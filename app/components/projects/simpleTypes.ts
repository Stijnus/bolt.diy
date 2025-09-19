// Simplified Project Types - Keep it minimal and debuggable

export type GitStatus = 'unknown' | 'accessible' | 'inaccessible' | 'checking';

export interface GitInfo {
  status: GitStatus;
  defaultBranch?: string;
  branches?: string[];
  lastChecked?: string;
  error?: string;
}

export type TaskStatus = 'todo' | 'in-progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface ProjectTask {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  createdAt: string;
  updatedAt?: string;
  dueDate?: string;
}

export interface SimpleProject {
  id: string;
  name: string;
  gitUrl: string;
  description?: string;
  createdAt: string;
  lastUpdated?: string;
  gitInfo?: GitInfo;
  tasks?: ProjectTask[];
  taskCounts?: {
    total: number;
    todo: number;
    inProgress: number;
    done: number;
  };
}

export interface NewProject {
  name: string;
  gitUrl: string;
  description?: string;
}

export interface UpdateProject {
  name?: string;
  gitUrl?: string;
  description?: string;
}

export interface NewTask {
  title: string;
  description?: string;
  priority: TaskPriority;
  dueDate?: string;
}

export interface UpdateTask {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string;
}
