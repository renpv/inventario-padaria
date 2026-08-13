import Dexie from 'dexie';
import type { Table } from 'dexie';

export interface OfflineSyncItem {
  id?: number;
  table: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  payload: any;
  timestamp: number;
}

export interface LocalDraft {
  key: string; // "draft_inv_{id_turno}_{id_setor}"
  data: any;
  updated_at: number;
}

class OfflineDatabase extends Dexie {
  syncQueue!: Table<OfflineSyncItem, number>;
  drafts!: Table<LocalDraft, string>;

  constructor() {
    super('OfflineDatabase');
    this.version(1).stores({
      syncQueue: '++id, table, action, timestamp',
      drafts: 'key, updated_at',
    });
  }
}

export const db = new OfflineDatabase();

export const enqueueOfflineAction = async (
  table: string,
  action: 'INSERT' | 'UPDATE' | 'DELETE',
  payload: any
) => {
  await db.syncQueue.add({
    table,
    action,
    payload,
    timestamp: Date.now(),
  });
};

export const saveLocalDraft = async (key: string, data: any) => {
  await db.drafts.put({
    key,
    data,
    updated_at: Date.now(),
  });
};

export const getLocalDraft = async (key: string): Promise<any | null> => {
  const draft = await db.drafts.get(key);
  return draft ? draft.data : null;
};

export const deleteLocalDraft = async (key: string) => {
  await db.drafts.delete(key);
};
