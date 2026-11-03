import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  getVideoStreamUrl,
  getVideoInfo,
  getLibraries,
  refreshLibrary,
} from '../api/jellyfin';
import {
  toggleFavorite,
  getFavorites,
  trashVideo,
  restoreVideo,
  moveVideo,
} from '../api/backend';
import { useLocalStorage } from './useLocalStorage';
import { usePinchZoom } from './usePinchZoom';
import { useFineSeek } from './useFineSeek';

export function useVideoPlayer(id) {
  const navigate = useNavigate();
  const location = useLocation();
  const playlist = useMemo(() => location.state?.playlist || [], [location.state]);

  const videoUrl = getVideoStreamUrl(id);

  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const timeoutRef = useRef(null);
  const isFineSeekActiveRef = useRef(false);
  const closeFineSeekRef = useRef(null);

  const { scale, position, isGestureRef, resetZoom } = usePinchZoom(containerRef);

  const [isLoop, setIsLoop] = useLocalStorage('jellyfin_isLoop', false);
  const [libraryHistory] = useLocalStorage('jellyfin_libraryHistory', []);
  const [isMobile, setIsMobile] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [volume, setVolume] = useState(100);
  const [isMuted, setIsMuted] = useState(false);

  const [fullVideoInfo, setFullVideoInfo] = useState(null);
  const [libraries, setLibraries] = useState([]);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);

  const seekTo = useCallback(
    (time) => {
      const maxDur = videoRef.current?.duration || duration || 0;
      const clamped = maxDur > 0 ? Math.min(Math.max(0, Number(time)), maxDur) : Math.max(0, Number(time));
      if (videoRef.current) videoRef.current.currentTime = clamped;
      setCurrentTime(clamped);
    },
    [duration]
  );

  const keepControlsOpen = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setShowControls(true);
  }, []);

  // --- コントロールバーの表示制御 ---
  const resetControlsTimeout = useCallback(() => {
    setShowControls(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (!isPlaying || isFineSeekActiveRef.current) return;

    timeoutRef.current = setTimeout(() => {
      if (isFineSeekActiveRef.current) return;
      setShowControls(false);
      if (closeFineSeekRef.current) closeFineSeekRef.current();
    }, 3000);
  }, [isPlaying]);

  const handleControlsMouseEnter = useCallback(() => {
    resetControlsTimeout();
  }, [resetControlsTimeout]);

  const fineSeek = useFineSeek({
    duration,
    currentTime,
    seekTo,
    isFineSeekActiveRef,
    onKeepControlsOpen: keepControlsOpen,
    onRestartControlsTimeout: resetControlsTimeout,
  });

  const { closeFineSeek, resetFineSeek, updateLastPlaybackTime } = fineSeek;

  useEffect(() => {
    closeFineSeekRef.current = closeFineSeek;
  }, [closeFineSeek]);

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
    getLibraries()
      .then((data) => setLibraries(data.Items || []))
      .catch((error) => console.error('Failed to fetch libraries', error));
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

  // 動画の詳細情報（Pathなど）を取得
  useEffect(() => {
    const fetchVideoInfo = async () => {
      try {
        const info = await getVideoInfo(id);
        setFullVideoInfo(info);

        // プレイリスト経由ではない直接アクセスの場合、自前DBからお気に入り状態を確認
        if (!currentVideo && info?.Path) {
          const fileName = info.Path.split(/[\\/]/).pop();
          if (fileName) {
            const favoriteList = await getFavorites().catch(() => []);
            setIsFavorite(favoriteList.includes(fileName));
          }
        }
      } catch (error) {
        console.error('Failed to fetch video info', error);
      }
    };
    fetchVideoInfo();
  }, [id, currentVideo]);

  const isTrashed = fullVideoInfo?.Path?.includes('/trash/') || fullVideoInfo?.Path?.includes('\\trash\\');
  const videoFileName =
    fullVideoInfo?.Id === id
      ? fullVideoInfo?.Path?.split(/[\\/]/).pop() || fullVideoInfo?.Name || ''
      : currentVideo?.FileName || '';

  const currentLibraryName = useMemo(() => {
    if (fullVideoInfo?.Id !== id || !fullVideoInfo?.Path) return '';
    const parts = fullVideoInfo.Path.split(/[\\/]/);
    const mediaIndex = parts.findIndex((p) => p.toLowerCase() === 'media');
    if (mediaIndex !== -1 && mediaIndex + 1 < parts.length - 1) {
      return parts[mediaIndex + 1];
    }
    return parts.length >= 2 ? parts[parts.length - 2] : '';
  }, [fullVideoInfo, id]);

  const movableLibraries = useMemo(() => {
    if (!libraries || libraries.length === 0) return [];
    const history = Array.isArray(libraryHistory) ? libraryHistory : [];
    return libraries
      .filter((lib) => {
        const name = lib.Name || '';
        if (name.toLowerCase() === 'trash') return false;
        if (currentLibraryName && name.toLowerCase() === currentLibraryName.toLowerCase()) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        const indexA = history.indexOf(a.Id);
        const indexB = history.indexOf(b.Id);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return (a.Name || '').localeCompare(b.Name || '');
      });
  }, [libraries, libraryHistory, currentLibraryName]);

  const hideVideoLocally = useCallback(() => {
    const hidden = JSON.parse(sessionStorage.getItem('jellyfin_hidden_ids') || '{}');
    hidden[id] = Date.now();
    sessionStorage.setItem('jellyfin_hidden_ids', JSON.stringify(hidden));
  }, [id]);

  const handleOpenMoveModal = useCallback(() => {
    setIsMoveModalOpen(true);
  }, []);

  const handleCloseMoveModal = useCallback(() => {
    setIsMoveModalOpen(false);
  }, []);

  const handleMoveVideo = useCallback(
    async (targetLibraryName) => {
      if (!fullVideoInfo?.Path || !targetLibraryName) return;
      if (!window.confirm(`この動画を「${targetLibraryName}」に移動しますか？`)) return;

      try {
        await moveVideo(fullVideoInfo.Path, targetLibraryName);

        // 移動完了後、Jellyfinにライブラリスキャンを要求
        await refreshLibrary().catch((e) => console.error(e));

        setIsMoveModalOpen(false);
        hideVideoLocally();
        // ホーム画面での動画再取得を1.5秒遅延させるフラグを立てる
        sessionStorage.setItem('jellyfin_delay_fetch', 'true');
        alert(`「${targetLibraryName}」に移動しました。`);
        navigate('/');
      } catch (error) {
        console.error(error);
        alert(`エラー: ${error.message}`);
      }
    },
    [fullVideoInfo, hideVideoLocally, navigate]
  );

  const handleTrashVideo = useCallback(async () => {
    if (!fullVideoInfo?.Path) return;
    if (!window.confirm('この動画をゴミ箱に移動しますか？')) return;
    
    try {
      await trashVideo(fullVideoInfo.Path);
      
      // 移動完了後、Jellyfinにライブラリスキャンを要求
      await refreshLibrary().catch(e => console.error(e));
      
      hideVideoLocally();
      // ホーム画面での動画再取得を1.5秒遅延させるフラグを立てる
      sessionStorage.setItem('jellyfin_delay_fetch', 'true');
      alert('ゴミ箱に移動しました。');
      navigate('/');
    } catch (error) {
      console.error(error);
      alert(`エラー: ${error.message}`);
    }
  }, [fullVideoInfo, hideVideoLocally, navigate]);

  const handleRestoreVideo = useCallback(async () => {
    if (!fullVideoInfo?.Path) return;
    if (!window.confirm('この動画を元の場所に復元しますか？')) return;
    
    try {
      await restoreVideo(fullVideoInfo.Path);
      
      // 復元完了後、Jellyfinにライブラリスキャンを要求
      await refreshLibrary().catch(e => console.error(e));
      
      hideVideoLocally();
      // ホーム画面での動画再取得を1.5秒遅延させるフラグを立てる
      sessionStorage.setItem('jellyfin_delay_fetch', 'true');
      alert('復元しました。');
      navigate('/');
    } catch (error) {
      console.error(error);
      alert(`エラー: ${error.message}`);
    }
  }, [fullVideoInfo, hideVideoLocally, navigate]);

  useEffect(() => {
    const handleActivity = () => resetControlsTimeout();
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('mousedown', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('touchstart', handleActivity);
    window.addEventListener('touchmove', handleActivity, { passive: true });
    
    resetControlsTimeout();

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('mousedown', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      window.removeEventListener('touchmove', handleActivity);
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
    const targetFileName = videoFileName || currentVideo?.FileName;
    if (!targetFileName) {
      alert('ファイル名が取得できないためお気に入りを更新できません');
      return;
    }

    try {
      const newStatus = await toggleFavorite(targetFileName);
      setIsFavorite(newStatus);
      if (currentVideo && currentVideo.UserData) {
        currentVideo.UserData.IsFavorite = newStatus;
      }
    } catch (error) {
      console.error(error);
      alert('お気に入りの更新に失敗しました');
    }
  }, [videoFileName, currentVideo]);

  const handlePrev = useCallback(() => {
    if (prevVideo) {
      setIsMoveModalOpen(false);
      resetZoom();
      resetFineSeek();
      navigate(`/player/${prevVideo.Id}`, { state: { playlist } });
    }
  }, [prevVideo, navigate, playlist, resetZoom, resetFineSeek]);

  const handleNext = useCallback(() => {
    if (nextVideo) {
      setIsMoveModalOpen(false);
      resetZoom();
      resetFineSeek();
      navigate(`/player/${nextVideo.Id}`, { state: { playlist } });
    }
  }, [nextVideo, navigate, playlist, resetZoom, resetFineSeek]);

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

  const handleSeek = useCallback(
    (e) => {
      const time = typeof e === 'number' ? e : Number(e.target.value);
      seekTo(time);
    },
    [seekTo]
  );

  const handleVideoClick = useCallback(() => {
    if (isGestureRef.current) {
      isGestureRef.current = false;
      return;
    }
    if (showControls) {
      setShowControls(false);
      closeFineSeek();
    } else {
      resetControlsTimeout();
    }
  }, [isGestureRef, showControls, resetControlsTimeout, closeFineSeek]);

  // Video要素のイベントをStateに反映するハンドラ
  const handlePlay = useCallback(() => setIsPlaying(true), []);
  const handlePause = useCallback(() => setIsPlaying(false), []);
  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      const t = videoRef.current.currentTime;
      setCurrentTime(t);
      updateLastPlaybackTime(t);
    }
  }, [updateLastPlaybackTime]);
  useEffect(() => {
    if (videoRef.current) {
      const effectiveVol = isMobile ? 1 : (isMuted ? 0 : Math.min(Math.max(volume, 0), 100) / 100);
      videoRef.current.volume = effectiveVol;
      videoRef.current.muted = isMobile ? false : isMuted;
    }
  }, [volume, isMuted, isMobile]);

  const handleVolumeChange = useCallback((newVol) => {
    const clamped = Math.min(Math.max(Math.round(Number(newVol)), 0), 100);
    setVolume(clamped);
    if (clamped > 0) {
      setIsMuted(false);
    }
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    resetZoom();
    resetFineSeek();
    if (videoRef.current) {
      const effectiveVol = isMobile ? 1 : (isMuted ? 0 : Math.min(Math.max(volume, 0), 100) / 100);
      videoRef.current.volume = effectiveVol;
      videoRef.current.muted = isMobile ? false : isMuted;
      setDuration(videoRef.current.duration);
      updateLastPlaybackTime(videoRef.current.currentTime || 0);
    }
  }, [resetZoom, resetFineSeek, updateLastPlaybackTime, isMobile, isMuted, volume]);
  
  const handleContainerMouseLeave = useCallback(() => {
    if (isPlaying && !isFineSeekActiveRef.current) {
      setShowControls(false);
      closeFineSeek();
    }
  }, [isPlaying, closeFineSeek]);

  // ループ状態のトグル関数
  const toggleLoop = useCallback(() => {
    setIsLoop((prev) => !prev);
  }, [setIsLoop]);

  return {
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
    isTrashed,
    handleTrashVideo,
    handleRestoreVideo,
    isMoveModalOpen,
    movableLibraries,
    currentLibraryName,
    handleOpenMoveModal,
    handleCloseMoveModal,
    handleMoveVideo,
    handleControlsMouseEnter,
    fineSeek,
  };
}
