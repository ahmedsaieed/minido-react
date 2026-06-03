import { Category } from '../types';

// updatedAt is epoch so any user-modified category (including a same-code
// edit on another device) always wins on sync.
const EPOCH = '1970-01-01T00:00:00.000Z';

export const DEFAULT_CATEGORIES: Category[] = [
  { code: 'GEN', color: '#9a9080', title: 'General', updatedAt: EPOCH },
  { code: 'WRK', color: '#7eb8c9', title: 'Work', updatedAt: EPOCH },
  { code: 'PRS', color: '#a8c99a', title: 'Personal', updatedAt: EPOCH },
  { code: 'LUV', color: '#c99a9a', title: 'Dating / Relationship', updatedAt: EPOCH },
];
