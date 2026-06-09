// Pull → merge → push. The merge is per-row, last-writer-wins by updatedAt.
// Tombstones (rows with deletedAt set) participate in the merge like any
// other row, so a late edit on one device can resurrect a row another
// device deleted (and vice versa) — whichever has the newer updatedAt wins.
//
// On Drive the storage shape is a single JSON file (AppData) in the user's
// appDataFolder. It contains both active rows and tombstones in flat lists;
// the deletedAt column distinguishes them.

import { Platform } from 'react-native';
import { AppData, Category, Task } from '../types';
import * as db from './db';
import { useTaskStore } from '../store/taskStore';
import {
  createSyncFile,
  downloadJson,
  DriveFile,
  findSyncFile,
  updateSyncFile,
} from './drive';

const IS_WEB = Platform.OS === 'web';
const FILE_VERSION = 1;

export interface SyncResult {
  ok: boolean;
  pulled: boolean; // remote had changes we adopted
  pushed: boolean; // local had changes we uploaded
  error?: string;
}

// ── pure merge helpers (exported for tests) ───────────────────────────────────

function flatten<T extends { deletedAt?: string | null }>(active: T[], tombstones: T[]): T[] {
  return [...active, ...tombstones];
}

function split<T extends { deletedAt?: string | null }>(rows: T[]): { active: T[]; tombstones: T[] } {
  const active: T[] = [];
  const tombstones: T[] = [];
  for (const r of rows) {
    if (r.deletedAt) tombstones.push(r);
    else active.push(r);
  }
  return { active, tombstones };
}

export function mergeRows<T extends { updatedAt: string }>(
  local: T[],
  remote: T[],
  keyOf: (row: T) => string,
): T[] {
  const m = new Map<string, T>();
  for (const r of local) m.set(keyOf(r), r);
  for (const r of remote) {
    const existing = m.get(keyOf(r));
    if (!existing || r.updatedAt > existing.updatedAt) m.set(keyOf(r), r);
  }
  return Array.from(m.values());
}

// Stable, order-independent canonical form for comparing two states.
function canonicalize(data: { tasks: Task[]; categories: Category[] }): string {
  const tasks = [...data.tasks].sort((a, b) => a.id.localeCompare(b.id));
  const categories = [...data.categories].sort((a, b) => a.code.localeCompare(b.code));
  return JSON.stringify({ tasks, categories });
}

// ── platform-specific local I/O ───────────────────────────────────────────────

function readLocal(): { tasks: Task[]; categories: Category[] } {
  if (IS_WEB) {
    const s = useTaskStore.getState();
    return {
      tasks: flatten(s.tasks, s.tombstones.tasks),
      categories: flatten(s.categories, s.tombstones.categories),
    };
  }
  return {
    tasks: db.getAllTasksIncludingDeleted(),
    categories: db.getAllCategoriesIncludingDeleted(),
  };
}

function writeLocal(merged: { tasks: Task[]; categories: Category[] }): void {
  // SQLite first on native — that's the source of truth — then mirror into
  // the zustand store so the UI updates.
  if (!IS_WEB) {
    for (const t of merged.tasks) db.upsertTask(t);
    for (const c of merged.categories) db.upsertCategory(c);
  }

  const { active: tA, tombstones: tT } = split(merged.tasks);
  const { active: cA, tombstones: cT } = split(merged.categories);
  useTaskStore.setState({
    tasks: tA,
    categories: cA,
    tombstones: { tasks: tT, categories: cT },
  });
}

// ── sync_state cache (where the remote file lives) ───────────────────────────

function getCachedFileId(): string | null {
  if (IS_WEB) {
    try {
      return localStorage.getItem('minido.sync.fileId');
    } catch {
      return null;
    }
  }
  return db.getSyncState().remoteFileId;
}

function setCachedRemote(fileId: string, revision: string | undefined): void {
  if (IS_WEB) {
    try {
      localStorage.setItem('minido.sync.fileId', fileId);
      if (revision != null) localStorage.setItem('minido.sync.revision', revision);
    } catch {
      /* ignore */
    }
    return;
  }
  db.setSyncState({
    remoteFileId: fileId,
    remoteRevision: revision ?? null,
    lastSyncedAt: new Date().toISOString(),
    lastError: null,
  });
}

function setSyncError(msg: string): void {
  if (IS_WEB) return;
  db.setSyncState({ lastError: msg });
}

// ── the engine ────────────────────────────────────────────────────────────────

// Normalize whatever JSON happens to be in Drive into a proper AppData.
// Old/foreign files (e.g. the Phase 3 TEST DRIVE probe) might be missing
// tasks/categories entirely; treat them as empty so the next sync simply
// overwrites them with the real schema.
function normalizeAppData(raw: any): AppData {
  // Coerce task.done to boolean — Android may have uploaded it as 0/1 since
  // SQLite stores it that way. Without this, web renders literal "0" inside
  // checkboxes via JSX shortcircuit (`{task.done && <X/>}` → `{0}` → "0").
  const tasks: Task[] = Array.isArray(raw?.tasks)
    ? raw.tasks.map((t: any) => ({ ...t, done: t?.done === 1 || t?.done === true }))
    : [];
  return {
    version: typeof raw?.version === 'number' ? raw.version : 0,
    lastModified: typeof raw?.lastModified === 'string' ? raw.lastModified : '',
    tasks,
    categories: Array.isArray(raw?.categories) ? raw.categories : [],
  };
}

async function fetchRemote(): Promise<{ file: DriveFile | null; data: AppData | null }> {
  const cachedId = getCachedFileId();
  if (cachedId) {
    try {
      const raw = await downloadJson<unknown>(cachedId);
      return {
        file: { id: cachedId, name: 'minido-sync.json', modifiedTime: '' },
        data: normalizeAppData(raw),
      };
    } catch {
      // Probably deleted on Drive; fall through to lookup.
    }
  }
  const file = await findSyncFile();
  if (!file) return { file: null, data: null };
  const raw = await downloadJson<unknown>(file.id);
  return { file, data: normalizeAppData(raw) };
}

export async function sync(): Promise<SyncResult> {
  try {
    const local = readLocal();
    const { file: remoteFile, data: remoteData } = await fetchRemote();

    const mergedTasks = mergeRows(local.tasks, remoteData?.tasks ?? [], (t) => t.id);
    const mergedCategories = mergeRows(
      local.categories,
      remoteData?.categories ?? [],
      (c) => c.code,
    );
    const merged = { tasks: mergedTasks, categories: mergedCategories };

    const mergedCanon = canonicalize(merged);
    const localCanon = canonicalize(local);
    const remoteCanon = remoteData
      ? canonicalize({ tasks: remoteData.tasks, categories: remoteData.categories })
      : null;

    const pulled = mergedCanon !== localCanon;
    const pushed = remoteCanon === null || mergedCanon !== remoteCanon;

    if (pulled) writeLocal(merged);

    if (pushed) {
      const payload: AppData = {
        version: FILE_VERSION,
        lastModified: new Date().toISOString(),
        ...merged,
      };
      const written = remoteFile
        ? await updateSyncFile(remoteFile.id, payload)
        : await createSyncFile(payload);
      setCachedRemote(written.id, written.version);
    } else if (remoteFile) {
      // Mark sync_state as successful even if we didn't upload (so the UI's
      // "last synced" timestamp stays current).
      setCachedRemote(remoteFile.id, undefined);
    }

    return { ok: true, pulled, pushed };
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    setSyncError(msg);
    console.warn('[sync] failed', msg);
    return { ok: false, pulled: false, pushed: false, error: msg };
  }
}
