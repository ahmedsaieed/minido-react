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
  deleteCategory: (code: string) => void;
}

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
        { ...category, updatedAt: category.updatedAt ?? nowISO() },
      ],
    })),

  deleteCategory: (code) =>
    set((s) => {
      const target = s.categories.find((c) => c.code === code);
      if (!target) return {};
      const ts = nowISO();
      return {
        categories: s.categories.filter((c) => c.code !== code),
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
