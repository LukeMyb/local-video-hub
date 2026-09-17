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
  onMouseLeave
}) {
  return (
    <div 
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/80 to-transparent px-8 py-6 transition-opacity duration-300 z-10 ${
        showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      {/* シークバーエリア */}
      <div className="flex items-center gap-4 mb-4">
        <span className="text-white text-sm font-mono">{formatTime(currentTime)}</span>
        <input
          type="range"
          min={0}
          max={duration || 100}
          value={currentTime}
          onChange={onSeek}
          className="flex-1 h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:h-2 transition-all"
        />
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
            className={`transition-colors flex items-center justify-center mr-2 sm:mr-4 ${isFavorite ? 'text-white' : 'text-zinc-300 hover:text-white'}`}
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