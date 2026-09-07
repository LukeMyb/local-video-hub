import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getVideoStreamUrl, toggleFavorite } from '../api/jellyfin';
import { useLocalStorage } from './useLocalStorage';

export function useVideoPlayer(id) {
  const navigate = useNavigate();
  const location = useLocation();
  const playlist = location.state?.playlist || [];

  const videoUrl = getVideoStreamUrl(id);

  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const timeoutRef = useRef(null);

  const [isLoop, setIsLoop] = useLocalStorage('jellyfin_isLoop', false);
  const [isMobile, setIsMobile] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);

  // --- プレイリスト関連 ---
  const currentIndex = playlist.findIndex((video) => video.Id === id);
  const currentVideo = currentIndex !== -1 ? playlist[currentIndex] : null;
  const prevVideo = currentIndex > 0 ? playlist[currentIndex - 1] : null;
  const nextVideo = currentIndex !== -1 && currentIndex < playlist.length - 1 ? playlist[currentIndex + 1] : null;

  // --- 初期化とクリーンアップ ---
  useEffect(() => {
    setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
  }, []);

  useEffect(() => {
    document.body.classList.remove('bg-zinc-900');
    document.body.classList.add('bg-black');
    return () => {
      document.body.classList.remove('bg-black');
      document.body.classList.add('bg-zinc-900');
    };
  }, []);

  useEffect(() => {
    if (currentVideo && currentVideo.UserData) {
      setIsFavorite(currentVideo.UserData.IsFavorite || false);
    }
  }, [id, currentVideo]);

  // --- コントロールバーの表示制御 ---
  const resetControlsTimeout = useCallback(() => {
    setShowControls(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (!isPlaying) return;
    
    timeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  }, [isPlaying]);

  useEffect(() => {
    const handleActivity = () => resetControlsTimeout();
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('mousedown', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('touchstart', handleActivity);
    
    resetControlsTimeout();

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('mousedown', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
    };
  }, [resetControlsTimeout]);

  // --- フルスクリーン制御 ---
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement || !!document.webkitFullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      if (container.requestFullscreen) container.requestFullscreen();
      else if (container.webkitRequestFullscreen) container.webkitRequestFullscreen();
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    }
  }, []);

  // --- アクションハンドラ ---
  const handleToggleFavorite = useCallback(async () => {
    try {
      const newStatus = await toggleFavorite(id, isFavorite);
      setIsFavorite(newStatus);
      if (currentVideo && currentVideo.UserData) {
        currentVideo.UserData.IsFavorite = newStatus;
      }
    } catch (error) {
      console.error(error);
      alert('お気に入りの更新に失敗しました');
    }
  }, [id, isFavorite, currentVideo]);

  const handlePrev = useCallback(() => {
    if (prevVideo) navigate(`/player/${prevVideo.Id}`, { state: { playlist } });
  }, [prevVideo, navigate, playlist]);

  const handleNext = useCallback(() => {
    if (nextVideo) navigate(`/player/${nextVideo.Id}`, { state: { playlist } });
  }, [nextVideo, navigate, playlist]);

  const handleEnded = useCallback(() => {
    if (isLoop && videoRef.current) videoRef.current.play();
    else handleNext();
  }, [isLoop, handleNext]);

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) videoRef.current.play();
    else videoRef.current.pause();
  }, []);

  const skipBackward = useCallback(() => {
    if (videoRef.current) {
      const newTime = Math.max(0, videoRef.current.currentTime - 10);
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  }, []);

  const skipForward = useCallback(() => {
    if (videoRef.current) {
      const newTime = Math.min(duration, videoRef.current.currentTime + 10);
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  }, [duration]);

  const handleSeek = useCallback((e) => {
    const time = Number(e.target.value);
    if (videoRef.current) videoRef.current.currentTime = time;
    setCurrentTime(time);
  }, []);

  const handleVideoClick = useCallback(() => {
    if (showControls) setShowControls(false);
    else resetControlsTimeout();
  }, [showControls, resetControlsTimeout]);

  // Video要素のイベントをStateに反映するハンドラ
  const handlePlay = useCallback(() => setIsPlaying(true), []);
  const handlePause = useCallback(() => setIsPlaying(false), []);
  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
  }, []);
  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) setDuration(videoRef.current.duration);
  }, []);
  
  const handleContainerMouseLeave = useCallback(() => {
    if (isPlaying) setShowControls(false);
  }, [isPlaying]);

  // ループ状態のトグル関数
  const toggleLoop = useCallback(() => {
    setIsLoop((prev) => !prev);
  }, [setIsLoop]);

  return {
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
    timeoutRef,
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
    
    handleControlsMouseEnter: useCallback(() => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setShowControls(true);
    }, [])
  };
}