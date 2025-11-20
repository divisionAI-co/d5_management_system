import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { TextAlign } from '@tiptap/extension-text-align';
import { Underline } from '@tiptap/extension-underline';
import { Strike } from '@tiptap/extension-strike';
import { FontFamily } from '@tiptap/extension-font-family';
import { Highlight } from '@tiptap/extension-highlight';
import { useEffect, useState } from 'react';
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
  Heading2,
  Heading3,
  Type,
  Palette,
  Highlighter,
} from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
}

// Custom FontSize extension
const FontSize = TextStyle.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      fontSize: {
        default: null,
        parseHTML: (element) => element.style.fontSize || null,
        renderHTML: (attributes) => {
          if (!attributes.fontSize) {
            return {};
          }
          return {
            style: `font-size: ${attributes.fontSize}`,
          };
        },
      },
    };
  },
  addCommands() {
    return {
      ...this.parent?.(),
      setFontSize: (fontSize: string) => ({ commands }) => {
        return commands.setMark(this.name, { fontSize });
      },
      unsetFontSize: () => ({ commands }) => {
        return commands.unsetMark(this.name);
      },
    };
  },
});

const FONT_FAMILIES = [
  { value: '', label: 'Default' },
  { value: 'Proxima Nova', label: 'Proxima Nova' },
  { value: 'Arial', label: 'Arial' },
  { value: 'Helvetica', label: 'Helvetica' },
  { value: 'Times New Roman', label: 'Times New Roman' },
  { value: 'Courier New', label: 'Courier New' },
  { value: 'Georgia', label: 'Georgia' },
  { value: 'Verdana', label: 'Verdana' },
  { value: 'Comic Sans MS', label: 'Comic Sans MS' },
  { value: 'Trebuchet MS', label: 'Trebuchet MS' },
];

const FONT_SIZES = [
  { value: '', label: 'Default' },
  { value: '8px', label: '8px' },
  { value: '10px', label: '10px' },
  { value: '12px', label: '12px' },
  { value: '14px', label: '14px' },
  { value: '16px', label: '16px' },
  { value: '18px', label: '18px' },
  { value: '20px', label: '20px' },
  { value: '24px', label: '24px' },
  { value: '28px', label: '28px' },
  { value: '32px', label: '32px' },
  { value: '36px', label: '36px' },
  { value: '48px', label: '48px' },
];

const TEXT_COLORS = [
  '#000000', '#333333', '#666666', '#999999', '#CCCCCC',
  '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF',
  '#FF6600', '#0066FF', '#6600FF', '#FF0066', '#00FF66',
];

const HIGHLIGHT_COLORS = [
  '#FFFF00', '#FFCC00', '#FF9900', '#FF6600',
  '#00FF00', '#00CCFF', '#0066FF', '#9900FF',
  '#FF00FF', '#FF0099', '#FF0066',
];

/**
 * RichTextEditor - A comprehensive WYSIWYG editor component using TipTap
 * Supports extensive formatting: font style, size, family, colors, alignment, etc.
 */
