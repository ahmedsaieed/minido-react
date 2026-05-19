import { renderHook } from '@testing-library/react-native';
import { useDates } from '../src/hooks/useDates';
import { Task } from '../src/types';

const TODAY = '2026-05-19';

function task(isoDate: string): Task {
  const now = new Date().toISOString();
  return {
    id: Math.random().toString(),
    text: 't',
    categoryCode: 'GEN',
    isoDate,
    done: false,
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
  };
}

// ── correct date list ─────────────────────────────────────────────────────────

test('useDates returns today + futureDays ahead even with no tasks', () => {
  const { result } = renderHook(() => useDates([], 3, TODAY));
  // 3 days: today, +1, +2
  expect(result.current).toContain(TODAY);
  expect(result.current).toContain('2026-05-20');
  expect(result.current).toContain('2026-05-21');
});

test('useDates includes past dates that have tasks', () => {
  const tasks = [task('2026-05-10'), task('2026-05-15')];
  const { result } = renderHook(() => useDates(tasks, 1, TODAY));
  expect(result.current).toContain('2026-05-10');
  expect(result.current).toContain('2026-05-15');
});

// ── past dates without tasks are excluded ─────────────────────────────────────

test('useDates excludes past dates that have no tasks', () => {
  const tasks = [task('2026-05-17')]; // only this past date has a task
  const { result } = renderHook(() => useDates(tasks, 1, TODAY));
  expect(result.current).toContain('2026-05-17');
  expect(result.current).not.toContain('2026-05-10'); // no task → excluded
});

// ── initial future cap at 20 ──────────────────────────────────────────────────

test('useDates caps future dates at 20 for initial 8-day window', () => {
  // create tasks far in the future to push beyond 20
  const tasks = Array.from({ length: 30 }, (_, i) =>
    task(`2027-${String(i + 1).padStart(2, '0')}-01`)
  );
  const { result } = renderHook(() => useDates(tasks, 8, TODAY));
  const futureDates = result.current.filter((d) => d >= TODAY);
  expect(futureDates.length).toBeLessThanOrEqual(20);
});

// ── uncapped after show more (futureDays > 8) ─────────────────────────────────

test('useDates is uncapped after futureDays exceeds 8', () => {
  const tasks = Array.from({ length: 30 }, (_, i) =>
    task(`2027-${String(i + 1).padStart(2, '0')}-01`)
  );
  const { result } = renderHook(() => useDates(tasks, 15, TODAY));
  const futureDates = result.current.filter((d) => d >= TODAY);
  expect(futureDates.length).toBeGreaterThan(20);
});

// ── ordering ──────────────────────────────────────────────────────────────────

test('useDates returns dates in chronological order', () => {
  const tasks = [task('2026-05-10'), task('2026-05-25')];
  const { result } = renderHook(() => useDates(tasks, 2, TODAY));
  const sorted = [...result.current].sort();
  expect(result.current).toEqual(sorted);
});
