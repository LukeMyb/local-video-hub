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
