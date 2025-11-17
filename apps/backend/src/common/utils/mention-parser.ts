/**
 * Utility functions for parsing @mentions from text
 */

export interface MentionMatch {
  fullMatch: string; // e.g., "@john.doe@example.com" or "@John Doe"
  identifier: string; // e.g., "john.doe@example.com" or "John Doe"
  startIndex: number;
  endIndex: number;
}

/**
 * Parse @mentions from text
 * Supports:
 * - @email@domain.com (email addresses)
 * - @FirstName LastName (full names)
 * - @FirstName (first names only)
 */
export function parseMentions(text: string): MentionMatch[] {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const mentions: MentionMatch[] = [];
  
  // Regex to match @mentions:
  // - @ followed by email: @user@domain.com
  // - @ followed by name: @FirstName LastName or @FirstName
  // - Stops at whitespace, punctuation (except @ and . for emails), or end of string
  const mentionRegex = /@([a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|[a-zA-Z][a-zA-Z0-9._-]*(?:\s+[a-zA-Z][a-zA-Z0-9._-]*)*)/g;
  
  let match;
  while ((match = mentionRegex.exec(text)) !== null) {
    mentions.push({
      fullMatch: match[0], // e.g., "@john.doe@example.com"
      identifier: match[1], // e.g., "john.doe@example.com"
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });
  }

  return mentions;
}

/**
 * Extract unique mention identifiers from text
 */
export function extractMentionIdentifiers(text: string): string[] {
  const mentions = parseMentions(text);
  const identifiers = mentions.map((m) => m.identifier);
  // Remove duplicates while preserving order
  return Array.from(new Set(identifiers));
}

