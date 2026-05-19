export interface Task {
  id: string;
  text: string;
  categoryCode: string;
  isoDate: string;
  done: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  code: string;
  color: string;
  title: string;
}

export interface AppData {
  version: number;
  lastModified: string;
  categories: Category[];
  tasks: Task[];
}
