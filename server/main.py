import os
import logging
from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import yt_dlp
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Local Video Hub API")

# CORS設定（フロントエンドからのアクセスを許可）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 開発用。必要に応じてフロントエンドのURLに絞る
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# プロジェクト直下のパスを取得
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

# ログディレクトリの作成とロガーの設定
LOGS_DIR = os.path.join(os.path.dirname(__file__), "logs")
os.makedirs(LOGS_DIR, exist_ok=True)

logger = logging.getLogger("download_logger")
logger.setLevel(logging.INFO)

# ログのフォーマット定義（タイムスタンプ付き）
formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')

# ファイルへの出力ハンドラ
file_handler = logging.FileHandler(os.path.join(LOGS_DIR, "download.log"), encoding="utf-8")
file_handler.setFormatter(formatter)
logger.addHandler(file_handler)

# コンソールへの出力ハンドラ
console_handler = logging.StreamHandler()
console_handler.setFormatter(formatter)
logger.addHandler(console_handler)

# ダウンロード先のフォルダ
INBOX_DIR = os.path.join(BASE_DIR, "downloads", "inbox")
os.makedirs(INBOX_DIR, exist_ok=True)

# クッキーとffmpegのパス
COOKIE_FILE = os.path.join(BASE_DIR, "config", "x.com_cookies.txt")
BIN_DIR = os.path.join(BASE_DIR, "bin")

# 環境変数からAPIキーを取得
SECRET_API_KEY = os.getenv("API_KEY")

class VideoRequest(BaseModel):
    url: str
    api_key: str

def download_with_ytdlp(url: str):
    logger.info(f"[{url}] ダウンロードを開始します...")
    
    # オプションを設定
    ydl_opts = {
        # 出力ファイル名: IDのみ
        'outtmpl': os.path.join(INBOX_DIR, '%(id)s.%(ext)s'),
        
        # フォーマット指定とmp4マージ
        'format': 'bv+ba/b',
        'merge_output_format': 'mp4',
        
        # FFmpegでの音声AACエンコード
        'postprocessor_args': ['-c:a', 'aac'],
        
        # クッキーファイルの指定
        'cookiefile': COOKIE_FILE,
        'ffmpeg_location': BIN_DIR,

        'noplaylist': True,
        'ignoreerrors': True,
        'quiet': False,
    }
    
    # クッキーファイルが存在しない場合の警告
    if not os.path.exists(COOKIE_FILE):
        logger.warning(f"[{url}] クッキーファイルが見つかりません: {COOKIE_FILE}")
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])
        logger.info(f"[{url}] ダウンロードが完了しました！")
    except Exception as e:
        logger.error(f"[{url}] エラーが発生しました: {e}")

@app.post("/download")
async def download_video(request: VideoRequest, background_tasks: BackgroundTasks):
    # APIキーの検証 (未設定、または不一致の場合は401エラー)
    if not SECRET_API_KEY or request.api_key != SECRET_API_KEY:
        # APIキーエラーも追跡できるようにログを残す
        logger.warning(f"不正なAPIキーでのアクセスを拒否しました: URL={request.url}")
        raise HTTPException(status_code=401, detail="APIキーが間違っています")

    logger.info(f"URLを受け取りました: {request.url}")
    
    # ダウンロード処理をバックグラウンドタスクとして登録
    background_tasks.add_task(download_with_ytdlp, request.url)
    
    # クライアントには即座に返事をする
    return {
        "status": "success", 
        "message": "ダウンロードをバックグラウンドで開始しました", 
        "url": request.url,
        "save_dir": INBOX_DIR
    }

MEDIA_DIR = os.path.join(BASE_DIR, "media")
TRASH_DIR = os.path.join(MEDIA_DIR, "trash")

class TrashRestoreRequest(BaseModel):
    video_path: str
    api_key: str

import shutil
from pathlib import Path

def get_related_files(video_path: str):
    """Find related files like .nfo, .jpg, .srt that share the same base name."""
    video_path_obj = Path(video_path)
    if not video_path_obj.exists():
        return []
    
    parent_dir = video_path_obj.parent
    base_name = video_path_obj.stem
    
    related_files = []
    for f in parent_dir.iterdir():
        if f.is_file():
            # base_name と一致するファイル群 (拡張子違い、または -xxx のサフィックス)
            if f.name.startswith(base_name + ".") or f.name.startswith(base_name + "-"):
                related_files.append(f)
    
    return related_files

@app.post("/api/videos/trash")
async def trash_video(request: TrashRestoreRequest):
    if not SECRET_API_KEY or request.api_key != SECRET_API_KEY:
        raise HTTPException(status_code=401, detail="APIキーが間違っています")

    video_path = os.path.normpath(request.video_path)
    
    # 存在確認
    if not os.path.exists(video_path):
        raise HTTPException(status_code=404, detail="ファイルが見つかりません")
        
    # パスがmediaディレクトリ以下か確認
    if not video_path.startswith(os.path.normpath(MEDIA_DIR)):
        raise HTTPException(status_code=400, detail="対象ファイルがメディアディレクトリ外です")
        
    # 既にtrash以下にいるか確認
    if video_path.startswith(os.path.normpath(TRASH_DIR)):
        raise HTTPException(status_code=400, detail="既にゴミ箱に移動されています")

    # mediaディレクトリからの相対パスを取得
    rel_path = os.path.relpath(video_path, MEDIA_DIR)
    
    # 移動先パス
    target_path = os.path.join(TRASH_DIR, rel_path)
    target_dir = os.path.dirname(target_path)
    
    # ゴミ箱内にディレクトリを作成
    os.makedirs(target_dir, exist_ok=True)
    
    # 関連ファイルを探して移動
    related_files = get_related_files(video_path)
    for f in related_files:
        src_file = str(f)
        dst_file = os.path.join(target_dir, f.name)
        shutil.move(src_file, dst_file)
        logger.info(f"Moved to trash: {src_file} -> {dst_file}")
        
    return {"status": "success", "message": "ファイルをゴミ箱に移動しました", "target": target_path}

@app.post("/api/videos/restore")
async def restore_video(request: TrashRestoreRequest):
    if not SECRET_API_KEY or request.api_key != SECRET_API_KEY:
        raise HTTPException(status_code=401, detail="APIキーが間違っています")

    video_path = os.path.normpath(request.video_path)
    
    # 存在確認
    if not os.path.exists(video_path):
        raise HTTPException(status_code=404, detail="ファイルが見つかりません")
        
    # パスがtrashディレクトリ以下か確認
    if not video_path.startswith(os.path.normpath(TRASH_DIR)):
        raise HTTPException(status_code=400, detail="対象ファイルはゴミ箱にありません")

    # trashディレクトリからの相対パスを取得
    rel_path = os.path.relpath(video_path, TRASH_DIR)
    
    # 移動先パス (元のmedia以下)
    target_path = os.path.join(MEDIA_DIR, rel_path)
    target_dir = os.path.dirname(target_path)
    
    # 元のディレクトリを作成
    os.makedirs(target_dir, exist_ok=True)
    
    # 関連ファイルを探して移動
    related_files = get_related_files(video_path)
    for f in related_files:
        src_file = str(f)
        dst_file = os.path.join(target_dir, f.name)
        shutil.move(src_file, dst_file)
        logger.info(f"Restored from trash: {src_file} -> {dst_file}")
        
    return {"status": "success", "message": "ファイルを元の場所に復元しました", "target": target_path}