import os
import cv2
import numpy as np
import pandas as pd
import gc
import shutil
from huggingface_hub import hf_hub_download
import onnxruntime as ort
import xml.etree.ElementTree as ET
import glob
import argparse
from tqdm import tqdm

class VideoTagger:
    def __init__(self, 
                 conv_model_name="wd-v1-4-convnext-tagger-v2", 
                 moat_model_name="wd-v1-4-moat-tagger-v2",     
                 general_threshold=0.35, 
                 character_threshold=0.75): 
        
        self.general_threshold = general_threshold
        self.character_threshold = character_threshold
        self.conv_model_name = conv_model_name
        self.moat_model_name = moat_model_name
        
        self.ignore_tags = {
            "explicit", "questionable", "safe", "sensitive", "general",
            "rating:explicit", "rating:questionable", "rating:safe", 
            "rating:sensitive", "rating:general",
            "text", "signature", "watermark", "username", "artist name", 
            "date", "translated", "copyright name", "source", "commentary request",
            "simple background", "white background", "transparent background",
            "black background", "grey background", "gradient background",
            "pattern background", "abstract background", 
            "indoors", "outdoors",
            "blue_skin", "purple_skin", "green_skin", "red_skin", "grey_skin"
        }

    def _load_model(self, model_name):
        repo_id = f"SmilingWolf/{model_name}"

        model_path = hf_hub_download(repo_id, "model.onnx")
        csv_path = hf_hub_download(repo_id, "selected_tags.csv")

        self.tags_df = pd.read_csv(csv_path)
        self.tag_names = self.tags_df["name"].tolist()
        self.tag_categories = self.tags_df["category"].tolist()
        
        self.session = ort.InferenceSession(model_path, providers=['DmlExecutionProvider', 'CPUExecutionProvider'])
        self.input_name = self.session.get_inputs()[0].name

    def _unload_model(self):
        self.session = None
        gc.collect()

    # OpenCVで読み込んだ画像(numpy配列)を直接受け取る
    def preprocess_image(self, img):
        if img is None: return None
        
        size = 448
        h, w, _ = img.shape
        max_dim = max(h, w)
        pad_img = np.zeros((max_dim, max_dim, 3), dtype=np.uint8) + 255
        
        offset_w = (max_dim - w) // 2
        offset_h = (max_dim - h) // 2
        pad_img[offset_h:offset_h+h, offset_w:offset_w+w] = img
        
        img = cv2.resize(pad_img, (size, size), interpolation=cv2.INTER_CUBIC)
        img = img.astype(np.float32)
        img = np.expand_dims(img, 0)
        return img

    # 動画から等間隔で複数枚のフレームを抽出する
    def extract_frames(self, video_path, num_frames=5):
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            return None
        
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        frames = []
        
        # 動画を (num_frames + 1) 分割し、均等な間隔で抽出
        for i in range(1, num_frames + 1):
            target_frame = int(total_frames * (i / (num_frames + 1)))
            cap.set(cv2.CAP_PROP_POS_FRAMES, target_frame)
            ret, frame = cap.read()
            if ret:
                frames.append(frame)
                
        cap.release()
        return frames if frames else None

    # 既存のNFOファイルにタグが含まれているかチェックする関数
    def _has_existing_tags(self, video_path):
        target_nfo_path = os.path.splitext(video_path)[0] + ".nfo"
        
        if not os.path.exists(target_nfo_path):
            return False
            
        try:
            tree = ET.parse(target_nfo_path)
            root = tree.getroot()
            
            # <tag> 要素が1つでも存在し、かつテキストが含まれていればTrueを返す
            for tag_elem in root.findall("tag"):
                if tag_elem.text and tag_elem.text.strip():
                    return True
                    
            return False
        except ET.ParseError:
            # XMLが破損している場合はタグ無しとみなして処理を続行（上書きを試みる）
            return False
    
    # 抽出したタグをNFOファイルに追記
    def edit_nfo(self, video_path, tags):
        # 動画と同じ階層のNFOパスを指定
        target_nfo_path = os.path.splitext(video_path)[0] + ".nfo"
        backup_nfo_path = target_nfo_path + ".bak" # バックアップ用のパス

        # 既存NFOを上書きする前に .bak としてバックアップを作成
        if os.path.exists(target_nfo_path):
            shutil.copy2(target_nfo_path, backup_nfo_path)
        
        if os.path.exists(target_nfo_path):
            try:
                tree = ET.parse(target_nfo_path)
                root = tree.getroot()
            except ET.ParseError:
                root = ET.Element("movie")
                tree = ET.ElementTree(root)
        else:
            root = ET.Element("movie")
            tree = ET.ElementTree(root)

        existing_tags = set()
        for tag_elem in root.findall("tag"):
            if tag_elem.text:
                existing_tags.add(tag_elem.text)

        added_count = 0
        for tag in tags:
            if tag not in existing_tags:
                tag_elem = ET.SubElement(root, "tag")
                tag_elem.text = tag
                added_count += 1

        if hasattr(ET, "indent"):
            ET.indent(tree, space="  ", level=0)

        tree.write(target_nfo_path, encoding="utf-8", xml_declaration=True)

        return added_count

    def process_video(self, video_path, num_frames=5, min_hits=1):
        # すでにタグが存在する場合は、重い推論処理をスキップする
        if self._has_existing_tags(video_path):
            return "skipped"

        frames = self.extract_frames(video_path, num_frames=num_frames)
        if not frames:
            from tqdm import tqdm
            tqdm.write(f"エラー: {os.path.basename(video_path)} の読み込み、またはフレーム抽出に失敗しました。")
            return "error"

        input_tensors = [self.preprocess_image(f) for f in frames]

        # モデルのロード
        self._load_model(self.conv_model_name)
        conv_probs_list = []
        for tensor in input_tensors:
            conv_probs_list.append(self.session.run(None, {self.input_name: tensor})[0][0])
        self._unload_model()

        self._load_model(self.moat_model_name)
        moat_probs_list = []
        for tensor in input_tensors:
            moat_probs_list.append(self.session.run(None, {self.input_name: tensor})[0][0])
        self._unload_model()

        # 実際に抽出・推論できたフレーム数を取得
        actual_frames = len(conv_probs_list)

        # タグの集計とフレームごとのTXT出力
        tag_counts = {}
        for i in range(actual_frames):
            for tag_idx in range(len(self.tag_names)):
                tag_name = self.tag_names[tag_idx]
                if tag_name in self.ignore_tags: continue

                c_prob = float(conv_probs_list[i][tag_idx])
                m_prob = float(moat_probs_list[i][tag_idx])
                combined_prob = max(c_prob, m_prob)

                category = self.tag_categories[tag_idx]
                threshold = self.character_threshold if category == 4 else self.general_threshold

                if combined_prob > threshold:
                    clean_tag = tag_name.replace("_", " ")
                    tag_counts[clean_tag] = tag_counts.get(clean_tag, 0) + 1

        # 閾値(min_hits)以上のタグを採用
        found_tags = [tag for tag, count in tag_counts.items() if count >= min_hits]
                
        added_count = self.edit_nfo(video_path, found_tags)

        return f"added {added_count}"

