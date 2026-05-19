import * as SQLite from 'expo-sqlite';
import { Task, Category } from '../types';
import { DEFAULT_CATEGORIES } from '../constants/defaultCategories';

let _db: SQLite.SQLiteDatabase | null = null;

function getDb(): SQLite.SQLiteDatabase {
  if (!_db) {
    _db = SQLite.openDatabaseSync('minido.db');
  }
  return _db;
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
  `);
}

export function seedDefaults(): void {
  const db = getDb();
  for (const cat of DEFAULT_CATEGORIES) {
    db.runSync(
      'INSERT OR IGNORE INTO categories (code, color, title) VALUES (?, ?, ?)',
      [cat.code, cat.color, cat.title]
    );
  }
}

// ── Categories ────────────────────────────────────────────────────────────────

export function getCategories(): Category[] {
  return getDb().getAllSync<Category>('SELECT * FROM categories ORDER BY code');
}

export function createCategory(cat: Category): Category {
  const db = getDb();
  const existing = db.getFirstSync<Category>(
    'SELECT * FROM categories WHERE code = ?',
    [cat.code]
  );
  if (existing) {
    throw new Error(`Category code "${cat.code}" already exists`);
  }
  db.runSync(
    'INSERT INTO categories (code, color, title) VALUES (?, ?, ?)',
    [cat.code, cat.color, cat.title]
  );
  return cat;
}

export function deleteCategory(code: string): void {
  getDb().runSync('DELETE FROM categories WHERE code = ?', [code]);
}

// ── Tasks ─────────────────────────────────────────────────────────────────────

export function getTasks(): Task[] {
  return getDb().getAllSync<Task>(
    'SELECT * FROM tasks ORDER BY isoDate ASC, sortOrder ASC'
  );
}

export function getTasksByDate(isoDate: string): Task[] {
  return getDb().getAllSync<Task>(
    'SELECT * FROM tasks WHERE isoDate = ? ORDER BY sortOrder ASC',
    [isoDate]
  );
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
  return getDb().getFirstSync<Task>('SELECT * FROM tasks WHERE id = ?', [task.id])!;
}

export function updateTask(id: string, changes: Partial<Omit<Task, 'id' | 'createdAt'>>): Task {
  const db = getDb();
  const fields = Object.keys(changes) as (keyof typeof changes)[];
  if (fields.length === 0) {
    return db.getFirstSync<Task>('SELECT * FROM tasks WHERE id = ?', [id])!;
  }
  const setClauses = fields.map((f) => `${f} = ?`).join(', ');
  const values = fields.map((f) => {
    const v = changes[f];
    if (f === 'done') return v ? 1 : 0;
    return v;
  });
  db.runSync(`UPDATE tasks SET ${setClauses} WHERE id = ?`, [...values, id]);
  return db.getFirstSync<Task>('SELECT * FROM tasks WHERE id = ?', [id])!;
}

export function deleteTask(id: string): void {
  getDb().runSync('DELETE FROM tasks WHERE id = ?', [id]);
}

export function _resetDb(): void {
  _db = null;
}
