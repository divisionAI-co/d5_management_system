import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

interface MarkdownRendererProps {
  content: string | null | undefined;
  className?: string;
}

/**
 * MarkdownRenderer - Safely renders markdown content
 * Supports GitHub Flavored Markdown (GFM) including tables, strikethrough, task lists, etc.
 */
export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  if (!content) {
    return null;
  }

  return (
    <div className={cn('prose prose-sm max-w-none dark:prose-invert', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Customize heading styles
          h1: ({ children }) => (
            <h1 className="text-2xl font-bold text-foreground mb-4 mt-6 first:mt-0">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl font-bold text-foreground mb-3 mt-5 first:mt-0">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-semibold text-foreground mb-2 mt-4 first:mt-0">{children}</h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-base font-semibold text-foreground mb-2 mt-3 first:mt-0">{children}</h4>
          ),
          // Paragraphs
          p: ({ children }) => <p className="mb-3 text-foreground last:mb-0">{children}</p>,
          // Lists
          ul: ({ children }) => (
            <ul className="mb-3 ml-6 list-disc space-y-1 text-foreground last:mb-0">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-3 ml-6 list-decimal space-y-1 text-foreground last:mb-0">{children}</ol>
          ),
          li: ({ children }) => <li className="text-foreground">{children}</li>,
          // Code blocks
          code: ({ className, children, ...props }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code
                  className="rounded bg-muted px-1.5 py-0.5 text-sm font-mono text-foreground"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return (
              <code
                className="block rounded-lg bg-muted p-4 text-sm font-mono text-foreground overflow-x-auto"
                {...props}
              >
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="mb-3 rounded-lg bg-muted p-4 text-sm font-mono text-foreground overflow-x-auto last:mb-0">
              {children}
            </pre>
          ),
          // Blockquotes
          blockquote: ({ children }) => (
            <blockquote className="mb-3 border-l-4 border-border pl-4 italic text-muted-foreground last:mb-0">
              {children}
            </blockquote>
          ),
          // Links
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700 underline dark:text-blue-400"
            >
              {children}
            </a>
          ),
          // Tables
          table: ({ children }) => (
            <div className="mb-3 overflow-x-auto last:mb-0">
              <table className="min-w-full border-collapse border border-border">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-muted">{children}</thead>,
          tbody: ({ children }) => <tbody>{children}</tbody>,
          tr: ({ children }) => <tr className="border-b border-border">{children}</tr>,
          th: ({ children }) => (
            <th className="border border-border px-4 py-2 text-left font-semibold text-foreground">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-border px-4 py-2 text-foreground">{children}</td>
          ),
          // Horizontal rule
          hr: () => <hr className="my-4 border-border" />,
          // Strong/Bold
          strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
          // Emphasis/Italic
          em: ({ children }) => <em className="italic text-foreground">{children}</em>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

