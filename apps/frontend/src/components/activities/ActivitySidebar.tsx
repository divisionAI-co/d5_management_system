import { X } from 'lucide-react';
import { ActivityPanel } from './ActivityPanel';

type EntityType =
  | 'customer'
  | 'lead'
  | 'opportunity'
  | 'candidate'
  | 'employee'
  | 'contact'
  | 'task';

interface ActivitySidebarProps {
  open: boolean;
  onClose: () => void;
  entityId: string;
  entityType: EntityType;
  title?: string;
  emptyState?: string;
}

export function ActivitySidebar({
  open,
  onClose,
  entityId,
  entityType,
  title,
  emptyState,
}: ActivitySidebarProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-gray-900/60">
      <aside className="relative flex h-full w-full max-w-3xl flex-col bg-card shadow-2xl">
        <div className="flex items-start justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              {title ?? 'Activities & Notes'}
            </h2>
            <p className="text-xs text-muted-foreground">
              Keep teammates aligned with a shared timeline of updates, reminders, and follow-ups.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close activities sidebar"
            className="rounded-full border border-border p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <ActivityPanel
            entityId={entityId}
            entityType={entityType}
            title={title}
            emptyState={emptyState}
          />
        </div>
      </aside>
    </div>
  );
}


