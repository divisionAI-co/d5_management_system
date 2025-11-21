/**
 * Utility functions for working with Google Drive folder IDs and URLs
 */

/**
 * Extracts a Google Drive folder ID from various input formats:
 * - Direct folder ID: "1A2b3C4D5E6F7G8H"
 * - Folder URL: "https://drive.google.com/drive/folders/1A2b3C4D5E6F7G8H"
 * - Short folder URL: "https://drive.google.com/folders/1A2b3C4D5E6F7G8H"
 *
 * @param input - Folder ID or URL string
 * @returns Extracted folder ID, or undefined if not found/invalid
 */
export function extractDriveFolderId(input?: string | null): string | undefined {
  if (!input) {
    return undefined;
  }

  const trimmed = input.trim();

  if (!trimmed) {
    return undefined;
  }

  const idPattern = /[-\w]{10,}/;

  // If it does not look like a URL, assume it's already an ID.
  if (!trimmed.includes('/')) {
    const maybeId = trimmed.match(idPattern)?.[0];
    return maybeId ?? undefined;
  }

  try {
    const url = new URL(trimmed);

    // Only extract folder IDs, not file IDs
    // Check for folder pattern first: /drive/folders/ID or /folders/ID
    const folderMatch =
      url.pathname.match(/\/drive\/folders\/([a-zA-Z0-9_-]+)/) ||
      url.pathname.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (folderMatch?.[1]) {
      return folderMatch[1];
    }

    // If it's a file URL (/file/d/ID), reject it - this is not a folder
    const fileMatch = url.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (fileMatch?.[1]) {
      // This is a file, not a folder - return undefined
      return undefined;
    }

    // Check query params for ID
    const idFromQuery = url.searchParams.get('id');
    if (idFromQuery) {
      return idFromQuery;
    }
  } catch {
    // Not a valid URL; fall back to regex below.
  }

  // Fallback: try to extract ID from the string directly
  const fallbackMatch = trimmed.match(idPattern);
  return fallbackMatch?.[0];
}

/**
 * Generates a Google Drive folder URL from a folder ID
 * @param folderId - Google Drive folder ID
 * @returns Full Google Drive folder URL
 */
export function generateDriveFolderUrl(folderId: string): string {
  return `https://drive.google.com/drive/folders/${folderId}`;
}