export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Start typing...',
  className,
  minHeight = '200px',
}: RichTextEditorProps) {
  const [showColorPicker, setShowColorPicker] = useState<'text' | 'highlight' | null>(null);
  const [showFontFamily, setShowFontFamily] = useState(false);
  const [showFontSize, setShowFontSize] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        strike: false, // We'll use the separate Strike extension
      }),
      TextStyle,
      Color,
      Underline,
      Strike,
      FontFamily,
      FontSize,
      Highlight.configure({
        multicolor: true,
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
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
    if (editor) {
      const currentHtml = editor.getHTML();
      // Only update if the value actually changed to avoid unnecessary updates
      if (value !== currentHtml) {
        editor.commands.setContent(value || '', false); // false = don't emit update event
      }
    }
  }, [editor, value]);

  if (!editor) {
    return null;
  }

  const currentFontFamily = editor.getAttributes('textStyle').fontFamily || '';
  const currentFontSize = editor.getAttributes('textStyle').fontSize || '';
  const currentColor = editor.getAttributes('textStyle').color || '#000000';
  const highlightAttrs = editor.getAttributes('highlight');
  const currentHighlight = highlightAttrs?.color || '#FFFF00';

  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-background focus-within:ring-2 focus-within:ring-blue-500',
        className,
      )}
      style={{ minHeight }}
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 border-b border-border px-3 py-2">
        {/* Font Family */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowFontFamily(!showFontFamily)}
            className={cn(
              'flex items-center gap-1 rounded px-2 py-1 text-xs transition',
              showFontFamily
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                : 'text-muted-foreground hover:bg-muted',
            )}
            title="Font Family"
          >
            <Type className="h-3.5 w-3.5" />
            <span className="max-w-[80px] truncate">
              {FONT_FAMILIES.find((f) => f.value === currentFontFamily)?.label || 'Font'}
            </span>
          </button>
          {showFontFamily && (
            <div className="absolute left-0 top-full z-50 mt-1 max-h-48 w-48 overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
              {FONT_FAMILIES.map((font) => (
                <button
                  key={font.value}
                  type="button"
                  onClick={() => {
                    if (font.value) {
                      editor.chain().focus().setFontFamily(font.value).run();
                    } else {
                      editor.chain().focus().unsetFontFamily().run();
                    }
                    setShowFontFamily(false);
                  }}
                  className="w-full px-3 py-2 text-left text-xs hover:bg-muted"
                  style={font.value ? { fontFamily: font.value } : {}}
                >
                  {font.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Font Size */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowFontSize(!showFontSize)}
            className={cn(
              'flex items-center gap-1 rounded px-2 py-1 text-xs transition',
              showFontSize
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                : 'text-muted-foreground hover:bg-muted',
            )}
            title="Font Size"
          >
            <span>{currentFontSize || 'Size'}</span>
          </button>
          {showFontSize && (
            <div className="absolute left-0 top-full z-50 mt-1 max-h-48 w-32 overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
              {FONT_SIZES.map((size) => (
                <button
                  key={size.value}
                  type="button"
                  onClick={() => {
                    if (size.value) {
                      editor.chain().focus().setFontSize(size.value).run();
                    } else {
                      editor.chain().focus().unsetFontSize().run();
                    }
                    setShowFontSize(false);
                  }}
                  className="w-full px-3 py-2 text-left text-xs hover:bg-muted"
                  style={size.value ? { fontSize: size.value } : {}}
                >
                  {size.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mx-1 h-4 w-px bg-border" />

        {/* Text Style Buttons */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={!editor.can().chain().focus().toggleBold().run()}
          className={cn(
            'rounded px-2 py-1 transition',
            editor.isActive('bold')
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
              : 'text-muted-foreground hover:bg-muted',
          )}
          title="Bold"
        >
          <Bold className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={!editor.can().chain().focus().toggleItalic().run()}
          className={cn(
            'rounded px-2 py-1 transition',
            editor.isActive('italic')
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
              : 'text-muted-foreground hover:bg-muted',
          )}
          title="Italic"
        >
          <Italic className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={cn(
            'rounded px-2 py-1 transition',
            editor.isActive('underline')
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
              : 'text-muted-foreground hover:bg-muted',
          )}
          title="Underline"
        >
          <UnderlineIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={cn(
            'rounded px-2 py-1 transition',
            editor.isActive('strike')
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
              : 'text-muted-foreground hover:bg-muted',
          )}
          title="Strikethrough"
        >
          <Strikethrough className="h-4 w-4" />
        </button>

        <div className="mx-1 h-4 w-px bg-border" />

        {/* Text Color */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowColorPicker(showColorPicker === 'text' ? null : 'text')}
            className={cn(
              'rounded px-2 py-1 transition',
              showColorPicker === 'text'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                : 'text-muted-foreground hover:bg-muted',
            )}
            title="Text Color"
          >
            <Palette className="h-4 w-4" />
          </button>
          {showColorPicker === 'text' && (
            <div className="absolute left-0 top-full z-50 mt-1 rounded-lg border border-border bg-card p-2 shadow-lg">
              <div className="grid grid-cols-5 gap-1">
                {TEXT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => {
                      editor.chain().focus().setColor(color).run();
                      setShowColorPicker(null);
                    }}
                    className="h-6 w-6 rounded border border-border transition hover:scale-110"
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
              <input
                type="color"
                value={currentColor}
                onChange={(e) => {
                  editor.chain().focus().setColor(e.target.value).run();
                  setShowColorPicker(null);
                }}
                className="mt-2 h-8 w-full cursor-pointer rounded border border-border"
                title="Custom Color"
              />
            </div>
          )}
        </div>

        {/* Highlight Color */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowColorPicker(showColorPicker === 'highlight' ? null : 'highlight')}
            className={cn(
              'rounded px-2 py-1 transition',
              showColorPicker === 'highlight'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                : 'text-muted-foreground hover:bg-muted',
            )}
            title="Highlight Color"
          >
            <Highlighter className="h-4 w-4" />
          </button>
          {showColorPicker === 'highlight' && (
            <div className="absolute left-0 top-full z-50 mt-1 rounded-lg border border-border bg-card p-2 shadow-lg">
              <div className="grid grid-cols-5 gap-1">
                {HIGHLIGHT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => {
                      editor.chain().focus().toggleHighlight({ color }).run();
                      setShowColorPicker(null);
                    }}
                    className="h-6 w-6 rounded border border-border transition hover:scale-110"
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
              <input
                type="color"
                value={currentHighlight || '#FFFF00'}
                onChange={(e) => {
                  editor.chain().focus().toggleHighlight({ color: e.target.value }).run();
                  setShowColorPicker(null);
                }}
                className="mt-2 h-8 w-full cursor-pointer rounded border border-border"
                title="Custom Highlight Color"
              />
            </div>
          )}
        </div>

        <div className="mx-1 h-4 w-px bg-border" />

        {/* Text Alignment */}
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          className={cn(
            'rounded px-2 py-1 transition',
            editor.isActive({ textAlign: 'left' })
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
              : 'text-muted-foreground hover:bg-muted',
          )}
          title="Align Left"
        >
          <AlignLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          className={cn(
            'rounded px-2 py-1 transition',
            editor.isActive({ textAlign: 'center' })
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
              : 'text-muted-foreground hover:bg-muted',
          )}
          title="Align Center"
        >
          <AlignCenter className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          className={cn(
            'rounded px-2 py-1 transition',
            editor.isActive({ textAlign: 'right' })
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
              : 'text-muted-foreground hover:bg-muted',
          )}
          title="Align Right"
        >
          <AlignRight className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
          className={cn(
            'rounded px-2 py-1 transition',
            editor.isActive({ textAlign: 'justify' })
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
              : 'text-muted-foreground hover:bg-muted',
          )}
          title="Justify"
        >
          <AlignJustify className="h-4 w-4" />
        </button>

        <div className="mx-1 h-4 w-px bg-border" />

        {/* Lists */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={cn(
            'rounded px-2 py-1 transition',
            editor.isActive('bulletList')
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
              : 'text-muted-foreground hover:bg-muted',
          )}
          title="Bullet List"
        >
          <List className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={cn(
            'rounded px-2 py-1 transition',
            editor.isActive('orderedList')
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
              : 'text-muted-foreground hover:bg-muted',
          )}
          title="Numbered List"
        >
          <ListOrdered className="h-4 w-4" />
        </button>

        <div className="mx-1 h-4 w-px bg-border" />

        {/* Headings */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={cn(
            'rounded px-2 py-1 text-xs font-semibold transition',
            editor.isActive('heading', { level: 2 })
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
              : 'text-muted-foreground hover:bg-muted',
          )}
          title="Heading 2"
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
          title="Heading 3"
        >
          H3
        </button>
      </div>

      {/* Editor Content */}
      <div className="relative overflow-y-auto" style={{ minHeight: `calc(${minHeight} - 50px)` }}>
        <EditorContent
          editor={editor}
          className="[&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[150px] [&_.ProseMirror]:p-3 [&_.ProseMirror]:text-foreground"
        />
        {!editor.getText() && (
          <div className="pointer-events-none absolute left-3 top-3 text-sm text-muted-foreground">
            {placeholder}
          </div>
        )}
      </div>

      {/* Close dropdowns when clicking outside */}
      {showColorPicker && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowColorPicker(null)}
        />
      )}
      {showFontFamily && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowFontFamily(false)}
        />
      )}
      {showFontSize && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowFontSize(false)}
        />
      )}
    </div>
  );
}
