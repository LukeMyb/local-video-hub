import os
import sys
import argparse
import time

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from server.duplicate_detector import (
    MEDIA_DIR,
    scan_and_cache_videos,
    find_duplicate_groups,
)


def format_size(size_bytes: int) -> str:
    return f"{size_bytes / (1024 * 1024):.2f} MB"


def format_duration(seconds: float) -> str:
    m, s = divmod(int(round(seconds)), 60)
    return f"{m}:{s:02d} ({seconds:.1f}s)"


def main():
    parser = argparse.ArgumentParser(description="重複動画スキャン＆検出テストツール (Step 1)")
    parser.add_argument(
        "target_path",
        nargs="?",
        default=MEDIA_DIR,
        help="スキャン対象のディレクトリパス（省略時は media 全体）",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="キャッシュを無視して全動画のハッシュを再計算する",
    )
    parser.add_argument(
        "--threshold",
        type=float,
        default=0.92,
        help="重複判定の類似度閾値 (0.0〜1.0, デフォルト: 0.92)",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=4,
        help="ハッシュ計算の並列スレッド数 (デフォルト: 4)",
    )
    args = parser.parse_args()

    target_dir = os.path.abspath(args.target_path)
    if not os.path.exists(target_dir):
        print(f"エラー: 指定されたパスが存在しません: {target_dir}")
        sys.exit(1)

    # 特定のライブラリフォルダのみ指定されたかどうかを判定
    target_library = None
    if os.path.normcase(target_dir) != os.path.normcase(os.path.abspath(MEDIA_DIR)):
        rel = os.path.relpath(target_dir, MEDIA_DIR).replace("\\", "/")
        if "/" not in rel and rel != ".":
            target_library = rel

    print("==================================================")
    print(f" スキャン対象: {target_dir}")
    print(f" 類似度閾値  : {args.threshold * 100:.1f}%")
    print("==================================================")

    t0 = time.time()
    stats = scan_and_cache_videos(
        target_dir=target_dir,
        force=args.force,
        max_workers=args.workers,
        show_progress=True,
    )
    elapsed_scan = time.time() - t0

    print("\n--- スキャン（キャッシュ更新）結果 ---")
    print(f"対象ファイル総数  : {stats['total_files']} 件")
    print(f"新規ハッシュ計算  : {stats['processed']} 件")
    print(f"キャッシュ利用済  : {stats['skipped_cached']} 件")
    if stats["removed_stale"] > 0:
        print(f"削除済キャッシュ整理: {stats['removed_stale']} 件")
    if stats["errors"] > 0:
        print(f"読み込みエラー    : {stats['errors']} 件")
    print(f"スキャン所要時間  : {elapsed_scan:.2f} 秒")

    t1 = time.time()
    groups = find_duplicate_groups(
        similarity_threshold=args.threshold,
        target_library=target_library,
    )
    elapsed_cmp = time.time() - t1

    print("\n==================================================")
    print(f" 重複検出結果: {len(groups)} グループ見つかりました (比較時間: {elapsed_cmp:.2f} 秒)")
    print("==================================================")

    for idx, g in enumerate(groups, start=1):
        print(
            f"\n[グループ #{idx}] 一致度: {g['similarity']:.1f}% | "
            f"再生時間: {format_duration(g['duration'])} | {g['video_count']}本"
        )
        for v in g["videos"]:
            fav_mark = "❤️" if v["is_favorite"] else "  "
            print(
                f"  {fav_mark} [{v['library']}] {v['filename']} "
                f"| {v['width']}x{v['height']} | {format_size(v['file_size'])} "
                f"| タグ:{v['tag_count']}個"
            )


if __name__ == "__main__":
    main()
