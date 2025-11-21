import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Underline } from '@tiptap/extension-underline';
import { TextAlign } from '@tiptap/extension-text-align';
import { Link } from '@tiptap/extension-link';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import { Highlight } from '@tiptap/extension-highlight';
import { useEffect, useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  Code,
  Minus,
  Link as LinkIcon,
  Undo,
  Redo,
  Palette,
  Highlighter,
  Type,
  ChevronDown,
} from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
}

/**
 * RichTextEditor - A comprehensive rich text editor component using TipTap
 * Provides word processor-like editing capabilities with extensive formatting options
 */
export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Start typing...',
  className,
  minHeight = '200px',
}: RichTextEditorProps) {
  const [linkUrl, setLinkUrl] = useState('');
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [showTextColorPicker, setShowTextColorPicker] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const [showFontFamilyPicker, setShowFontFamilyPicker] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  const fontFamilies = [
    { label: 'Default', value: '' },
    { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
    { label: 'Proxima Nova', value: '"Proxima Nova", "Helvetica Neue", Helvetica, Arial, sans-serif' },
    { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
    { label: 'Helvetica', value: 'Helvetica, Arial, sans-serif' },
    { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
    { label: 'Georgia', value: 'Georgia, serif' },
    { label: 'Courier New', value: '"Courier New", Courier, monospace' },
    { label: 'Monaco', value: 'Monaco, "Courier New", monospace' },
    { label: 'Comic Sans MS', value: '"Comic Sans MS", cursive' },
    { label: 'Trebuchet MS', value: '"Trebuchet MS", Helvetica, sans-serif' },
  ];

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4, 5, 6],
        },
      }),
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 underline cursor-pointer',
        },
      }),
      Color,
      TextStyle,
      Highlight.configure({
        multicolor: true,
      }),
    ],
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

  useEffect(() => {
    if (editor && showLinkDialog) {
      const previousUrl = editor.getAttributes('link').href || '';
      setLinkUrl(previousUrl);
    }
  }, [editor, showLinkDialog]);

  // Close dialogs when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (editorRef.current && !editorRef.current.contains(event.target as Node)) {
        setShowLinkDialog(false);
        setShowTextColorPicker(false);
        setShowHighlightPicker(false);
        setShowFontFamilyPicker(false);
      }
    };

    if (showLinkDialog || showTextColorPicker || showHighlightPicker || showFontFamilyPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showLinkDialog, showTextColorPicker, showHighlightPicker, showFontFamilyPicker]);

  if (!editor) {
    return null;
  }

  const setLink = () => {
    if (linkUrl) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run();
    } else {
      editor.chain().focus().unsetLink().run();
    }
    setShowLinkDialog(false);
    setLinkUrl('');
  };

  const unsetLink = () => {
    editor.chain().focus().unsetLink().run();
    setShowLinkDialog(false);
    setLinkUrl('');
  };

  const getFontFamily = () => {
    const fontFamily = editor.getAttributes('textStyle').fontFamily;
    const matched = fontFamilies.find((f) => f.value === fontFamily);
    return matched ? matched.label : fontFamily || 'Default';
  };

  const ToolbarButton = ({
    onClick,
    isActive,
    disabled,
    title,
    children,
    className: btnClassName,
  }: {
    onClick: () => void;
    isActive?: boolean;
    disabled?: boolean;
    title: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded transition',
        isActive
          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
          : 'text-muted-foreground hover:bg-muted',
        disabled && 'opacity-50 cursor-not-allowed',
        btnClassName,
      )}
      title={title}
    >
      {children}
    </button>
  );

  const ToolbarSeparator = () => <div className="mx-1 h-6 w-px bg-border" />;

  return (
    <div
      ref={editorRef}
      className={cn(
        'rounded-lg border border-border bg-background focus-within:ring-2 focus-within:ring-blue-500',
        className,
      )}
      style={{ minHeight }}
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 border-b border-border px-3 py-2">
        {/* Text Formatting */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
          disabled={!editor.can().chain().focus().toggleBold().run()}
          title="Bold (Ctrl+B)"
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
          disabled={!editor.can().chain().focus().toggleItalic().run()}
          title="Italic (Ctrl+I)"
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          isActive={editor.isActive('underline')}
          title="Underline (Ctrl+U)"
        >
          <UnderlineIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={editor.isActive('strike')}
          title="Strikethrough"
        >
          <Strikethrough className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          isActive={editor.isActive('code')}
          title="Inline Code"
        >
          <Code className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarSeparator />

        {/* Font Family */}
        <div className="relative">
          <ToolbarButton
            onClick={() => {
              setShowFontFamilyPicker(!showFontFamilyPicker);
              setShowTextColorPicker(false);
              setShowHighlightPicker(false);
            }}
            isActive={showFontFamilyPicker}
            title="Font Family"
            className="gap-1 pr-1 w-auto min-w-[120px] justify-between"
          >
            <Type className="h-4 w-4" />
            <span className="text-xs">{getFontFamily()}</span>
            <ChevronDown className="h-3 w-3" />
          </ToolbarButton>
          {showFontFamilyPicker && (
            <div className="absolute left-0 top-full z-50 mt-1 max-h-64 w-48 overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
              {fontFamilies.map((font) => (
                <button
                  key={font.value}
                  type="button"
                  onClick={() => {
                    if (font.value) {
                      editor.chain().focus().setMark('textStyle', { fontFamily: font.value }).run();
                    } else {
                      editor.chain().focus().unsetMark('textStyle').run();
                    }
                    setShowFontFamilyPicker(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition"
                  style={font.value ? { fontFamily: font.value } : {}}
                >
                  {font.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <ToolbarSeparator />

        {/* Text Color & Highlight */}
        <div className="relative">
          <ToolbarButton
            onClick={() => {
              setShowTextColorPicker(!showTextColorPicker);
              setShowHighlightPicker(false);
            }}
            isActive={showTextColorPicker}
            title="Text Color"
          >
            <Palette className="h-4 w-4" />
          </ToolbarButton>
          {showTextColorPicker && (
            <div className="absolute left-0 top-full z-50 mt-1 rounded-lg border border-border bg-card p-2 shadow-lg">
              <div className="grid grid-cols-8 gap-1">
                {[
                  '#000000', '#374151', '#6B7280', '#9CA3AF',
                  '#EF4444', '#F59E0B', '#10B981', '#3B82F6',
                  '#8B5CF6', '#EC4899', '#F97316', '#14B8A6',
                  '#6366F1', '#A855F7', '#F43F5E', '#84CC16',
                ].map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => {
                      editor.chain().focus().setColor(color).run();
                      setShowTextColorPicker(false);
                    }}
                    className="h-6 w-6 rounded border border-border hover:scale-110 transition"
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => {
                    editor.chain().focus().unsetColor().run();
                    setShowTextColorPicker(false);
                  }}
                  className="h-6 w-6 rounded border border-border hover:bg-muted flex items-center justify-center text-xs"
                  title="Remove color"
                >
                  ×
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="relative">
          <ToolbarButton
            onClick={() => {
              setShowHighlightPicker(!showHighlightPicker);
              setShowTextColorPicker(false);
            }}
            isActive={showHighlightPicker}
            title="Highlight Color"
          >
            <Highlighter className="h-4 w-4" />
          </ToolbarButton>
          {showHighlightPicker && (
            <div className="absolute left-0 top-full z-50 mt-1 rounded-lg border border-border bg-card p-2 shadow-lg">
              <div className="grid grid-cols-8 gap-1">
                {[
                  '#FEF08A', '#FDE047', '#FCD34D', '#FBBF24',
                  '#FCA5A5', '#F87171', '#FCD34D', '#86EFAC',
                  '#4ADE80', '#34D399', '#7DD3FC', '#60A5FA',
                  '#A78BFA', '#C084FC', '#F472B6', '#FB7185',
                ].map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => {
                      editor.chain().focus().toggleHighlight({ color }).run();
                      setShowHighlightPicker(false);
                    }}
                    className="h-6 w-6 rounded border border-border hover:scale-110 transition"
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => {
                    editor.chain().focus().unsetHighlight().run();
                    setShowHighlightPicker(false);
                  }}
                  className="h-6 w-6 rounded border border-border hover:bg-muted flex items-center justify-center text-xs"
                  title="Remove highlight"
                >
                  ×
                </button>
              </div>
            </div>
          )}
        </div>

        <ToolbarSeparator />

        {/* Alignment */}
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          isActive={editor.isActive({ textAlign: 'left' })}
          title="Align Left"
        >
          <AlignLeft className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          isActive={editor.isActive({ textAlign: 'center' })}
          title="Align Center"
        >
          <AlignCenter className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          isActive={editor.isActive({ textAlign: 'right' })}
          title="Align Right"
        >
          <AlignRight className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
          isActive={editor.isActive({ textAlign: 'justify' })}
          title="Justify"
        >
          <AlignJustify className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarSeparator />

        {/* Lists */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive('bulletList')}
          title="Bullet List"
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive('orderedList')}
          title="Numbered List"
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarSeparator />

        {/* Headings */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          isActive={editor.isActive('heading', { level: 1 })}
          title="Heading 1"
        >
          <Heading1 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={editor.isActive('heading', { level: 2 })}
          title="Heading 2"
        >
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          isActive={editor.isActive('heading', { level: 3 })}
          title="Heading 3"
        >
          <Heading3 className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarSeparator />

        {/* Block Elements */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          isActive={editor.isActive('blockquote')}
          title="Quote"
        >
          <Quote className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          isActive={editor.isActive('codeBlock')}
          title="Code Block"
        >
          <Code className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Horizontal Rule"
        >
          <Minus className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarSeparator />

        {/* Link */}
        <ToolbarButton
          onClick={() => {
            if (editor.isActive('link')) {
              unsetLink();
            } else {
              setShowLinkDialog(true);
            }
          }}
          isActive={editor.isActive('link')}
          title="Insert/Edit Link"
        >
          <LinkIcon className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarSeparator />

        {/* Undo/Redo */}
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().chain().focus().undo().run()}
          title="Undo (Ctrl+Z)"
        >
          <Undo className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().chain().focus().redo().run()}
          title="Redo (Ctrl+Y)"
        >
          <Redo className="h-4 w-4" />
        </ToolbarButton>
      </div>

      {/* Link Dialog */}
      {showLinkDialog && (
        <div className="absolute left-1/2 top-full z-50 mt-1 -translate-x-1/2 rounded-lg border border-border bg-card p-3 shadow-lg">
          <div className="flex flex-col gap-2">
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="Enter URL..."
              className="rounded border border-border bg-background px-2 py-1 text-sm text-foreground focus:border-blue-500 focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  setLink();
                } else if (e.key === 'Escape') {
                  setShowLinkDialog(false);
                  setLinkUrl('');
                }
              }}
              autoFocus
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={setLink}
                className="flex-1 rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
              >
                {editor.isActive('link') ? 'Update' : 'Insert'}
              </button>
              {editor.isActive('link') && (
                <button
                  type="button"
                  onClick={unsetLink}
                  className="rounded border border-border px-3 py-1 text-sm text-foreground hover:bg-muted"
                >
                  Remove
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setShowLinkDialog(false);
                  setLinkUrl('');
                }}
                className="rounded border border-border px-3 py-1 text-sm text-foreground hover:bg-muted"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Editor Content */}
      <div className="relative overflow-y-auto" style={{ minHeight: `calc(${minHeight} - 50px)` }}>
        <EditorContent
          editor={editor}
          className="[&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[150px] [&_.ProseMirror]:p-3 [&_.ProseMirror_prose]:max-w-none [&_.ProseMirror_a]:text-blue-600 [&_.ProseMirror_a]:underline [&_.ProseMirror_code]:rounded [&_.ProseMirror_code]:bg-muted [&_.ProseMirror_code]:px-1 [&_.ProseMirror_code]:py-0.5 [&_.ProseMirror_code]:text-sm [&_.ProseMirror_pre]:rounded [&_.ProseMirror_pre]:bg-muted [&_.ProseMirror_pre]:p-3 [&_.ProseMirror_blockquote]:border-l-4 [&_.ProseMirror_blockquote]:border-border [&_.ProseMirror_blockquote]:pl-4 [&_.ProseMirror_blockquote]:italic"
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
