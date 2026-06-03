import { mergeRows } from '../src/services/sync';

interface Row {
  id: string;
  updatedAt: string;
  payload?: string;
  deletedAt?: string | null;
}

const row = (id: string, updatedAt: string, payload?: string, deletedAt?: string | null): Row =>
  ({ id, updatedAt, payload, deletedAt });

test('newer remote wins over older local', () => {
  const local = [row('a', '2026-01-01T00:00:00Z', 'old')];
  const remote = [row('a', '2026-02-01T00:00:00Z', 'new')];
  const merged = mergeRows(local, remote, (r) => r.id);
  expect(merged).toHaveLength(1);
  expect(merged[0].payload).toBe('new');
});

test('newer local wins over older remote', () => {
  const local = [row('a', '2026-02-01T00:00:00Z', 'new')];
  const remote = [row('a', '2026-01-01T00:00:00Z', 'old')];
  const merged = mergeRows(local, remote, (r) => r.id);
  expect(merged[0].payload).toBe('new');
});

test('union of local-only and remote-only rows', () => {
  const local = [row('a', '2026-01-01T00:00:00Z')];
  const remote = [row('b', '2026-01-01T00:00:00Z')];
  const merged = mergeRows(local, remote, (r) => r.id);
  const ids = merged.map((r) => r.id).sort();
  expect(ids).toEqual(['a', 'b']);
});

test('tombstone with newer updatedAt suppresses an older edit', () => {
  const local = [row('a', '2026-01-15T00:00:00Z', 'edited')];
  const remote = [row('a', '2026-02-01T00:00:00Z', 'edited', '2026-02-01T00:00:00Z')];
  const merged = mergeRows(local, remote, (r) => r.id);
  expect(merged[0].deletedAt).toBeTruthy();
});

test('newer edit on one side resurrects an older deletion on the other', () => {
  const local = [row('a', '2026-02-10T00:00:00Z', 'resurrected')];
  const remote = [row('a', '2026-02-01T00:00:00Z', 'gone', '2026-02-01T00:00:00Z')];
  const merged = mergeRows(local, remote, (r) => r.id);
  expect(merged[0].deletedAt).toBeFalsy();
  expect(merged[0].payload).toBe('resurrected');
});

test('merge is commutative: same result regardless of order', () => {
  const a = [row('x', '2026-01-01T00:00:00Z', 'A'), row('y', '2026-03-01T00:00:00Z', 'A')];
  const b = [row('x', '2026-02-01T00:00:00Z', 'B'), row('z', '2026-01-01T00:00:00Z', 'B')];
  const m1 = mergeRows(a, b, (r) => r.id).sort((x, y) => x.id.localeCompare(y.id));
  const m2 = mergeRows(b, a, (r) => r.id).sort((x, y) => x.id.localeCompare(y.id));
  expect(m1).toEqual(m2);
});
