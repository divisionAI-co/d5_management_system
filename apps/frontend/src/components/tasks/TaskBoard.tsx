import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
  DroppableProvided,
  DroppableStateSnapshot,
  DraggableProvided,
  DraggableStateSnapshot,
} from '@hello-pangea/dnd';
import { Plus } from 'lucide-react';
import type { Task, TaskStatus, TasksColumn } from '@/types/tasks';
import { TaskCard } from './TaskCard';

interface TaskBoardProps {
  columns: TasksColumn[];
  onCreateTask: (status?: TaskStatus) => void;
  onEditTask: (task: Task) => void;
  onStatusChange: (task: Task, status: TaskStatus) => void;
  onDeleteTask?: (task: Task) => void;
  statusOptions: TaskStatus[];
  disableStatusChange?: boolean;
  canDeleteTasks?: boolean;
  onTaskMove?: (result: DropResult, task: Task) => void;
  onAddTaskToEod?: (task: Task) => void;
  addingTaskId?: string | null;
  onOpenActivity?: (task: Task) => void;
}

const STATUS_TITLES: Record<TaskStatus, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'In Review',
  DONE: 'Done',
  CANCELLED: 'Cancelled',
};

const STATUS_ACCENTS: Record<TaskStatus, string> = {
  TODO: 'border-blue-200 bg-blue-50 text-blue-700',
  IN_PROGRESS: 'border-amber-200 bg-amber-50 text-amber-700',
  IN_REVIEW: 'border-purple-200 bg-purple-50 text-purple-700',
  DONE: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  CANCELLED: 'border-border bg-muted text-muted-foreground',
};

export function TaskBoard({
  columns,
  onCreateTask,
  onEditTask,
  onStatusChange,
  onDeleteTask,
  statusOptions,
  disableStatusChange,
  canDeleteTasks = false,
  onTaskMove,
  onAddTaskToEod,
  addingTaskId,
  onOpenActivity,
}: TaskBoardProps) {
  const tasksMap = new Map<string, Task>();
  columns.forEach((column) => {
    column.tasks.forEach((task) => tasksMap.set(task.id, task));
  });

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) {
      return;
    }

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    const targetStatus = destination.droppableId as TaskStatus;
    const task = tasksMap.get(draggableId);

    if (!task) {
      return;
    }

    onTaskMove?.(result, task);

    if (task.status === targetStatus) {
      return;
    }

    if (!onTaskMove) {
      onStatusChange(task, targetStatus);
    }
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="grid w-full gap-4 [grid-template-columns:repeat(auto-fit,minmax(320px,1fr))]">
        {columns.map((column) => (
          <Droppable droppableId={column.status} key={column.status}>
            {(provided: DroppableProvided, snapshot: DroppableStateSnapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`flex min-h-[400px] flex-1 flex-col rounded-2xl border border-border bg-muted transition ${
                  snapshot.isDraggingOver ? 'border-blue-300 bg-blue-50/60' : ''
                }`}
              >
                <div className="flex items-center justify-between rounded-t-2xl border-b border-border bg-card px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${STATUS_ACCENTS[column.status]}`}
                    >
                      {STATUS_TITLES[column.status]}
                    </span>
                    <span className="text-xs font-medium text-muted-foreground">
                      {column.tasks.length}{' '}
                      {column.tasks.length === 1 ? 'Task' : 'Tasks'}
                    </span>
                  </div>
                  <button
                    onClick={() => onCreateTask(column.status)}
                    className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground/70"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add
                  </button>
                </div>

                <div className="flex flex-1 flex-col gap-3 p-4">
                  {column.tasks.length === 0 && (
                    <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/80 px-4 py-8 text-center text-sm text-muted-foreground">
                      <p>No tasks in this stage yet.</p>
                      <button
                        onClick={() => onCreateTask(column.status)}
                        className="mt-3 inline-flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-600 transition hover:bg-blue-100"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Create Task
                      </button>
                    </div>
                  )}

                  {column.tasks.map((task, index) => (
                    <Draggable
                      key={task.id}
                      draggableId={task.id}
                      index={index}
                    >
                      {(dragProvided: DraggableProvided, dragSnapshot: DraggableStateSnapshot) => (
                        <div
                          ref={dragProvided.innerRef}
                          {...dragProvided.draggableProps}
                          {...dragProvided.dragHandleProps}
                          style={{
                            width: '100%',
                            ...(dragProvided.draggableProps.style ?? {}),
                          }}
                          className={`${
                            dragSnapshot.isDragging ? 'shadow-lg' : ''
                          }`}
                        >
                          <TaskCard
                            task={task}
                            statusOptions={statusOptions}
                            onEdit={onEditTask}
                            onStatusChange={onStatusChange}
                            onDelete={canDeleteTasks ? onDeleteTask : undefined}
                            disableStatusChange={disableStatusChange}
                            onAddToEod={onAddTaskToEod}
                            disableAddToEod={addingTaskId === task.id}
                            onOpenActivity={onOpenActivity}
                          />
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              </div>
            )}
          </Droppable>
        ))}
      </div>
    </DragDropContext>
  );
}


