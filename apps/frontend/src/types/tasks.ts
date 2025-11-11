export type TaskStatus =
  | 'TODO'
  | 'IN_PROGRESS'
  | 'IN_REVIEW'
  | 'DONE'
  | 'CANCELLED';

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface TaskUserRef {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignedToId?: string | null;
  assignedTo?: TaskUserRef | null;
  createdById: string;
  createdBy: TaskUserRef;
  dueDate?: string | null;
  startDate?: string | null;
  completedAt?: string | null;
  customerId?: string | null;
  tags: string[];
  estimatedHours?: number | null;
  actualHours?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface TasksColumn {
  status: TaskStatus;
  tasks: Task[];
}

export interface TasksKanbanResponse {
  view: 'kanban';
  total: number;
  columns: TasksColumn[];
}

export interface TaskFilters {
  status?: TaskStatus;
  priority?: TaskPriority;
  assignedToId?: string;
  createdById?: string;
  customerId?: string;
  search?: string;
  dueBefore?: string;
  dueAfter?: string;
  limit?: number;
}

export interface CreateTaskPayload {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignedToId?: string;
  createdById: string;
  customerId?: string;
  dueDate?: string;
  startDate?: string;
  tags?: string[];
  estimatedHours?: number;
  actualHours?: number;
}

export interface UpdateTaskPayload extends Partial<CreateTaskPayload> {}

export interface UpdateTaskStatusPayload {
  status: TaskStatus;
  completedAt?: string;
}


