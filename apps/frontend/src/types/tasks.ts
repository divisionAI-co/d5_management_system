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

export interface TaskAssignee {
  id: string;
  taskId: string;
  userId: string;
  user: TaskUserRef;
  assignedAt: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignedToId?: string | null; // Legacy field - kept for backward compatibility
  assignedTo?: TaskUserRef | null; // Legacy field - kept for backward compatibility
  assignees?: TaskAssignee[]; // New multiple assignees
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
  assignedToId?: string; // Legacy field - kept for backward compatibility
  assignedToIds?: string[]; // New array of assignee IDs
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

export interface TaskEodLinkResponse {
  reportId: string;
  reportDate: string;
  isNewReport: boolean;
  message: string;
}

// Task Template Types (Recurring Tasks)
export type TaskRecurrenceType = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

export interface TaskTemplate {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  recurrenceType: TaskRecurrenceType;
  recurrenceInterval: number;
  isActive: boolean;
  startDate: string;
  endDate?: string | null;
  defaultAssigneeIds: string[];
  defaultCustomerId?: string | null;
  defaultTags: string[];
  defaultEstimatedHours?: number | null;
  createdById: string;
  createdBy: TaskUserRef;
  lastGeneratedDate?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    generatedTasks: number;
  };
  generatedTasks?: Task[];
}

export interface CreateTaskTemplatePayload {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  recurrenceType: TaskRecurrenceType;
  recurrenceInterval?: number;
  isActive?: boolean;
  startDate: string;
  endDate?: string | null;
  defaultAssigneeIds?: string[];
  defaultCustomerId?: string;
  defaultTags?: string[];
  defaultEstimatedHours?: number;
  createdById: string;
}

export interface UpdateTaskTemplatePayload extends Partial<CreateTaskTemplatePayload> {}


