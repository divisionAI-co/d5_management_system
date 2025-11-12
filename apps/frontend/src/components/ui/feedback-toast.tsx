import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

import { cn } from '@/lib/utils';

type FeedbackTone = 'success' | 'info' | 'warning' | 'error';

const TONE_STYLES: Record<FeedbackTone, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  info: 'border-blue-200 bg-blue-50 text-blue-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-700',
  error: 'border-red-200 bg-red-50 text-red-700',
};

export interface FeedbackToastProps {
  message: string;
  onDismiss?: () => void;
  dismissLabel?: string;
  tone?: FeedbackTone;
}

export function FeedbackToast({
  message,
  onDismiss,
  dismissLabel = 'Dismiss',
  tone = 'success',
}: FeedbackToastProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[120] flex justify-center px-4 pb-6 sm:justify-end sm:px-6">
      <div
        className={cn(
          'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg sm:max-w-md',
          TONE_STYLES[tone],
        )}
        role="status"
        aria-live="polite"
      >
        <span className="flex-1 leading-5">{message}</span>
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className={cn(
              'inline-flex shrink-0 items-center gap-1 rounded-md border border-transparent px-2 py-1 text-xs font-semibold uppercase tracking-wide transition',
              tone === 'success' && 'text-emerald-700 hover:bg-emerald-100/80',
              tone === 'info' && 'text-blue-700 hover:bg-blue-100/70',
              tone === 'warning' && 'text-amber-700 hover:bg-amber-100/70',
              tone === 'error' && 'text-red-700 hover:bg-red-100/70',
            )}
            aria-label={dismissLabel}
          >
            <X className="h-3.5 w-3.5" />
            {dismissLabel}
          </button>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}


