import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { getImageUrl } from '../../api/jellyfin';
import { Heart } from 'lucide-react';

export function VideoGrid({ 
  loading, 
  displayedVideos, 
  allFilteredVideos, 
  onLoadMore, 
  onVideoClick 
}) {
  // 無限スクロールの監視対象となるDOMの参照
  const observerTarget = useRef(null);

  // IntersectionObserverを用いて、ページ最下部付近に到達したことを検知する
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        // 監視対象が画面内に入ったら追加読み込み処理を発火
        if (entries[0].isIntersecting) {
          onLoadMore();
        }
      },
      // 下端から400px手前で早めに読み込みを開始する
      { rootMargin: '400px' }
    );

    if (observerTarget.current) observer.observe(observerTarget.current);
    
    // クリーンアップ関数で監視を解除
    return () => observer.disconnect();
  }, [onLoadMore]);

  return (
    <div className="p-2 md:p-4 pt-0 flex-1 flex flex-col gap-4 w-full">
      {loading ? (
        <p className="text-zinc-500 text-center mt-8 text-sm">読み込み中...</p>
      ) : (
        <div className="grid grid-cols-3 md:grid-cols-6 landscape:grid-cols-6 gap-2 lg:gap-4">
          {displayedVideos.map((video) => (
            <Link 
              to={`/player/${video.Id}`}
              // 遷移先のプレイヤーにシャッフルや連続再生用のプレイリスト情報を渡す
              // History APIのサイズ制限(pushState)に引っかからないよう、必要なプロパティのみに軽量化する
              state={{ 
                playlist: allFilteredVideos.map(v => ({ 
                  Id: v.Id, 
                  UserData: { IsFavorite: v.UserData?.IsFavorite || false } 
                })) 
              }}
              key={video.Id} 
              className="relative rounded-md overflow-hidden bg-[#27272a] border border-zinc-800 hover:bg-zinc-700 transition-colors block group"
              onClick={onVideoClick}
            >
              <img
                src={getImageUrl(video.Id)}
                alt={video.Name}
                className="w-full aspect-2/3 object-cover bg-zinc-800 transition-opacity group-hover:opacity-90"
                loading="lazy"
              />

              {/* お気に入りマークの表示 */}
              {video.UserData?.IsFavorite && (
                <div className="absolute bottom-1 right-1 p-1 md:p-2 pointer-events-none z-10">
                  <Heart className="w-5 h-5 md:w-6 md:h-6 fill-white text-white drop-shadow-[0_0_8px_rgba(0,0,0,0.8)]"/>
                </div>
              )}
            </Link>
          ))}
        </div>
      )}

      {/* 無限スクロールの検知用見えないブロック */}
      <div ref={observerTarget} className="h-20" />
    </div>
  );
}