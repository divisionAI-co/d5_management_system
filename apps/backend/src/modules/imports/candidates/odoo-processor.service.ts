/**
 * Odoo-specific import processing utilities.
 * This is a temporary module for handling Odoo export formats.
 * Can be removed or replaced when Odoo integration is no longer needed.
 */

export interface OdooProcessedNotes {
  notes: string | undefined;
  resume?: string;
  driveFolderId?: string;
}

export class OdooProcessor {
  /**
   * Strips HTML tags from text, preserving text content.
   * Also decodes HTML entities.
   */
  static stripHtml(html: string): string {
    if (!html) {
      return '';
    }

    // Decode common HTML entities
    let text = html
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'");

    // Remove HTML tags
    text = text.replace(/<[^>]*>/g, '');

    // Clean up whitespace
    text = text
      .replace(/\s+/g, ' ') // Multiple spaces to single space
      .replace(/\n\s*\n/g, '\n') // Multiple newlines to single newline
      .trim();

    return text;
  }

  /**
   * Strips HTML tags from text while preserving URLs from href attributes.
   * URLs from href attributes are inserted into the text before tags are removed.
   * Also decodes HTML entities.
   */
  static stripHtmlPreservingUrls(html: string): string {
    if (!html || typeof html !== 'string') {
      return '';
    }

    // Decode common HTML entities first
    let text = html
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&#x27;/g, "'")
      .replace(/&#x2F;/g, '/');

    // Extract URLs from href attributes and insert them before the anchor tag
    // Pattern: <a href="URL">text</a> -> URL text
    // More permissive pattern to handle various HTML structures
    text = text.replace(/<a\s+[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi, (match, url, linkText) => {
      // If link text is the same as URL, just return the URL
      // Otherwise, return URL followed by link text
      const cleanUrl = url.trim();
      const cleanText = linkText.trim();
      if (cleanText === cleanUrl || cleanText === '') {
        return cleanUrl;
      }
      return `${cleanUrl} ${cleanText}`;
    });

    // Also handle self-closing tags and malformed tags
    text = text.replace(/<br\s*\/?>/gi, '\n');
    text = text.replace(/<p[^>]*>/gi, '\n');
    text = text.replace(/<\/p>/gi, '\n');
    text = text.replace(/<div[^>]*>/gi, '\n');
    text = text.replace(/<\/div>/gi, '\n');

    // Remove remaining HTML tags
    text = text.replace(/<[^>]*>/g, '');

    // Clean up whitespace
    text = text
      .replace(/\s+/g, ' ') // Multiple spaces to single space
      .replace(/\n\s*\n/g, '\n') // Multiple newlines to single newline
      .trim();

    return text;
  }

  /**
   * Extracts a valid folder or file ID from a potentially malformed Drive URL.
   * Handles nested URLs by extracting the last valid ID.
   */
  private static extractDriveIdFromUrl(url: string, isFolder: boolean): string | null {
    if (!url || typeof url !== 'string') {
      return null;
    }

    // Check for nested/malformed URLs (e.g., /folders/https://drive.google.com/...)
    // In this case, we need to find the actual ID, which is typically the last valid ID in the string
    const folderPattern = /\/drive\/folders\/([a-zA-Z0-9_-]+)/g;
    const filePattern = /\/file\/d\/([a-zA-Z0-9_-]+)/g;
    
    let lastValidId: string | null = null;
    
    if (isFolder) {
      // Find all folder IDs in the URL
      const folderMatches = Array.from(url.matchAll(folderPattern));
      for (const match of folderMatches) {
        if (match[1]) {
          const id = match[1].trim();
          // Validate ID: must be alphanumeric/underscore/hyphen, no http, length >= 10
          if (id && !id.includes('http') && !id.includes('://') && /^[a-zA-Z0-9_-]+$/.test(id) && id.length >= 10) {
            lastValidId = id;
          }
        }
      }
    } else {
      // Find all file IDs in the URL
      const fileMatches = Array.from(url.matchAll(filePattern));
      for (const match of fileMatches) {
        if (match[1]) {
          const id = match[1].trim();
          // Validate ID: must be alphanumeric/underscore/hyphen, no http, length >= 10
          if (id && !id.includes('http') && !id.includes('://') && /^[a-zA-Z0-9_-]+$/.test(id) && id.length >= 10) {
            lastValidId = id;
          }
        }
      }
    }
    
    return lastValidId;
  }

  /**
   * Extracts Google Drive links from HTML text (typically from Odoo notes).
   * Returns the first Drive link found, or null if none found.
   * Handles various Google Drive URL formats and malformed nested URLs.
   */
  static extractGoogleDriveLink(html: string | undefined): string | null {
    if (!html || typeof html !== 'string') {
      return null;
    }

    // Normalize the HTML string (handle potential encoding issues)
    const normalizedHtml = html
      .replace(/&amp;/g, '&') // Decode &amp; to & first
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");

    // First, try to extract Drive links from href attributes (most reliable for HTML)
    // Handle both single and double quotes, and match until closing quote or end of attribute
    const hrefPatterns = [
      /href\s*=\s*["']([^"']*drive\.google\.com[^"']*)["']/gi,
      /href\s*=\s*([^\s>]*drive\.google\.com[^\s>]*)/gi, // More permissive pattern
    ];
    
    for (const hrefPattern of hrefPatterns) {
      const hrefMatches = Array.from(normalizedHtml.matchAll(hrefPattern));
      for (const match of hrefMatches) {
        if (match[1]) {
          let url = match[1].trim().replace(/^["']|["']$/g, ''); // Remove surrounding quotes
          
          // Skip if empty
          if (!url) continue;
          
          // Check if it's a folder or file URL
          const isFolder = url.includes('/drive/folders/') || url.includes('/folders/');
          const isFile = url.includes('/file/d/');
          
          if (isFolder) {
            // Extract folder ID (handles nested URLs by getting the last valid ID)
            const folderId = this.extractDriveIdFromUrl(url, true);
            if (folderId) {
              return `https://drive.google.com/drive/folders/${folderId}`;
            }
          } else if (isFile) {
            // Extract file ID (handles nested URLs by getting the last valid ID)
            const fileId = this.extractDriveIdFromUrl(url, false);
            if (fileId) {
              return `https://drive.google.com/file/d/${fileId}/view`;
            }
          }
        }
      }
    }
    
    // Also check for Drive links in the text content (not just href)
    // This handles cases where the URL appears in the text between tags
    const textPatterns = [
      // Folder links - match the full URL including potential nested URLs
      /https?:\/\/drive\.google\.com\/drive\/folders\/[^\s<>"']*/gi,
      /https?:\/\/drive\.google\.com\/folders\/[^\s<>"']*/gi,
      // File links
      /https?:\/\/drive\.google\.com\/file\/d\/[^\s<>"']*/gi,
      /https?:\/\/drive\.google\.com\/open\?id=[^\s<>"']*/gi,
    ];

    for (const pattern of textPatterns) {
      const matches = Array.from(normalizedHtml.matchAll(pattern));
      for (const match of matches) {
        if (match[0]) {
          const url = match[0].trim();
          const isFolder = url.includes('/drive/folders/') || url.includes('/folders/');
          const isFile = url.includes('/file/d/');
          
          if (isFolder) {
            const folderId = this.extractDriveIdFromUrl(url, true);
            if (folderId) {
              return `https://drive.google.com/drive/folders/${folderId}`;
            }
          } else if (isFile) {
            const fileId = this.extractDriveIdFromUrl(url, false);
            if (fileId) {
              return `https://drive.google.com/file/d/${fileId}/view`;
            }
          }
        }
      }
    }

    return null;
  }

  /**
   * Validates that a Drive URL is properly formatted and not malformed
   */
  static isValidDriveUrl(url: string): boolean {
    if (!url || typeof url !== 'string') {
      return false;
    }
    
    // Check for nested URLs (malformed)
    if (url.includes('https://drive.google.com/drive/folders/https://') ||
        url.includes('https://drive.google.com/file/d/https://') ||
        url.match(/\/drive\/folders\/https?:\/\//) ||
        url.match(/\/file\/d\/https?:\/\//)) {
      return false;
    }
    
    // Check it's a valid Drive URL format
    if (url.includes('/drive/folders/')) {
      const folderIdMatch = url.match(/\/drive\/folders\/([a-zA-Z0-9_-]+)(?:\/|$|\?|#)/);
      if (!folderIdMatch || !folderIdMatch[1]) {
        return false;
      }
      const folderId = folderIdMatch[1];
      return !folderId.includes('http') && !folderId.includes('://') && folderId.length > 10;
    } else if (url.includes('/file/d/')) {
      const fileIdMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)(?:\/|$|\?|#)/);
      if (!fileIdMatch || !fileIdMatch[1]) {
        return false;
      }
      const fileId = fileIdMatch[1];
      return !fileId.includes('http') && !fileId.includes('://') && fileId.length > 10;
    }
    
    return false;
  }

  /**
   * Extracts wp-content/uploads URLs from HTML/text (typically from Odoo notes).
   * Returns the first wp-content/uploads URL found, or null if none found.
   */
  static extractWpContentUrl(html: string | undefined): string | null {
    if (!html) {
      return null;
    }

    // Pattern to match wp-content/uploads URLs
    const wpContentPattern = /https?:\/\/[^\s<>"']*\/wp-content\/uploads\/[^\s<>"']*/gi;
    const matches = html.matchAll(wpContentPattern);
    
    for (const match of matches) {
      if (match[0]) {
        return match[0].trim();
      }
    }

    return null;
  }

  /**
   * Processes notes field for Odoo imports:
   * - Extracts wp-content/uploads URLs → resume
   * - Extracts Drive links → driveFolderId (folders) or resume (files)
   * - Strips HTML but preserves URLs in plain text
   */
  static processOdooNotes(
    notesRawHtml: string | undefined,
    existingResume?: string,
  ): OdooProcessedNotes {
    if (!notesRawHtml || typeof notesRawHtml !== 'string') {
      return { notes: undefined, resume: existingResume };
    }

    // Ensure we have a string to work with
    const htmlString = String(notesRawHtml).trim();
    if (!htmlString) {
      return { notes: undefined, resume: existingResume };
    }

    let resume = existingResume;
    let driveFolderId: string | undefined;

    // Extract wp-content/uploads URLs first (these go to resume)
    const extractedWpContentUrl = this.extractWpContentUrl(htmlString);
    if (extractedWpContentUrl) {
      resume = extractedWpContentUrl;
    }

    // Extract Drive links and distinguish between files and folders
    const extractedDriveLink = this.extractGoogleDriveLink(htmlString);
    if (extractedDriveLink) {
      // Validate the extracted link
      if (this.isValidDriveUrl(extractedDriveLink)) {
        // The extracted link is already properly formatted, just use it directly
        // Check if it's a folder or file based on the URL structure
        if (extractedDriveLink.includes('/drive/folders/') || extractedDriveLink.includes('/folders/')) {
          // It's a folder - goes to driveFolderId
          driveFolderId = extractedDriveLink;
        } else if (extractedDriveLink.includes('/file/d/')) {
          // It's a file - goes to resume (only if resume is not already set)
          if (!resume) {
            resume = extractedDriveLink;
          }
        }
      }
    }

    // Strip HTML from notes but preserve URLs from href attributes
    const notes = this.stripHtmlPreservingUrls(htmlString);
    const cleanedNotes = notes && notes.trim().length > 0 ? notes.trim() : undefined;

    return {
      notes: cleanedNotes,
      resume: resume || existingResume,
      driveFolderId,
    };
  }

  /**
   * Strips HTML from a value if Odoo import is enabled
   */
  static processValue(value: string | undefined, isOdooImport: boolean): string | undefined {
    if (!value) {
      return undefined;
    }

    if (!isOdooImport) {
      return value.trim().length > 0 ? value.trim() : undefined;
    }

    const processed = this.stripHtml(value);
    return processed.length > 0 ? processed : undefined;
  }
}

