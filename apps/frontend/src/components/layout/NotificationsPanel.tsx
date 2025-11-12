import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { Bell, Check, Loader2, RotateCcw } from 'lucide-react';

import { notificationsApi } from '@/lib/api/notifications';
import type { Notification } from '@/types/notifications';

const NOTIFICATIONS_QUERY_KEY = ['notifications'];

interface NotificationsPanelProps {
  className?: string;
}

export function NotificationsPanel({ className }: NotificationsPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const queryClient = useQueryClient();

  const {
    data: notifications,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: NOTIFICATIONS_QUERY_KEY,
    queryFn: () => notificationsApi.list({ limit: 20 }),
    refetchOnWindowFocus: false,
  });

  const unreadCount = useMemo(
    () => (notifications ?? []).filter((notification) => !notification.isRead).length,
    [notifications],
  );

  const markAsReadMutation = useMutation({
    mutationFn: (notificationId: string) => notificationsApi.markAsRead(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
    },
  });

  const togglePanel = () => {
    setIsOpen((previous) => !previous);
  };

  const closePanel = () => {
    setIsOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (
        isOpen &&
        panelRef.current &&
        !panelRef.current.contains(target) &&
        !buttonRef.current?.contains(target as Node)
      ) {
        closePanel();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closePanel();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleMarkAsRead = (notification: Notification) => {
    if (notification.isRead) {
      return;
    }
    markAsReadMutation.mutate(notification.id);
  };

  const handleRefresh = () => {
    refetch();
  };

  return (
    <div className={`relative ${className ?? ''}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={togglePanel}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition hover:text-blue-600 dark:hover:text-blue-400"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-[0.65rem] font-semibold text-white">
            {unreadCount}
          </span>
        ) : null}
      </button>

      <div
        ref={panelRef}
        className={`absolute right-0 z-40 mt-2 w-80 max-w-[90vw] rounded-lg border border-border bg-card shadow-xl transition ${
          isOpen ? 'scale-100 opacity-100' : 'pointer-events-none scale-95 opacity-0'
        }`}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Notifications</p>
            <p className="text-xs text-muted-foreground">
              Stay on top of reminders and activity updates.
            </p>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label="Refresh notifications"
          >
            {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading notifications…
            </div>
          ) : notifications && notifications.length > 0 ? (
            <ul className="divide-y divide-border">
              {notifications.map((notification) => {
                const isMarkedAsRead =
                  notification.isRead ||
                  markAsReadMutation.isPending && markAsReadMutation.variables === notification.id;

                return (
                  <li
                    key={notification.id}
                    className={`px-4 py-3 text-sm ${
                      notification.isRead ? 'bg-card' : 'bg-blue-50/70 dark:bg-blue-500/10'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-foreground">{notification.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(notification.createdAt), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                      {!notification.isRead && (
                        <button
                          type="button"
                          onClick={() => handleMarkAsRead(notification)}
                          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[0.7rem] font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
                          disabled={markAsReadMutation.isPending}
                        >
                          {markAsReadMutation.isPending &&
                          markAsReadMutation.variables === notification.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Check className="h-3 w-3" />
                          )}
                          Mark read
                        </button>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground whitespace-pre-line">
                      {notification.message}
                    </p>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              You're all caught up.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default NotificationsPanel;


