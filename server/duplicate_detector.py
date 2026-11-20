import os
import sqlite3
import cv2
import numpy as np
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from tqdm import tqdm

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MEDIA_DIR = os.path.join(BASE_DIR, "media")
TRASH_DIR = os.path.join(MEDIA_DIR, "trash")
DATA_DIR = os.path.join(BASE_DIR, "data")
DB_PATH = os.path.join(DATA_DIR, "favorites.db")

SAMPLE_RATIOS = (0.10, 0.30, 0.50, 0.70, 0.90)
BLANK_STD_THRESHOLD = 4.0  # これ未満の標準偏差は単色（黒画面・白画面）フレームとみなす


def normalize_rel_path(video_path: str) -> str:
    """mediaディレクトリからの相対パスをスラッシュ区切りで正規化する"""
    rel = os.path.relpath(os.path.abspath(video_path), os.path.abspath(MEDIA_DIR))
    return rel.replace("\\", "/")


def init_duplicates_db(db_path: str = DB_PATH):
    """重複検出用のキャッシュテーブルを初期化する"""
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    with sqlite3.connect(db_path) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS video_hashes (
                rel_path TEXT PRIMARY KEY,
                filename TEXT NOT NULL,
                library TEXT NOT NULL,
                file_size INTEGER NOT NULL,
                mtime REAL NOT NULL,
                duration REAL NOT NULL,
                width INTEGER NOT NULL,
                height INTEGER NOT NULL,
                fps REAL NOT NULL,
                frame_hashes TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()


def compute_frame_dhash_128(frame: np.ndarray) -> str:
    """
    1フレームから128bit（横方向64bit + 縦方向64bit）のdHash（32文字の16進数）を計算する。
    真っ黒・真っ白などの単色フレームの場合は 'BLANK:<mean>' を返す。
    """
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    std_val = float(np.std(gray))
    if std_val < BLANK_STD_THRESHOLD:
        mean_bucket = int(round(float(np.mean(gray)) / 16.0))
        return f"BLANK:{mean_bucket}"

    # 横方向の勾配 (9x8 -> 8x8 = 64bit)
    resized_h = cv2.resize(gray, (9, 8), interpolation=cv2.INTER_AREA)
    diff_h = (resized_h[:, 1:] > resized_h[:, :-1]).flatten()

    # 縦方向の勾配 (8x9 -> 8x8 = 64bit)
    resized_v = cv2.resize(gray, (8, 9), interpolation=cv2.INTER_AREA)
    diff_v = (resized_v[1:, :] > resized_v[:-1, :]).flatten()

    bits_h = int("".join("1" if b else "0" for b in diff_h), 2)
    bits_v = int("".join("1" if b else "0" for b in diff_v), 2)
    return f"{bits_h:016x}{bits_v:016x}"


def extract_video_signature(video_path: str) -> dict | None:
    """
    動画ファイルからメタデータ（再生時間・解像度・FPS）と5フレームの知覚ハッシュを抽出する。
    """
    try:
        stat = os.stat(video_path)
    except OSError:
        return None

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return None

    try:
        fps = float(cap.get(cv2.CAP_PROP_FPS) or 0.0)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)

        if total_frames <= 0 or width <= 0 or height <= 0:
            return None

        duration = (total_frames / fps) if fps > 0 else 0.0

        hashes = []
        for ratio in SAMPLE_RATIOS:
            target_idx = max(0, min(total_frames - 1, int(total_frames * ratio)))
            cap.set(cv2.CAP_PROP_POS_FRAMES, target_idx)
            ret, frame = cap.read()
            if not ret or frame is None:
                # シーク失敗時は先頭フレームでフォールバック試行
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                ret, frame = cap.read()
                if not ret or frame is None:
                    return None
            hashes.append(compute_frame_dhash_128(frame))

        rel_path = normalize_rel_path(video_path)
        parts = rel_path.split("/")
        library = parts[0] if len(parts) > 1 else ""
        filename = parts[-1]

        return {
            "rel_path": rel_path,
            "filename": filename,
            "library": library,
            "file_size": stat.st_size,
            "mtime": stat.st_mtime,
            "duration": round(duration, 3),
            "width": width,
            "height": height,
            "fps": round(fps, 3),
            "frame_hashes": ";".join(hashes),
        }
    finally:
        cap.release()


