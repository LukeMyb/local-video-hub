// グリッド列数の計算ロジック（縦横画面ごとの列数管理）

// 縦画面の列数に対する横画面の列数の比率（縦:横 = 1:LANDSCAPE_COLUMN_RATIO）
// 例: 2 の場合、縦3列 ⇔ 横6列
export const LANDSCAPE_COLUMN_RATIO = 2;

// スマホ縦画面での列数の範囲（横画面はこれに比率を掛けた範囲になる）
const MOBILE_PORTRAIT_LIMITS = { min: 1, max: 6 };
// PCの狭いウィンドウでの列数の範囲
const NARROW_WINDOW_LIMITS = { min: 1, max: 6 };
// PCでの列数の範囲
const DESKTOP_LIMITS = { min: 4, max: 12 };

export const STORAGE_KEY = 'jellyfin_gridColumnsByOrientation';
// 縦横別に保存する前の旧キー（移行用）
export const LEGACY_STORAGE_KEY = 'jellyfin_gridColumns';

const otherOrientation = (orientation) => (orientation === 'portrait' ? 'landscape' : 'portrait');

// 端末の向きを取得する
// screen.orientation はキーボード表示などによるビューポートの変化に影響されないため優先して使う
export const getOrientation = () => {
  const type = window.screen?.orientation?.type;
  if (type) return type.startsWith('portrait') ? 'portrait' : 'landscape';
  return window.matchMedia('(orientation: portrait)').matches ? 'portrait' : 'landscape';
};

// 端末の短辺で判定するため、回転しても結果が変わらない
export const isMobileDevice = () =>
  Math.min(window.screen.width, window.screen.height) < 768;

export const getLimits = (orientation) => {
  if (isMobileDevice()) {
    if (orientation === 'landscape') {
      return {
        min: Math.round(MOBILE_PORTRAIT_LIMITS.min * LANDSCAPE_COLUMN_RATIO),
        max: Math.round(MOBILE_PORTRAIT_LIMITS.max * LANDSCAPE_COLUMN_RATIO),
      };
    }
    return MOBILE_PORTRAIT_LIMITS;
  }
  return window.innerWidth < 768 ? NARROW_WINDOW_LIMITS : DESKTOP_LIMITS;
};

export const clampColumns = (cols, orientation) => {
  const { min, max } = getLimits(orientation);
  return Math.max(min, Math.min(Math.round(cols), max));
};

// ある向きの列数を、もう一方の向きの列数に比率で換算する
export const convertColumns = (cols, from, to) => {
  if (from === to) return cols;
  return to === 'landscape'
    ? Math.round(cols * LANDSCAPE_COLUMN_RATIO)
    : Math.round(cols / LANDSCAPE_COLUMN_RATIO);
};

// 現在の向きの列数から、縦横両方の列数を組み立てる
export const buildColumnsPair = (cols, orientation) => {
  const other = otherOrientation(orientation);
  return {
    [orientation]: cols,
    [other]: clampColumns(convertColumns(cols, orientation, other), other),
  };
};

const isValidPair = (pair) =>
  pair && Number.isFinite(pair.portrait) && Number.isFinite(pair.landscape);

// 保存済みの列数を読み込む（無ければ旧キーから移行、それも無ければ初期値）
export const loadColumnsPair = (orientation, initialMobile, initialDesktop) => {
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
    if (isValidPair(stored)) return stored;
  } catch {
    // 壊れた値は無視して作り直す
  }

  const legacy = parseInt(window.localStorage.getItem(LEGACY_STORAGE_KEY), 10);
  if (Number.isFinite(legacy)) {
    return buildColumnsPair(clampColumns(legacy, orientation), orientation);
  }

  if (isMobileDevice()) {
    // スマホの初期値は縦画面基準で決め、横画面は比率から算出する
    return buildColumnsPair(clampColumns(initialMobile, 'portrait'), 'portrait');
  }
  const initial = window.innerWidth < 768 ? initialMobile : initialDesktop;
  return buildColumnsPair(clampColumns(initial, orientation), orientation);
};

export const saveColumnsPair = (pair) => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pair));
};
