import { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, FileText, FolderOpen, Loader2, Link as LinkIcon, Check } from 'lucide-react';

import { googleDriveApi } from '@/lib/api/google-drive';
import type { DriveFile } from '@/types/integrations';

interface CandidateDrivePreviewProps {
  folderId?: string | null;
  folderUrl?: string | null;
  candidateName: string;
}

function getFileThumbnail(file: DriveFile) {
  if (file.thumbnailLink) {
    return (
      <img
        src={file.thumbnailLink}
        alt={`${file.name} thumbnail`}
        className="h-full w-full object-cover"
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
      <FileText className="h-8 w-8" />
    </div>
  );
}

export function CandidateDrivePreview({
  folderId,
  folderUrl,
  candidateName,
}: CandidateDrivePreviewProps) {
  const [copiedFileId, setCopiedFileId] = useState<string | null>(null);
  const resetTimerRef = useRef<number | undefined>(undefined);

  const driveQuery = useQuery({
    queryKey: ['candidate-drive-preview', folderId],
    enabled: Boolean(folderId),
    queryFn: () =>
      googleDriveApi.listFiles({
        parentId: folderId ?? undefined,
        pageSize: 12,
      }),
  });

  const files = useMemo(() => {
    return driveQuery.data?.files?.slice(0, 8) ?? [];
  }, [driveQuery.data?.files]);

  const handleCopyLink = async (fileId: string, link: string) => {
    if (!link) {
      return;
    }

    try {
      await navigator.clipboard.writeText(link);
      setCopiedFileId(fileId);
      if (resetTimerRef.current) {
        window.clearTimeout(resetTimerRef.current);
      }
      resetTimerRef.current = window.setTimeout(() => {
        setCopiedFileId(null);
        resetTimerRef.current = undefined;
      }, 2000);
    } catch (error) {
      // ignore clipboard errors silently
    }
  };

  if (!folderId) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-6 shadow-sm">
        <div className="flex items-start gap-3 text-sm text-muted-foreground">
          <FolderOpen className="h-5 w-5 text-muted-foreground" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">Candidate Documents</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Link the candidate&apos;s Google Drive folder in the profile to surface interview
              recordings, CVs, and other documents directly in this workspace.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Candidate Documents</h2>
          <p className="text-sm text-muted-foreground">
            Files stored for {candidateName}. Click to open in Google Drive.
          </p>
        </div>
        {folderUrl && (
          <a
            href={folderUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open folder
          </a>
        )}
      </div>

      {driveQuery.isLoading ? (
        <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading documents from Google Drive...
        </div>
      ) : driveQuery.isError ? (
        <p className="mt-6 text-sm text-red-600">
          We couldn&apos;t load the files from Google Drive right now. Please try again later.
        </p>
      ) : files.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-border bg-muted/50 px-4 py-6 text-center text-sm text-muted-foreground">
          The Google Drive folder is connected but currently empty.
        </p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {files.map((file) => {
            const viewLink =
              file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`;

            return (
              <div
                key={file.id}
                className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-muted/40 transition hover:border-blue-500 hover:bg-blue-50/60"
              >
                <button
                  type="button"
                  onClick={() => window.open(viewLink, '_blank', 'noopener,noreferrer')}
                  className="group flex flex-1 flex-col text-left"
                >
                  <div className="relative overflow-hidden bg-muted">
                    <div className="aspect-video w-full">
                      {getFileThumbnail(file)}
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col gap-1 px-4 py-3">
                    <p className="line-clamp-2 text-sm font-semibold text-foreground">
                      {file.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {file.modifiedTime
                        ? `Updated ${new Date(file.modifiedTime).toLocaleDateString()}`
                        : 'Last update unknown'}
                    </p>
                  </div>
                </button>
                <div className="flex items-center justify-between border-t border-border bg-card/60 px-4 py-3 text-xs">
                  <button
                    type="button"
                    onClick={() => window.open(viewLink, '_blank', 'noopener,noreferrer')}
                    className="inline-flex items-center gap-1 font-semibold text-blue-600 transition hover:text-blue-700"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopyLink(file.id, viewLink)}
                    className="inline-flex items-center gap-1 font-semibold text-muted-foreground transition hover:text-foreground"
                    title="Copy direct link"
                  >
                    {copiedFileId === file.id ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        Copied
                      </>
                    ) : (
                      <>
                        <LinkIcon className="h-3.5 w-3.5" />
                        Copy
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


