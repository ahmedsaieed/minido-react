export interface Task {
  id: string;
  text: string;
  categoryCode: string;
  isoDate: string;
  done: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  // Soft-delete tombstone marker. NULL on active rows. When set, the row is
  // treated as deleted but kept around for cross-device sync.
  deletedAt?: string | null;
}

export interface Category {
  code: string;
  color: string;
  title: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface AppData {
  version: number;
  lastModified: string;
  categories: Category[];
  tasks: Task[];
}

export interface SyncState {
  remoteFileId: string | null;
  remoteRevision: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
}
