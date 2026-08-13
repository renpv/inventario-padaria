import { useState, useEffect } from 'react';
import { saveLocalDraft, getLocalDraft, deleteLocalDraft } from '../services/offlineQueue';

export const useIndexedDB = <T>(key: string, initialData: T) => {
  const [data, setData] = useState<T>(initialData);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDraft = async () => {
      try {
        const saved = await getLocalDraft(key);
        if (saved !== null) {
          setData(saved as T);
        }
      } catch (err) {
        console.error('Failed to load draft from IndexedDB:', err);
      } finally {
        setLoading(false);
      }
    };
    loadDraft();
  }, [key]);

  const updateData = async (newData: T | ((prev: T) => T)) => {
    setData((prev) => {
      const resolved = typeof newData === 'function' ? (newData as (prev: T) => T)(prev) : newData;
      saveLocalDraft(key, resolved).catch((err) =>
        console.error('Failed to save draft to IndexedDB:', err)
      );
      return resolved;
    });
  };

  const clearDraft = async () => {
    try {
      await deleteLocalDraft(key);
      setData(initialData);
    } catch (err) {
      console.error('Failed to delete draft from IndexedDB:', err);
    }
  };

  return { data, updateData, clearDraft, loading };
};
