import { useState, useEffect, useRef, useCallback } from 'react';
import {
  getOrientation,
  clampColumns,
  buildColumnsPair,
  loadColumnsPair,
  saveColumnsPair,
} from '../utils/gridColumns';

export function useGridColumns(initialMobile = 3, initialDesktop = 6) {
  // 縦横それぞれの列数を保持する。ユーザーが列数を変えると、もう一方の向きの列数も比率から再計算される
  const [initial] = useState(() => {
    const orientation = getOrientation();
    return { orientation, pair: loadColumnsPair(orientation, initialMobile, initialDesktop) };
  });

  const orientationRef = useRef(initial.orientation);
  const pairRef = useRef(initial.pair);

  const [columns, setColumnsState] = useState(() =>
    clampColumns(initial.pair[initial.orientation], initial.orientation)
  );
  const columnsRef = useRef(columns);

  const applyColumns = useCallback((cols) => {
    if (cols !== columnsRef.current) {
      columnsRef.current = cols;
      setColumnsState(cols);
    }
  }, []);

  // ユーザー操作（ピンチ・ホイール）による列数の変更
  const setColumns = useCallback((newCols) => {
    const orientation = orientationRef.current;
    // 画面の向き・端末に応じて最小・最大列数を制限
    const clamped = clampColumns(newCols, orientation);
    if (clamped !== columnsRef.current) {
      pairRef.current = buildColumnsPair(clamped, orientation);
      saveColumnsPair(pairRef.current);
      applyColumns(clamped);
    }
  }, [applyColumns]);

  // 画面の回転・ウィンドウリサイズへの対応
  useEffect(() => {
    const handleViewportChange = () => {
      const next = getOrientation();

      if (next !== orientationRef.current) {
        // 向きが変わったら、保持しているその向き用の列数に切り替える
        orientationRef.current = next;
        applyColumns(clampColumns(pairRef.current[next], next));
        return;
      }

      // 向きが同じ場合は、現在の列数が範囲外になっていたら自動補正する（PCのウィンドウリサイズ等）
      const clamped = clampColumns(columnsRef.current, next);
      if (clamped !== columnsRef.current) {
        setColumns(clamped);
      }
    };

    window.addEventListener('resize', handleViewportChange);
    const screenOrientation = window.screen?.orientation;
    if (screenOrientation) {
      screenOrientation.addEventListener('change', handleViewportChange);
    } else {
      window.addEventListener('orientationchange', handleViewportChange);
    }

    return () => {
      window.removeEventListener('resize', handleViewportChange);
      if (screenOrientation) {
        screenOrientation.removeEventListener('change', handleViewportChange);
      } else {
        window.removeEventListener('orientationchange', handleViewportChange);
      }
    };
  }, [applyColumns, setColumns]);

  useEffect(() => {
    // --- PC用: Shift + ホイール ---
    let wheelAccumulator = 0;
    const handleWheel = (e) => {
      if (e.shiftKey) {
        e.preventDefault(); // デフォルトのスクロールや横スクロール（戻る等）を防止
        
        wheelAccumulator += e.deltaY;
        
        // ホイールの感度調整（例: 100 蓄積するごとに1列変更）
        if (wheelAccumulator > 100) {
          setColumns(columnsRef.current + 1); // 縮小（列を増やす）
          wheelAccumulator = 0;
        } else if (wheelAccumulator < -100) {
          setColumns(columnsRef.current - 1); // 拡大（列を減らす）
          wheelAccumulator = 0;
        }
      } else {
        wheelAccumulator = 0;
      }
    };

    // --- スマホ用: ピンチイン・ピンチアウト ---
    let initialDistance = null;
    let initialColsAtTouchStart = null;

    const getDistance = (touches) => {
      return Math.hypot(
        touches[0].clientX - touches[1].clientX,
        touches[0].clientY - touches[1].clientY
      );
    };

    const handleTouchStart = (e) => {
      if (e.touches.length === 2) {
        initialDistance = getDistance(e.touches);
        initialColsAtTouchStart = columnsRef.current;
      }
    };

    const handleTouchMove = (e) => {
      if (e.touches.length === 2 && initialDistance) {
        // デフォルトのブラウザズームを防止
        if (e.cancelable) {
          e.preventDefault();
        }

        const currentDistance = getDistance(e.touches);
        const ratio = initialDistance / currentDistance;
        
        // ピンチイン（狭める）-> ratio > 1 -> 列を増やす（縮小）
        // ピンチアウト（広げる）-> ratio < 1 -> 列を減らす（拡大）
        const newCols = Math.round(initialColsAtTouchStart * ratio);
        setColumns(newCols);
      }
    };

    const handleTouchEnd = (e) => {
      if (e.touches.length < 2) {
        initialDistance = null;
        initialColsAtTouchStart = null;
      }
    };

    // { passive: false } を指定して preventDefault() を有効にする
    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [setColumns]);

  return columns;
}
