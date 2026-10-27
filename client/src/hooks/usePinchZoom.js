import { useState, useEffect, useRef, useCallback } from 'react';

const MIN_SCALE = 1;
const MAX_SCALE = 5;

export function usePinchZoom(containerRef) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const scaleRef = useRef(1);
  const positionRef = useRef({ x: 0, y: 0 });
  const isGestureRef = useRef(false);

  const resetZoom = useCallback(() => {
    scaleRef.current = 1;
    positionRef.current = { x: 0, y: 0 };
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let isPinching = false;
    let isPanning = false;
    let prevDistance = null;
    let prevMidpoint = null;
    let prevTouch = null;
    let startTouch = null;

    const getDistance = (touches) => {
      return Math.hypot(
        touches[0].clientX - touches[1].clientX,
        touches[0].clientY - touches[1].clientY
      );
    };

    const getMidpoint = (touches) => ({
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    });

    const clampPosition = (x, y, currentScale) => {
      if (currentScale <= 1) return { x: 0, y: 0 };
      const rect = container.getBoundingClientRect();
      const maxOffsetX = (rect.width * (currentScale - 1)) / 2;
      const maxOffsetY = (rect.height * (currentScale - 1)) / 2;
      return {
        x: Math.min(Math.max(x, -maxOffsetX), maxOffsetX),
        y: Math.min(Math.max(y, -maxOffsetY), maxOffsetY),
      };
    };

    const handleTouchStart = (e) => {
      if (e.touches.length === 2) {
        isPinching = true;
        isPanning = false;
        isGestureRef.current = true;
        prevDistance = getDistance(e.touches);
        prevMidpoint = getMidpoint(e.touches);
      } else if (e.touches.length === 1) {
        isGestureRef.current = false;
        if (e.target.closest('button, input, [data-controls]')) return;

        if (scaleRef.current > 1) {
          isPanning = true;
          prevTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
          startTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
      }
    };

    const handleTouchMove = (e) => {
      if (e.touches.length === 2 && isPinching && prevDistance && prevMidpoint) {
        if (e.cancelable) e.preventDefault();

        const currentDistance = getDistance(e.touches);
        const currentMidpoint = getMidpoint(e.touches);

        const prevScale = scaleRef.current;
        const newScale = Math.min(
          Math.max(prevScale * (currentDistance / prevDistance), MIN_SCALE),
          MAX_SCALE
        );

        const rect = container.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const prevRelX = prevMidpoint.x - centerX;
        const prevRelY = prevMidpoint.y - centerY;
        const currentRelX = currentMidpoint.x - centerX;
        const currentRelY = currentMidpoint.y - centerY;

        const scaleRatio = newScale / prevScale;
        const rawX = currentRelX - (prevRelX - positionRef.current.x) * scaleRatio;
        const rawY = currentRelY - (prevRelY - positionRef.current.y) * scaleRatio;

        const newPos = clampPosition(rawX, rawY, newScale);

        scaleRef.current = newScale;
        positionRef.current = newPos;
        setScale(newScale);
        setPosition(newPos);

        prevDistance = currentDistance;
        prevMidpoint = currentMidpoint;
      } else if (e.touches.length === 1 && isPanning && prevTouch && scaleRef.current > 1) {
        const touch = e.touches[0];
        if (
          startTouch &&
          Math.hypot(touch.clientX - startTouch.x, touch.clientY - startTouch.y) > 5
        ) {
          isGestureRef.current = true;
        }

        if (e.cancelable) e.preventDefault();

        const deltaX = touch.clientX - prevTouch.x;
        const deltaY = touch.clientY - prevTouch.y;
        const newPos = clampPosition(
          positionRef.current.x + deltaX,
          positionRef.current.y + deltaY,
          scaleRef.current
        );

        positionRef.current = newPos;
        setPosition(newPos);
        prevTouch = { x: touch.clientX, y: touch.clientY };
      }
    };

    const handleTouchEnd = (e) => {
      if (e.touches.length < 2) {
        isPinching = false;
        prevDistance = null;
        prevMidpoint = null;
      }

      if (e.touches.length === 1 && scaleRef.current > 1 && !e.target.closest('button, input, [data-controls]')) {
        isPanning = true;
        prevTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        startTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 0) {
        isPanning = false;
        prevTouch = null;
        startTouch = null;
      }
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);
    container.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [containerRef]);

  return {
    scale,
    position,
    isGestureRef,
    resetZoom,
  };
}
