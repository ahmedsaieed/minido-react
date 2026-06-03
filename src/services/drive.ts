// Thin REST wrapper around Google Drive v3 for the appDataFolder space.
// All requests go through `authed()` which pulls a fresh access token via
// googleAuth.getValidAccessToken (auto-refreshes if expired).
//
// We store a single JSON file in the user's Drive appDataFolder. The folder
// is invisible in the user's Drive UI and scoped to this app only, so it
// can't leak into their normal Drive contents.

import { getValidAccessToken } from './googleAuth';

const FILE_NAME = 'minido-sync.json';
const SPACE = 'appDataFolder';
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const FIELDS = 'id,name,modifiedTime,version';

export interface DriveFile {
  id: string;
  name: string;
  modifiedTime: string;
  version?: string; // monotonic counter Drive increments on every change
}

async function authed(input: string, init: RequestInit = {}): Promise<Response> {
  const token = await getValidAccessToken();
  if (!token) throw new Error('Not signed in to Google');
  const headers = new Headers(init.headers ?? {});
  headers.set('Authorization', `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}

async function ensureOk(res: Response, what: string): Promise<void> {
  if (res.ok) return;
  const text = await res.text();
  throw new Error(`${what} failed: ${res.status} ${text}`);
}

// ── reads ─────────────────────────────────────────────────────────────────────

export async function listAppData(): Promise<DriveFile[]> {
  const url = `${API}/files?spaces=${SPACE}&fields=files(${FIELDS})&pageSize=100`;
  const res = await authed(url);
  await ensureOk(res, 'drive.list');
  const json = (await res.json()) as { files?: DriveFile[] };
  return json.files ?? [];
}

// Returns the latest copy of our sync file, or null if it doesn't exist yet.
// If duplicates somehow exist, we pick the one with the highest modifiedTime.
export async function findSyncFile(): Promise<DriveFile | null> {
  const files = await listAppData();
  const matches = files.filter((f) => f.name === FILE_NAME);
  if (matches.length === 0) return null;
  matches.sort((a, b) => (b.modifiedTime ?? '').localeCompare(a.modifiedTime ?? ''));
  return matches[0];
}

export async function downloadJson<T>(fileId: string): Promise<T> {
  const res = await authed(`${API}/files/${fileId}?alt=media`);
  await ensureOk(res, 'drive.download');
  return (await res.json()) as T;
}

// ── writes ────────────────────────────────────────────────────────────────────

// Build a multipart/related body. Used only on first-time creation when we
// need to attach metadata (name + parents) in the same request as the bytes.
function buildMultipartBody(metadata: object, body: string, boundary: string): string {
  return [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    body,
    `--${boundary}--`,
    '',
  ].join('\r\n');
}

export async function createSyncFile<T>(data: T): Promise<DriveFile> {
  const boundary = `minido-${Math.random().toString(16).slice(2)}`;
  const meta = { name: FILE_NAME, parents: [SPACE] };
  const body = buildMultipartBody(meta, JSON.stringify(data), boundary);
  const res = await authed(`${UPLOAD}/files?uploadType=multipart&fields=${FIELDS}`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  await ensureOk(res, 'drive.create');
  return (await res.json()) as DriveFile;
}

export async function updateSyncFile<T>(fileId: string, data: T): Promise<DriveFile> {
  const res = await authed(`${UPLOAD}/files/${fileId}?uploadType=media&fields=${FIELDS}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify(data),
  });
  await ensureOk(res, 'drive.update');
  return (await res.json()) as DriveFile;
}

// Create-or-update by name. Convenience for the sync engine.
export async function upsertSyncFile<T>(data: T): Promise<DriveFile> {
  const existing = await findSyncFile();
  if (existing) return updateSyncFile(existing.id, data);
  return createSyncFile(data);
}

export async function deleteSyncFile(fileId: string): Promise<void> {
  const res = await authed(`${API}/files/${fileId}`, { method: 'DELETE' });
  // 204 No Content is success too.
  if (!res.ok && res.status !== 204) {
    const text = await res.text();
    throw new Error(`drive.delete failed: ${res.status} ${text}`);
  }
}
