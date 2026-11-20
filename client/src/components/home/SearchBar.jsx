import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, Search as SearchIcon, Heart, Ellipsis, Copy, Settings, X } from 'lucide-react';

export function SearchBar({
  onOpenMenu,
  onOpenSettings,
  searchQuery,
  onSearch,
  tags, // サジェスト候補の元となる全タグリスト
  isFavoriteFilter,
  onToggleFavorite,
  resultCount // 絞り込み後の動画件数
}) {
  const navigate = useNavigate();
  // 入力欄を直接操作（フォーカスや値の取得）するためのRef
  const inputRef = useRef(null);
  // サジェスト領域外のクリック判定用Ref
  const suggestRef = useRef(null);
  // その他メニュー領域外のクリック判定用Ref
  const moreMenuRef = useRef(null);

  // 検索サジェストUIの表示・非表示と入力状態を管理するState
  const [inputText, setInputText] = useState(searchQuery || '');
  const [showClearButton, setShowClearButton] = useState(!!searchQuery);
  const [showSuggest, setShowSuggest] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  // 入力文字に基づくサジェスト候補の絞り込み処理
  const suggestedTags = useMemo(() => {
    const trimmedInput = inputText.trim().toLowerCase();
    if (!trimmedInput) return []; // 入力が空ならサジェストしない
    
    // 複数のキーワード（スペース区切り）に対応するため、最後に入力中のキーワードでサジェストを行う
    const keywords = trimmedInput.split(/\s+/);
    const currentKeyword = keywords[keywords.length - 1];
    if (!currentKeyword) return [];

    return tags.filter(tag => 
      tag.toLowerCase().startsWith(currentKeyword)
    ).slice(0, 10); // 表示は最大10件までに制限
  }, [inputText, tags]);

  // 検索を実行し、親コンポーネント(Home)に検索クエリを渡す
  const handleSearchExecute = () => {
    const query = inputRef.current ? inputRef.current.value : '';
    setShowSuggest(false);
    onSearch(query);
  };

  // 検索窓をクリアし、フォーカスを戻す処理
  const handleClearSearch = () => {
    if (inputRef.current) {
      inputRef.current.value = '';
      inputRef.current.focus(); 
    }
    setInputText('');
    setShowClearButton(false);
    setShowSuggest(false);
    onSearch(''); // 空文字で検索を実行（リストをリセット）
  };

  // 入力値の変更を検知してクリアボタンやサジェストの表示状態を切り替える
  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputText(val);
    setShowClearButton(val.length > 0);
    setShowSuggest(true);
  };

  // Enterキーでの検索実行を検知（IME変換中のEnterは無視する）
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (e.nativeEvent.isComposing) return;
      handleSearchExecute();
    }
  };

  // サジェストされたタグがクリックされた時の補完処理
  const handleSuggestClick = (tag) => {
    if (!inputRef.current) return;
    
    // 現在の入力をスペースで分割し、入力中の最後の単語をクリックされたタグに置き換える
    const currentWords = inputText.trim().split(/\s+/);
    currentWords.pop();
    currentWords.push(tag);
    
    const newSearchString = currentWords.join(' ');
    
    inputRef.current.value = newSearchString;
    setInputText(newSearchString);
    setShowSuggest(false);
    setShowClearButton(true);
    
    onSearch(newSearchString); // 即座に検索を実行
  };

  // 検索窓やサジェスト枠の外側をクリックした時にサジェストやメニューを閉じる処理
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        suggestRef.current && !suggestRef.current.contains(event.target) &&
        inputRef.current && !inputRef.current.contains(event.target)
      ) {
        setShowSuggest(false);
      }
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target)) {
        setIsMoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  return (
    <div className="p-3 portrait:pt-16 md:p-4 md:portrait:pt-4 md:sticky md:top-0 md:z-40 md:bg-zinc-900/90 md:backdrop-blur-md md:border-b md:border-zinc-800 flex flex-col gap-3">
      {/* 上段: 操作パネル */}
      <div className="flex items-center gap-2 md:gap-4">
        {/* メニュー（ドロワー）を開くボタン */}
        <button 
          onClick={onOpenMenu}
          className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-colors"
          title="メニューを開く"
        >
          <Menu size={24} />
        </button>

        {/* 検索窓エリア */}
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="タグで動画を検索..."
            className="w-full py-2.5 pl-3 pr-10 bg-[#27272a] rounded-md text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
            ref={inputRef}
            defaultValue={searchQuery}
            onKeyDown={handleKeyDown}
            onChange={handleInputChange}
            onFocus={() => { if (inputRef.current?.value) setShowSuggest(true); }}
          />
          {showClearButton && (
            <button
              onClick={handleClearSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-md transition-colors"
              title="検索をクリア"
            >
              <X size={18} />
            </button>
          )}

          {/* サジェストドロップダウンUI */}
          {showSuggest && suggestedTags.length > 0 && (
            <div 
              ref={suggestRef}
              className="absolute top-full left-0 right-0 mt-1 bg-[#27272a] border border-zinc-700 rounded-md shadow-xl overflow-hidden z-50 max-h-60 overflow-y-auto"
            >
              {suggestedTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => handleSuggestClick(tag)}
                  className="w-full text-left px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 虫眼鏡（検索実行）ボタン */}
        <button 
          onClick={handleSearchExecute}
          className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-colors"
          title="検索する"
        >
          <SearchIcon size={24} />
        </button>

        {/* お気に入りフィルターボタン */}
        <button 
          onClick={onToggleFavorite}
          className={`p-2 rounded-md transition-colors ${
            isFavoriteFilter 
              ? 'text-white hover:bg-zinc-800'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
          }`}
          title="お気に入りのみ表示"
        >
          <Heart size={24} className={isFavoriteFilter ? 'fill-current' : ''} />
        </button>

        {/* その他メニューボタン */}
        <div ref={moreMenuRef} className="relative">
          <button
            type="button"
            onClick={() => setIsMoreMenuOpen((prev) => !prev)}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-colors"
            title="メニュー"
          >
            <Ellipsis size={24} />
          </button>

          {isMoreMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-zinc-900/95 backdrop-blur-md border border-zinc-800 rounded-xl shadow-2xl py-1.5 z-50 overflow-hidden">
              <button
                type="button"
                onClick={() => {
                  setIsMoreMenuOpen(false);
                  navigate('/duplicates');
                }}
                className="w-full px-4 py-2.5 text-sm text-zinc-200 hover:text-white hover:bg-zinc-800/80 transition-colors flex items-center gap-3 text-left"
              >
                <Copy size={17} className="shrink-0" />
                <span>重複動画の確認</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsMoreMenuOpen(false);
                  if (onOpenSettings) onOpenSettings();
                }}
                className="w-full px-4 py-2.5 text-sm text-zinc-200 hover:text-white hover:bg-zinc-800/80 transition-colors flex items-center gap-3 text-left"
              >
                <Settings size={17} className="shrink-0" />
                <span>設定</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 下段: ステータスメッセージ */}
      <div className="px-2 flex items-center justify-between text-sm">
        <p className="text-zinc-400">
          {searchQuery || isFavoriteFilter ? '絞り込み結果' : 'すべての動画'}
          <span className="ml-2 text-zinc-200 font-medium">{resultCount}件</span>
        </p>
      </div>
    </div>
  );
}