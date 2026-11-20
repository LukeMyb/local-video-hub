import { X, Sliders } from 'lucide-react';
import { useLocalStorage } from '../../hooks/useLocalStorage';

const SKIP_SECOND_OPTIONS = [5, 10, 15, 30];

const AFTER_ACTION_OPTIONS = [
  { value: 'home', label: '一覧に戻る' },
  { value: 'next', label: '次の動画へ進む' },
];

export function SettingsModal({ isOpen, onClose }) {
  const [skipSeconds, setSkipSeconds] = useLocalStorage('jellyfin_skipSeconds', 10);
  const [afterActionBehavior, setAfterActionBehavior] = useLocalStorage(
    'jellyfin_afterActionBehavior',
    'home'
  );

  if (!isOpen) return null;

  const currentSkipSeconds = Number(skipSeconds) || 10;

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
        </div>
      </div>
    </div>
  );
}
