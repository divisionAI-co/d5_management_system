import { sanitizeHtml, escapeHtml } from '@/lib/utils/sanitize';

interface SafeHtmlProps {
  /**
   * HTML content to render safely
   * Will be sanitized before rendering
   */
  html: string | null | undefined;
  
  /**
   * If true, renders as plain text (fully escaped)
   * If false, renders as HTML (sanitized)
   * @default false
   */
  asText?: boolean;
  
  /**
   * Additional CSS classes
   */
  className?: string;
  
  /**
   * HTML tag to use as container
   * @default 'div'
   */
  tag?: keyof JSX.IntrinsicElements;
}

/**
 * SafeHtml component - Safely renders HTML content with XSS protection
 * 
 * Usage:
 * ```tsx
 * <SafeHtml html={userContent} />
 * <SafeHtml html={userContent} asText /> // Render as plain text
 * <SafeHtml html={userContent} tag="span" className="text-sm" />
 * ```
 */
export function SafeHtml({
  html,
  asText = false,
  className,
  tag: Tag = 'div',
}: SafeHtmlProps) {
  if (!html) {
    return null;
  }

  if (asText) {
    // Render as plain text (fully escaped)
    return <Tag className={className}>{escapeHtml(html)}</Tag>;
  }

  // Render as HTML (sanitized)
  const sanitized = sanitizeHtml(html);
  
  return (
    <Tag
      className={className}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}

/**
 * SafeText component - Renders content as plain text (fully escaped)
 * Use this when you want to display user input as text, not HTML
 */
export function SafeText({
  text,
  className,
  tag: Tag = 'span',
}: {
  text: string | null | undefined;
  className?: string;
  tag?: keyof JSX.IntrinsicElements;
}) {
  return <SafeHtml html={text} asText className={className} tag={Tag} />;
}

