import { useState, useRef, useCallback, useEffect } from 'react';

// 1時間(3600秒) -> ±5分(300秒, 全幅600秒)、10分(600秒) -> ±1分(60秒, 全幅120秒) となる指数
const FINE_SCALE_EXPONENT = Math.log(5) / Math.log(6);
const MIN_HALF_WINDOW = 5; // 最小レンジ ±5秒（全幅10秒）
const MAX_FINE_LEVELS = 2; // 詳細シークバーは最大2個まで

export const getNextHalfWindow = (parentSpan) => {
  if (!parentSpan || parentSpan <= MIN_HALF_WINDOW * 2) {
    return MIN_HALF_WINDOW;
  }
  const rawHalf = 60 * Math.pow(parentSpan / 600, FINE_SCALE_EXPONENT);
  return Math.max(
    MIN_HALF_WINDOW,
    Math.min(Math.round(rawHalf), Math.floor(parentSpan * 0.25))
  );
};

export const getLevelBounds = (centerTime, halfWindow, duration) => {
  const safeDuration = duration || 100;
  const span = Math.min(halfWindow * 2, safeDuration);
  let min = Math.max(0, centerTime - halfWindow);
  let max = min + span;
  if (max > safeDuration) {
    max = safeDuration;
    min = Math.max(0, max - span);
  }
  return { min, max, range: Math.max(max - min, 0.1) };
};

