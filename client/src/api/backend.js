const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || `http://${window.location.hostname}:9096`;
const BACKEND_API_KEY = import.meta.env.VITE_BACKEND_API_KEY;

export const trashVideo = async (videoPath) => {
  const response = await fetch(`${BACKEND_URL}/api/videos/trash`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      video_path: videoPath,
      api_key: BACKEND_API_KEY,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || '動画の削除（ゴミ箱への移動）に失敗しました');
  }

  return response.json();
};

export const restoreVideo = async (videoPath) => {
  const response = await fetch(`${BACKEND_URL}/api/videos/restore`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      video_path: videoPath,
      api_key: BACKEND_API_KEY,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || '動画の復元に失敗しました');
  }

  return response.json();
};

export const moveVideo = async (videoPath, targetLibrary) => {
  const response = await fetch(`${BACKEND_URL}/api/videos/move`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      video_path: videoPath,
      target_library: targetLibrary,
      api_key: BACKEND_API_KEY,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || '動画の移動に失敗しました');
  }

  return response.json();
};

export const getFavorites = async () => {
  const response = await fetch(`${BACKEND_URL}/api/favorites`);
  if (!response.ok) {
    throw new Error('お気に入り一覧の取得に失敗しました');
  }
  const data = await response.json();
  return data.favorites || [];
};

export const toggleFavorite = async (filename) => {
  const response = await fetch(`${BACKEND_URL}/api/favorites/toggle`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      filename,
      api_key: BACKEND_API_KEY,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'お気に入りの状態変更に失敗しました');
  }

  const data = await response.json();
  return data.is_favorite;
};

export const getDuplicates = async ({ library = null, threshold = 0.92 } = {}) => {
  const url = new URL(`${BACKEND_URL}/api/duplicates`);
  if (library) {
    url.searchParams.append('library', library);
  }
  if (threshold) {
    url.searchParams.append('threshold', String(threshold));
  }

  const response = await fetch(url.toString());
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || '重複動画一覧の取得に失敗しました');
  }

  return response.json();
};

export const scanDuplicates = async ({ library = null, force = false, runAsync = true } = {}) => {
  const response = await fetch(`${BACKEND_URL}/api/duplicates/scan`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      api_key: BACKEND_API_KEY,
      library,
      force,
      run_async: runAsync,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || '重複スキャンの開始に失敗しました');
  }

  return response.json();
};

export const getBackendVideoStreamUrl = (relPath) => {
  return `${BACKEND_URL}/api/videos/stream?rel_path=${encodeURIComponent(relPath)}`;
};

export const resolveDuplicate = async ({
  trashRelPath,
  keepRelPaths,
  mergeMetadata = true,
}) => {
  const response = await fetch(`${BACKEND_URL}/api/duplicates/resolve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      trash_rel_path: trashRelPath,
      keep_rel_paths: keepRelPaths,
      merge_metadata: mergeMetadata,
      api_key: BACKEND_API_KEY,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || '重複動画の削除（引き継ぎ）に失敗しました');
  }

  return response.json();
};

export const resolveDuplicatesBatch = async ({ items, mergeMetadata = true }) => {
  const response = await fetch(`${BACKEND_URL}/api/duplicates/resolve-batch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      items,
      merge_metadata: mergeMetadata,
      api_key: BACKEND_API_KEY,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || '重複動画の一括削除に失敗しました');
  }

  return response.json();
};

export const getSystemStatus = async () => {
  const response = await fetch(`${BACKEND_URL}/api/system/status`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'システム情報の取得に失敗しました');
  }
  return response.json();
};
