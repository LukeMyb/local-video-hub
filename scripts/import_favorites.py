import os
import sqlite3
import urllib.parse
import urllib.request
import json
from dotenv import load_dotenv

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
CLIENT_ENV_PATH = os.path.join(BASE_DIR, "client", ".env")
ROOT_ENV_PATH = os.path.join(BASE_DIR, ".env")

# 環境変数の読み込み (client/.env と .env)
if os.path.exists(CLIENT_ENV_PATH):
    load_dotenv(CLIENT_ENV_PATH)
if os.path.exists(ROOT_ENV_PATH):
    load_dotenv(ROOT_ENV_PATH)

JELLYFIN_URL = os.getenv("VITE_JELLYFIN_URL")
JELLYFIN_API_KEY = os.getenv("VITE_JELLYFIN_API_KEY")
JELLYFIN_USER_ID = os.getenv("VITE_JELLYFIN_USER_ID")

DATA_DIR = os.path.join(BASE_DIR, "data")
DB_PATH = os.path.join(DATA_DIR, "favorites.db")


def init_db():
    os.makedirs(DATA_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS favorites (
            filename TEXT PRIMARY KEY,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    return conn


def fetch_jellyfin_favorites():
    if not JELLYFIN_URL or not JELLYFIN_API_KEY or not JELLYFIN_USER_ID:
        raise ValueError(
            "Jellyfinの接続情報が見つかりません。client/.env に VITE_JELLYFIN_URL, VITE_JELLYFIN_API_KEY, VITE_JELLYFIN_USER_ID が設定されているか確認してください。"
        )

    params = urllib.parse.urlencode({
        "api_key": JELLYFIN_API_KEY,
        "userId": JELLYFIN_USER_ID,
        "IncludeItemTypes": "Movie,Episode,Video",
        "Recursive": "true",
        "IsFavorite": "true",
        "Fields": "Path",
    })
    url = f"{JELLYFIN_URL.rstrip('/')}/Items?{params}"

    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req) as res:
        data = json.loads(res.read().decode("utf-8"))
        return data.get("Items", [])


def main():
    print("Jellyfinからお気に入りデータを取得しています...")
    try:
        items = fetch_jellyfin_favorites()
    except Exception as e:
        print(f"エラー: Jellyfinからのデータ取得に失敗しました: {e}")
        return

    favorite_items = [
        item for item in items
        if item.get("UserData", {}).get("IsFavorite", True) and item.get("Path")
    ]

    print(f"Jellyfin上で {len(favorite_items)} 件のお気に入り動画が見つかりました。")

    conn = init_db()
    cursor = conn.cursor()

    added_count = 0
    skipped_count = 0

    for item in favorite_items:
        raw_path = item["Path"]
        filename = os.path.basename(raw_path.replace("\\", "/"))
        if not filename:
            continue

        cursor.execute(
            "INSERT OR IGNORE INTO favorites (filename) VALUES (?)",
            (filename,)
        )
        if cursor.rowcount > 0:
            added_count += 1
        else:
            skipped_count += 1

    conn.commit()

    cursor.execute("SELECT COUNT(*) FROM favorites")
    total_in_db = cursor.fetchone()[0]
    conn.close()

    print("\n--- インポート完了 ---")
    print(f"新規追加        : {added_count} 件")
    print(f"スキップ(登録済): {skipped_count} 件")
    print(f"DB内お気に入り総数: {total_in_db} 件")
    print(f"保存先DB        : {DB_PATH}")


if __name__ == "__main__":
    main()
