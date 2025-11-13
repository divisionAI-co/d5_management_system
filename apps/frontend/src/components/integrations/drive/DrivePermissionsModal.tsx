import { useQuery } from '@tanstack/react-query';
import { X, Shield, User, Globe, Users, Lock, Check, X as XIcon } from 'lucide-react';
import { googleDriveApi } from '@/lib/api/google-drive';
import type { DrivePermission, UserFilePermissions } from '@/types/integrations';
import { FeedbackToast } from '@/components/ui/feedback-toast';
import { useState } from 'react';

interface DrivePermissionsModalProps {
  fileId: string;
  fileName: string;
  open: boolean;
  onClose: () => void;
}

const ROLE_LABELS: Record<DrivePermission['role'], string> = {
  owner: 'Owner',
  organizer: 'Organizer',
  fileOrganizer: 'File Organizer',
  writer: 'Writer',
  commenter: 'Commenter',
  reader: 'Reader',
};

const TYPE_ICONS = {
  user: User,
  group: Users,
  domain: Globe,
  anyone: Lock,
};

const TYPE_LABELS: Record<DrivePermission['type'], string> = {
  user: 'User',
  group: 'Group',
  domain: 'Domain',
  anyone: 'Anyone',
};

export function DrivePermissionsModal({ fileId, fileName, open, onClose }: DrivePermissionsModalProps) {
  const [error, setError] = useState<string | null>(null);

  const { data: allPermissions, isLoading: loadingAll } = useQuery({
    queryKey: ['drive-permissions', fileId],
    queryFn: () => googleDriveApi.getFilePermissions(fileId),
    enabled: open,
    onError: () => {
      setError('Unable to load permissions. Please try again.');
    },
  });

  const { data: myPermissions, isLoading: loadingMy } = useQuery({
    queryKey: ['drive-my-permissions', fileId],
    queryFn: () => googleDriveApi.getMyPermissions(fileId),
    enabled: open,
    onError: () => {
      setError('Unable to load your permissions. Please try again.');
    },
  });

  if (!open) {
    return null;
  }

  return (
    <>
      {error && <FeedbackToast message={error} onDismiss={() => setError(null)} tone="error" />}

      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-3xl rounded-xl bg-card shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-blue-600" />
              <div>
                <h2 className="text-lg font-semibold text-foreground">File Permissions</h2>
                <p className="text-sm text-muted-foreground">{fileName}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="max-h-[70vh] space-y-6 overflow-y-auto px-6 py-6">
            {/* My Permissions Section */}
            {loadingMy ? (
              <div className="text-sm text-muted-foreground">Loading your permissions...</div>
            ) : myPermissions ? (
              <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
                <h3 className="text-sm font-semibold text-foreground">Your Permissions</h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="flex items-center gap-2 text-sm">
                    {myPermissions.canView ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <XIcon className="h-4 w-4 text-red-600" />
                    )}
                    <span className={myPermissions.canView ? 'text-foreground' : 'text-muted-foreground'}>
                      Can View
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    {myPermissions.canComment ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <XIcon className="h-4 w-4 text-red-600" />
                    )}
                    <span className={myPermissions.canComment ? 'text-foreground' : 'text-muted-foreground'}>
                      Can Comment
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    {myPermissions.canEdit ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <XIcon className="h-4 w-4 text-red-600" />
                    )}
                    <span className={myPermissions.canEdit ? 'text-foreground' : 'text-muted-foreground'}>
                      Can Edit
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    {myPermissions.canDelete ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <XIcon className="h-4 w-4 text-red-600" />
                    )}
                    <span className={myPermissions.canDelete ? 'text-foreground' : 'text-muted-foreground'}>
                      Can Delete
                    </span>
                  </div>
                </div>
                {myPermissions.isOwner && (
                  <div className="mt-2 rounded bg-blue-500/20 px-3 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-400">
                    You are the owner of this file
                  </div>
                )}
              </div>
            ) : null}

            {/* All Permissions Section */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">All Permissions</h3>
              {loadingAll ? (
                <div className="text-sm text-muted-foreground">Loading permissions...</div>
              ) : allPermissions && allPermissions.length > 0 ? (
                <div className="space-y-2">
                  {allPermissions.map((permission) => {
                    const Icon = TYPE_ICONS[permission.type];
                    return (
                      <div
                        key={permission.id}
                        className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-3"
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="text-sm font-medium text-foreground">
                              {permission.type === 'user'
                                ? permission.displayName || permission.emailAddress || 'Unknown User'
                                : permission.type === 'domain'
                                  ? `@${permission.domain}`
                                  : TYPE_LABELS[permission.type]}
                            </div>
                            {permission.type === 'user' && permission.emailAddress && (
                              <div className="text-xs text-muted-foreground">{permission.emailAddress}</div>
                            )}
                          </div>
                        </div>
                        <div className="rounded bg-blue-500/20 px-2 py-1 text-xs font-medium text-blue-700 dark:text-blue-400">
                          {ROLE_LABELS[permission.role]}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                  No explicit permissions found. This file may be private or only accessible to the owner.
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end border-t border-border px-6 py-4">
            <button
              onClick={onClose}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

