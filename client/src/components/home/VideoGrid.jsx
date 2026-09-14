import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getImageUrl } from '../../api/jellyfin';
import { Heart } from 'lucide-react';
import { useGridColumns } from '../../hooks/useGridColumns';
import { VirtuosoGrid } from 'react-virtuoso';
import React from 'react';

// VirtuosoGridに渡すためのカスタムコンポーネント（再生成を防ぐためコンポーネント外に静的に定義）
const gridComponents = {
  // 全体を囲むグリッドコンテナ
  List: React.forwardRef(({ style, children, ...props }, ref) => (
    <div
      ref={ref}
      {...props}
      style={{
        ...style,
        display: 'grid',
        // CSS変数を使って列数を動的に受け取る
        gridTemplateColumns: 'repeat(var(--grid-columns, 6), minmax(0, 1fr))',
      }}
      className="gap-2 lg:gap-4"
    >
      {children}
    </div>
  )),
  // 個々のアイテムのラッパー
  Item: ({ children, ...props }) => (
    <div {...props} className="flex w-full">
      {children}
    </div>
  )
};

export function VideoGrid({ 
  loading, 
  allFilteredVideos, 
  onVideoClick 
}) {
  const columns = useGridColumns();

  return (
    // 親要素のstyleにCSS変数として現在の列数を渡す
    <div className="p-2 md:p-4 pt-0 flex-1 w-full" style={{ '--grid-columns': columns }}>
      {loading ? (
        <p className="text-zinc-500 text-center mt-8 text-sm">読み込み中...</p>
      ) : (
        <VirtuosoGrid
          useWindowScroll
          totalCount={allFilteredVideos.length}
          components={gridComponents}
          overscan={500} // スクロール前後の余裕を持たせる（px）
          itemContent={(index) => {
            const video = allFilteredVideos[index];
            if (!video) return null;

            return (
              <Link 
                to={`/player/${video.Id}`}
                state={{ 
                  playlist: allFilteredVideos.map(v => ({ 
                    Id: v.Id, 
                    UserData: { IsFavorite: v.UserData?.IsFavorite || false } 
                  })) 
                }}
                key={video.Id} 
                className="relative rounded-md overflow-hidden bg-[#27272a] border border-zinc-800 hover:bg-zinc-700 transition-colors block group w-full"
                onClick={onVideoClick}
              >
                <img
                  src={getImageUrl(video.Id)}
                  alt={video.Name}
                  className="w-full aspect-2/3 object-cover bg-zinc-800 transition-opacity group-hover:opacity-90"
                  loading="lazy"
                />

                {video.UserData?.IsFavorite && (
                  <div className="absolute bottom-1 right-1 p-1 md:p-2 pointer-events-none z-10">
                    <Heart className="w-5 h-5 md:w-6 md:h-6 fill-white text-white drop-shadow-[0_0_8px_rgba(0,0,0,0.8)]"/>
                  </div>
                )}
              </Link>
            );
          }}
        />
      )}
    </div>
  );
}