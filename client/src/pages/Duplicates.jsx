import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowUp,
  RefreshCw,
  Play,
  Pause,
  Heart,
  Tag,
  Folder,
  Maximize2,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  getDuplicates,
  scanDuplicates,
  getBackendVideoStreamUrl,
  resolveDuplicate,
} from '../api/backend';
import {
  getVideos,
  getLibraries,
  getImageUrl,
  getVideoStreamUrl,
  refreshLibrary,
} from '../api/jellyfin';
import { InfoModal } from '../components/player/InfoModal';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { formatTime } from '../utils/formatters';

function formatFileSize(bytes) {
  if (!bytes && bytes !== 0) return '-';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(2)} MB`;
}

function DuplicateGroupCard({
  group,
  groupIndex,
  jellyfinMap,
  resolvingRelPath,
  savedVolume,
  savedIsMuted,
  onOpenTags,
  onOpenFullPlayer,
  onResolveVideo,
}) {
  const [activePlayers, setActivePlayers] = useState({});
  const [isGroupPlaying, setIsGroupPlaying] = useState(false);
  const videoRefs = useRef({});

  const applySavedVolume = useCallback(
    (el) => {
      if (!el) return;
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const effectiveVol = isMobile
        ? 1
        : savedIsMuted
          ? 0
          : Math.min(Math.max(Number(savedVolume) || 0, 0), 100) / 100;
      el.volume = effectiveVol;
      el.muted = isMobile ? false : !!savedIsMuted;
    },
    [savedVolume, savedIsMuted]
  );

  // グループ内での最大解像度・最大ファイルサイズを計算（優れている方をハイライトするため）
  const { maxPixels, minPixels, maxSize, minSize } = useMemo(() => {
    const pixelsList = group.videos.map((v) => (v.width || 0) * (v.height || 0));
    const sizeList = group.videos.map((v) => v.file_size || 0);
    return {
      maxPixels: Math.max(...pixelsList),
      minPixels: Math.min(...pixelsList),
      maxSize: Math.max(...sizeList),
      minSize: Math.min(...sizeList),
    };
  }, [group.videos]);

  const handleToggleSimultaneousPlay = () => {
    const allRelPaths = group.videos.map((v) => v.rel_path);
    const allMounted = allRelPaths.every((p) => activePlayers[p]);

    if (!allMounted) {
      // 全動画のインラインプレイヤーを起動して自動再生
      const next = {};
      allRelPaths.forEach((p) => {
        next[p] = true;
      });
      setActivePlayers(next);
      setIsGroupPlaying(true);
      setTimeout(() => {
        allRelPaths.forEach((p) => {
          const el = videoRefs.current[p];
          if (el) {
            el.play().catch(() => {});
          }
        });
      }, 80);
      return;
    }

    // 既にマウント済みの場合は一括再生 / 一括一時停止を切り替え
    if (isGroupPlaying) {
      allRelPaths.forEach((p) => {
        const el = videoRefs.current[p];
        if (el) el.pause();
      });
      setIsGroupPlaying(false);
    } else {
      allRelPaths.forEach((p) => {
        const el = videoRefs.current[p];
        if (el) el.play().catch(() => {});
      });
      setIsGroupPlaying(true);
    }
  };

  const handleEnableSinglePlayer = (relPath) => {
    setActivePlayers((prev) => ({ ...prev, [relPath]: true }));
  };

  const releaseGroupPlayers = useCallback(() => {
    Object.values(videoRefs.current).forEach((el) => {
      if (el) {
        try {
          el.pause();
          el.removeAttribute('src');
          el.load();
        } catch {
          // ignore
        }
      }
    });
    videoRefs.current = {};
    setActivePlayers({});
    setIsGroupPlaying(false);
  }, []);

  return (
    <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl overflow-hidden shadow-lg">
      {/* グループヘッダー */}
      <div className="px-3 py-2.5 md:px-4 md:py-3 bg-zinc-800/60 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs md:text-sm font-bold text-zinc-100">
            グループ #{groupIndex + 1}
          </span>
          <span
            className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
              group.similarity >= 99.5
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
            }`}
          >
            一致度 {group.similarity.toFixed(1)}%
          </span>
          <span className="text-xs text-zinc-400">
            再生時間 {formatTime(group.duration)}
          </span>
          {group.video_count > 2 && (
            <span className="px-2 py-0.5 text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full">
              {group.video_count}本重複
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleToggleSimultaneousPlay}
            className="px-2.5 py-1 text-xs font-medium bg-zinc-700 hover:bg-zinc-600 text-zinc-100 rounded-md transition-colors flex items-center gap-1.5"
          >
            {isGroupPlaying ? <Pause size={13} /> : <Play size={13} />}
            <span>{isGroupPlaying ? '一括停止' : '同時再生'}</span>
          </button>
        </div>
      </div>

      {/* スマホでもPCでも横並び2列（grid-cols-2）で見比べられるカードグリッド */}
      <div className="p-2.5 md:p-4 grid grid-cols-2 gap-2.5 md:gap-4">
        {group.videos.map((video) => {
          const jfItem =
            jellyfinMap.byRelPath.get(video.rel_path.toLowerCase()) ||
            jellyfinMap.byFileName.get(video.filename.toLowerCase());
          const thumbUrl = jfItem ? getImageUrl(jfItem) : null;
          const streamUrl = jfItem
            ? getVideoStreamUrl(jfItem.Id)
            : getBackendVideoStreamUrl(video.rel_path);

          const pixels = (video.width || 0) * (video.height || 0);
          const isHigherRes = pixels > 0 && pixels === maxPixels && maxPixels > minPixels;
          const isLargerSize =
            video.file_size > 0 &&
            video.file_size === maxSize &&
            maxSize - minSize > 100 * 1024; // 100KB以上の差がある場合のみハイライト
          const isPlayerActive = !!activePlayers[video.rel_path];

          return (
            <div
              key={video.rel_path}
              className="flex flex-col bg-[#202023] border border-zinc-800 rounded-lg overflow-hidden"
            >
              {/* プレビュー / インライン動画再生枠 */}
              <div className="relative w-full aspect-2/3 max-h-64 md:max-h-80 bg-black flex items-center justify-center overflow-hidden">
                {isPlayerActive ? (
                  <video
                    ref={(el) => {
                      if (el) {
                        videoRefs.current[video.rel_path] = el;
                        applySavedVolume(el);
                      }
                    }}
                    onLoadedMetadata={(e) => applySavedVolume(e.currentTarget)}
                    src={streamUrl}
                    poster={thumbUrl || undefined}
                    controls
                    playsInline
                    autoPlay
                    className="w-full h-full object-contain bg-black"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => handleEnableSinglePlayer(video.rel_path)}
                    className="relative w-full h-full group cursor-pointer flex items-center justify-center"
                    title="タップしてこの場で再生"
                  >
                    {thumbUrl ? (
                      <img
                        src={thumbUrl}
                        alt={video.filename}
                        loading="lazy"
                        className="w-full h-full object-contain bg-black group-hover:opacity-80 transition-opacity"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-zinc-900 text-zinc-500 text-xs">
                        プレビュー
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/25 group-hover:bg-black/40 transition-colors">
                      <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-black/70 border border-white/20 flex items-center justify-center text-white shadow-lg">
                        <Play size={20} className="fill-white ml-0.5" />
                      </div>
                    </div>
                  </button>
                )}

                {/* フルプレイヤーで開くボタン（左上） */}
                {jfItem && (
                  <button
                    type="button"
                    onClick={() => onOpenFullPlayer(jfItem.Id)}
                    className="absolute top-1.5 right-1.5 p-1.5 rounded-md bg-black/70 hover:bg-black text-zinc-200 hover:text-white border border-white/10 transition-colors z-10"
                    title="フル画面プレイヤーで開く"
                  >
                    <Maximize2 size={14} />
                  </button>
                )}
              </div>

              {/* メタデータ比較欄 */}
              <div className="p-2.5 md:p-3 flex flex-col gap-1.5 text-xs flex-1">
                {/* ライブラリ名 */}
                <div className="flex items-center gap-1.5 text-zinc-300 font-medium truncate">
                  <Folder size={13} className="text-blue-400 shrink-0" />
                  <span className="truncate" title={video.library}>
                    {video.library}
                  </span>
                </div>

                {/* ファイル名 */}
                <div
                  className="text-zinc-400 font-mono text-[11px] truncate"
                  title={video.filename}
                >
                  {video.filename}
                </div>

                {/* 解像度 */}
                <div className="flex items-center justify-between gap-1 pt-1 border-t border-zinc-800/80">
                  <span className="text-zinc-500">解像度</span>
                  <div className="flex items-center gap-1">
                    {isHigherRes && (
                      <span className="px-1.5 py-0.5 text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded">
                        高画質
                      </span>
                    )}
                    <span
                      className={`font-mono ${
                        isHigherRes ? 'text-emerald-300 font-bold' : 'text-zinc-200'
                      }`}
                    >
                      {video.width}×{video.height}
                    </span>
                  </div>
                </div>

                {/* ファイルサイズ */}
                <div className="flex items-center justify-between gap-1">
                  <span className="text-zinc-500">サイズ</span>
                  <span
                    className={`font-mono ${
                      isLargerSize ? 'text-emerald-300 font-semibold' : 'text-zinc-200'
                    }`}
                  >
                    {formatFileSize(video.file_size)}
                  </span>
                </div>

                {/* お気に入り & タグ数 */}
                <div className="flex items-center justify-between gap-1 pt-1 border-t border-zinc-800/80 mt-auto">
                  <span
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium ${
                      video.is_favorite
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : 'text-zinc-500'
                    }`}
                  >
                    <Heart
                      size={12}
                      className={video.is_favorite ? 'fill-rose-400 text-rose-400' : ''}
                    />
                    <span>{video.is_favorite ? 'お気に入り' : 'なし'}</span>
                  </span>

                  <button
                    type="button"
                    onClick={() => onOpenTags(video.filename, video.tags)}
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] transition-colors ${
                      video.tag_count > 0
                        ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700'
                        : 'text-zinc-500 hover:text-zinc-400'
                    }`}
                    title="タグ一覧を表示"
                  >
                    <Tag size={11} />
                    <span>{video.tag_count}タグ</span>
                  </button>
                </div>

                {/* 引き継ぎ削除ボタン (Step 4) */}
                <button
                  type="button"
                  disabled={!!resolvingRelPath}
                  onClick={() => onResolveVideo(group, video, releaseGroupPlayers)}
                  className={`mt-1.5 w-full py-2 px-2 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                    resolvingRelPath === video.rel_path
                      ? 'bg-red-900/40 text-red-300 cursor-wait border border-red-800/50'
                      : resolvingRelPath
                        ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                        : 'bg-red-950/60 hover:bg-red-900/80 text-red-200 hover:text-white border border-red-800/60'
                  }`}
                  title="お気に入りとタグを残す側の動画へ引き継いでからゴミ箱へ移動します"
                >
                  <Trash2 size={13} className="shrink-0" />
                  <span className="truncate">
                    {resolvingRelPath === video.rel_path
                      ? '移動中...'
                      : 'こちらを削除(引継)'}
                  </span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Duplicates() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [cachedCount, setCachedCount] = useState(0);
  const [scanStatus, setScanStatus] = useState(null);
  const [libraries, setLibraries] = useState([]);
  const [selectedLibrary, setSelectedLibrary] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [resolvingRelPath, setResolvingRelPath] = useState(null);
  const [savedVolume] = useLocalStorage('jellyfin_volume', 100);
  const [savedIsMuted] = useLocalStorage('jellyfin_isMuted', false);
  const scrollToTopBtnRef = useRef(null);

  // スクロール検知（上に戻るボタンの制御：300pxより下かつ上スクロール時のみ表示）
  useEffect(() => {
    let lastScrollY = window.scrollY;
    let isScrollingUp = false;
    let ticking = false;

    const updateScrollTopBtn = (show) => {
      if (!scrollToTopBtnRef.current) return;
      if (show) {
        scrollToTopBtnRef.current.style.opacity = '1';
        scrollToTopBtnRef.current.style.pointerEvents = 'auto';
        scrollToTopBtnRef.current.style.transform = 'translateY(0)';
      } else {
        scrollToTopBtnRef.current.style.opacity = '0';
        scrollToTopBtnRef.current.style.pointerEvents = 'none';
        scrollToTopBtnRef.current.style.transform = 'translateY(10px)';
      }
    };

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;

          if (currentScrollY < lastScrollY) {
            isScrollingUp = true;
          } else if (currentScrollY > lastScrollY) {
            isScrollingUp = false;
          }

          updateScrollTopBtn(currentScrollY > 300 && isScrollingUp);

          lastScrollY = currentScrollY;
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Jellyfinアイテムの照合マップ (サムネイル & ストリームURL取得用)
  const [jellyfinItems, setJellyfinItems] = useState([]);

  // タグ確認モーダル用
  const [tagModalInfo, setTagModalInfo] = useState({
    isOpen: false,
    filename: '',
    tags: [],
  });

  const jellyfinMap = useMemo(() => {
    const byRelPath = new Map();
    const byFileName = new Map();

    for (const item of jellyfinItems) {
      if (!item.Path) continue;
      const parts = item.Path.split(/[\\/]/);
      const fileName = parts[parts.length - 1];
      if (fileName) {
        byFileName.set(fileName.toLowerCase(), item);
      }
      const mediaIdx = parts.findIndex((p) => p.toLowerCase() === 'media');
      if (mediaIdx !== -1 && mediaIdx + 1 < parts.length) {
        const rel = parts.slice(mediaIdx + 1).join('/').toLowerCase();
        byRelPath.set(rel, item);
      }
    }

    return { byRelPath, byFileName };
  }, [jellyfinItems]);

  const fetchDuplicateData = useCallback(
    async (showSpinner = false) => {
      if (showSpinner) setLoading(true);
      setError(null);
      try {
        const data = await getDuplicates({
          library: selectedLibrary || null,
        });
        setGroups(data.groups || []);
        setCachedCount(data.cached_count || 0);
        setScanStatus(data.scan_status || null);
      } catch (err) {
        console.error(err);
        setError(err.message || '重複データの取得に失敗しました');
      } finally {
        if (showSpinner) setLoading(false);
      }
    },
    [selectedLibrary]
  );

  // 初回マウント時にライブラリ一覧とJellyfin全動画リストを取得
  useEffect(() => {
    getLibraries()
      .then((data) => {
        const libs = (data.Items || []).filter(
          (lib) => (lib.Name || '').toLowerCase() !== 'trash'
        );
        setLibraries(libs);
      })
      .catch((err) => console.error('Failed to fetch libraries:', err));

    getVideos()
      .then((data) => {
        setJellyfinItems(data.Items || []);
      })
      .catch((err) => console.error('Failed to fetch videos for thumbnail map:', err));
  }, []);

  // 選択ライブラリ変更時に重複一覧を取得
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await getDuplicates({
          library: selectedLibrary || null,
        });
        if (cancelled) return;
        setGroups(data.groups || []);
        setCachedCount(data.cached_count || 0);
        setScanStatus(data.scan_status || null);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        console.error(err);
        setError(err.message || '重複データの取得に失敗しました');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [selectedLibrary]);

  // バックグラウンドスキャン実行中は1.5秒おきに進捗をポーリング
  useEffect(() => {
    if (!scanStatus?.is_scanning) return;
    const timer = setInterval(() => {
      fetchDuplicateData(false);
    }, 1500);
    return () => clearInterval(timer);
  }, [scanStatus?.is_scanning, fetchDuplicateData]);

  const handleStartScan = async () => {
    try {
      setError(null);
      const res = await scanDuplicates({
        library: selectedLibrary || null,
        force: false,
        runAsync: true,
      });
      setScanStatus(res.scan_status);
      setTimeout(() => fetchDuplicateData(false), 500);
    } catch (err) {
      alert(`スキャン開始エラー: ${err.message}`);
    }
  };

  const handleResolveVideo = async (group, targetVideo, releaseGroupPlayers) => {
    const keepVideos = group.videos.filter((v) => v.rel_path !== targetVideo.rel_path);
    if (keepVideos.length === 0) return;

    const inheritNotes = [];
    if (targetVideo.is_favorite) {
      inheritNotes.push('・お気に入り登録状態 (❤️)');
    }
    if (targetVideo.tag_count > 0) {
      inheritNotes.push(`・NFOタグ (${targetVideo.tag_count}個)`);
    }

    const inheritMessage =
      inheritNotes.length > 0
        ? `\n\n以下のデータが残す動画へ自動で引き継がれます：\n${inheritNotes.join('\n')}`
        : '';

    const confirmed = window.confirm(
      `[${targetVideo.library}] ${targetVideo.filename}\nをゴミ箱へ移動しますか？${inheritMessage}`
    );
    if (!confirmed) return;

    setResolvingRelPath(targetVideo.rel_path);
    try {
      // Windowsでのファイルロック(WinError 32)を防ぐため、削除リクエスト前に<video>のストリーム接続を明示的に破棄する
      if (releaseGroupPlayers) {
        releaseGroupPlayers();
        await new Promise((resolve) => setTimeout(resolve, 150));
      }

      await resolveDuplicate({
        trashRelPath: targetVideo.rel_path,
        keepRelPaths: keepVideos.map((v) => v.rel_path),
        mergeMetadata: true,
      });

      // ホーム画面のキャッシュでも非表示になるようにセッションストレージを更新
      const jfItem =
        jellyfinMap.byRelPath.get(targetVideo.rel_path.toLowerCase()) ||
        jellyfinMap.byFileName.get(targetVideo.filename.toLowerCase());
      if (jfItem?.Id) {
        const hidden = JSON.parse(sessionStorage.getItem('jellyfin_hidden_ids') || '{}');
        hidden[jfItem.Id] = Date.now();
        sessionStorage.setItem('jellyfin_hidden_ids', JSON.stringify(hidden));
      }
      sessionStorage.setItem('jellyfin_delay_fetch', 'true');

      // Jellyfinにライブラリスキャンを非同期で要求
      refreshLibrary().catch((e) => console.error(e));

      // 最新の一覧を再取得
      await fetchDuplicateData(false);
    } catch (err) {
      console.error(err);
      alert(`削除（引き継ぎ）エラー: ${err.message}`);
    } finally {
      setResolvingRelPath(null);
    }
  };

  const isScanning = !!scanStatus?.is_scanning;
  const scanProgressPercent =
    isScanning && scanStatus?.total > 0
      ? Math.round((scanStatus.current / scanStatus.total) * 100)
      : 0;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200 flex flex-col pb-16">
      {/* 上部固定ヘッダー */}
      <div className="sticky top-0 z-30 bg-zinc-900/95 backdrop-blur-md border-b border-zinc-800 px-3 py-3 portrait:pt-14 md:portrait:pt-3 md:px-6">
        <div className="max-w-6xl mx-auto flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={() => navigate('/')}
                className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-colors shrink-0"
                title="ホームへ戻る"
              >
                <ArrowLeft size={22} />
              </button>
              <div className="min-w-0">
                <h1 className="text-base md:text-lg font-bold text-zinc-100 truncate">
                  重複動画の確認
                </h1>
                <p className="text-xs text-zinc-400">
                  検出: <span className="text-zinc-100 font-semibold">{groups.length}</span> グループ
                  <span className="mx-1.5 text-zinc-600">|</span>
                  キャッシュ済: <span className="text-zinc-300">{cachedCount}</span> 本
                </p>
              </div>
            </div>

            {/* ライブラリ絞り込み & スキャンボタン */}
            <div className="flex items-center gap-2 shrink-0">
              <select
                value={selectedLibrary}
                onChange={(e) => {
                  setLoading(true);
                  setSelectedLibrary(e.target.value);
                }}
                className="py-1.5 px-2.5 bg-zinc-800 border border-zinc-700 rounded-md text-xs md:text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-600 max-w-36 md:max-w-52 truncate"
              >
                <option value="">すべてのライブラリ</option>
                {libraries.map((lib) => (
                  <option key={lib.Id} value={lib.Name}>
                    {lib.Name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleStartScan}
                disabled={isScanning}
                className={`px-3 py-1.5 rounded-md text-xs md:text-sm font-medium flex items-center gap-1.5 transition-colors ${
                  isScanning
                    ? 'bg-blue-600/40 text-blue-200 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-500 text-white'
                }`}
                title="新規・未キャッシュの動画のハッシュを計算します"
              >
                <RefreshCw size={15} className={isScanning ? 'animate-spin' : ''} />
                <span>{isScanning ? 'スキャン中...' : 'スキャン'}</span>
              </button>
            </div>
          </div>

          {/* スキャン進捗バー */}
          {isScanning && (
            <div className="bg-zinc-800/80 border border-zinc-700 rounded-lg p-2.5 flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs text-zinc-300">
                <span>
                  {scanStatus.target_library
                    ? `「${scanStatus.target_library}」をスキャン中...`
                    : '全ライブラリをスキャン中...'}
                </span>
                <span className="font-mono">
                  {scanStatus.current} / {scanStatus.total} 件 ({scanProgressPercent}%)
                </span>
              </div>
              <div className="w-full h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${scanProgressPercent}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* メインリスト領域 */}
      <div className="max-w-6xl w-full mx-auto p-3 md:p-6 flex-1 flex flex-col gap-4">
        {error && (
          <div className="p-4 bg-red-950/50 border border-red-800/80 rounded-lg text-sm text-red-200">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-16 text-center text-zinc-500 text-sm">
            重複動画グループを読み込み中...
          </div>
        ) : groups.length === 0 ? (
          <div className="py-16 px-4 text-center bg-zinc-900/50 border border-zinc-800/80 rounded-xl flex flex-col items-center gap-3">
            <Sparkles size={32} className="text-zinc-500" />
            <div className="text-sm md:text-base font-medium text-zinc-300">
              重複している動画は見つかりませんでした
            </div>
            <p className="text-xs text-zinc-500 max-w-md">
              まだスキャンしていないライブラリがある場合は、右上の「スキャン」ボタンを押すとハッシュ計算と重複検出が行われます。
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {groups.map((group, index) => (
              <DuplicateGroupCard
                key={group.group_id}
                group={group}
                groupIndex={index}
                jellyfinMap={jellyfinMap}
                resolvingRelPath={resolvingRelPath}
                savedVolume={savedVolume}
                savedIsMuted={savedIsMuted}
                onOpenTags={(filename, tags) =>
                  setTagModalInfo({
                    isOpen: true,
                    filename,
                    tags: (tags || []).map((t) => t.replace(/ /g, '_')),
                  })
                }
                onOpenFullPlayer={(itemId) => navigate(`/player/${itemId}`)}
                onResolveVideo={handleResolveVideo}
              />
            ))}
          </div>
        )}
      </div>

      {/* 一番上に戻るボタン */}
      <button
        ref={scrollToTopBtnRef}
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="fixed bottom-6 right-6 p-3 bg-zinc-800/50 text-white rounded-full shadow-lg backdrop-blur-md transition-all duration-300 hover:bg-zinc-700/80 z-40 opacity-0 pointer-events-none translate-y-2 border border-zinc-700/50"
        title="一番上に戻る"
      >
        <ArrowUp size={24} />
      </button>

      {/* タグ一覧確認モーダル（プレイヤー画面と共通のInfoModalを再利用） */}
      <InfoModal
        isOpen={tagModalInfo.isOpen}
        onClose={() => setTagModalInfo((prev) => ({ ...prev, isOpen: false }))}
        videoFileName={tagModalInfo.filename}
        tags={tagModalInfo.tags}
      />
    </div>
  );
}
