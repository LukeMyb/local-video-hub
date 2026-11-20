import { useState, useEffect, useCallback } from 'react';

const LOCAL_STORAGE_SYNC_EVENT = 'local-storage-sync';

// ローカルストレージの値とReactのStateを同期させるカスタムフック
export function useLocalStorage(key, initialValue) {
  // Stateの初期化関数。初回レンダリング時のみ実行され、ローカルストレージから既存の値を読み込む
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn("ローカルストレージの読み込みエラー:", error);
      return initialValue;
    }
  });

  // 状態とローカルストレージの双方を同時に更新する関数
  const setValue = useCallback((value) => {
    try {
      setStoredValue((prev) => {
        const valueToStore = value instanceof Function ? value(prev) : value;
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
        window.dispatchEvent(
          new CustomEvent(LOCAL_STORAGE_SYNC_EVENT, {
            detail: { key, newValue: valueToStore },
          })
        );
        return valueToStore;
      });
    } catch (error) {
      console.warn("ローカルストレージの保存エラー:", error);
    }
  }, [key]);

  // 同一タブ内の別コンポーネントや別タブからの更新を同期
  useEffect(() => {
    const handleCustomSync = (e) => {
      if (e.detail?.key === key) {
        setStoredValue(e.detail.newValue);
      }
    };
    const handleStorageChange = (e) => {
      if (e.key === key) {
        try {
          setStoredValue(e.newValue !== null ? JSON.parse(e.newValue) : initialValue);
        } catch (error) {
          console.warn("ローカルストレージの同期エラー:", error);
        }
      }
    };

    window.addEventListener(LOCAL_STORAGE_SYNC_EVENT, handleCustomSync);
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener(LOCAL_STORAGE_SYNC_EVENT, handleCustomSync);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [key, initialValue]);

  return [storedValue, setValue];
}