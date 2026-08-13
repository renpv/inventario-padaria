import Dexie from 'dexie';
import type { Table } from 'dexie';

/** Payload de uma linha (ou várias, para insert/upsert em lote) de qualquer tabela do Supabase. */
export type OfflineActionPayload = Record<string, unknown> | Record<string, unknown>[];

export interface OfflineSyncItem {
  id?: number;
  table: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE' | 'UPSERT';
  payload: OfflineActionPayload;
  /** Usado apenas quando action === 'UPSERT' (ex.: "id_lancamento,id_produto"). */
  onConflict?: string;
  timestamp: number;
}

export interface LocalDraft {
  key: string; // "draft_inv_{id_turno}_{id_setor}"
  data: unknown;
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
  action: 'INSERT' | 'UPDATE' | 'DELETE' | 'UPSERT',
  payload: OfflineActionPayload,
  onConflict?: string
) => {
  await db.syncQueue.add({
    table,
    action,
    payload,
    onConflict,
    timestamp: Date.now(),
  });
};

export const saveLocalDraft = async (key: string, data: unknown) => {
  await db.drafts.put({
    key,
    data,
    updated_at: Date.now(),
  });
};

export const getLocalDraft = async (key: string): Promise<unknown | null> => {
  const draft = await db.drafts.get(key);
  return draft ? draft.data : null;
};

export const deleteLocalDraft = async (key: string) => {
  await db.drafts.delete(key);
};

// Cache local do "lançamento ativo" (id_lancamento) de um turno no dia
// corrente. Evita depender de uma nova chamada de rede a `iniciar_turno`
// toda vez que o operador troca de setor, e permite continuar gravando itens
// do mesmo lançamento mesmo se a conexão cair depois que o turno já foi
// iniciado (o que exige rede).
const activeLancamentoKey = (id_turno: string) => {
  const today = new Date().toISOString().slice(0, 10);
  return `lancamento_ativo_${id_turno}_${today}`;
};

export const cacheActiveLancamento = async (id_turno: string, id_lancamento: string) => {
  await saveLocalDraft(activeLancamentoKey(id_turno), id_lancamento);
};

export const getCachedActiveLancamento = async (id_turno: string): Promise<string | null> => {
  const cached = await getLocalDraft(activeLancamentoKey(id_turno));
  return typeof cached === 'string' ? cached : null;
};
