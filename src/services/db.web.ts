// Web stub — SQLite is native-only. All persistence on web goes through
// Zustand's localStorage persist middleware (see taskStore.ts).
import { Task, Category } from '../types';

export function initDb(): void {}
export function seedDefaults(): void {}
export function getCategories(): Category[] { return []; }
export function getTasks(): Task[] { return []; }
export function getTasksByDate(_iso: string): Task[] { return []; }
export function createTask(_task: Task): void {}
export function updateTask(_id: string, _changes: Partial<Task>): void {}
export function deleteTask(_id: string): void {}
export function createCategory(_cat: Category): void {}
export function deleteCategory(_code: string): void {}
export function _resetDb(): void {}
