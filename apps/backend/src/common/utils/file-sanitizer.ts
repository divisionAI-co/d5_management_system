import path from 'path';

/**
 * Sanitizes a filename to prevent path traversal attacks
 * Removes path components and dangerous characters
 */
export function sanitizeFilename(filename: string): string {
  // Remove path components to prevent directory traversal
  const basename = path.basename(filename);
  
  // Remove or replace dangerous characters
  // Allow: alphanumeric, dots, hyphens, underscores
  return basename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .substring(0, 255); // Limit length to prevent filesystem issues
}

