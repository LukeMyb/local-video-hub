import { useState, useRef, useCallback, useEffect } from 'react';

export const getFineHalfWindow = (duration) => {
  if (!duration || duration <= 0) return 30;
  // 動画長の10%を基準にしつつ、最小10秒(±10秒)・最大60秒(±60秒)に制限
  return Math.min(60, Math.max(10, Math.round(duration * 0.1)));
};

export function useFineSeek({
  duration,
  currentTime,
  seekTo,
  isFineSeekActiveRef,
  onKeepControlsOpen,
  onRestartControlsTimeout,
}) {
  const [isFineSeekOpen, setIsFineSeekOpen] = useState(false);
  const [fineCenterTime, setFineCenterTime] = useState(0);
  const [originTime, setOriginTime] = useState(null);

  const mainBarRef = useRef(null);
  const longPressTimerRef = useRef(null);

  const latestTimeRef = useRef(currentTime);
  const durationRef = useRef(duration);
  const fineCenterTimeRef = useRef(0);
  const originTimeRef = useRef(null);
  const lastPlaybackTimeRef = useRef(currentTime);

  const isPressingMainBarRef = useRef(false);
  const isPressingFineBarRef = useRef(false);
  const isHoldingFineRef = useRef(false);
  const isSeekingRef = useRef(false);
  const suppressInitialJumpRef = useRef(false);

  const pressStartXRef = useRef(0);
  const lastClientXRef = useRef(0);
  const holdAnchorXRef = useRef(0);
  const holdAnchorTimeRef = useRef(0);

  useEffect(() => {
    latestTimeRef.current = currentTime;
    if (!isSeekingRef.current && !isPressingMainBarRef.current && !isPressingFineBarRef.current) {
      lastPlaybackTimeRef.current = currentTime;
    }
  }, [currentTime]);

  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const updateFineCenter = useCallback((center) => {
    fineCenterTimeRef.current = center;
    setFineCenterTime(center);
  }, []);

  const updateOriginTime = useCallback((time) => {
    originTimeRef.current = time;
    setOriginTime(time);
  }, []);

  const startLongPressTimer = useCallback(() => {
    clearLongPressTimer();
    longPressTimerRef.current = setTimeout(() => {
      const center = latestTimeRef.current;
      isHoldingFineRef.current = true;
      suppressInitialJumpRef.current = false;
      holdAnchorXRef.current = lastClientXRef.current;
      holdAnchorTimeRef.current = center;
      updateFineCenter(center);
      setIsFineSeekOpen(true);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(15);
      }
    }, 400);
  }, [clearLongPressTimer, updateFineCenter]);

  const closeFineSeek = useCallback(() => {
    clearLongPressTimer();
    isPressingMainBarRef.current = false;
    isPressingFineBarRef.current = false;
    isHoldingFineRef.current = false;
    isSeekingRef.current = false;
    suppressInitialJumpRef.current = false;
    isFineSeekActiveRef.current = false;
    updateOriginTime(null);
    setIsFineSeekOpen(false);
  }, [clearLongPressTimer, isFineSeekActiveRef, updateOriginTime]);

  const resetFineSeek = useCallback(() => {
    closeFineSeek();
  }, [closeFineSeek]);

  const updateLastPlaybackTime = useCallback((time) => {
    if (!isSeekingRef.current && !isPressingMainBarRef.current && !isPressingFineBarRef.current) {
      lastPlaybackTimeRef.current = time;
    }
  }, []);

  const handleMainBarStart = useCallback(
    (e) => {
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      isPressingMainBarRef.current = true;
      isSeekingRef.current = true;
      isHoldingFineRef.current = false;
      isFineSeekActiveRef.current = true;
      pressStartXRef.current = clientX;
      lastClientXRef.current = clientX;

      if (onKeepControlsOpen) onKeepControlsOpen();

      // シークバーに触れた瞬間の再生位置を一度だけ記録して表示
      updateOriginTime(lastPlaybackTimeRef.current);

      const bar = mainBarRef.current;
      const dur = durationRef.current;
      if (bar && dur > 0) {
        const rect = bar.getBoundingClientRect();
        const thumbX = rect.left + (latestTimeRef.current / dur) * rect.width;
        suppressInitialJumpRef.current = Math.abs(clientX - thumbX) <= 20;
      } else {
        suppressInitialJumpRef.current = false;
      }

      startLongPressTimer();
    },
    [isFineSeekActiveRef, onKeepControlsOpen, startLongPressTimer, updateOriginTime]
  );

  const finalizeFineBarRelease = useCallback(() => {
    isPressingFineBarRef.current = false;
    isSeekingRef.current = false;
    isFineSeekActiveRef.current = false;

    const releasedTime = latestTimeRef.current;
    lastPlaybackTimeRef.current = releasedTime;
    // 指を離したら元の位置マーカーを非表示にし、現在の再生位置が中心に来るようにレンジを更新
    updateOriginTime(null);
    updateFineCenter(releasedTime);

    if (onRestartControlsTimeout) onRestartControlsTimeout();
  }, [isFineSeekActiveRef, onRestartControlsTimeout, updateFineCenter, updateOriginTime]);

  useEffect(() => {
    const handleMove = (e) => {
      if (!isPressingMainBarRef.current) return;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      if (typeof clientX !== 'number') return;
      lastClientXRef.current = clientX;

      if (isHoldingFineRef.current) {
        const bar = mainBarRef.current;
        const dur = durationRef.current;
        if (!bar || !dur) return;
        const rect = bar.getBoundingClientRect();
        if (rect.width <= 0) return;

        const deltaX = clientX - holdAnchorXRef.current;
        const halfWindow = getFineHalfWindow(dur);
        const fineSpan = halfWindow * 2;
        const newTime = Math.min(
          Math.max(0, holdAnchorTimeRef.current + (deltaX / rect.width) * fineSpan),
          dur
        );

        latestTimeRef.current = newTime;
        seekTo(newTime);

        if (Math.abs(newTime - fineCenterTimeRef.current) > halfWindow * 0.85) {
          updateFineCenter(newTime);
        }
      } else {
        if (Math.abs(clientX - pressStartXRef.current) > 6) {
          suppressInitialJumpRef.current = false;
          pressStartXRef.current = clientX;
          startLongPressTimer();
        }
      }
    };

    const handleEnd = () => {
      if (isPressingFineBarRef.current) {
        finalizeFineBarRelease();
        return;
      }

      if (!isPressingMainBarRef.current) return;
      clearLongPressTimer();
      isPressingMainBarRef.current = false;
      suppressInitialJumpRef.current = false;
      isSeekingRef.current = false;
      isFineSeekActiveRef.current = false;
      isHoldingFineRef.current = false;

      const releasedTime = latestTimeRef.current;
      lastPlaybackTimeRef.current = releasedTime;
      // 指を離したら元の位置マーカーを非表示にし、現在の再生位置が中心に来るようにレンジを更新
      updateOriginTime(null);
      updateFineCenter(releasedTime);

      if (onRestartControlsTimeout) onRestartControlsTimeout();
    };

    window.addEventListener('touchmove', handleMove, { passive: true });
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('touchend', handleEnd);
    window.addEventListener('touchcancel', handleEnd);
    window.addEventListener('mouseup', handleEnd);

    return () => {
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('touchend', handleEnd);
      window.removeEventListener('touchcancel', handleEnd);
      window.removeEventListener('mouseup', handleEnd);
    };
  }, [
    clearLongPressTimer,
    finalizeFineBarRelease,
    isFineSeekActiveRef,
    onRestartControlsTimeout,
    seekTo,
    startLongPressTimer,
    updateFineCenter,
    updateOriginTime,
  ]);

  const handleMainBarChange = useCallback(
    (e) => {
      if (isHoldingFineRef.current || suppressInitialJumpRef.current) {
        return;
      }
      const time = Number(e.target.value);
      latestTimeRef.current = time;
      seekTo(time);
    },
    [seekTo]
  );

  const handleFineBarStart = useCallback(() => {
    isPressingFineBarRef.current = true;
    isSeekingRef.current = true;
    isFineSeekActiveRef.current = true;
    if (onKeepControlsOpen) onKeepControlsOpen();
    // 詳細シークバーに触れた瞬間の再生位置を一度だけ記録して表示
    updateOriginTime(lastPlaybackTimeRef.current);
  }, [isFineSeekActiveRef, onKeepControlsOpen, updateOriginTime]);

  const handleFineBarChange = useCallback(
    (e) => {
      const time = Number(e.target.value);
      latestTimeRef.current = time;
      seekTo(time);
    },
    [seekTo]
  );

  const handleFineBarEnd = useCallback(() => {
    if (!isPressingFineBarRef.current) return;
    finalizeFineBarRelease();
  }, [finalizeFineBarRelease]);

  const fineHalfWindow = getFineHalfWindow(duration);
  const safeDuration = duration || 100;
  const fineSpan = Math.min(fineHalfWindow * 2, safeDuration);
  let fineMin = Math.max(0, fineCenterTime - fineHalfWindow);
  let fineMax = fineMin + fineSpan;
  if (fineMax > safeDuration) {
    fineMax = safeDuration;
    fineMin = Math.max(0, fineMax - fineSpan);
  }

  return {
    mainBarRef,
    isFineSeekOpen,
    originTime,
    fineMin,
    fineMax,
    fineHalfWindow,
    handleMainBarStart,
    handleMainBarChange,
    handleFineBarStart,
    handleFineBarChange,
    handleFineBarEnd,
    closeFineSeek,
    resetFineSeek,
    updateLastPlaybackTime,
  };
}
