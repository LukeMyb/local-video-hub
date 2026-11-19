import { X, Tag } from 'lucide-react';

export function InfoModal({
  isOpen,
  onClose,
  videoFileName,
  tags = [],
}) {
  if (!isOpen) return null;

  return (
    <div
      data-controls
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <div
        className="w-full max-w-sm max-h-[80dvh] bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* モーダルヘッダー */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-zinc-100">情報</h2>
            {videoFileName && (
              <p className="text-xs text-zinc-400 truncate mt-0.5" title={videoFileName}>
                {videoFileName}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-colors shrink-0"
            title="閉じる"
          >
            <X size={20} />
          </button>
        </div>

        {/* タグ一覧 */}
        <div className="flex-1 overflow-y-auto p-4 overscroll-contain">
          <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 mb-3">
            <Tag size={14} />
            <span>タグ一覧 ({tags.length})</span>
          </div>

          {tags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2.5 py-1 text-xs text-zinc-200 bg-zinc-800 border border-zinc-700/80 rounded-md break-all"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : (
            <p className="py-6 text-sm text-zinc-500 text-center">
              タグがありません
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
