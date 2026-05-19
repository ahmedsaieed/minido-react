import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Task, Category } from '../types';

interface TaskStore {
  tasks: Task[];
  categories: Category[];

  setTasks: (tasks: Task[]) => void;
  setCategories: (categories: Category[]) => void;

  addTask: (task: Task) => void;
  updateTask: (id: string, changes: Partial<Omit<Task, 'id' | 'createdAt'>>) => void;
  deleteTask: (id: string) => void;
  toggleDone: (id: string) => void;
  moveTask: (id: string, isoDate: string) => void;
  changeCategory: (id: string, categoryCode: string) => void;

  addCategory: (category: Category) => void;
  deleteCategory: (code: string) => void;
}

const storeImpl = (set: (fn: (s: TaskStore) => Partial<TaskStore>) => void): TaskStore => ({
  tasks: [],
  categories: [],

  setTasks: (tasks) => set(() => ({ tasks })),
  setCategories: (categories) => set(() => ({ categories })),

  addTask: (task) => set((s) => ({ tasks: [...s.tasks, task] })),

  updateTask: (id, changes) =>
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === id ? { ...t, ...changes, updatedAt: new Date().toISOString() } : t
      ),
    })),

  deleteTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),

  toggleDone: (id) =>
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === id
          ? { ...t, done: !t.done, updatedAt: new Date().toISOString() }
          : t
      ),
    })),

  moveTask: (id, isoDate) =>
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === id ? { ...t, isoDate, updatedAt: new Date().toISOString() } : t
      ),
    })),

  changeCategory: (id, categoryCode) =>
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === id ? { ...t, categoryCode, updatedAt: new Date().toISOString() } : t
      ),
    })),

  addCategory: (category) => set((s) => ({ categories: [...s.categories, category] })),

  deleteCategory: (code) =>
    set((s) => ({ categories: s.categories.filter((c) => c.code !== code) })),
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