def collect_video_files(target_dir: str = MEDIA_DIR) -> list[str]:
    """指定ディレクトリ配下のMP4ファイルを収集する（trashフォルダは除外）"""
    norm_trash = os.path.normcase(os.path.normpath(TRASH_DIR))
    video_files = []

    for root, dirs, files in os.walk(target_dir):
        norm_root = os.path.normcase(os.path.normpath(root))
        if norm_root == norm_trash or norm_root.startswith(norm_trash + os.sep):
            dirs[:] = []
            continue

        # サブディレクトリ走査から trash を除外
        dirs[:] = [
            d for d in dirs
            if os.path.normcase(os.path.join(norm_root, d)) != norm_trash
        ]

        for f in files:
            if f.lower().endswith(".mp4"):
                video_files.append(os.path.join(root, f))

    video_files.sort()
    return video_files


def get_cached_video_count(db_path: str = DB_PATH) -> int:
    """キャッシュ済みの動画件数を返す"""
    init_duplicates_db(db_path)
    with sqlite3.connect(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM video_hashes")
        row = cursor.fetchone()
        return row[0] if row else 0


def scan_and_cache_videos(
    target_dir: str = MEDIA_DIR,
    db_path: str = DB_PATH,
    force: bool = False,
    max_workers: int = 4,
    show_progress: bool = True,
    progress_callback=None,
) -> dict:
    """
    mediaディレクトリ内の動画を走査し、新規・更新された動画のハッシュをSQLiteにキャッシュする。
    削除された動画のキャッシュは自動的にクリーンアップする。
    """
    init_duplicates_db(db_path)
    video_files = collect_video_files(target_dir)

    with sqlite3.connect(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT rel_path, file_size, mtime FROM video_hashes")
        cached_map = {
            row[0]: (row[1], row[2]) for row in cursor.fetchall()
        }

    current_rel_paths = set()
    to_process = []
    skipped_count = 0

    for vpath in video_files:
        rel_path = normalize_rel_path(vpath)
        current_rel_paths.add(rel_path)
        try:
            stat = os.stat(vpath)
        except OSError:
            continue

        if not force and rel_path in cached_map:
            c_size, c_mtime = cached_map[rel_path]
            # ファイルサイズと更新時刻(秒精度)が一致していればキャッシュを利用
            if c_size == stat.st_size and abs(c_mtime - stat.st_mtime) < 1e-3:
                skipped_count += 1
                continue

        to_process.append(vpath)

    # スキャン範囲がMEDIA_DIR全体の場合のみ、存在しなくなったファイルのキャッシュを削除
    removed_count = 0
    if os.path.normcase(os.path.abspath(target_dir)) == os.path.normcase(os.path.abspath(MEDIA_DIR)):
        stale_paths = set(cached_map.keys()) - current_rel_paths
        if stale_paths:
            with sqlite3.connect(db_path) as conn:
                conn.executemany(
                    "DELETE FROM video_hashes WHERE rel_path = ?",
                    [(p,) for p in stale_paths],
                )
                conn.commit()
            removed_count = len(stale_paths)

    processed_count = 0
    error_count = 0
    batch_rows = []
    total_to_process = len(to_process)

    if progress_callback:
        progress_callback(0, total_to_process)

    if to_process:
        pbar = tqdm(
            total=total_to_process,
            desc="ハッシュ計算中",
            unit="video",
            disable=not show_progress,
            dynamic_ncols=True,
        )
        done_so_far = 0
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_to_path = {
                executor.submit(extract_video_signature, vp): vp for vp in to_process
            }
            for future in as_completed(future_to_path):
                try:
                    sig = future.result()
                    if sig is not None:
                        batch_rows.append((
                            sig["rel_path"],
                            sig["filename"],
                            sig["library"],
                            sig["file_size"],
                            sig["mtime"],
                            sig["duration"],
                            sig["width"],
                            sig["height"],
                            sig["fps"],
                            sig["frame_hashes"],
                        ))
                        processed_count += 1
                    else:
                        error_count += 1
                except Exception:
                    error_count += 1

                done_so_far += 1
                pbar.update(1)
                if progress_callback:
                    progress_callback(done_so_far, total_to_process)

                if len(batch_rows) >= 100:
                    _save_hash_batch(db_path, batch_rows)
                    batch_rows.clear()
        pbar.close()

    if batch_rows:
        _save_hash_batch(db_path, batch_rows)
        batch_rows.clear()

    return {
        "total_files": len(video_files),
        "processed": processed_count,
        "skipped_cached": skipped_count,
        "removed_stale": removed_count,
        "errors": error_count,
    }


def _save_hash_batch(db_path: str, rows: list[tuple]):
    with sqlite3.connect(db_path) as conn:
        conn.executemany("""
            INSERT OR REPLACE INTO video_hashes (
                rel_path, filename, library, file_size, mtime,
                duration, width, height, fps, frame_hashes, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        """, rows)
        conn.commit()


def _parse_hashes(frame_hashes_str: str) -> list[int | str]:
    """16進数ハッシュ文字列をint（またはBLANK文字列）のリストに変換して高速比較可能にする"""
    result = []
    for h in frame_hashes_str.split(";"):
        if h.startswith("BLANK:"):
            result.append(h)
        else:
            result.append(int(h, 16))
    return result


def compare_signatures(
    parsed_a: list[int | str],
    parsed_b: list[int | str],
    max_single_frame_dist: int = 18,
) -> float | None:
    """
    2つの動画の5フレームハッシュを比較し、類似度 (0.0〜1.0) を返す。
    別動画と判定した場合は None を返す。
    """
    if len(parsed_a) != len(parsed_b) or not parsed_a:
        return None

    total_distance = 0
    valid_frames = 0
    blank_matches = 0

    for ha, hb in zip(parsed_a, parsed_b):
        is_blank_a = isinstance(ha, str)
        is_blank_b = isinstance(hb, str)

        if is_blank_a and is_blank_b:
            if ha == hb:
                blank_matches += 1
                continue
            else:
                return None
        elif is_blank_a or is_blank_b:
            # 片方だけが単色フレームの場合は不一致
            return None
        else:
            dist = (ha ^ hb).bit_count()
            if dist > max_single_frame_dist:
                return None
            total_distance += dist
            valid_frames += 1

    # 非単色フレームが1枚もない（全フレーム真っ黒など）の場合は誤検出防止のため除外
    if valid_frames == 0:
        return None

    similarity = 1.0 - (total_distance / (128.0 * valid_frames))
    return similarity


def read_nfo_tags(video_full_path: str) -> list[str]:
    """動画に対応する .nfo ファイルからタグ一覧を読み取る"""
    nfo_path = os.path.splitext(video_full_path)[0] + ".nfo"
    if not os.path.exists(nfo_path):
        return []
    try:
        tree = ET.parse(nfo_path)
        root = tree.getroot()
        tags = []
        for elem in root.findall("tag"):
            if elem.text and elem.text.strip():
                tags.append(elem.text.strip())
        return tags
    except Exception:
        return []


def merge_nfo_tags(tags_to_add: list[str], target_video_full_path: str) -> int:
    """
    指定したタグ一覧を target_video_full_path に対応する .nfo ファイルにマージ（追記）する。
    新規追加されたタグの個数を返す。
    """
    if not tags_to_add:
        return 0

    target_nfo_path = os.path.splitext(target_video_full_path)[0] + ".nfo"
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
        if tag_elem.text and tag_elem.text.strip():
            existing_tags.add(tag_elem.text.strip())

    added_count = 0
    for tag in tags_to_add:
        clean_tag = tag.strip()
        if clean_tag and clean_tag not in existing_tags:
            tag_elem = ET.SubElement(root, "tag")
            tag_elem.text = clean_tag
            existing_tags.add(clean_tag)
            added_count += 1

    if added_count > 0:
        if hasattr(ET, "indent"):
            ET.indent(tree, space="  ", level=0)
        tree.write(target_nfo_path, encoding="utf-8", xml_declaration=True)

    return added_count


def remove_cached_video_hash(rel_path: str, db_path: str = DB_PATH):
    """ゴミ箱へ移動した動画のキャッシュレコードを video_hashes から削除する"""
    norm_rel = rel_path.replace("\\", "/")
    with sqlite3.connect(db_path) as conn:
        conn.execute("DELETE FROM video_hashes WHERE rel_path = ?", (norm_rel,))
        conn.commit()


def find_duplicate_groups(
    db_path: str = DB_PATH,
    similarity_threshold: float = 0.92,
    max_duration_diff: float = 0.6,
    target_library: str | None = None,
) -> list[dict]:
    """
    キャッシュされたハッシュから重複動画グループを検出して返す。
    """
    init_duplicates_db(db_path)

    with sqlite3.connect(db_path) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        cursor.execute("SELECT * FROM video_hashes ORDER BY duration ASC, rel_path ASC")
        rows = [dict(r) for r in cursor.fetchall()]

        cursor.execute("SELECT filename FROM favorites")
        favorite_filenames = {r[0] for r in cursor.fetchall()}

    # 実ファイルが存在するもののみ対象にする
    valid_items = []
    for r in rows:
        full_path = os.path.join(MEDIA_DIR, r["rel_path"].replace("/", os.sep))
        if not os.path.exists(full_path):
            continue
        r["full_path"] = full_path
        r["parsed_hashes"] = _parse_hashes(r["frame_hashes"])
        r["aspect"] = (r["width"] / r["height"]) if r["height"] > 0 else 1.0
        valid_items.append(r)

    n = len(valid_items)
    if n < 2:
        return []

    # Union-Find で重複グループを構築
    parent = list(range(n))
    pair_similarities = {}

    def find(x: int) -> int:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(x: int, y: int):
        rx, ry = find(x), find(y)
        if rx != ry:
            parent[ry] = rx

    # duration でソート済みなので、再生時間が近い範囲だけをスライディングウィンドウ比較
    for i in range(n):
        item_a = valid_items[i]
        dur_a = item_a["duration"]

        for j in range(i + 1, n):
            item_b = valid_items[j]
            dur_b = item_b["duration"]

            # 再生時間の差が閾値を超えたら以降の j はすべて範囲外なので break
            allowed_diff = max(max_duration_diff, min(dur_a, dur_b) * 0.02)
            if (dur_b - dur_a) > allowed_diff:
                break

            # アスペクト比が大きく異なる場合はスキップ
            if abs(item_a["aspect"] - item_b["aspect"]) > 0.08:
                continue

            # フレームハッシュ比較
            sim = compare_signatures(item_a["parsed_hashes"], item_b["parsed_hashes"])
            if sim is not None and sim >= similarity_threshold:
                union(i, j)
                pair_similarities[(min(i, j), max(i, j))] = sim

    # グループごとに集約
    groups_map: dict[int, list[int]] = {}
    for idx in range(n):
        root = find(idx)
        groups_map.setdefault(root, []).append(idx)

    duplicate_groups = []
    for indices in groups_map.values():
        if len(indices) < 2:
            continue

        # target_library が指定されている場合、グループ内にそのライブラリの動画が1つでも含まれるもののみ抽出
        if target_library:
            if not any(valid_items[idx]["library"] == target_library for idx in indices):
                continue

        # グループ内の最小・平均類似度を算出
        sims = []
        for a_idx in range(len(indices)):
            for b_idx in range(a_idx + 1, len(indices)):
                u, v = min(indices[a_idx], indices[b_idx]), max(indices[a_idx], indices[b_idx])
                if (u, v) in pair_similarities:
                    sims.append(pair_similarities[(u, v)])
        group_similarity = round(min(sims) * 100, 1) if sims else 100.0

        videos_info = []
        for idx in indices:
            item = valid_items[idx]
            tags = read_nfo_tags(item["full_path"])
            is_fav = item["filename"] in favorite_filenames
            videos_info.append({
                "rel_path": item["rel_path"],
                "full_path": item["full_path"],
                "filename": item["filename"],
                "library": item["library"],
                "file_size": item["file_size"],
                "mtime": item["mtime"],
                "duration": item["duration"],
                "width": item["width"],
                "height": item["height"],
                "fps": item["fps"],
                "is_favorite": is_fav,
                "tags": tags,
                "tag_count": len(tags),
            })

        # 解像度(画素数)が高い順 → ファイルサイズが大きい順 → お気に入り優先 → タグ数順でソート
        videos_info.sort(
            key=lambda v: (
                v["width"] * v["height"],
                v["file_size"],
                v["is_favorite"],
                v["tag_count"],
            ),
            reverse=True,
        )

        group_id = "||".join(sorted(v["rel_path"] for v in videos_info))
        duplicate_groups.append({
            "group_id": group_id,
            "similarity": group_similarity,
            "duration": videos_info[0]["duration"],
            "video_count": len(videos_info),
            "videos": videos_info,
        })

    # 一致度が高い順、次にファイルサイズ合計が大きい順にソート
    duplicate_groups.sort(
        key=lambda g: (g["similarity"], sum(v["file_size"] for v in g["videos"])),
        reverse=True,
    )
    return duplicate_groups
