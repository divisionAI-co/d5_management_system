import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect } from 'react';
import { cn } from '@/lib/utils';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
}

/**
 * RichTextEditor - A rich text editor component using TipTap
 * Supports formatting like bold, italic, lists, headings, etc.
 */
export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Start typing...',
  className,
  minHeight = '200px',
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value || '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none p-3 text-foreground',
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || '');
    }
  }, [editor, value]);

  if (!editor) {
    return null;
  }

  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-background focus-within:ring-2 focus-within:ring-blue-500',
        className,
      )}
      style={{ minHeight }}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-1 border-b border-border px-3 py-2">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={!editor.can().chain().focus().toggleBold().run()}
          className={cn(
            'rounded px-2 py-1 text-sm font-semibold transition',
            editor.isActive('bold')
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
              : 'text-muted-foreground hover:bg-muted',
          )}
          title="Bold"
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={!editor.can().chain().focus().toggleItalic().run()}
          className={cn(
            'rounded px-2 py-1 text-sm font-semibold italic transition',
            editor.isActive('italic')
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
              : 'text-muted-foreground hover:bg-muted',
          )}
          title="Italic"
        >
          <em>I</em>
        </button>
        <div className="mx-1 h-4 w-px bg-border" />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={cn(
            'rounded px-2 py-1 text-sm transition',
            editor.isActive('bulletList')
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
              : 'text-muted-foreground hover:bg-muted',
          )}
          title="Bullet List"
        >
          •
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={cn(
            'rounded px-2 py-1 text-sm transition',
            editor.isActive('orderedList')
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
              : 'text-muted-foreground hover:bg-muted',
          )}
          title="Numbered List"
        >
          1.
        </button>
        <div className="mx-1 h-4 w-px bg-border" />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={cn(
            'rounded px-2 py-1 text-xs font-semibold transition',
            editor.isActive('heading', { level: 2 })
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
              : 'text-muted-foreground hover:bg-muted',
          )}
          title="Heading"
        >
          H2
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={cn(
            'rounded px-2 py-1 text-xs font-semibold transition',
            editor.isActive('heading', { level: 3 })
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
              : 'text-muted-foreground hover:bg-muted',
          )}
          title="Subheading"
        >
          H3
        </button>
      </div>

      {/* Editor Content */}
      <div className="relative overflow-y-auto" style={{ minHeight: `calc(${minHeight} - 50px)` }}>
        <EditorContent
          editor={editor}
          className="[&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[150px] [&_.ProseMirror]:p-3"
        />
        {!editor.getText() && (
          <div className="pointer-events-none absolute left-3 top-3 text-sm text-muted-foreground">
            {placeholder}
          </div>
        )}
      </div>
    </div>
  );
}

