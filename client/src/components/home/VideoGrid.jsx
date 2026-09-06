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
              state={{ playlist: allFilteredVideos }}
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

              {/* サムネイル下部のタグ表示エリア */}
              {video.Tags && video.Tags.length > 0 && (
                <div 
                  className="absolute bottom-0 left-0 right-0 p-1.5 bg-linear-to-t from-black/95 via-black/70 to-transparent flex flex-wrap gap-1 max-h-[20%] overflow-y-auto"
                  style={{ scrollbarWidth: 'none' }} /* Firefox等でスクロールバーを非表示にする */
                >
                  {video.Tags.map(tag => (
                    <span 
                      key={tag} 
                      className="text-[9px] md:text-[10px] text-zinc-300 bg-zinc-900/80 px-1 py-0.5 rounded-sm border border-zinc-700/50 break-all"
                    >
                      {/* 表示時はスペースをアンダースコアに変換 */}
                      {tag.replace(/ /g, '_')}
                    </span>
                  ))}
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