if __name__ == "__main__":
    # コマンドライン引数によるパス指定
    parser = argparse.ArgumentParser(description="Jellyfin用 AI動画タガー")
    parser.add_argument("target_path", type=str, help="処理対象の動画ファイル、または動画が含まれるディレクトリのパス")
    parser.add_argument("--force", action="store_true", help="既存のNFOファイルがあっても強制的に再処理を行う")
    args = parser.parse_args()
    
    target = os.path.abspath(args.target_path)
    video_files = []
    
    # 指定されたパスがファイルかディレクトリか判定し、動画リストを取得
    if os.path.isfile(target):
        if target.lower().endswith('.mp4'):
            video_files.append(target)
        else:
            print("エラー: 指定されたファイルはMP4ファイルではありません。")
    elif os.path.isdir(target):
        # ディレクトリ内の全てのmp4を再帰的に検索
        search_pattern = os.path.join(target, "**", "*.mp4")
        video_files = glob.glob(search_pattern, recursive=True)
    else:
        print(f"エラー: 指定されたパスが存在しません: {target}")

    if not video_files:
        print("処理対象の動画が見つかりませんでした。")
    else:
        # \tqdm を使ったプログレス表示
        total_files = len(video_files)
        print(f"合計 {total_files} 件の動画をスキャンします...")
        
        tagger = VideoTagger()
        skipped_count = 0
        processed_count = 0
        error_count = 0

        # tqdmを使ってループを回す
        with tqdm(total=total_files, desc="動画処理中", unit="file", dynamic_ncols=True) as pbar:
            for video_path in video_files:
                # 現在処理しているファイル名をプログレスバーの右側に表示
                pbar.set_postfix(file=os.path.basename(video_path)[:30]) # 長い場合は30文字でカット
                
                result = tagger.process_video(video_path, num_frames=5, min_hits=1)
                
                if result == "skipped":
                    skipped_count += 1
                elif result == "error":
                    error_count += 1
                else:
                    processed_count += 1
                
                pbar.update(1) # プログレスバーを1進める

        # 最終結果の表示
        print("\n--- 処理完了 ---")
        print(f"新しくタグ付けした動画: {processed_count} 件")
        print(f"スキップした動画(処理済): {skipped_count} 件")
        print(f"エラーが発生した動画    : {error_count} 件")