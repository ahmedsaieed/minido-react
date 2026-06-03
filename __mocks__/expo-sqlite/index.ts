// In-memory SQLite mock using a simple row store.
// Supports the synchronous API used by db.ts:
//   openDatabaseSync, execSync, runSync, getAllSync, getFirstSync
// Now also: ALTER TABLE ADD COLUMN (idempotent throw-on-duplicate), and
// WHERE clauses with `IS NULL`, `IS NOT NULL`, and `AND`.

interface Row {
  [key: string]: unknown;
}

let tables: Record<string, Row[]> = {};
// Per-table set of added columns, to mimic SQLite's "duplicate column" error.
let addedColumns: Record<string, Set<string>> = {};

function reset() {
  tables = {};
  addedColumns = {};
}

function parseCreateTable(sql: string): string[] {
  const names: string[] = [];
  const re = /CREATE TABLE IF NOT EXISTS (\w+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) names.push(m[1]);
  return names;
}

function bindParams(sql: string, params: unknown[]): string {
  let i = 0;
  return sql.replace(/\?/g, () => {
    const v = params[i++];
    if (v === null || v === undefined) return 'NULL';
    if (typeof v === 'string') return `'${v.replace(/'/g, "''")}'`;
    return String(v);
  });
}

// Coerce a SQL literal token (e.g. "'hello''world'", "42", "NULL") to a JS value.
function literalToJs(raw: string): unknown {
  const v = raw.trim();
  if (v === 'NULL') return null;
  if (v.startsWith("'")) return v.slice(1, -1).replace(/''/g, "'");
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v;
}

// Evaluate a single WHERE atom against a row. Supports `col = val`,
// `col IS NULL`, `col IS NOT NULL`.
function evalCondition(cond: string, row: Row): boolean {
  const c = cond.trim();
  const isNotNull = c.match(/^(\w+)\s+IS\s+NOT\s+NULL$/i);
  if (isNotNull) return row[isNotNull[1]] !== null && row[isNotNull[1]] !== undefined;
  const isNull = c.match(/^(\w+)\s+IS\s+NULL$/i);
  if (isNull) {
    const v = row[isNull[1]];
    return v === null || v === undefined;
  }
  const eq = c.match(/^(\w+)\s*=\s*(.+)$/);
  if (eq) return row[eq[1]] === literalToJs(eq[2]);
  return true;
}

function matchesWhere(whereStr: string | undefined, row: Row): boolean {
  if (!whereStr) return true;
  const atoms = whereStr.split(/\s+AND\s+/i);
  return atoms.every((a) => evalCondition(a, row));
}

