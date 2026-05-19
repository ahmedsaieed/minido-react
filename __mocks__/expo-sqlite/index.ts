// In-memory SQLite mock using a simple row store.
// Supports the synchronous API used by db.ts:
//   openDatabaseSync, execSync, runSync, getAllSync, getFirstSync

interface Row {
  [key: string]: unknown;
}

let tables: Record<string, Row[]> = {};

function reset() {
  tables = {};
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

function execSql(sql: string, params: unknown[] = []): Row[] {
  const bound = bindParams(sql.trim(), params);

  // CREATE TABLE
  if (/^CREATE TABLE/i.test(bound)) {
    const names = parseCreateTable(bound);
    for (const name of names) {
      if (!tables[name]) tables[name] = [];
    }
    return [];
  }

  // INSERT OR IGNORE
  if (/^INSERT OR IGNORE/i.test(bound)) {
    const m = bound.match(/INTO (\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
    if (!m) return [];
    const [, tbl, colStr, valStr] = m;
    const cols = colStr.split(',').map((c) => c.trim());
    const vals = valStr.match(/'[^']*'|\d+|NULL/g) || [];
    const row: Row = {};
    cols.forEach((c, idx) => {
      let v: unknown = vals[idx];
      if (typeof v === 'string' && v.startsWith("'")) v = v.slice(1, -1).replace(/''/g, "'");
      row[c] = v;
    });
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
    cols.forEach((c, idx) => {
      let v: unknown = vals[idx];
      if (typeof v === 'string' && v.startsWith("'"))
        v = v.slice(1, -1).replace(/''/g, "'");
      else if (typeof v === 'string' && v !== 'NULL') v = Number(v);
      else if (v === 'NULL') v = null;
      row[c] = v;
    });
    if (!tables[tbl]) tables[tbl] = [];
    tables[tbl].push(row);
    return [];
  }

  // UPDATE
  if (/^UPDATE/i.test(bound)) {
    const tblMatch = bound.match(/UPDATE (\w+) SET (.+) WHERE (.+)/i);
    if (!tblMatch) return [];
    const [, tbl, setStr, whereStr] = tblMatch;
    const changes: Row = {};
    setStr.split(',').forEach((pair) => {
      const [k, v] = pair.split('=').map((s) => s.trim());
      let val: unknown = v;
      if (typeof val === 'string' && val.startsWith("'"))
        val = val.slice(1, -1).replace(/''/g, "'");
      else if (typeof val === 'string' && val !== 'NULL') val = isNaN(Number(val)) ? val : Number(val);
      changes[k] = val;
    });
    const [wk, wv] = whereStr.split('=').map((s) => s.trim());
    const wVal = wv.startsWith("'") ? wv.slice(1, -1) : Number(wv);
    if (tables[tbl]) {
      tables[tbl] = tables[tbl].map((r) =>
        r[wk] === wVal ? { ...r, ...changes } : r
      );
    }
    return [];
  }

  // DELETE
  if (/^DELETE/i.test(bound)) {
    const m = bound.match(/FROM (\w+)\s+WHERE (.+)/i);
    if (!m) return [];
    const [, tbl, whereStr] = m;
    const [wk, wv] = whereStr.split('=').map((s) => s.trim());
    const wVal = wv.startsWith("'") ? wv.slice(1, -1) : Number(wv);
    if (tables[tbl]) tables[tbl] = tables[tbl].filter((r) => r[wk] !== wVal);
    return [];
  }

  // SELECT
  if (/^SELECT/i.test(bound)) {
    const fromMatch = bound.match(/FROM (\w+)/i);
    if (!fromMatch) return [];
    const tbl = fromMatch[1];
    if (!tables[tbl]) return [];
    let rows = [...tables[tbl]];

    const whereMatch = bound.match(/WHERE (.+?)(?:\s+ORDER|\s+LIMIT|$)/i);
    if (whereMatch) {
      const cond = whereMatch[1];
      const [wk, wv] = cond.split('=').map((s) => s.trim());
      const wVal = wv.startsWith("'") ? wv.slice(1, -1) : Number(wv);
      rows = rows.filter((r) => r[wk] === wVal);
    }

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

    // convert done back to boolean for Task rows
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
