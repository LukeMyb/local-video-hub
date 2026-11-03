import { useState, useMemo } from 'react';
import { X, Folder, Search } from 'lucide-react';

export function MoveModal({
  isOpen,
  onClose,
  libraries,
  currentLibraryName,
  onSelectLibrary,
}) {
  const [searchQuery, setSearchQuery] = useState('');

  const handleClose = () => {
    setSearchQuery('');
    onClose();
  };

  const filteredLibraries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return libraries;
    return libraries.filter((lib) => (lib.Name || '').toLowerCase().includes(q));
  }, [libraries, searchQuery]);

  if (!isOpen) return null;

  return (
    <div
      data-controls
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={handleClose}
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
            <h2 className="text-base font-bold text-zinc-100">別のライブラリへ移動</h2>
            {currentLibraryName && (
              <p className="text-xs text-zinc-400 truncate mt-0.5">
                現在: {currentLibraryName}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-colors shrink-0"
            title="閉じる"
          >
            <X size={20} />
          </button>
        </div>

        {/* 検索バー */}
        <div className="p-3 border-b border-zinc-800">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="移動先ライブラリを検索..."
              className="w-full py-1.5 pl-9 pr-8 bg-[#27272a] rounded-md text-sm text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-white rounded-md transition-colors"
                title="クリア"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* ライブラリ一覧 */}
        <div className="flex-1 overflow-y-auto py-1 overscroll-contain">
          {filteredLibraries.length > 0 ? (
            filteredLibraries.map((lib) => (
              <button
                key={lib.Id}
                type="button"
                onClick={() => onSelectLibrary(lib.Name)}
                className="w-full text-left px-4 py-3 flex items-center gap-3 text-zinc-200 hover:bg-zinc-800 transition-colors"
              >
                <Folder size={18} className="text-zinc-400 shrink-0" />
                <span className="font-medium truncate">{lib.Name}</span>
              </button>
            ))
          ) : (
            <p className="px-4 py-6 text-sm text-zinc-500 text-center">
              移動可能なライブラリがありません
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
