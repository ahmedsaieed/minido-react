import * as SQLite from 'expo-sqlite';
import { Task, Category, SyncState } from '../types';
import { DEFAULT_CATEGORIES } from '../constants/defaultCategories';

let _db: SQLite.SQLiteDatabase | null = null;

function getDb(): SQLite.SQLiteDatabase {
  if (!_db) {
    _db = SQLite.openDatabaseSync('minido.db');
  }
  return _db;
}

// Idempotent column add: SQLite < 3.35 doesn't support ADD COLUMN IF NOT EXISTS,
// so we swallow the "duplicate column" error.
function addColumnIfMissing(table: string, columnDef: string) {
  try {
    getDb().execSync(`ALTER TABLE ${table} ADD COLUMN ${columnDef};`);
  } catch (e: any) {
    if (!String(e?.message ?? e).toLowerCase().includes('duplicate column')) {
      throw e;
    }
  }
}

export function initDb(): void {
  const db = getDb();
  db.execSync(`
    CREATE TABLE IF NOT EXISTS categories (
      code TEXT PRIMARY KEY,
      color TEXT NOT NULL,
      title TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      categoryCode TEXT NOT NULL,
      isoDate TEXT NOT NULL,
      done INTEGER NOT NULL DEFAULT 0,
      sortOrder INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sync_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      remoteFileId TEXT,
      remoteRevision TEXT,
      lastSyncedAt TEXT,
      lastError TEXT
    );
  `);

  // Migrations for existing installs.
  addColumnIfMissing('categories', "updatedAt TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z'");
  addColumnIfMissing('categories', 'deletedAt TEXT');
  addColumnIfMissing('tasks', 'deletedAt TEXT');

  // Ensure the singleton sync_state row exists.
  db.runSync(
    'INSERT OR IGNORE INTO sync_state (id, remoteFileId, remoteRevision, lastSyncedAt, lastError) VALUES (1, NULL, NULL, NULL, NULL)'
  );
}

export function seedDefaults(): void {
  const db = getDb();
  for (const cat of DEFAULT_CATEGORIES) {
    db.runSync(
      'INSERT OR IGNORE INTO categories (code, color, title, updatedAt) VALUES (?, ?, ?, ?)',
      [cat.code, cat.color, cat.title, cat.updatedAt]
    );
  }
}

// ── Categories ────────────────────────────────────────────────────────────────

export function getCategories(): Category[] {
  return getDb().getAllSync<Category>(
    'SELECT * FROM categories WHERE deletedAt IS NULL ORDER BY code'
  );
}

export function getCategoryTombstones(): Category[] {
  return getDb().getAllSync<Category>(
    'SELECT * FROM categories WHERE deletedAt IS NOT NULL'
  );
}

export function getAllCategoriesIncludingDeleted(): Category[] {
  return getDb().getAllSync<Category>('SELECT * FROM categories');
}

export function createCategory(cat: Category): Category {
  const db = getDb();
  const existing = db.getFirstSync<Category>(
    'SELECT * FROM categories WHERE code = ?',
    [cat.code]
  );
  if (existing && !existing.deletedAt) {
    throw new Error(`Category code "${cat.code}" already exists`);
  }
  const updatedAt = cat.updatedAt ?? new Date().toISOString();
  if (existing) {
    db.runSync(
      'UPDATE categories SET color = ?, title = ?, updatedAt = ?, deletedAt = NULL WHERE code = ?',
      [cat.color, cat.title, updatedAt, cat.code]
    );
  } else {
    db.runSync(
      'INSERT INTO categories (code, color, title, updatedAt) VALUES (?, ?, ?, ?)',
      [cat.code, cat.color, cat.title, updatedAt]
    );
  }
  return { ...cat, updatedAt };
}

export function updateCategory(code: string, changes: Partial<Omit<Category, 'code'>>): Category {
  const db = getDb();
  const merged = { ...changes, updatedAt: new Date().toISOString() };
  const fields = Object.keys(merged) as (keyof typeof merged)[];
  const setClauses = fields.map((f) => `${f} = ?`).join(', ');
  const values: (string | number | null)[] = fields.map((f) => (merged[f] ?? null) as string | number | null);
  db.runSync(`UPDATE categories SET ${setClauses} WHERE code = ?`, [...values, code]);
  return db.getFirstSync<Category>('SELECT * FROM categories WHERE code = ?', [code])!;
}

export function deleteCategory(code: string): void {
  const now = new Date().toISOString();
  getDb().runSync(
    'UPDATE categories SET deletedAt = ?, updatedAt = ? WHERE code = ?',
    [now, now, code]
  );
}

// ── Tasks ─────────────────────────────────────────────────────────────────────

