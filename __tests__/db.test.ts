import { _resetTables } from '../__mocks__/expo-sqlite/index';
import { DEFAULT_CATEGORIES } from '../src/constants/defaultCategories';

// Reset the in-memory DB and the module-level db singleton before each test
beforeEach(() => {
  _resetTables();
  jest.resetModules();
});

function loadDb() {
  return require('../src/services/db');
}

function makeTask(overrides = {}) {
  const now = new Date().toISOString();
  return {
    id: `task-${Math.random()}`,
    text: 'Test task',
    categoryCode: 'GEN',
    isoDate: '2026-05-19',
    done: false,
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// ── db.createTask ─────────────────────────────────────────────────────────────

test('db.createTask inserts and returns task with correct fields', () => {
  const db = loadDb();
  db.initDb();
  const task = makeTask({ text: 'Buy groceries', categoryCode: 'PRS' });
  const result = db.createTask(task);
  expect(result.id).toBe(task.id);
  expect(result.text).toBe('Buy groceries');
  expect(result.categoryCode).toBe('PRS');
  expect(result.done).toBe(false);
});

// ── db.updateTask ─────────────────────────────────────────────────────────────

test('db.updateTask persists field changes on re-read', () => {
  const db = loadDb();
  db.initDb();
  const task = makeTask();
  db.createTask(task);
  const updated = db.updateTask(task.id, { text: 'Updated text', done: true });
  expect(updated.text).toBe('Updated text');
  expect(updated.done).toBe(true);
});

// ── db.deleteTask ─────────────────────────────────────────────────────────────

test('db.deleteTask removes the task and leaves others intact', () => {
  const db = loadDb();
  db.initDb();
  const t1 = makeTask({ id: 'a' });
  const t2 = makeTask({ id: 'b' });
  db.createTask(t1);
  db.createTask(t2);
  db.deleteTask('a');
  const remaining = db.getTasks();
  expect(remaining).toHaveLength(1);
  expect(remaining[0].id).toBe('b');
});

// ── db.getTasksByDate ─────────────────────────────────────────────────────────

test('db.getTasksByDate returns only tasks for the given date', () => {
  const db = loadDb();
  db.initDb();
  db.createTask(makeTask({ id: 'x', isoDate: '2026-05-19' }));
  db.createTask(makeTask({ id: 'y', isoDate: '2026-05-20' }));
  db.createTask(makeTask({ id: 'z', isoDate: '2026-05-19' }));
  const results = db.getTasksByDate('2026-05-19');
  expect(results).toHaveLength(2);
  expect(results.every((t: { isoDate: string }) => t.isoDate === '2026-05-19')).toBe(true);
});

// ── db.createCategory ─────────────────────────────────────────────────────────

test('db.createCategory inserts and returns category', () => {
  const db = loadDb();
  db.initDb();
  const cat = { code: 'MKT', color: '#abc123', title: 'Marketing' };
  const result = db.createCategory(cat);
  expect(result.code).toBe('MKT');
  expect(result.title).toBe('Marketing');
});

test('db.createCategory enforces code uniqueness', () => {
  const db = loadDb();
  db.initDb();
  const cat = { code: 'UNQ', color: '#111', title: 'Unique' };
  db.createCategory(cat);
  expect(() => db.createCategory(cat)).toThrow(/already exists/i);
});

// ── db.seedDefaults ───────────────────────────────────────────────────────────

test('db.seedDefaults seeds all 4 default categories', () => {
  const db = loadDb();
  db.initDb();
  db.seedDefaults();
  const cats = db.getCategories();
  const codes = cats.map((c: { code: string }) => c.code);
  expect(codes).toEqual(expect.arrayContaining(['GEN', 'WRK', 'PRS', 'LUV']));
  expect(cats.length).toBeGreaterThanOrEqual(4);
});

test('db.seedDefaults is idempotent — running twice does not duplicate', () => {
  const db = loadDb();
  db.initDb();
  db.seedDefaults();
  db.seedDefaults();
  const cats = db.getCategories();
  const codes = cats.map((c: { code: string }) => c.code);
  const uniqueCodes = [...new Set(codes)];
  expect(codes.length).toBe(uniqueCodes.length);
  expect(
    DEFAULT_CATEGORIES.every((d) => codes.includes(d.code))
  ).toBe(true);
});
