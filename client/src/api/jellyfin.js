const API_URL = import.meta.env.VITE_JELLYFIN_URL;
const API_KEY = import.meta.env.VITE_JELLYFIN_API_KEY;
const USER_ID = import.meta.env.VITE_JELLYFIN_USER_ID;

export const getVideos = async (libraryId = null) => {
  const url = new URL(`${API_URL}/Items`);
  // APIキーをクエリパラメータとして付与
  url.searchParams.append('api_key', API_KEY);
  // 動画ファイルのみを取得対象とする
  url.searchParams.append('IncludeItemTypes', 'Movie,Episode,Video');
  // フォルダ階層を無視してすべてのアイテムをフラットに取得する
  url.searchParams.append('Recursive', 'true');
  // ソート用にDateCreated(追加日時)を取得する
  url.searchParams.append('Fields', 'DateCreated,Tags');

  // ユーザーIDをパラメータに付与して、お気に入りデータ等を含める
  if (USER_ID) {
    url.searchParams.append('userId', USER_ID);
  }

  // ライブラリ(ParentId)での絞り込み
  if (libraryId) {
    url.searchParams.append('ParentId', libraryId);
  }

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error('動画の取得に失敗しました');
  }

  const data = await res.json();
    
  // デバッグ用にお気に入りステータスが取得できているか確認
  if (data.Items && data.Items.length > 0) {
    console.log('UserData(お気に入り等)の取得確認:', data.Items[0].UserData);
  }

  return data;
};

// ライブラリ(Views)一覧の取得
export const getLibraries = async () => {
  if (!USER_ID) {
    throw new Error('ユーザーIDが設定されていません');
  }

  const url = new URL(`${API_URL}/Users/${USER_ID}/Views`);
  url.searchParams.append('api_key', API_KEY);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error('ライブラリの取得に失敗しました');
  }

  const data = await res.json();
  return data; // { Items: [...] } が返る
};

export const getVideoInfo = async (itemId) => {
  if (!USER_ID) {
    throw new Error('ユーザーIDが設定されていません');
  }

  const url = new URL(`${API_URL}/Users/${USER_ID}/Items/${itemId}`);
  url.searchParams.append('api_key', API_KEY);
  url.searchParams.append('Fields', 'Path');

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error('動画情報の取得に失敗しました');
  }

  return await res.json();
};

export const getImageUrl = (itemId) => {
  // サムネイル画像用のURLを構築
  return `${API_URL}/Items/${itemId}/Images/Primary?fillHeight=300&fillWidth=200&quality=90`;
};

export const getVideoStreamUrl = (itemId) => {
  // static=true を付与してDirect Play（静的ファイル配信）を強制する
  return `${API_URL}/Videos/${itemId}/stream?api_key=${API_KEY}&static=true`;
};

// お気に入りのトグル処理
export const toggleFavorite = async (videoId, currentIsFavorite) => {
  if (!USER_ID) {
    throw new Error('ユーザーIDが設定されていません');
  }

  const method = currentIsFavorite ? 'DELETE' : 'POST';
  
  // 既存の API_URL と USER_ID を使用してURLを構築
  const url = new URL(`${API_URL}/Users/${USER_ID}/FavoriteItems/${videoId}`);
  
  // 既存の関数と同様にクエリパラメータで api_key を渡す
  url.searchParams.append('api_key', API_KEY);

  const response = await fetch(url.toString(), {
    method: method,
  });

  if (!response.ok) {
    throw new Error('お気に入りの状態変更に失敗しました');
  }

  const data = await response.json();
  return data.IsFavorite; 
};