// SQLite stores `done` as INTEGER (0/1); the Task type expects boolean.
// Without this coercion downstream `{task.done && <X/>}` JSX expressions
// evaluate to literal 0 on web (renders as "0" text in the DOM).
function hydrateTaskRow(r: any): Task {
  return { ...r, done: r.done === 1 || r.done === true };
}

export function getTasks(): Task[] {
  return getDb()
    .getAllSync<Task>(
      'SELECT * FROM tasks WHERE deletedAt IS NULL ORDER BY isoDate ASC, sortOrder ASC',
    )
    .map(hydrateTaskRow);
}

export function getTaskTombstones(): Task[] {
  return getDb()
    .getAllSync<Task>('SELECT * FROM tasks WHERE deletedAt IS NOT NULL')
    .map(hydrateTaskRow);
}

export function getAllTasksIncludingDeleted(): Task[] {
  return getDb().getAllSync<Task>('SELECT * FROM tasks').map(hydrateTaskRow);
}

export function getTasksByDate(isoDate: string): Task[] {
  return getDb()
    .getAllSync<Task>(
      'SELECT * FROM tasks WHERE isoDate = ? AND deletedAt IS NULL ORDER BY sortOrder ASC',
      [isoDate],
    )
    .map(hydrateTaskRow);
}

export function createTask(task: Task): Task {
  const db = getDb();
  db.runSync(
    `INSERT INTO tasks
       (id, text, categoryCode, isoDate, done, sortOrder, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      task.id,
      task.text,
      task.categoryCode,
      task.isoDate,
      task.done ? 1 : 0,
      task.sortOrder,
      task.createdAt,
      task.updatedAt,
    ]
  );
  return hydrateTaskRow(getDb().getFirstSync<Task>('SELECT * FROM tasks WHERE id = ?', [task.id])!);
}

export function updateTask(id: string, changes: Partial<Omit<Task, 'id' | 'createdAt'>>): Task {
  const db = getDb();
  const merged = { ...changes, updatedAt: changes.updatedAt ?? new Date().toISOString() };
  const fields = Object.keys(merged) as (keyof typeof merged)[];
  if (fields.length === 0) {
    return hydrateTaskRow(db.getFirstSync<Task>('SELECT * FROM tasks WHERE id = ?', [id])!);
  }
  const setClauses = fields.map((f) => `${f} = ?`).join(', ');
  const values: (string | number | null)[] = fields.map((f) => {
    const v = merged[f];
    if (f === 'done') return v ? 1 : 0;
    return (v ?? null) as string | number | null;
  });
  db.runSync(`UPDATE tasks SET ${setClauses} WHERE id = ?`, [...values, id]);
  return hydrateTaskRow(db.getFirstSync<Task>('SELECT * FROM tasks WHERE id = ?', [id])!);
}

// Upsert variants — used by the sync engine when merging remote rows into
// local state. They write the exact `updatedAt` and `deletedAt` from the
// merge result (don't bump updatedAt).
export function upsertTask(task: Task): void {
  getDb().runSync(
    `INSERT OR REPLACE INTO tasks
       (id, text, categoryCode, isoDate, done, sortOrder, createdAt, updatedAt, deletedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      task.id,
      task.text,
      task.categoryCode,
      task.isoDate,
      task.done ? 1 : 0,
      task.sortOrder,
      task.createdAt,
      task.updatedAt,
      task.deletedAt ?? null,
    ],
  );
}

export function upsertCategory(cat: Category): void {
  getDb().runSync(
    `INSERT OR REPLACE INTO categories (code, color, title, updatedAt, deletedAt)
     VALUES (?, ?, ?, ?, ?)`,
    [cat.code, cat.color, cat.title, cat.updatedAt, cat.deletedAt ?? null],
  );
}

export function deleteTask(id: string): void {
  const now = new Date().toISOString();
  getDb().runSync(
    'UPDATE tasks SET deletedAt = ?, updatedAt = ? WHERE id = ?',
    [now, now, id]
  );
}

// ── Sync state ────────────────────────────────────────────────────────────────

export function getSyncState(): SyncState {
  const row = getDb().getFirstSync<SyncState>('SELECT * FROM sync_state WHERE id = 1');
  return row ?? {
    remoteFileId: null,
    remoteRevision: null,
    lastSyncedAt: null,
    lastError: null,
  };
}

export function setSyncState(state: Partial<SyncState>): void {
  const current = getSyncState();
  const merged = { ...current, ...state };
  getDb().runSync(
    `UPDATE sync_state
       SET remoteFileId = ?, remoteRevision = ?, lastSyncedAt = ?, lastError = ?
       WHERE id = 1`,
    [merged.remoteFileId, merged.remoteRevision, merged.lastSyncedAt, merged.lastError]
  );
}

export function _resetDb(): void {
  _db = null;
}
