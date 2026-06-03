// Web stub — SQLite is native-only. All persistence on web goes through
// Zustand's localStorage persist middleware (see taskStore.ts).
import { Task, Category, SyncState } from '../types';

export function initDb(): void {}
export function seedDefaults(): void {}

export function getCategories(): Category[] { return []; }
export function getCategoryTombstones(): Category[] { return []; }
export function getAllCategoriesIncludingDeleted(): Category[] { return []; }
export function createCategory(_cat: Category): Category { return _cat; }
export function updateCategory(_code: string, _changes: Partial<Category>): Category { return null as any; }
export function deleteCategory(_code: string): void {}

export function getTasks(): Task[] { return []; }
export function getTaskTombstones(): Task[] { return []; }
export function getAllTasksIncludingDeleted(): Task[] { return []; }
export function getTasksByDate(_iso: string): Task[] { return []; }
export function createTask(_task: Task): Task { return _task; }
export function updateTask(_id: string, _changes: Partial<Task>): Task { return null as any; }
export function deleteTask(_id: string): void {}
export function upsertTask(_task: Task): void {}
export function upsertCategory(_cat: Category): void {}

export function getSyncState(): SyncState {
  return { remoteFileId: null, remoteRevision: null, lastSyncedAt: null, lastError: null };
}
export function setSyncState(_state: Partial<SyncState>): void {}

export function _resetDb(): void {}
