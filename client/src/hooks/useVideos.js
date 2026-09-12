import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getVideos, getLibraries } from '../api/jellyfin';
import { useLocalStorage } from './useLocalStorage';

export function useVideos() {
  const navigate = useNavigate();
  const [videos, setVideos] = useState([]);
  const [libraries, setLibraries] = useState([]);
  const [loading, setLoading] = useState(true);

  // ローカルストレージと同期する状態
  const [searchQuery, setSearchQuery] = useLocalStorage('jellyfin_searchQuery', '');
  const [isFavoriteFilter, setIsFavoriteFilter] = useLocalStorage('jellyfin_isFavorite', false);
  const [selectedLibraryId, setSelectedLibraryId] = useLocalStorage('jellyfin_libraryId', null);
  const [sortOrder, setSortOrder] = useLocalStorage('jellyfin_sortOrder', 'desc');

  // UIの状態
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isControlBarVisible, setIsControlBarVisible] = useState(true);
  
  // 無限スクロール用の表示件数
  const [displayCount, setDisplayCount] = useState(() => {
    const saved = sessionStorage.getItem('jellyfin_displayCount');
    return saved ? parseInt(saved, 10) : 100;
  });

  const isFirstMountForFilter = useRef(true);
  const scrollToTopBtnRef = useRef(null);

  // 1. 初回マウント時にライブラリ一覧を取得
  useEffect(() => {
    const fetchLibs = async () => {
      try {
        const data = await getLibraries();
        setLibraries(data.Items || []);
      } catch (error) {
        console.error(error);
      }
    };
    fetchLibs();
  }, []);

  // 2. 選択されたライブラリが変わるたびに動画を取得
  useEffect(() => {
    const fetchVideos = async () => {
      setLoading(true);
      try {
        const data = await getVideos(selectedLibraryId);
        setVideos(data.Items || []);
      } catch (error) {
        console.error(error);
      }
      setLoading(false);
    };
    fetchVideos();
  }, [selectedLibraryId]);

  // 3. フィルターやライブラリが変わった時のリセット処理
  useEffect(() => {
    if (isFirstMountForFilter.current) {
      isFirstMountForFilter.current = false;
      return;
    }
    setDisplayCount(100);
    sessionStorage.setItem('jellyfin_displayCount', '100');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [isFavoriteFilter, selectedLibraryId]);

  // 4. スクロール位置の復元
  useEffect(() => {
    if (!loading) {
      const saved = sessionStorage.getItem('jellyfin_scrollPosition');
      if (saved) {
        // ブラウザのネイティブなスクロール復元と競合しないよう、
        // 描画サイクルを少し遅らせてから確実にスクロールさせる
        requestAnimationFrame(() => {
          window.scrollTo({ top: parseInt(saved, 10), behavior: 'instant' });
        });
        sessionStorage.removeItem('jellyfin_scrollPosition');
      }
    }
  }, [loading]);

  // 5. スクロール検知（コントロールバーと上に戻るボタンの制御）
  useEffect(() => {
    let lastScrollY = window.scrollY;
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          
          if (currentScrollY < lastScrollY) {
            setIsControlBarVisible(true);
          } else if (currentScrollY > lastScrollY && currentScrollY > 50) {
            setIsControlBarVisible(false);
          }
          lastScrollY = currentScrollY;
          ticking = false;
        });
        ticking = true;
      }
    };

    const handleScrollTopBtn = () => {
      if (!scrollToTopBtnRef.current) return;
      if (window.scrollY > 300) {
        scrollToTopBtnRef.current.style.opacity = "1";
        scrollToTopBtnRef.current.style.pointerEvents = "auto";
        scrollToTopBtnRef.current.style.transform = "translateY(0)";
      } else {
        scrollToTopBtnRef.current.style.opacity = "0";
        scrollToTopBtnRef.current.style.pointerEvents = "none";
        scrollToTopBtnRef.current.style.transform = "translateY(10px)";
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('scroll', handleScrollTopBtn, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('scroll', handleScrollTopBtn);
    };
  }, []);

  // --- 計算ロジック ---

  // サジェスト用タグリスト生成
  const allUniqueTags = useMemo(() => {
    if (!videos || videos.length === 0) return [];
    const tagSet = new Set();
    videos.forEach(video => {
      if (video.Tags && video.Tags.length > 0) {
        video.Tags.forEach(tag => tagSet.add(tag.replace(/ /g, '_')));
      }
    });
    return Array.from(tagSet).sort((a, b) => a.localeCompare(b));
  }, [videos]);

  // フィルタリングとソートの適用
  const { allFiltered, displayed } = useMemo(() => {
    if (!videos) return { allFiltered: [], displayed: [] };
    
    let filtered = [...videos];
    
    if (isFavoriteFilter) {
      filtered = filtered.filter(video => video.UserData?.IsFavorite);
    }

    if (searchQuery.trim()) {
      const keywords = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);
      filtered = filtered.filter(video => {
        const tags = video.Tags || [];
        return keywords.every(keyword => {
          const normalizedKeyword = keyword.replace(/_/g, ' ');
          return tags.some(tag => tag.toLowerCase() === normalizedKeyword);
        });
      });
    }

    filtered.sort((a, b) => {
      const dateA = new Date(a.DateCreated || 0).getTime();
      const dateB = new Date(b.DateCreated || 0).getTime();
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });

    return {
      allFiltered: filtered,
      displayed: filtered.slice(0, displayCount)
    };
  }, [videos, sortOrder, isFavoriteFilter, displayCount, searchQuery]);

  // --- イベントハンドラ ---

  const handleSearch = useCallback((newQuery) => {
    setSearchQuery(newQuery);
    setDisplayCount(100);
    sessionStorage.setItem('jellyfin_displayCount', '100');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [setSearchQuery]);

  const toggleSortOrder = useCallback(() => {
    setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
    setDisplayCount(100);
    sessionStorage.setItem('jellyfin_displayCount', '100');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [setSortOrder]);

  const handleLoadMore = useCallback(() => {
    setDisplayCount((prev) => {
      const newCount = prev + 100;
      sessionStorage.setItem('jellyfin_displayCount', newCount.toString());
      return newCount;
    });
  }, []);

  const handleVideoClick = useCallback(() => {
    const currentScrollY = window.scrollY;
    sessionStorage.setItem('jellyfin_scrollPosition', currentScrollY.toString());
    sessionStorage.setItem('jellyfin_displayCount', displayCount.toString());
  }, [displayCount]);

  const handleRandomPlay = useCallback(() => {
    if (!allFiltered || allFiltered.length === 0) return;

    const shuffleArray = (array) => {
      const newArray = [...array];
      for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
      }
      return newArray;
    };
    
    // History APIのサイズ制限対策として、Idとお気に入り情報だけを残した軽量オブジェクトに変換
    const lightweightPlaylist = allFiltered.map(v => ({
      Id: v.Id,
      UserData: { IsFavorite: v.UserData?.IsFavorite || false }
    }));
    
    const shuffledPlaylist = shuffleArray(lightweightPlaylist);
    const randomVideo = shuffledPlaylist[0];
    
    navigate(`/player/${randomVideo.Id}`, { state: { playlist: shuffledPlaylist } });
  }, [allFiltered, navigate]);


  // Componentで必要なStateや関数を全て返す
  return {
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
    isControlBarVisible,
    sortOrder,
    toggleSortOrder,
    handleRandomPlay,
    scrollToTopBtnRef
  };
}