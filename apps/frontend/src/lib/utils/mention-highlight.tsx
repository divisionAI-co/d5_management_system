import React from 'react';

/**
 * Highlight @mentions in text by wrapping them in a styled span
 */
export function highlightMentions(text: string): React.ReactNode {
  if (!text) return text;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  // Regex to match @mentions (same as backend)
  const mentionRegex = /@([a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|[a-zA-Z][a-zA-Z0-9._-]*(?:\s+[a-zA-Z][a-zA-Z0-9._-]*)*)/g;

  let match;
  while ((match = mentionRegex.exec(text)) !== null) {
    // Add text before the mention
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    // Add the highlighted mention
    parts.push(
      <span
        key={`mention-${match.index}`}
        className="inline-flex items-center rounded bg-blue-100 px-1.5 py-0.5 text-sm font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-200"
      >
        {match[0]}
      </span>
    );

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? <>{parts}</> : text;
}

