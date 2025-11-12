import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Folder, FileText, ArrowLeft, RefreshCcw, Upload, Download, Edit, Trash2, Search, ListTree, Link as LinkIcon, Check } from 'lucide-react';

import { googleDriveApi } from '@/lib/api/google-drive';
import { FeedbackToast } from '@/components/ui/feedback-toast';
import type { DriveFile } from '@/types/integrations';

type Breadcrumb = {
  id: string | null;
  name: string;
};

const PAGE_SIZE = 100;

function getFileIcon(file: DriveFile) {
  if (file.isFolder) {
    return <Folder className="h-5 w-5 text-blue-500" />;
  }
  if (file.thumbnailLink) {
    return (
      <img
        src={file.thumbnailLink}
        alt={`${file.name} thumbnail`}
        className="h-10 w-10 rounded border border-border object-cover"
        referrerPolicy="no-referrer"
      />
    );
  }
  return <FileText className="h-5 w-5 text-muted-foreground" />;
}

export function DriveBrowser() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([
    { id: null, name: 'Shared Drive' },
  ]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [downloadingFileId, setDownloadingFileId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [recursiveSearch, setRecursiveSearch] = useState(false);
  const [copySuccessId, setCopySuccessId] = useState<string | null>(null);

  const parentId = useMemo(() => breadcrumbs[breadcrumbs.length - 1]?.id ?? undefined, [breadcrumbs]);

  const listQuery = useQuery({
    queryKey: ['drive-files', parentId, activeSearch],
    queryFn: () =>
      googleDriveApi.listFiles({
        parentId: parentId ?? undefined,
        search: activeSearch || undefined,
        pageSize: PAGE_SIZE,
        recursive: recursiveSearch || undefined,
      }),
  });

  useEffect(() => {
    if (listQuery.isError) {
      setListError('Unable to load Google Drive files right now. Please try again later.');
    } else if (listQuery.isSuccess) {
      setListError(null);
    }
  }, [listQuery.isError, listQuery.isSuccess]);

  const uploadMutation = useMutation({
    mutationFn: ({ file, parent }: { file: File; parent?: string }) =>
      googleDriveApi.uploadFile(file, parent),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drive-files'] });
      setActionError(null);
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message ?? 'Unable to upload file right now.';
      setActionError(typeof message === 'string' ? message : 'Unable to upload file right now.');
    },
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      googleDriveApi.renameFile(id, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drive-files'] });
      setActionError(null);
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message ?? 'Unable to rename file right now.';
      setActionError(typeof message === 'string' ? message : 'Unable to rename file right now.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (fileId: string) => googleDriveApi.deleteFile(fileId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drive-files'] });
      setActionError(null);
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message ?? 'Unable to delete file right now.';
      setActionError(typeof message === 'string' ? message : 'Unable to delete file right now.');
    },
  });

  const handleOpenFolder = useCallback(
    (file: DriveFile) => {
      setBreadcrumbs((prev) => {
        const last = prev[prev.length - 1];
        const alreadyActive = last?.id === file.id;

        if (alreadyActive) {
          return prev;
        }

        const root = prev[0] ?? { id: null, name: 'Shared Drive' };

        if (recursiveSearch || activeSearch) {
          return [
            root,
            {
              id: file.id,
              name: file.name,
            },
          ];
        }

        return [
          ...prev,
          {
            id: file.id,
            name: file.name,
          },
        ];
      });

      if (recursiveSearch || activeSearch) {
        setActiveSearch('');
        setSearchTerm('');
        if (recursiveSearch) {
          setRecursiveSearch(false);
        }
      }
    },
    [recursiveSearch, activeSearch],
  );
  const handleOpenFile = useCallback((file: DriveFile) => {
    const url = file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }, []);


  const handleNavigateToBreadcrumb = useCallback((index: number) => {
    setBreadcrumbs((prev) => prev.slice(0, index + 1));
  }, []);

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['drive-files'] });
  }, [queryClient]);

  const handleUploadClick = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, []);

  const handleFileSelected = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }

      uploadMutation.mutate({ file, parent: parentId ?? undefined });
      event.target.value = '';
    },
    [parentId, uploadMutation],
  );

  const handleRename = useCallback(
    (file: DriveFile) => {
      const newName = window.prompt('Enter new name for the file', file.name);
      if (!newName || newName.trim() === '' || newName === file.name) {
        return;
      }

      renameMutation.mutate({ id: file.id, name: newName.trim() });
    },
    [renameMutation],
  );

  const handleDelete = useCallback(
    (file: DriveFile) => {
      const confirmed = window.confirm(`Delete "${file.name}" from Google Drive?`);
      if (!confirmed) {
        return;
      }

      deleteMutation.mutate(file.id);
    },
    [deleteMutation],
  );

  const handleCopyLink = useCallback((file: DriveFile) => {
    const viewLink = file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`;

    navigator.clipboard
      .writeText(viewLink)
      .then(() => {
        setCopySuccessId(file.id);
        setTimeout(() => setCopySuccessId(null), 2000);
      })
      .catch(() => {
        setActionError('Unable to copy link to clipboard. Please try manually.');
      });
  }, []);

  const handleDownload = useCallback(
    async (file: DriveFile) => {
      try {
        setActionError(null);
        setDownloadingFileId(file.id);
        const blob = await googleDriveApi.downloadFile(file.id);
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = file.name;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      } catch (error: any) {
        const message = error?.response?.data?.message ?? 'Unable to download file right now.';
        setActionError(typeof message === 'string' ? message : 'Unable to download file right now.');
      } finally {
        setDownloadingFileId(null);
      }
    },
    [],
  );

  const loading =
    listQuery.isLoading ||
    uploadMutation.isPending ||
    renameMutation.isPending ||
    deleteMutation.isPending ||
    downloadingFileId !== null;

  return (
    <>
      {actionError && (
        <FeedbackToast
          message={actionError}
          onDismiss={() => setActionError(null)}
          tone="error"
        />
      )}

      {listError && (
        <FeedbackToast
          message={listError}
          onDismiss={() => setListError(null)}
          tone="error"
        />
      )}

      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-4 border-b border-border px-6 py-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Google Drive</h2>
          <p className="text-sm text-muted-foreground">
            Browse and manage files stored in your shared Google Drive without leaving division5.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </button>
          <button
            type="button"
            onClick={handleUploadClick}
            disabled={uploadMutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Upload className="h-4 w-4" />
            {uploadMutation.isPending ? 'Uploading...' : 'Upload'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileSelected}
          />
        </div>
      </div>

        <div className="space-y-4 px-6 py-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ArrowLeft className="h-4 w-4" />
            <nav className="flex flex-wrap items-center gap-1">
              {breadcrumbs.map((breadcrumb, index) => (
                <span key={`${breadcrumb.id ?? 'root'}-${index}`} className="flex items-center">
                  <button
                    type="button"
                    className="text-blue-600 hover:underline"
                    onClick={() => handleNavigateToBreadcrumb(index)}
                    disabled={index === breadcrumbs.length - 1}
                  >
                    {breadcrumb.name}
                  </button>
                  {index < breadcrumbs.length - 1 && <span className="mx-1 text-muted-foreground">/</span>}
                </span>
              ))}
            </nav>
          </div>

          <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
            <form
              className="w-full md:w-auto"
              onSubmit={(event) => {
                event.preventDefault();
                setActiveSearch(searchTerm);
              }}
            >
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="search"
                  placeholder={`Search ${recursiveSearch ? 'entire drive' : 'this folder'}...`}
                  className="w-full rounded-lg border border-border px-10 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </div>
            </form>

            <label className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <input
                type="checkbox"
                checked={recursiveSearch}
                onChange={(event) => setRecursiveSearch(event.target.checked)}
                className="h-4 w-4 rounded border-border text-blue-600 focus:ring-blue-500"
              />
              <span className="inline-flex items-center gap-1">
                <ListTree className="h-4 w-4" />
                Search entire drive
              </span>
            </label>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-muted text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Name</th>
                <th className="px-4 py-3 text-left font-semibold">Modified</th>
                <th className="px-4 py-3 text-left font-semibold">Size</th>
                <th className="px-4 py-3 text-left font-semibold">Owner</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card text-muted-foreground">
              {listQuery.isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    Loading Google Drive files...
                  </td>
                </tr>
              ) : (listQuery.data?.files?.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    {activeSearch
                      ? `No files match "${activeSearch}".`
                      : 'This folder is empty. Upload a document to get started.'}
                  </td>
                </tr>
              ) : (
                listQuery.data?.files.map((file) => (
                  <tr key={file.id} className="hover:bg-muted/50">
                    <td className="px-4 py-3">
                      {file.isFolder ? (
                        <button
                          type="button"
                          className="flex items-center gap-3 text-left text-sm font-medium text-foreground hover:text-blue-600"
                          onClick={() => handleOpenFolder(file)}
                        >
                          {getFileIcon(file)}
                          <span>{file.name}</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="flex items-center gap-3 text-left text-sm font-medium text-blue-600 hover:text-blue-500"
                          onClick={() => handleOpenFile(file)}
                        >
                          {getFileIcon(file)}
                          <span>{file.name}</span>
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {file.modifiedTime
                        ? new Date(file.modifiedTime).toLocaleString()
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {file.isFolder
                        ? '—'
                        : file.size
                        ? `${(file.size / (1024 * 1024)).toFixed(2)} MB`
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {file.owners?.[0]?.displayName ?? file.owners?.[0]?.emailAddress ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {!file.isFolder && (
                          <button
                            type="button"
                            onClick={() => handleDownload(file)}
                            disabled={downloadingFileId === file.id}
                            className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Download className="h-3.5 w-3.5" />
                            {downloadingFileId === file.id ? 'Downloading...' : 'Download'}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleCopyLink(file)}
                          className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
                        >
                          {copySuccessId === file.id ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                              Copied
                            </>
                          ) : (
                            <>
                              <LinkIcon className="h-3.5 w-3.5" />
                              Copy link
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRename(file)}
                          className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
                        >
                          <Edit className="h-3.5 w-3.5" />
                          Rename
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(file)}
                          className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {listQuery.data?.nextPageToken && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Showing first {PAGE_SIZE} results. Use search to narrow down or navigate directly in Google Drive for more.
          </div>
        )}

        {loading && (
          <p className="text-sm text-muted-foreground">
            Working on your latest Google Drive request. This may take a moment...
          </p>
        )}

        </div>
      </div>
    </>
  );
}


