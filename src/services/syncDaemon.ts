import { db } from './offlineQueue';
import { supabase } from './supabaseClient';

class SyncDaemon {
  private intervalId: any = null;
  private isSyncing = false;

  public start(intervalMs = 15000) {
    if (this.intervalId) return;

    // Listen to online events
    window.addEventListener('online', () => {
      console.log('SyncDaemon: Connection restored, triggering sync...');
      this.sync();
    });

    this.intervalId = setInterval(() => {
      if (navigator.onLine) {
        this.sync();
      }
    }, intervalMs);
  }

  public stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  public async sync() {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      const queue = await db.syncQueue.orderBy('timestamp').toArray();
      if (queue.length === 0) {
        this.isSyncing = false;
        return;
      }

      console.log(`SyncDaemon: Found ${queue.length} pending actions to sync...`);

      for (const item of queue) {
        let success = false;

        if (item.action === 'INSERT') {
          const { error } = await supabase.from(item.table).insert(item.payload);
          if (!error) success = true;
          else console.error(`SyncDaemon: Insert failed on ${item.table}`, error);
        } else if (item.action === 'UPDATE') {
          // Assuming payload has id / primary key field
          const pkField = Object.keys(item.payload)[0]; // simple fallback
          const { error } = await supabase
            .from(item.table)
            .update(item.payload)
            .eq(pkField, item.payload[pkField]);
          if (!error) success = true;
          else console.error(`SyncDaemon: Update failed on ${item.table}`, error);
        }

        if (success && item.id !== undefined) {
          await db.syncQueue.delete(item.id);
        } else {
          // If failed, stop processing the queue to preserve order
          break;
        }
      }
    } catch (err) {
      console.error('SyncDaemon: Unexpected error during sync:', err);
    } finally {
      this.isSyncing = false;
    }
  }
}

export const syncDaemon = new SyncDaemon();
