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
  // ソート用にDateCreated(追加日時)やファイル名照合用にPathなどを取得する
  url.searchParams.append('Fields', 'DateCreated,Tags,ImageTags,Path');

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

export const getImageUrl = (video) => {
  // サムネイル画像用のURLを構築
  const tag = video.ImageTags?.Primary;
  const tagParam = tag ? `&tag=${tag}` : '';
  return `${API_URL}/Items/${video.Id}/Images/Primary?fillHeight=300&fillWidth=200&quality=90${tagParam}`;
};

export const getVideoStreamUrl = (itemId) => {
  // static=true を付与してDirect Play（静的ファイル配信）を強制する
  return `${API_URL}/Videos/${itemId}/stream?api_key=${API_KEY}&static=true`;
};

// ライブラリの全体スキャン（更新）を強制的にトリガーする
export const refreshLibrary = async () => {
  if (!API_KEY) {
    throw new Error('APIキーが設定されていません');
  }

  const url = new URL(`${API_URL}/Library/Refresh`);
  url.searchParams.append('api_key', API_KEY);

  const response = await fetch(url.toString(), {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error('ライブラリのスキャン要求に失敗しました');
  }
};
