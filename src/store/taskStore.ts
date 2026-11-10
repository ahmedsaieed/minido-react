import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Task, Category } from '../types';

interface Tombstones {
  tasks: Task[];       // each carries deletedAt
  categories: Category[];
}

interface TaskStore {
  tasks: Task[];           // active only
  categories: Category[];  // active only
  tombstones: Tombstones;  // soft-deleted rows kept for sync

  setTasks: (tasks: Task[]) => void;
  setCategories: (categories: Category[]) => void;
  setTombstones: (t: Tombstones) => void;

  addTask: (task: Task) => void;
  updateTask: (id: string, changes: Partial<Omit<Task, 'id' | 'createdAt'>>) => void;
  deleteTask: (id: string) => void;
  toggleDone: (id: string) => void;
  moveTask: (id: string, isoDate: string) => void;
  changeCategory: (id: string, categoryCode: string) => void;

  addCategory: (category: Category) => void;
  updateCategory: (code: string, changes: Partial<Pick<Category, 'title' | 'color'>>) => void;
  // Soft-deletes the category and moves its active tasks to FALLBACK_CATEGORY.
  deleteCategory: (code: string) => void;
}

// Tasks from a deleted category land here. It can't be deleted itself.
export const FALLBACK_CATEGORY = 'GEN';

const nowISO = () => new Date().toISOString();

const storeImpl = (set: (fn: (s: TaskStore) => Partial<TaskStore>) => void): TaskStore => ({
  tasks: [],
  categories: [],
  tombstones: { tasks: [], categories: [] },

  setTasks: (tasks) => set(() => ({ tasks })),
  setCategories: (categories) => set(() => ({ categories })),
  setTombstones: (tombstones) => set(() => ({ tombstones })),

  addTask: (task) => set((s) => ({ tasks: [...s.tasks, task] })),

  updateTask: (id, changes) =>
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === id ? { ...t, ...changes, updatedAt: nowISO() } : t
      ),
    })),

  deleteTask: (id) =>
    set((s) => {
      const target = s.tasks.find((t) => t.id === id);
      if (!target) return {};
      const ts = nowISO();
      return {
        tasks: s.tasks.filter((t) => t.id !== id),
        tombstones: {
          ...s.tombstones,
          tasks: [
            ...s.tombstones.tasks.filter((t) => t.id !== id),
            { ...target, deletedAt: ts, updatedAt: ts },
          ],
        },
      };
    }),

  toggleDone: (id) =>
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === id ? { ...t, done: !t.done, updatedAt: nowISO() } : t
      ),
    })),

  moveTask: (id, isoDate) =>
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === id ? { ...t, isoDate, updatedAt: nowISO() } : t
      ),
    })),

  changeCategory: (id, categoryCode) =>
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === id ? { ...t, categoryCode, updatedAt: nowISO() } : t
      ),
    })),

  addCategory: (category) =>
    set((s) => ({
      categories: [
        ...s.categories,
        { ...category, deletedAt: null, updatedAt: category.updatedAt ?? nowISO() },
      ],
      // Re-creating a previously deleted code revives it: drop the tombstone,
      // otherwise sync would see both rows and the tombstone could win.
      tombstones: {
        ...s.tombstones,
        categories: s.tombstones.categories.filter((c) => c.code !== category.code),
      },
    })),

  updateCategory: (code, changes) =>
    set((s) => ({
      categories: s.categories.map((c) =>
        c.code === code ? { ...c, ...changes, updatedAt: nowISO() } : c
      ),
    })),

  deleteCategory: (code) =>
    set((s) => {
      if (code === FALLBACK_CATEGORY) return {};
      const target = s.categories.find((c) => c.code === code);
      if (!target) return {};
      const ts = nowISO();
      return {
        categories: s.categories.filter((c) => c.code !== code),
        tasks: s.tasks.map((t) =>
          t.categoryCode === code
            ? { ...t, categoryCode: FALLBACK_CATEGORY, updatedAt: ts }
            : t
        ),
        tombstones: {
          ...s.tombstones,
          categories: [
            ...s.tombstones.categories.filter((c) => c.code !== code),
            { ...target, deletedAt: ts, updatedAt: ts },
          ],
        },
      };
    }),
});

// On web: persist to localStorage so data survives page refreshes.
// On native: SQLite is the source of truth; the store is just a runtime cache.
const webStorage = typeof localStorage !== 'undefined'
  ? createJSONStorage(() => localStorage)
  : null;

export const useTaskStore = webStorage
  ? create<TaskStore>()(
      persist(storeImpl as any, {
        name: 'minido-store',
        storage: webStorage,
      })
    )
  : create<TaskStore>()(storeImpl as any);
