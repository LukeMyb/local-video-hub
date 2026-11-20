import { useState, useEffect, useCallback } from 'react';
import {
  X,
  Activity,
  RefreshCw,
  RotateCcw,
  Check,
  KeyRound,
  Trash2,
} from 'lucide-react';
import { refreshLibrary } from '../../api/jellyfin';
import { getSystemStatus } from '../../api/backend';

const CACHE_LOCAL_STORAGE_KEYS = [
  'jellyfin_searchQuery',
  'jellyfin_isFavorite',
  'jellyfin_libraryId',
  'jellyfin_sortOrder',
  'jellyfin_isShuffled',
  'jellyfin_shuffleSeed',
  'jellyfin_libraryHistory',
  'jellyfin_gridColumnsByOrientation',
  'jellyfin_gridColumns',
];

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 MB';
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) {
    return `${gb.toFixed(2)} GB`;
  }
  const mb = bytes / (1024 * 1024);
  if (mb >= 0.1) {
    return `${mb.toFixed(1)} MB`;
  }
  const kb = bytes / 1024;
  return `${kb.toFixed(1)} KB`;
}

function CookieStatusRow({ label, cookieInfo }) {
  if (!cookieInfo) {
    return (
      <div className="flex items-center justify-between text-xs text-zinc-400 py-1">
        <span>{label}</span>
        <span>取得中...</span>
      </div>
    );
  }

  const isValid = !!cookieInfo.is_valid;
  const isWarning =
    isValid &&
    typeof cookieInfo.days_remaining === 'number' &&
    cookieInfo.days_remaining <= 7;

  const badgeClass = !isValid
    ? 'bg-red-500/15 text-red-400 border-red-500/30'
    : isWarning
      ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
      : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';

  return (
    <div className="p-2.5 rounded-lg bg-zinc-800/60 border border-zinc-800 flex items-center justify-between gap-2">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <KeyRound size={14} className="text-zinc-400 shrink-0" />
          <span className="text-xs font-medium text-zinc-200">{label}</span>
        </div>
        <p className="text-[11px] text-zinc-400 mt-0.5 truncate">
          {cookieInfo.expires_at ? (
            <>
              期限: <span className="font-mono text-zinc-300">{cookieInfo.expires_at}</span>
              {typeof cookieInfo.days_remaining === 'number' && (
                <span className="ml-1">
                  ({cookieInfo.days_remaining >= 0 ? `残り${cookieInfo.days_remaining}日` : '期限切れ'})
                </span>
              )}
            </>
          ) : (
            cookieInfo.message
          )}
        </p>
      </div>
      <span
        className={`px-2 py-0.5 text-[11px] font-medium rounded-full border shrink-0 ${badgeClass}`}
      >
        {isValid ? '有効' : cookieInfo.status === 'expired' ? '期限切れ' : '無効/未配置'}
      </span>
    </div>
  );
}

