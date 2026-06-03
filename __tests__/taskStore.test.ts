import { act, renderHook } from '@testing-library/react-native';
import { useTaskStore } from '../src/store/taskStore';
import { Task, Category } from '../src/types';

function makeTask(overrides: Partial<Task> = {}): Task {
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

function makeCat(over: Partial<Category> & Pick<Category, 'code'>): Category {
  return { color: '#000', title: over.code, updatedAt: '1970-01-01T00:00:00.000Z', ...over };
}

beforeEach(() => {
  useTaskStore.setState({
    tasks: [],
    categories: [],
    tombstones: { tasks: [], categories: [] },
  });
});

// ── addTask ───────────────────────────────────────────────────────────────────

test('addTask reflects new task in store immediately', () => {
  const { result } = renderHook(() => useTaskStore());
  const task = makeTask({ text: 'Walk the dog' });
  act(() => { result.current.addTask(task); });
  expect(result.current.tasks).toHaveLength(1);
  expect(result.current.tasks[0].text).toBe('Walk the dog');
});

// ── toggleDone ────────────────────────────────────────────────────────────────

test('toggleDone flips done and refreshes updatedAt', () => {
  jest.useFakeTimers();
  const { result } = renderHook(() => useTaskStore());
  const task = makeTask({ done: false });
  act(() => { result.current.addTask(task); });
  const before = result.current.tasks[0].updatedAt;
  jest.advanceTimersByTime(10);
  act(() => { result.current.toggleDone(task.id); });
  expect(result.current.tasks[0].done).toBe(true);
  expect(result.current.tasks[0].updatedAt).not.toBe(before);
  jest.useRealTimers();
});

test('toggleDone twice returns done to false', () => {
  const { result } = renderHook(() => useTaskStore());
  const task = makeTask();
  act(() => { result.current.addTask(task); });
  act(() => { result.current.toggleDone(task.id); });
  act(() => { result.current.toggleDone(task.id); });
  expect(result.current.tasks[0].done).toBe(false);
});

// ── moveTask ──────────────────────────────────────────────────────────────────

test('moveTask changes isoDate to target date', () => {
  const { result } = renderHook(() => useTaskStore());
  const task = makeTask({ isoDate: '2026-05-19' });
  act(() => { result.current.addTask(task); });
  act(() => { result.current.moveTask(task.id, '2026-05-21'); });
  expect(result.current.tasks[0].isoDate).toBe('2026-05-21');
});

// ── changeCategory ────────────────────────────────────────────────────────────

test('changeCategory updates categoryCode correctly', () => {
  const { result } = renderHook(() => useTaskStore());
  const task = makeTask({ categoryCode: 'GEN' });
  act(() => { result.current.addTask(task); });
  act(() => { result.current.changeCategory(task.id, 'WRK'); });
  expect(result.current.tasks[0].categoryCode).toBe('WRK');
});

// ── deleteTask ────────────────────────────────────────────────────────────────

test('deleteTask removes task from store', () => {
  const { result } = renderHook(() => useTaskStore());
  const t1 = makeTask({ id: 'keep' });
  const t2 = makeTask({ id: 'remove' });
  act(() => { result.current.addTask(t1); result.current.addTask(t2); });
  act(() => { result.current.deleteTask('remove'); });
  expect(result.current.tasks).toHaveLength(1);
  expect(result.current.tasks[0].id).toBe('keep');
});

test('deleteTask moves task into tombstones with deletedAt set', () => {
  const { result } = renderHook(() => useTaskStore());
  const t = makeTask({ id: 'gone' });
  act(() => { result.current.addTask(t); });
  act(() => { result.current.deleteTask('gone'); });
  expect(result.current.tombstones.tasks).toHaveLength(1);
  expect(result.current.tombstones.tasks[0].id).toBe('gone');
  expect(result.current.tombstones.tasks[0].deletedAt).toBeTruthy();
});

// ── addCategory ───────────────────────────────────────────────────────────────

test('addCategory makes category available in store', () => {
  const { result } = renderHook(() => useTaskStore());
  const cat: Category = makeCat({ code: 'FIT', color: '#aabbcc', title: 'Fitness' });
  act(() => { result.current.addCategory(cat); });
  expect(result.current.categories).toHaveLength(1);
  expect(result.current.categories[0].code).toBe('FIT');
});

// ── deleteCategory ────────────────────────────────────────────────────────────

test('deleteCategory moves it to tombstones', () => {
  const { result } = renderHook(() => useTaskStore());
  const cat = makeCat({ code: 'GONE', color: '#000', title: 'Gone' });
  act(() => { result.current.addCategory(cat); });
  act(() => { result.current.deleteCategory('GONE'); });
  expect(result.current.categories.find((c) => c.code === 'GONE')).toBeUndefined();
  expect(result.current.tombstones.categories[0]?.code).toBe('GONE');
  expect(result.current.tombstones.categories[0]?.deletedAt).toBeTruthy();
});

test('deleteCategory removes only the targeted category', () => {
  const { result } = renderHook(() => useTaskStore());
  const cats: Category[] = [
    makeCat({ code: 'AAA', color: '#111', title: 'A' }),
    makeCat({ code: 'BBB', color: '#222', title: 'B' }),
  ];
  act(() => { cats.forEach((c) => result.current.addCategory(c)); });
  act(() => { result.current.deleteCategory('AAA'); });
  expect(result.current.categories).toHaveLength(1);
  expect(result.current.categories[0].code).toBe('BBB');
});

// ── setTasks / setCategories ──────────────────────────────────────────────────

test('setTasks replaces the task list wholesale', () => {
  const { result } = renderHook(() => useTaskStore());
  const batch = [makeTask({ id: 'p' }), makeTask({ id: 'q' })];
  act(() => { result.current.setTasks(batch); });
  expect(result.current.tasks).toHaveLength(2);
  expect(result.current.tasks.map((t) => t.id)).toEqual(['p', 'q']);
});

test('setCategories replaces the category list wholesale', () => {
  const { result } = renderHook(() => useTaskStore());
  const cats: Category[] = [
    makeCat({ code: 'X', color: '#x', title: 'X' }),
    makeCat({ code: 'Y', color: '#y', title: 'Y' }),
  ];
  act(() => { result.current.setCategories(cats); });
  expect(result.current.categories).toHaveLength(2);
});

// ── updateTask ────────────────────────────────────────────────────────────────

test('updateTask applies partial changes and refreshes updatedAt', () => {
  jest.useFakeTimers();
  const { result } = renderHook(() => useTaskStore());
  const task = makeTask({ text: 'Original' });
  act(() => { result.current.addTask(task); });
  const before = result.current.tasks[0].updatedAt;
  jest.advanceTimersByTime(10);
  act(() => { result.current.updateTask(task.id, { text: 'Modified', sortOrder: 5 }); });
  expect(result.current.tasks[0].text).toBe('Modified');
  expect(result.current.tasks[0].sortOrder).toBe(5);
  expect(result.current.tasks[0].updatedAt).not.toBe(before);
  jest.useRealTimers();
});