function execSql(sql: string, params: unknown[] = []): Row[] {
  const bound = bindParams(sql.trim(), params);

  // CREATE TABLE
  if (/^CREATE TABLE/i.test(bound)) {
    const names = parseCreateTable(bound);
    for (const name of names) {
      if (!tables[name]) tables[name] = [];
      if (!addedColumns[name]) addedColumns[name] = new Set();
    }
    return [];
  }

  // ALTER TABLE ADD COLUMN
  const alterMatch = bound.match(/^ALTER TABLE (\w+)\s+ADD COLUMN\s+(\w+)\b(.*)$/i);
  if (alterMatch) {
    const [, tbl, col, rest] = alterMatch;
    if (!tables[tbl]) tables[tbl] = [];
    if (!addedColumns[tbl]) addedColumns[tbl] = new Set();
    if (addedColumns[tbl].has(col)) {
      const err: any = new Error(`duplicate column name: ${col}`);
      throw err;
    }
    addedColumns[tbl].add(col);
    // Apply default for existing rows.
    const defMatch = rest.match(/DEFAULT\s+(.+?)\s*;?$/i);
    const defVal = defMatch ? literalToJs(defMatch[1]) : null;
    tables[tbl] = tables[tbl].map((r) => (col in r ? r : { ...r, [col]: defVal }));
    return [];
  }

  // INSERT OR IGNORE
  if (/^INSERT OR IGNORE/i.test(bound)) {
    const m = bound.match(/INTO (\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
    if (!m) return [];
    const [, tbl, colStr, valStr] = m;
    const cols = colStr.split(',').map((c) => c.trim());
    const vals = valStr.match(/'(?:[^']|'')*'|-?\d+(?:\.\d+)?|NULL/g) || [];
    const row: Row = {};
    cols.forEach((c, idx) => { row[c] = literalToJs(vals[idx]); });
    if (!tables[tbl]) tables[tbl] = [];
    const pk = cols[0];
    const exists = tables[tbl].some((r) => r[pk] === row[pk]);
    if (!exists) tables[tbl].push(row);
    return [];
  }

  // INSERT
  if (/^INSERT/i.test(bound)) {
    const m = bound.match(/INTO (\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
    if (!m) return [];
    const [, tbl, colStr, valStr] = m;
    const cols = colStr.split(',').map((c) => c.trim());
    const vals = valStr.match(/'(?:[^']|'')*'|-?\d+(?:\.\d+)?|NULL/g) || [];
    const row: Row = {};
    cols.forEach((c, idx) => { row[c] = literalToJs(vals[idx]); });
    if (!tables[tbl]) tables[tbl] = [];
    tables[tbl].push(row);
    return [];
  }

  // UPDATE
  if (/^UPDATE/i.test(bound)) {
    const tblMatch = bound.match(/^UPDATE (\w+)\s+SET\s+(.+?)\s+WHERE\s+(.+)$/i);
    if (!tblMatch) return [];
    const [, tbl, setStr, whereStr] = tblMatch;
    const changes: Row = {};
    setStr.split(',').forEach((pair) => {
      const [k, v] = pair.split('=').map((s) => s.trim());
      changes[k] = literalToJs(v);
    });
    if (tables[tbl]) {
      tables[tbl] = tables[tbl].map((r) =>
        matchesWhere(whereStr, r) ? { ...r, ...changes } : r
      );
    }
    return [];
  }

  // DELETE
  if (/^DELETE/i.test(bound)) {
    const m = bound.match(/FROM (\w+)\s+WHERE (.+)/i);
    if (!m) return [];
    const [, tbl, whereStr] = m;
    if (tables[tbl]) tables[tbl] = tables[tbl].filter((r) => !matchesWhere(whereStr, r));
    return [];
  }

  // SELECT
  if (/^SELECT/i.test(bound)) {
    const fromMatch = bound.match(/FROM (\w+)/i);
    if (!fromMatch) return [];
    const tbl = fromMatch[1];
    if (!tables[tbl]) return [];
    let rows = [...tables[tbl]];

    const whereMatch = bound.match(/WHERE\s+(.+?)(?:\s+ORDER|\s+LIMIT|$)/i);
    if (whereMatch) rows = rows.filter((r) => matchesWhere(whereMatch[1], r));

    const orderMatch = bound.match(/ORDER BY (.+?)(?:\s+LIMIT|$)/i);
    if (orderMatch) {
      const cols = orderMatch[1].split(',').map((c) => c.trim().split(/\s+/));
      rows.sort((a, b) => {
        for (const [col, dir] of cols) {
          const av = a[col] ?? '';
          const bv = b[col] ?? '';
          const cmp = av < bv ? -1 : av > bv ? 1 : 0;
          if (cmp !== 0) return dir?.toUpperCase() === 'DESC' ? -cmp : cmp;
        }
        return 0;
      });
    }

    // Re-hydrate done back to a boolean for Task rows.
    return rows.map((r) => ({
      ...r,
      ...(r.done !== undefined ? { done: r.done === 1 || r.done === true } : {}),
    }));
  }

  return [];
}

const mockDb = {
  execSync(sql: string) {
    sql.split(';').forEach((s) => { if (s.trim()) execSql(s); });
  },
  runSync(sql: string, params: unknown[] = []) {
    execSql(sql, params);
  },
  getAllSync<T>(sql: string, params: unknown[] = []): T[] {
    return execSql(sql, params) as T[];
  },
  getFirstSync<T>(sql: string, params: unknown[] = []): T | null {
    const rows = execSql(sql, params);
    return (rows[0] as T) ?? null;
  },
};

export function openDatabaseSync(_name: string) {
  return mockDb;
}

export { reset as _resetTables };
