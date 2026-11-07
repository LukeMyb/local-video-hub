import { ArrowDownWideNarrow, ArrowUpNarrowWide, Shuffle, ArrowUp } from 'lucide-react';

export function ControlBar({
  sortOrder,
  onToggleSortOrder,
  onShuffle,
  onRandomPlay,
  scrollToTopBtnRef,
  onScrollToTop
}) {
  return (
    <>
      {/* ピル型のフローティングコントロールバー */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-max max-w-[95vw]">
        <div className="bg-zinc-800/90 backdrop-blur-md border border-zinc-700 shadow-2xl rounded-full px-1.5 py-1.5 flex flex-row items-center gap-0.5 sm:gap-1 overflow-x-auto scrollbar-hide">
          
          {/* ソート順変更トグルボタン */}
          <button
            onClick={onToggleSortOrder}
            className="flex flex-row items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 rounded-full hover:bg-zinc-700 transition-colors text-zinc-300"
          >
            {sortOrder === 'desc' ? <ArrowDownWideNarrow size={18} /> : <ArrowUpNarrowWide size={18} />}
            <span className="text-sm font-medium whitespace-nowrap">
              {sortOrder === 'desc' ? '新しい順' : '古い順'}
            </span>
          </button>

          <div className="w-px h-5 bg-zinc-700 sm:mx-1 shrink-0"></div>

          {/* シャッフルソートボタン */}
          <button
            onClick={onShuffle}
            className="flex flex-row items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 rounded-full hover:bg-zinc-700 transition-colors text-zinc-300"
          >
            <Shuffle size={18} />
            <span className="text-sm font-medium whitespace-nowrap">シャッフル</span>
          </button>

          <div className="w-px h-5 bg-zinc-700 sm:mx-1 shrink-0"></div>

          {/* ランダム再生ボタン */}
          <button
            onClick={onRandomPlay}
            className="flex flex-row items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 rounded-full hover:bg-zinc-700 transition-colors text-blue-400"
          >
            <Shuffle size={18} />
            <span className="text-sm font-medium whitespace-nowrap">ランダム再生</span>
          </button>
          
        </div>
      </div>

      {/* 一番上に戻るボタン */}
      <button
        ref={scrollToTopBtnRef}
        onClick={onScrollToTop}
        className="fixed bottom-6 right-6 p-3 bg-zinc-800/50 text-white rounded-full shadow-lg backdrop-blur-md transition-all duration-300 hover:bg-zinc-700/80 z-40 opacity-0 pointer-events-none translate-y-2 border border-zinc-700/50"
      >
        <ArrowUp size={24} />
      </button>
    </>
  );
}
