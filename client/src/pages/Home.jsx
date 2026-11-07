import { RefreshCw } from 'lucide-react';
import { Sidebar } from '../components/common/Sidebar';
import { SearchBar } from '../components/home/SearchBar';
import { VideoGrid } from '../components/home/VideoGrid';
import { ControlBar } from '../components/home/ControlBar';
import { useVideos } from '../hooks/useVideos';
import { useSwipe } from '../hooks/useSwipe';
import { usePullToRefresh } from '../hooks/usePullToRefresh';

function Home() {
  const {
    loading,
    libraries,
    selectedLibraryId,
    setSelectedLibraryId,
    isDrawerOpen,
    setIsDrawerOpen,
    searchQuery,
    handleSearch,
    allUniqueTags,
    isFavoriteFilter,
    setIsFavoriteFilter,
    allFiltered,
    displayed,
    handleLoadMore,
    handleVideoClick,
    sortOrder,
    toggleSortOrder,
    handleShuffle,
    handleRandomPlay,
    reloadVideos,
    scrollToTopBtnRef
  } = useVideos();

  // 右スワイプ時にサイドバー(Drawer)を開く処理を設定
  const swipeHandlers = useSwipe({
    onSwipeRight: () => setIsDrawerOpen(true)
  });

  // 一番上で更に上へスクロール（引っ張り / ホイール上回転）した時にグリッドを再読み込み
  const { pullDistance, isThresholdReached } = usePullToRefresh({
    onRefresh: reloadVideos,
    disabled: loading || isDrawerOpen
  });

  return (
    <div 
      className="min-h-screen bg-zinc-900 text-zinc-200 flex flex-col relative pb-24"
      {...swipeHandlers}
    >
      {/* SideBar */}
      <Sidebar 
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        libraries={libraries}
        selectedLibraryId={selectedLibraryId}
        onSelectLibrary={setSelectedLibraryId}
      />

      {/* SearchBar */}
      <SearchBar 
        onOpenMenu={() => setIsDrawerOpen(true)}
        searchQuery={searchQuery}
        onSearch={handleSearch}
        tags={allUniqueTags}
        isFavoriteFilter={isFavoriteFilter}
        onToggleFavorite={() => setIsFavoriteFilter(!isFavoriteFilter)}
        resultCount={allFiltered.length}
      />

      {/* プルリフレッシュのインジケーター */}
      {pullDistance > 0 && (
        <div
          className="flex items-center justify-center gap-2 overflow-hidden text-zinc-400 text-xs select-none"
          style={{ height: `${pullDistance}px` }}
        >
          <RefreshCw
            size={18}
            className={isThresholdReached ? 'text-zinc-200' : 'text-zinc-500'}
            style={{ transform: `rotate(${pullDistance * 3}deg)` }}
          />
          <span className={isThresholdReached ? 'text-zinc-200 font-medium' : 'text-zinc-500'}>
            {isThresholdReached ? '離して再読み込み' : '引っ張って再読み込み'}
          </span>
        </div>
      )}

      {/* VideoGrid */}
      <VideoGrid 
        loading={loading}
        displayedVideos={displayed}
        allFilteredVideos={allFiltered}
        onLoadMore={handleLoadMore}
        onVideoClick={handleVideoClick}
      />
      
      {/* ControlBar */}
      <ControlBar 
        sortOrder={sortOrder}
        onToggleSortOrder={toggleSortOrder}
        onShuffle={handleShuffle}
        onRandomPlay={handleRandomPlay}
        scrollToTopBtnRef={scrollToTopBtnRef}
        onScrollToTop={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      />

    </div>
  );
}

export default Home;
