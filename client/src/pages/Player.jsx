import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Controls } from '../components/player/Controls';
import { useVideoPlayer } from '../hooks/useVideoPlayer';

function Player() {
  const { id } = useParams();
  const navigate = useNavigate();

  // ロジックと状態管理をカスタムフックに委譲
  const {
    videoRef,
    containerRef,
    videoUrl,
    isLoop,
    isMobile,
    isFullscreen,
    isPlaying,
    currentTime,
    duration,
    showControls,
    isFavorite,
    prevVideo,
    nextVideo,
    resetControlsTimeout,
    handleToggleFavorite,
    handlePrev,
    handleNext,
    handleEnded,
    toggleFullscreen,
    togglePlay,
    skipBackward,
    skipForward,
    handleSeek,
    handleVideoClick,
    handlePlay,
    handlePause,
    handleTimeUpdate,
    handleLoadedMetadata,
    handleContainerMouseLeave,
    toggleLoop,
    handleControlsMouseEnter,
    isTrashed,
    handleTrashVideo,
    handleRestoreVideo
  } = useVideoPlayer(id);

  return (
    <div 
      ref={containerRef} 
      className="fixed inset-0 z-50 w-full h-100dvh bg-black flex flex-col justify-center"
      onMouseLeave={handleContainerMouseLeave}
    >
      {/* 上部コントロールバー */}
      <div 
        className={`absolute top-0 left-0 right-0 px-8 portrait:px-4 pb-6 pt-6 portrait:pt-16 landscape:pt-6 bg-linear-to-b from-black/90 via-black/50 to-transparent transition-opacity duration-300 z-10 flex items-center gap-4 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <button 
          onClick={() => navigate('/')}
          className="px-4 py-2 text-zinc-300 hover:text-white hover:bg-zinc-800/80 rounded-full transition-colors flex items-center justify-center"
          title="一覧へ戻る"
        >
          <ArrowLeft size={24} />
        </button>
      </div>

      {/* Videoプレイヤー */}
      <video 
        ref={videoRef}
        autoPlay 
        playsInline
        loop={isLoop}
        onEnded={handleEnded}
        className={`w-full h-full object-contain bg-black ${showControls ? 'cursor-pointer' : 'cursor-none'}`}
        src={videoUrl}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={handleVideoClick}
        onPlay={handlePlay}
        onPause={handlePause}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
      >
        お使いのブラウザは動画の再生をサポートしていません。
      </video>

      {/* カスタムコントロールUI */}
      <Controls
        showControls={showControls}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        isFavorite={isFavorite}
        isLoop={isLoop}
        isMobile={isMobile}
        isFullscreen={isFullscreen}
        prevVideo={prevVideo}
        nextVideo={nextVideo}
        isTrashed={isTrashed}
        onTrash={handleTrashVideo}
        onRestore={handleRestoreVideo}
        onPlayPause={togglePlay}
        onSeek={handleSeek}
        onSkipBackward={skipBackward}
        onSkipForward={skipForward}
        onPrev={handlePrev}
        onNext={handleNext}
        onToggleFavorite={handleToggleFavorite}
        onToggleLoop={toggleLoop}
        onToggleFullscreen={toggleFullscreen}
        onMouseEnter={handleControlsMouseEnter}
        onMouseLeave={resetControlsTimeout}
      />
    </div>
  );
}

export default Player;