import { useState, useEffect, useRef } from 'react';

export function useGridColumns(initialMobile = 3, initialDesktop = 6) {
  // レスポンシブな初期値の決定
  const getInitialColumns = () => {
    const saved = window.localStorage.getItem('jellyfin_gridColumns');
    if (saved) return parseInt(saved, 10);
    return window.innerWidth < 768 ? initialMobile : initialDesktop;
  };

  const [columns, setColumnsState] = useState(getInitialColumns);
  const columnsRef = useRef(columns);

  const setColumns = (newCols) => {
    // 画面幅に応じて最小・最大列数を制限
    const isMobile = window.innerWidth < 768;
    const minCols = isMobile ? 1 : 4;
    const maxCols = isMobile ? 6 : 12;
    
    // 範囲内に制限
    const clamped = Math.max(minCols, Math.min(Math.round(newCols), maxCols));
    if (clamped !== columnsRef.current) {
      columnsRef.current = clamped;
      setColumnsState(clamped);
      window.localStorage.setItem('jellyfin_gridColumns', clamped.toString());
    }
  };

  // ウィンドウリサイズ時にもし現在の列数が範囲外になっていたら自動補正する
  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < 768;
      const minCols = isMobile ? 1 : 4;
      const maxCols = isMobile ? 6 : 12;
      
      if (columnsRef.current > maxCols) {
        setColumns(maxCols);
      } else if (columnsRef.current < minCols) {
        setColumns(minCols);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
        
        // ratioに応じて列数を計算。少し感度を下げるために倍率を調整することも可能
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
  }, []);

  return columns;
}
