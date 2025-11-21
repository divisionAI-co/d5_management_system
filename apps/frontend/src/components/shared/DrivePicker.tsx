import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ExternalLink, FileText, Folder, Loader2, X } from 'lucide-react';
import { googleDriveApi } from '@/lib/api/google-drive';
import type { DriveFile } from '@/types/integrations';

export type DrivePickerMode = 'file' | 'folder';

interface DriveBreadcrumb {
  id: string | null;
  name: string;
}

interface DrivePickerProps {
  open: boolean;
  mode: DrivePickerMode;
  initialFolderId?: string | null;
  title?: string;
  description?: string;
  onClose: () => void;
  onSelectFile?: (file: DriveFile) => void;
  onSelectFolder?: (folder: DriveFile) => void;
  onUseCurrentFolder?: (folderId: string) => void;
}

export function DrivePicker({
  open,
  mode,
  initialFolderId,
  title,
  description,
  onClose,
  onSelectFile,
  onSelectFolder,
  onUseCurrentFolder,
}: DrivePickerProps) {
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(initialFolderId ?? null);
  const [breadcrumbs, setBreadcrumbs] = useState<DriveBreadcrumb[]>([
    { id: null, name: 'My Drive' },
  ]);

  const driveFilesQuery = useQuery({
    queryKey: ['drive-picker', currentFolderId],
    enabled: open,
    queryFn: () =>
      googleDriveApi.listFiles({
        parentId: currentFolderId ?? undefined,
        pageSize: 100,
      }),
  });

  // Initialize breadcrumbs when opening with an initial folder
  useEffect(() => {
    if (open && initialFolderId && breadcrumbs.length === 1) {
      setBreadcrumbs([{ id: null, name: 'My Drive' }, { id: initialFolderId, name: 'Selected folder' }]);
      setCurrentFolderId(initialFolderId);
      
      // Try to get folder name
      googleDriveApi
        .getFile(initialFolderId)
        .then((metadata) => {
          setBreadcrumbs((prev) =>
            prev.map((crumb) =>
              crumb.id === initialFolderId ? { ...crumb, name: metadata.name ?? 'Selected folder' } : crumb,
            ),
          );
        })
        .catch(() => {
          // ignore metadata errors
        });
    } else if (!open) {
      // Reset when closed
      setCurrentFolderId(initialFolderId ?? null);
      setBreadcrumbs([{ id: null, name: 'My Drive' }]);
    }
  }, [open, initialFolderId]);

  const handleClose = () => {
    setCurrentFolderId(initialFolderId ?? null);
    setBreadcrumbs([{ id: null, name: 'My Drive' }]);
    onClose();
  };

  const handleSelectFile = (file: DriveFile) => {
    if (onSelectFile) {
      onSelectFile(file);
      handleClose();
    }
  };

  const handleSelectFolder = (folder: DriveFile) => {
    if (onSelectFolder) {
      onSelectFolder(folder);
      handleClose();
    }
  };

  const handleUseCurrentFolder = () => {
    if (currentFolderId && onUseCurrentFolder) {
      onUseCurrentFolder(currentFolderId);
      handleClose();
    }
  };

  const handleNavigateToBreadcrumb = (index: number) => {
    const target = breadcrumbs[index];
    setCurrentFolderId(target?.id ?? null);
    setBreadcrumbs(breadcrumbs.slice(0, index + 1));
  };

  const handleEnterFolder = (folder: DriveFile) => {
    setCurrentFolderId(folder.id);
    setBreadcrumbs([
      ...breadcrumbs,
      {
        id: folder.id,
        name: folder.name || 'Untitled folder',
      },
    ]);
  };

  if (!open) {
    return null;
  }

  const isFolderMode = mode === 'folder';
  const files = driveFilesQuery.data?.files ?? [];
  const folders = files.filter((f) => f.isFolder);
  const fileItems = files.filter((f) => !f.isFolder);
  const lastBreadcrumbIndex = breadcrumbs.length - 1;
  const currentFolderLink = currentFolderId
    ? `https://drive.google.com/drive/folders/${currentFolderId}`
    : 'https://drive.google.com/drive/u/0/my-drive';

  const defaultTitle = isFolderMode ? 'Choose Google Drive Folder' : 'Select File from Google Drive';
  const defaultDescription = isFolderMode
    ? 'Navigate your Google Drive and pick the folder.'
    : 'Choose a file from Google Drive.';

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 px-4">
      <div className="relative flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">{title || defaultTitle}</h3>
            <p className="text-sm text-muted-foreground">{description || defaultDescription}</p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={currentFolderLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open in Drive
            </a>
            <button
              type="button"
              onClick={handleClose}
              className="rounded-full p-2 text-muted-foreground transition hover:bg-muted/70 hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
          <nav className="flex flex-wrap items-center gap-1 text-sm">
            {breadcrumbs.map((breadcrumb, index) => (
              <span key={`${breadcrumb.id ?? 'root'}-${index}`} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleNavigateToBreadcrumb(index)}
                  disabled={index === lastBreadcrumbIndex}
                  className={`font-semibold transition ${
                    index === lastBreadcrumbIndex
                      ? 'cursor-default text-foreground'
                      : 'text-blue-600 hover:underline'
                  }`}
                >
                  {index === 0 ? 'My Drive' : breadcrumb.name}
                </button>
                {index < lastBreadcrumbIndex && <span className="text-muted-foreground">/</span>}
              </span>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            {breadcrumbs.length > 1 && (
              <button
                type="button"
                onClick={() => handleNavigateToBreadcrumb(Math.max(0, lastBreadcrumbIndex - 1))}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Back
              </button>
            )}
            {isFolderMode && currentFolderId && onUseCurrentFolder && (
              <button
                type="button"
                onClick={handleUseCurrentFolder}
                className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                Use this folder
              </button>
            )}
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
          {driveFilesQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Loading Google Drive files...</p>
              </div>
            </div>
          ) : driveFilesQuery.isError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-6 text-center text-sm text-red-700">
              <p className="font-semibold">Unable to load Google Drive files</p>
              <p className="mt-1 text-xs">Please check your Google Drive connection and try again.</p>
            </div>
          ) : files.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/50 px-4 py-12 text-center text-sm text-muted-foreground">
              This folder is empty.
            </div>
          ) : (
            <div className="space-y-2">
              {folders.length > 0 && (
                <div>
                  <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Folders</h4>
                  <div className="space-y-1">
                    {folders.map((folder) => (
                      <button
                        key={folder.id}
                        type="button"
                        onClick={() => handleEnterFolder(folder)}
                        className="flex w-full items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left transition hover:border-blue-500 hover:bg-blue-50/60"
                      >
                        <Folder className="h-5 w-5 flex-shrink-0 text-blue-500" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-foreground">{folder.name}</p>
                          {folder.modifiedTime && (
                            <p className="text-xs text-muted-foreground">
                              Modified {new Date(folder.modifiedTime).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        {isFolderMode && onSelectFolder && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectFolder(folder);
                            }}
                            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700"
                          >
                            Select
                          </button>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!isFolderMode && fileItems.length > 0 && (
                <div>
                  {folders.length > 0 && <h4 className="mb-2 mt-4 text-xs font-semibold uppercase text-muted-foreground">Files</h4>}
                  <div className="space-y-1">
                    {fileItems.map((file) => (
                      <button
                        key={file.id}
                        type="button"
                        onClick={() => handleSelectFile(file)}
                        className="flex w-full items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left transition hover:border-blue-500 hover:bg-blue-50/60"
                      >
                        <FileText className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-foreground">{file.name}</p>
                          {file.modifiedTime && (
                            <p className="text-xs text-muted-foreground">
                              Modified {new Date(file.modifiedTime).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700"
                        >
                          Select
                        </button>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

