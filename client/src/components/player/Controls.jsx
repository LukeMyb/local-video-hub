// client/src/components/player/Controls.jsx
import { 
  Play, Pause, SkipBack, SkipForward, Rewind, FastForward,
  Maximize, Minimize, Repeat, Heart
} from 'lucide-react';
import { formatTime } from '../../utils/formatters';

export function Controls({
  showControls,
  isPlaying,
  currentTime,
  duration,
  isFavorite,
  isLoop,
  isMobile,
  isFullscreen,
  prevVideo,
  nextVideo,
  onPlayPause,
  onSeek,
  onSkipBackward,
  onSkipForward,
  onPrev,
  onNext,
  onToggleFavorite,
  onToggleLoop,
  onToggleFullscreen,
  onMouseEnter,
  onMouseLeave,
  fineSeek,
}) {
  const {
    mainBarRef,
    isFineSeekOpen,
    originTime,
    fineMin = 0,
    fineMax = 100,
    handleMainBarStart,
    handleMainBarChange,
    handleFineBarStart,
    handleFineBarChange,
    handleFineBarEnd,
  } = fineSeek || {};

  const safeDuration = duration || 100;
  const fineRange = Math.max(fineMax - fineMin, 0.1);
  const originInFineRange =
    originTime !== null && originTime >= fineMin && originTime <= fineMax;
  const originFinePercent = originInFineRange
    ? Math.min(Math.max(((originTime - fineMin) / fineRange) * 100, 0), 100)
    : 0;
  const originMainPercent =
    originTime !== null && duration > 0
      ? Math.min(Math.max((originTime / safeDuration) * 100, 0), 100)
      : 0;

  return (
    <div 
      data-controls
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/80 to-transparent px-8 portrait:px-4 py-6 transition-opacity duration-300 z-10 ${
        showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      {/* 長押し時に表示される詳細シークUI */}
      {isFineSeekOpen && (
        <div
          className="mb-3 px-3 py-2 rounded-xl bg-zinc-900/95 border border-zinc-700/80 shadow-lg backdrop-blur-sm select-none flex items-center gap-3"
          onContextMenu={(e) => e.preventDefault()}
        >
          <span className="text-zinc-400 text-xs font-mono w-11 text-right shrink-0">
            {formatTime(fineMin)}
          </span>

          <div className="relative flex-1 flex items-center py-2">
            <input
              type="range"
              min={fineMin}
              max={fineMax}
              step={0.1}
              value={Math.min(Math.max(currentTime, fineMin), fineMax)}
              onChange={handleFineBarChange}
              onTouchStart={handleFineBarStart}
              onMouseDown={handleFineBarStart}
              onTouchEnd={handleFineBarEnd}
              onMouseUp={handleFineBarEnd}
              className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-400"
            />

            {/* 詳細バー上の元の位置マーカー */}
            {originInFineRange && (
              <div
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-none z-10 flex flex-col items-center"
                style={{ left: `${originFinePercent}%` }}
              >
                <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-amber-400 mb-0.5" />
                <div className="w-0.5 h-4 bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.9)]" />
              </div>
            )}
          </div>

          <span className="text-zinc-400 text-xs font-mono w-11 shrink-0">
            {formatTime(fineMax)}
          </span>
        </div>
      )}

      {/* シークバーエリア */}
      <div
        className="flex items-center gap-4 mb-4 select-none"
        onContextMenu={(e) => e.preventDefault()}
      >
        <span className="text-white text-sm font-mono">{formatTime(currentTime)}</span>
        <div className="relative flex-1 flex items-center py-1.5">
          <input
            ref={mainBarRef}
            type="range"
            min={0}
            max={safeDuration}
            step="any"
            value={currentTime}
            onChange={handleMainBarChange || onSeek}
            onTouchStart={handleMainBarStart}
            onMouseDown={handleMainBarStart}
            className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:h-2 transition-all"
          />

          {/* メインバー上の元の位置マーカー */}
          {originTime !== null && duration > 0 && (
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-none z-10 flex flex-col items-center"
              style={{ left: `${originMainPercent}%` }}
            >
              <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-amber-400 mb-0.5" />
              <div className="w-0.5 h-3.5 bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.9)]" />
            </div>
          )}
        </div>
        <span className="text-white text-sm font-mono">{formatTime(duration)}</span>
      </div>

      {/* ボタンエリア */}
      <div className="flex items-center justify-between mt-2">
        {/* 中央の再生コントロール群 */}
        <div className="flex items-center gap-6 sm:gap-8">
          {/* 10秒戻る */}
          <button
            onClick={onSkipBackward}
            className="text-zinc-300 hover:text-white flex items-center justify-center transition-colors"
            title="10秒戻る"
          >
            <Rewind size={28} className="fill-current" strokeWidth={0} />
          </button>

          {/* 再生/一時停止 */}
          <button
            onClick={onPlayPause}
            className="text-white hover:text-blue-400 flex items-center justify-center transition-colors"
            title={isPlaying ? "一時停止" : "再生"}
          >
            {isPlaying ? (
              <Pause size={28} className="fill-current" strokeWidth={0} />
            ) : (
              <Play size={28} className="fill-current ml-1" strokeWidth={0} />
            )}
          </button>

          {/* 10秒進む */}
          <button
            onClick={onSkipForward}
            className="text-zinc-300 hover:text-white flex items-center justify-center transition-colors"
            title="10秒進む"
          >
            <FastForward size={28} className="fill-current" strokeWidth={0} />
          </button>

          {/* 前の動画 */}
          <button
            onClick={onPrev}
            disabled={!prevVideo}
            className={`${prevVideo ? 'text-zinc-300 hover:text-white' : 'text-zinc-600 cursor-not-allowed'} flex items-center justify-center transition-colors`}
            title="前の動画"
          >
            <SkipBack size={24} className="fill-current" />
          </button>

          {/* 次の動画 */}
          <button
            onClick={onNext}
            disabled={!nextVideo}
            className={`${nextVideo ? 'text-zinc-300 hover:text-white' : 'text-zinc-600 cursor-not-allowed'} flex items-center justify-center transition-colors`}
            title="次の動画"
          >
            <SkipForward size={24} className="fill-current" />
          </button>
        </div>

        {/* 右側のコントロール群 */}
        <div className="flex items-center gap-4 justify-end">
          {/* お気に入りボタン */}
          <button
            onClick={onToggleFavorite}
            className={`transition-colors flex items-center justify-center mr-2 sm:mr-4 ${isFavorite ? 'text-rose-500' : 'text-zinc-300 hover:text-white'}`}
            title={isFavorite ? "お気に入り解除" : "お気に入り登録"}
          >
            <Heart size={28} className={isFavorite ? 'fill-current' : ''} />
          </button>

          <button
            onClick={onToggleLoop}
            className={`transition-colors ${isLoop ? 'text-blue-400' : 'text-zinc-300 hover:text-white'}`}
            title={isLoop ? "リピート中" : "自動再生 (次の動画へ)"}
          >
            <Repeat size={28} />
          </button>
          
          {!isMobile && (
            <button
              onClick={onToggleFullscreen}
              className="text-zinc-300 hover:text-white transition-colors"
              title={isFullscreen ? "フルスクリーン解除" : "フルスクリーン"}
            >
              {isFullscreen ? <Minimize size={28} /> : <Maximize size={28} />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
