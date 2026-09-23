import { useEffect } from 'react';
import { X, Folder } from 'lucide-react';

export function Sidebar({
  isOpen,
  onClose,
  libraries,
  selectedLibraryId,
  onSelectLibrary
}) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }
    // コンポーネントのアンマウント時もリセット
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <>
      {/* ドロワーのオーバーレイ背景（クリックでドロワーを閉じる） */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-50 transition-opacity backdrop-blur-sm touch-none"
          onClick={onClose}
          onTouchMove={(e) => e.preventDefault()}
          onWheel={(e) => e.preventDefault()}
        />
      )}

      {/* サイドドロワー本体（isOpenの状態に応じて画面左外からスライドイン） */}
      <div 
        className={`fixed inset-y-0 left-0 w-64 bg-zinc-900 border-r border-zinc-800 z-50 transform transition-transform duration-300 ease-in-out flex flex-col ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* ドロワーヘッダー部分 */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <h2 className="text-lg font-bold text-zinc-100">ライブラリ</h2>
          <button 
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white rounded-md transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* ライブラリリスト部分 */}
        <div className="flex-1 overflow-y-auto py-2 overscroll-contain">
          {/* 全動画を表示するための「すべての動画」選択ボタン */}
          <button
            onClick={() => {
              onSelectLibrary(null);
              onClose();
            }}
            className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${
              selectedLibraryId === null ? 'bg-zinc-800 text-blue-400 border-r-2 border-blue-400' : 'text-zinc-300 hover:bg-zinc-800/50'
            }`}
          >
            <Folder size={20} className={selectedLibraryId === null ? 'fill-blue-900/50' : ''} />
            <span className="font-medium">すべての動画</span>
          </button>
          
          {/* Jellyfin APIから取得した各ライブラリの選択ボタン */}
          {libraries.map(lib => (
            <button
              key={lib.Id}
              onClick={() => {
                onSelectLibrary(lib.Id);
                onClose();
              }}
              className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${
                selectedLibraryId === lib.Id ? 'bg-zinc-800 text-blue-400 border-r-2 border-blue-400' : 'text-zinc-300 hover:bg-zinc-800/50'
              }`}
            >
              <Folder size={20} className={selectedLibraryId === lib.Id ? 'fill-blue-900/50' : ''} />
              <span className="font-medium">{lib.Name}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}