// Runtime state for sync: status pill + last synced timestamp + last error.
// The actual sync logic lives in services/sync.ts. This store coordinates
// triggers (manual button, app foreground, debounced mutation) and exposes
// state to the UI.

import { create } from 'zustand';
import { sync as runSync } from '../services/sync';

export type SyncStatus = 'idle' | 'syncing' | 'error';

interface SyncStore {
  status: SyncStatus;
  lastSyncedAt: number | null; // ms-epoch
  lastError: string | null;
  syncNow: () => Promise<void>;
}

export const useSyncStore = create<SyncStore>((set, get) => ({
  status: 'idle',
  lastSyncedAt: null,
  lastError: null,
  syncNow: async () => {
    // Coalesce concurrent triggers — if a sync is already running, drop this
    // call. The in-flight one will pick up the latest state when it finishes
    // since we always read fresh local data inside sync().
    if (get().status === 'syncing') return;
    set({ status: 'syncing', lastError: null });
    const result = await runSync();
    set({
      status: result.ok ? 'idle' : 'error',
      lastSyncedAt: result.ok ? Date.now() : get().lastSyncedAt,
      lastError: result.ok ? null : result.error ?? 'Sync failed',
    });
  },
}));