export function useFineSeek({
  duration,
  currentTime,
  seekTo,
  isFineSeekActiveRef,
  onKeepControlsOpen,
  onRestartControlsTimeout,
}) {
  // 各階層の [{ halfWindow, centerTime }, ...] （最大2段: index 0 が1段目、index 1 が2段目）
  const [fineLevels, setFineLevels] = useState([]);
  const [originTime, setOriginTime] = useState(null);

  const longPressTimerRef = useRef(null);

  const latestTimeRef = useRef(currentTime);
  const durationRef = useRef(duration);
  const fineLevelsRef = useRef([]);
  const originTimeRef = useRef(null);
  const lastPlaybackTimeRef = useRef(currentTime);

  const isPressingBarRef = useRef(false);
  const activeBarElementRef = useRef(null);
  const activeLevelIndexRef = useRef(-1);
  const isHoldingSpawnedFineRef = useRef(false);
  const spawnedHalfWindowRef = useRef(30);
  const isSeekingRef = useRef(false);
  const suppressInitialJumpRef = useRef(false);

  const pressStartXRef = useRef(0);
  const lastClientXRef = useRef(0);
  const holdAnchorXRef = useRef(0);
  const holdAnchorTimeRef = useRef(0);

  useEffect(() => {
    latestTimeRef.current = currentTime;
    if (!isSeekingRef.current && !isPressingBarRef.current) {
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

  const updateFineLevels = useCallback((nextLevels) => {
    fineLevelsRef.current = nextLevels;
    setFineLevels(nextLevels);
  }, []);

  const updateOriginTime = useCallback((time) => {
    originTimeRef.current = time;
    setOriginTime(time);
  }, []);

  const startLongPressTimer = useCallback(
    (levelIndex) => {
      clearLongPressTimer();
      // 詳細シークバーは最大2個まで（levelIndex: -1 -> 1個目, 0 -> 2個目）
      if (levelIndex + 1 >= MAX_FINE_LEVELS) return;

      longPressTimerRef.current = setTimeout(() => {
        // 再生位置が動いている状態なら詳細シークバーを出さない
        if (!suppressInitialJumpRef.current) return;

        const dur = durationRef.current || 0;
        const currentLevels = fineLevelsRef.current;
        const parentSpan =
          levelIndex === -1
            ? dur
            : (currentLevels[levelIndex]?.halfWindow || 0) * 2;

        if (parentSpan <= MIN_HALF_WINDOW * 2) return;

        const nextHalfWindow = getNextHalfWindow(parentSpan);
        if (nextHalfWindow >= parentSpan * 0.5) return;

        const center = latestTimeRef.current;
        isHoldingSpawnedFineRef.current = true;
        spawnedHalfWindowRef.current = nextHalfWindow;
        suppressInitialJumpRef.current = false;
        holdAnchorXRef.current = lastClientXRef.current;
        holdAnchorTimeRef.current = center;

        const keptLevels = currentLevels
          .slice(0, levelIndex + 1)
          .map((lvl) => ({ ...lvl, centerTime: center }));
        const nextLevels = [
          ...keptLevels,
          { halfWindow: nextHalfWindow, centerTime: center },
        ];
        updateFineLevels(nextLevels);

        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(15);
        }
      }, 400);
    },
    [clearLongPressTimer, updateFineLevels]
  );

  const closeFineSeek = useCallback(() => {
    clearLongPressTimer();
    isPressingBarRef.current = false;
    activeBarElementRef.current = null;
    activeLevelIndexRef.current = -1;
    isHoldingSpawnedFineRef.current = false;
    isSeekingRef.current = false;
    suppressInitialJumpRef.current = false;
    isFineSeekActiveRef.current = false;
    updateOriginTime(null);
    updateFineLevels([]);
  }, [clearLongPressTimer, isFineSeekActiveRef, updateFineLevels, updateOriginTime]);

  const resetFineSeek = useCallback(() => {
    closeFineSeek();
  }, [closeFineSeek]);

  const updateLastPlaybackTime = useCallback((time) => {
    if (!isSeekingRef.current && !isPressingBarRef.current) {
      lastPlaybackTimeRef.current = time;
    }
  }, []);

  // levelIndex: -1 = メインシークバー, 0 = 1段目の詳細シークバー, 1 = 2段目の詳細シークバー
  const handleBarStart = useCallback(
    (levelIndex, e) => {
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const barEl = e.currentTarget;

      isPressingBarRef.current = true;
      activeBarElementRef.current = barEl;
      activeLevelIndexRef.current = levelIndex;
      isSeekingRef.current = true;
      isHoldingSpawnedFineRef.current = false;
      isFineSeekActiveRef.current = true;
      pressStartXRef.current = clientX;
      lastClientXRef.current = clientX;

      if (onKeepControlsOpen) onKeepControlsOpen();

      // シークバーに触れた瞬間の再生位置を一度だけ記録して表示
      updateOriginTime(lastPlaybackTimeRef.current);

      const dur = durationRef.current;
      if (barEl && dur > 0) {
        const rect = barEl.getBoundingClientRect();
        let min = 0;
        let max = dur;
        if (levelIndex >= 0 && fineLevelsRef.current[levelIndex]) {
          const lvl = fineLevelsRef.current[levelIndex];
          const bounds = getLevelBounds(lvl.centerTime, lvl.halfWindow, dur);
          min = bounds.min;
          max = bounds.max;
        }
        const ratio = (latestTimeRef.current - min) / Math.max(max - min, 0.1);
        const thumbX = rect.left + ratio * rect.width;
        suppressInitialJumpRef.current = Math.abs(clientX - thumbX) <= 24;
      } else {
        suppressInitialJumpRef.current = false;
      }

      // 再生位置が動かない判定（現在のツマミ位置付近を押さえている状態）のときだけ長押しタイマーを開始
      if (suppressInitialJumpRef.current && levelIndex + 1 < MAX_FINE_LEVELS) {
        startLongPressTimer(levelIndex);
      } else {
        clearLongPressTimer();
      }
    },
    [clearLongPressTimer, isFineSeekActiveRef, onKeepControlsOpen, startLongPressTimer, updateOriginTime]
  );

  useEffect(() => {
    const handleMove = (e) => {
      if (!isPressingBarRef.current) return;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      if (typeof clientX !== 'number') return;
      lastClientXRef.current = clientX;

      if (isHoldingSpawnedFineRef.current) {
        const barEl = activeBarElementRef.current;
        const dur = durationRef.current;
        if (!barEl || !dur) return;
        const rect = barEl.getBoundingClientRect();
        if (rect.width <= 0) return;

        const deltaX = clientX - holdAnchorXRef.current;
        const halfWindow = spawnedHalfWindowRef.current;
        const fineSpan = halfWindow * 2;
        const newTime = Math.min(
          Math.max(0, holdAnchorTimeRef.current + (deltaX / rect.width) * fineSpan),
          dur
        );

        latestTimeRef.current = newTime;
        seekTo(newTime);

        const topIdx = fineLevelsRef.current.length - 1;
        if (
          topIdx >= 0 &&
          Math.abs(newTime - fineLevelsRef.current[topIdx].centerTime) > halfWindow * 0.85
        ) {
          const updated = fineLevelsRef.current.map((lvl, idx) =>
            idx === topIdx ? { ...lvl, centerTime: newTime } : lvl
          );
          updateFineLevels(updated);
        }
      } else {
        // 指を動かして再生位置を動かしている判定になったら長押しタイマーを解除する
        if (Math.abs(clientX - pressStartXRef.current) > 6) {
          suppressInitialJumpRef.current = false;
          clearLongPressTimer();
        }
      }
    };

    const handleEnd = () => {
      if (!isPressingBarRef.current) return;
      clearLongPressTimer();
      isPressingBarRef.current = false;
      activeBarElementRef.current = null;
      activeLevelIndexRef.current = -1;
      suppressInitialJumpRef.current = false;
      isSeekingRef.current = false;
      isFineSeekActiveRef.current = false;
      isHoldingSpawnedFineRef.current = false;

      const releasedTime = latestTimeRef.current;
      lastPlaybackTimeRef.current = releasedTime;
      // 指を離したら元の位置マーカーを非表示にし、すべての詳細シークバーの中心を現在の再生位置に更新
      updateOriginTime(null);

      if (fineLevelsRef.current.length > 0) {
        const recentered = fineLevelsRef.current.map((lvl) => ({
          ...lvl,
          centerTime: releasedTime,
        }));
        updateFineLevels(recentered);
      }

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
    isFineSeekActiveRef,
    onRestartControlsTimeout,
    seekTo,
    updateFineLevels,
    updateOriginTime,
  ]);

  const handleBarChange = useCallback(
    (e) => {
      if (isHoldingSpawnedFineRef.current || suppressInitialJumpRef.current) {
        return;
      }
      // 再生位置が動いた場合は長押し判定をキャンセル
      clearLongPressTimer();
      const time = Number(e.target.value);
      latestTimeRef.current = time;
      seekTo(time);
    },
    [clearLongPressTimer, seekTo]
  );

  return {
    fineLevels,
    originTime,
    handleBarStart,
    handleBarChange,
    closeFineSeek,
    resetFineSeek,
    updateLastPlaybackTime,
  };
}
