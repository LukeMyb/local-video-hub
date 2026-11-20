import { useState } from 'react';
import { X, Sliders, RefreshCw, RotateCcw, Check } from 'lucide-react';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { refreshLibrary } from '../../api/jellyfin';

const SKIP_SECOND_OPTIONS = [5, 10, 15, 30];

const AFTER_ACTION_OPTIONS = [
  { value: 'home', label: '一覧に戻る' },
  { value: 'next', label: '次の動画へ進む' },
];

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

export function SettingsModal({ isOpen, onClose, onReloadVideos }) {
  const [skipSeconds, setSkipSeconds] = useLocalStorage('jellyfin_skipSeconds', 10);
  const [afterActionBehavior, setAfterActionBehavior] = useLocalStorage(
    'jellyfin_afterActionBehavior',
    'home'
  );
  const [excludeTrashInAll, setExcludeTrashInAll] = useLocalStorage(
    'jellyfin_excludeTrashInAll',
    false
  );

  const [isScanningLibrary, setIsScanningLibrary] = useState(false);
  const [scanResultMessage, setScanResultMessage] = useState(null);

  if (!isOpen) return null;

  const currentSkipSeconds = Number(skipSeconds) || 10;

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
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[85dvh] bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* モーダルヘッダー */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Sliders size={18} className="text-zinc-400" />
            <h2 className="text-base font-bold text-zinc-100">設定</h2>
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

        {/* 設定コンテンツ */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 overscroll-contain">
          {/* セクション: プレイヤー設定 */}
          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 border-b border-zinc-800 pb-1.5">
              プレイヤー設定
            </h3>

            {/* 1. スキップ秒数の変更 */}
            <div className="flex items-center justify-between gap-4">
              <label
                htmlFor="setting-skip-seconds"
                className="text-sm font-medium text-zinc-200"
              >
                早送り・早戻しのスキップ秒数
              </label>
              <select
                id="setting-skip-seconds"
                value={currentSkipSeconds}
                onChange={(e) => setSkipSeconds(Number(e.target.value))}
                className="py-1.5 px-3 bg-zinc-800 border border-zinc-700 rounded-md text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-600 shrink-0"
              >
                {SKIP_SECOND_OPTIONS.map((sec) => (
                  <option key={sec} value={sec}>
                    {sec}秒
                  </option>
                ))}
              </select>
            </div>

            {/* 2. 移動・削除後の遷移先 */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-4">
                <label
                  htmlFor="setting-after-action"
                  className="text-sm font-medium text-zinc-200"
                >
                  動画の移動・ゴミ箱移動後の動作
                </label>
                <select
                  id="setting-after-action"
                  value={afterActionBehavior}
                  onChange={(e) => setAfterActionBehavior(e.target.value)}
                  className="py-1.5 px-3 bg-zinc-800 border border-zinc-700 rounded-md text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-600 shrink-0"
                >
                  {AFTER_ACTION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-zinc-500">
                「次の動画へ進む」を選ぶと、整理後に一覧へ戻らずプレイリストの次の動画を連続再生します。
              </p>
            </div>
          </section>

          {/* セクション: 一覧・表示設定 */}
          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 border-b border-zinc-800 pb-1.5">
              一覧・表示設定
            </h3>

            {/* 3. 「すべての動画」表示時のゴミ箱除外設定 */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-4">
                <label
                  htmlFor="setting-exclude-trash"
                  className="text-sm font-medium text-zinc-200 cursor-pointer"
                >
                  「すべての動画」からゴミ箱（trash/）を除外
                </label>
                <button
                  id="setting-exclude-trash"
                  type="button"
                  role="switch"
                  aria-checked={!!excludeTrashInAll}
                  onClick={() => setExcludeTrashInAll((prev) => !prev)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 ${
                    excludeTrashInAll ? 'bg-blue-600' : 'bg-zinc-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      excludeTrashInAll ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
              <p className="text-xs text-zinc-500">
                ONにすると、「すべての動画」の一覧およびランダム再生からゴミ箱内の動画を除外します（サイドバーからtrashを直接開いた時は表示されます）。
              </p>
            </div>
          </section>

          {/* セクション: メンテナンス */}
          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 border-b border-zinc-800 pb-1.5">
              メンテナンス
            </h3>

            {/* 4. Jellyfin ライブラリスキャンの手動トリガー */}
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

            {/* 5. キャッシュクリア */}
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
