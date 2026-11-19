import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Ellipsis, Forward, Trash, Undo } from 'lucide-react';
import { Controls } from '../components/player/Controls';
import { MoveModal } from '../components/player/MoveModal';
import { useVideoPlayer } from '../hooks/useVideoPlayer';

function Player() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // ロジックと状態管理をカスタムフックに委譲
  const {
    videoRef,
    containerRef,
    videoUrl,
    videoFileName,
    scale,
    position,
    isLoop,
    isMobile,
    isFullscreen,
    isPlaying,
    currentTime,
    duration,
    showControls,
    isFavorite,
    volume,
    isMuted,
    handleVolumeChange,
    toggleMute,
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
    handleRestoreVideo,
    isMoveModalOpen,
    movableLibraries,
    currentLibraryName,
    handleOpenMoveModal,
    handleCloseMoveModal,
    handleMoveVideo,
    fineSeek
  } = useVideoPlayer(id);

  useEffect(() => {
    if (!isMenuOpen) return;
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isMenuOpen]);

  return (
    <div 
      ref={containerRef} 
      className="fixed inset-0 z-50 w-full h-100dvh bg-black flex flex-col justify-center overflow-hidden"
      onMouseLeave={handleContainerMouseLeave}
    >
      {/* 上部コントロールバー */}
      <div 
        data-controls
        className={`absolute top-0 left-0 right-0 px-8 portrait:px-4 pb-6 pt-6 portrait:pt-16 landscape:pt-6 bg-linear-to-b from-black/90 via-black/50 to-transparent transition-opacity duration-300 z-10 flex items-center justify-between gap-4 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button 
            onClick={() => navigate('/')}
            className="px-4 py-2 text-zinc-300 hover:text-white hover:bg-zinc-800/80 rounded-full transition-colors flex items-center justify-center shrink-0"
            title="一覧へ戻る"
          >
            <ArrowLeft size={24} />
          </button>

          {videoFileName && (
            <span
              className="text-zinc-200 text-sm sm:text-base font-medium truncate text-left"
              title={videoFileName}
            >
              {videoFileName}
            </span>
          )}
        </div>

        {/* 右上のアクションボタン群 */}
        <div className="flex items-center gap-2 pr-2 shrink-0">
          {isTrashed ? (
            <button
              onClick={handleRestoreVideo}
              className="px-4 py-2 text-zinc-300 hover:text-white hover:bg-zinc-800/80 rounded-full transition-colors flex items-center justify-center"
              title="元に戻す（復元）"
            >
              <Undo size={24} />
            </button>
          ) : (
            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setIsMenuOpen((prev) => !prev)}
                className="px-4 py-2 text-zinc-300 hover:text-white hover:bg-zinc-800/80 rounded-full transition-colors flex items-center justify-center"
                title="メニュー"
              >
                <Ellipsis size={24} />
              </button>

              {isMenuOpen && showControls && (
                <div className="absolute right-0 top-full mt-2 w-52 bg-zinc-900/95 backdrop-blur-md border border-zinc-800 rounded-xl shadow-2xl py-1.5 z-50 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      handleOpenMoveModal();
                    }}
                    className="w-full px-4 py-2.5 text-sm text-zinc-200 hover:text-white hover:bg-zinc-800/80 transition-colors flex items-center gap-3 text-left"
                    title="別のライブラリへ移動"
                  >
                    <Forward size={18} className="shrink-0" />
                    <span>別のライブラリへ移動</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      handleTrashVideo();
                    }}
                    disabled={isFavorite}
                    className={`w-full px-4 py-2.5 text-sm transition-colors flex items-center gap-3 text-left ${
                      isFavorite
                        ? 'text-zinc-600 cursor-not-allowed'
                        : 'text-zinc-200 hover:text-red-400 hover:bg-zinc-800/80'
                    }`}
                    title={isFavorite ? "お気に入り登録中はゴミ箱へ移動できません" : "ゴミ箱へ移動（論理削除）"}
                  >
                    <Trash size={18} className="shrink-0" />
                    <span>ゴミ箱へ移動</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 別のライブラリへ移動するモーダル */}
      <MoveModal
        isOpen={isMoveModalOpen}
        onClose={handleCloseMoveModal}
        libraries={movableLibraries}
        currentLibraryName={currentLibraryName}
        onSelectLibrary={handleMoveVideo}
      />

      {/* Videoプレイヤー */}
      <video 
        ref={videoRef}
        autoPlay 
        playsInline
        loop={isLoop}
        onEnded={handleEnded}
        className={`w-full h-full object-contain bg-black touch-none ${showControls ? 'cursor-pointer' : 'cursor-none'}`}
        style={{
          transform: `translate3d(${position.x}px, ${position.y}px, 0) scale(${scale})`,
          transformOrigin: 'center center',
        }}
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
        volume={volume}
        isMuted={isMuted}
        isLoop={isLoop}
        isMobile={isMobile}
        isFullscreen={isFullscreen}
        prevVideo={prevVideo}
        nextVideo={nextVideo}
        onPlayPause={togglePlay}
        onSeek={handleSeek}
        onSkipBackward={skipBackward}
        onSkipForward={skipForward}
        onPrev={handlePrev}
        onNext={handleNext}
        onToggleFavorite={handleToggleFavorite}
        onVolumeChange={handleVolumeChange}
        onToggleMute={toggleMute}
        onToggleLoop={toggleLoop}
        onToggleFullscreen={toggleFullscreen}
        onMouseEnter={handleControlsMouseEnter}
        onMouseLeave={resetControlsTimeout}
        fineSeek={fineSeek}
      />
    </div>
  );
}

export default Player;
