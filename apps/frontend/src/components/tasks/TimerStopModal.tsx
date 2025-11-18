import { useState } from 'react';
import { X, Clock } from 'lucide-react';
import { MentionInput } from '@/components/shared/MentionInput';

interface TimerStopModalProps {
  open: boolean;
  timeSpent: number; // in hours
  taskTitle: string;
  onClose: () => void;
  onSubmit: (description: string) => void;
  isSubmitting?: boolean;
}

export function TimerStopModal({
  open,
  timeSpent,
  taskTitle,
  onClose,
  onSubmit,
  isSubmitting = false,
}: TimerStopModalProps) {
  const [description, setDescription] = useState('');

  if (!open) {
    return null;
  }

  const formatTime = (hours: number): string => {
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);
    
    if (wholeHours === 0) {
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }
    if (minutes === 0) {
      return `${wholeHours} hour${wholeHours !== 1 ? 's' : ''}`;
    }
    return `${wholeHours}h ${minutes}m`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(description.trim());
  };

  const handleClose = () => {
    setDescription('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-blue-100 p-2">
              <Clock className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Timer Stopped</h2>
              <p className="text-sm text-muted-foreground">{taskTitle}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-4">
          <div className="rounded-lg border border-border bg-muted/50 p-4">
            <div className="text-center">
              <p className="text-sm font-medium text-muted-foreground">Time Spent</p>
              <p className="mt-1 text-2xl font-bold text-foreground">
                {formatTime(timeSpent)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                ({timeSpent.toFixed(2)} hours)
              </p>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">
              Description <span className="text-muted-foreground/70">(optional)</span>
            </label>
            <MentionInput
              value={description}
              onChange={setDescription}
              rows={4}
              placeholder="What did you work on? Type @ to mention someone"
              multiline={true}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              This will be added to the task description along with the time entry.
            </p>
          </div>

          <div className="flex justify-end gap-3 border-t border-border pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Saving...' : 'Log Time'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

