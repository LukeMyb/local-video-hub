import { useState, useEffect, useRef } from 'react';

const PULL_THRESHOLD = 60;
const MAX_PULL_DISTANCE = 100;
const WHEEL_THRESHOLD = 180;
const TOP_COOLDOWN_MS = 400;

export function usePullToRefresh({ onRefresh, disabled = false }) {
  const [pullDistance, setPullDistance] = useState(0);
  const pullDistanceRef = useRef(0);
  const onRefreshRef = useRef(onRefresh);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    if (disabled) {
      pullDistanceRef.current = 0;
      return;
    }

    let startX = null;
    let startY = null;
    let isPulling = false;
    let wheelAccum = 0;
    let wheelResetTimer = null;
    let lastNotAtTopTime = window.scrollY > 0 ? Date.now() : 0;

    const updatePull = (val) => {
      pullDistanceRef.current = val;
      setPullDistance(val);
    };

    const resetTouch = () => {
      startX = null;
      startY = null;
      isPulling = false;
      if (pullDistanceRef.current !== 0) {
        updatePull(0);
      }
    };

    const handleScroll = () => {
      if (window.scrollY > 0) {
        lastNotAtTopTime = Date.now();
        wheelAccum = 0;
        if (isPulling) resetTouch();
      }
    };

    const handleTouchStart = (e) => {
      if (window.scrollY > 0 || e.touches.length !== 1) {
        resetTouch();
        return;
      }
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      isPulling = false;
    };

    const handleTouchMove = (e) => {
      if (startY === null || e.touches.length !== 1 || window.scrollY > 0) {
        resetTouch();
        return;
      }

      const deltaX = e.touches[0].clientX - startX;
      const deltaY = e.touches[0].clientY - startY;

      if (!isPulling) {
        // 横スワイプ（ドロワー表示）や下スクロールの場合はプル判定を中断
        if (Math.abs(deltaX) > 12 || deltaY < -5) {
          resetTouch();
          return;
        }
        if (deltaY > 10 && deltaY > Math.abs(deltaX) * 1.2) {
          isPulling = true;
        }
      }

      if (isPulling && deltaY > 0) {
        if (e.cancelable) {
          e.preventDefault();
        }
        const damped = Math.min(Math.round(deltaY * 0.45), MAX_PULL_DISTANCE);
        updatePull(damped);
      }
    };

    const handleTouchEnd = () => {
      if (isPulling && pullDistanceRef.current >= PULL_THRESHOLD) {
        if (onRefreshRef.current) onRefreshRef.current();
      }
      resetTouch();
    };

    const handleWheel = (e) => {
      if (e.shiftKey) {
        wheelAccum = 0;
        return;
      }

      if (window.scrollY <= 0 && e.deltaY < 0) {
        // 下から一番上へスクロールしてきた直後の慣性ホイールは無視する
        if (Date.now() - lastNotAtTopTime < TOP_COOLDOWN_MS) {
          return;
        }

        wheelAccum += Math.abs(e.deltaY);
        if (wheelResetTimer) clearTimeout(wheelResetTimer);
        wheelResetTimer = setTimeout(() => {
          wheelAccum = 0;
        }, 300);

        if (wheelAccum >= WHEEL_THRESHOLD) {
          wheelAccum = 0;
          lastNotAtTopTime = Date.now();
          if (onRefreshRef.current) onRefreshRef.current();
        }
      } else {
        wheelAccum = 0;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchcancel', resetTouch);
    window.addEventListener('wheel', handleWheel, { passive: true });

    return () => {
      if (wheelResetTimer) clearTimeout(wheelResetTimer);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', resetTouch);
      window.removeEventListener('wheel', handleWheel);
    };
  }, [disabled]);

  const effectivePullDistance = disabled ? 0 : pullDistance;

  return {
    pullDistance: effectivePullDistance,
    isThresholdReached: effectivePullDistance >= PULL_THRESHOLD,
  };
}