export function SystemStatusModal({ isOpen, onClose, onReloadVideos }) {
  const [isScanningLibrary, setIsScanningLibrary] = useState(false);
  const [scanResultMessage, setScanResultMessage] = useState(null);

  const [systemStatus, setSystemStatus] = useState(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [statusError, setStatusError] = useState(null);

  const fetchSystemStatus = useCallback(async () => {
    setIsLoadingStatus(true);
    setStatusError(null);
    try {
      const data = await getSystemStatus();
      setSystemStatus(data);
    } catch (error) {
      console.error(error);
      setStatusError(error.message || 'システム状態の取得に失敗しました');
    } finally {
      setIsLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      fetchSystemStatus();
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [isOpen, fetchSystemStatus]);

  if (!isOpen) return null;

  const handleManualLibraryScan = async () => {
    if (isScanningLibrary) return;
    setIsScanningLibrary(true);
    setScanResultMessage(null);
    try {
      await refreshLibrary();
      // Jellyfin側のスキャン反映を少し待ってから動画一覧を再取得
      await new Promise((resolve) => setTimeout(resolve, 1500));
      if (onReloadVideos) {
        await onReloadVideos();
      }
      setScanResultMessage({
        type: 'success',
        text: 'ライブラリスキャンを要求し、一覧を更新しました。',
      });
    } catch (error) {
      console.error(error);
      setScanResultMessage({
        type: 'error',
        text: error.message || 'ライブラリスキャンの要求に失敗しました。',
      });
    } finally {
      setIsScanningLibrary(false);
    }
  };

  const handleClearCache = async () => {
    const confirmed = window.confirm(
      '検索条件・フィルタ・列数・ライブラリ履歴・一時キャッシュをクリアして画面を再読み込みしますか？\n（※プレイヤー設定などのカスタマイズ項目は保持されます）'
    );
    if (!confirmed) return;

    try {
      window.sessionStorage.clear();
      CACHE_LOCAL_STORAGE_KEYS.forEach((key) => {
        window.localStorage.removeItem(key);
      });
      if ('caches' in window) {
        const cacheNames = await window.caches.keys();
        await Promise.all(cacheNames.map((name) => window.caches.delete(name)));
      }
    } catch (error) {
      console.warn('キャッシュクリア中にエラーが発生しました:', error);
    }
    window.location.reload();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overscroll-contain"
      onClick={onClose}
      onWheel={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
    >
      <div
        className="w-full max-w-md max-h-[85dvh] bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* モーダルヘッダー */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Activity size={18} className="text-zinc-400" />
            <h2 className="text-base font-bold text-zinc-100">
              システム状態・メンテナンス
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-colors"
            title="閉じる"
          >
            <X size={20} />
          </button>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 overscroll-contain">
          {/* セクション: システム状態 */}
          <section className="space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-1.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                システム状態
              </h3>
              <button
                type="button"
                onClick={fetchSystemStatus}
                disabled={isLoadingStatus}
                className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1 transition-colors"
                title="ステータスを再取得"
              >
                <RefreshCw
                  size={12}
                  className={isLoadingStatus ? 'animate-spin' : ''}
                />
                <span>更新</span>
              </button>
            </div>

            {statusError && (
              <p className="text-xs text-red-400 bg-red-950/40 border border-red-800/60 rounded-lg p-2.5">
                {statusError}
              </p>
            )}

            {/* X / TikTok クッキーの有効期限ステータス表示 */}
            <div className="space-y-2">
              <CookieStatusRow
                label="X (Twitter) Cookie"
                cookieInfo={systemStatus?.cookies?.x}
              />
              <CookieStatusRow
                label="TikTok Cookie"
                cookieInfo={systemStatus?.cookies?.tiktok}
              />
            </div>

            {/* ゴミ箱（media/trash）内のファイル数・合計容量の表示 */}
            <div className="p-2.5 rounded-lg bg-zinc-800/60 border border-zinc-800 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Trash2 size={15} className="text-zinc-400 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-zinc-200">
                    ゴミ箱（media/trash）
                  </p>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    {systemStatus?.trash
                      ? `動画 ${systemStatus.trash.video_count} 本（関連含む計 ${systemStatus.trash.total_file_count} ファイル）`
                      : '集計中...'}
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono font-semibold text-zinc-200 shrink-0">
                {systemStatus?.trash
                  ? formatBytes(systemStatus.trash.total_bytes)
                  : '-'}
              </span>
            </div>
          </section>

          {/* セクション: メンテナンス */}
          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 border-b border-zinc-800 pb-1.5">
              メンテナンス
            </h3>

            {/* Jellyfin ライブラリスキャンの手動トリガー */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-200">
                    Jellyfin ライブラリスキャン
                  </p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Jellyfinにファイルの再スキャンを要求し、動画一覧を再取得します。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleManualLibraryScan}
                  disabled={isScanningLibrary}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 shrink-0 transition-colors ${
                    isScanningLibrary
                      ? 'bg-blue-600/40 text-blue-200 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-500 text-white'
                  }`}
                >
                  <RefreshCw
                    size={14}
                    className={isScanningLibrary ? 'animate-spin' : ''}
                  />
                  <span>{isScanningLibrary ? 'スキャン中...' : 'スキャン実行'}</span>
                </button>
              </div>
              {scanResultMessage && (
                <p
                  className={`text-xs flex items-center gap-1 ${
                    scanResultMessage.type === 'error'
                      ? 'text-red-400'
                      : 'text-emerald-400'
                  }`}
                >
                  {scanResultMessage.type === 'success' && <Check size={14} />}
                  <span>{scanResultMessage.text}</span>
                </p>
              )}
            </div>

            {/* キャッシュクリア */}
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-zinc-200">
                  キャッシュのクリア
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  検索・フィルタ状態、列数、ライブラリ履歴、一時キャッシュをリセットして再読み込みします。
                </p>
              </div>
              <button
                type="button"
                onClick={handleClearCache}
                className="px-3 py-1.5 rounded-md text-xs font-medium bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 hover:text-white flex items-center gap-1.5 shrink-0 transition-colors"
              >
                <RotateCcw size={14} />
                <span>クリア</span>
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
