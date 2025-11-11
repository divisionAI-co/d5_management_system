import { Plus, ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import type { TemplateBlock, TemplateBlockType } from '@/types/templates';
import { createBlock } from './template-blocks';

type TemplateBlockEditorProps = {
  blocks: TemplateBlock[];
  onChange: (blocks: TemplateBlock[]) => void;
  availableVariables?: string[];
};

const generateId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `block_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
};

const BLOCK_OPTIONS: Array<{ type: TemplateBlockType; label: string; description: string }> = [
  { type: 'heading', label: 'Heading', description: 'Large title text' },
  { type: 'text', label: 'Paragraph', description: 'Multi-line rich text' },
  { type: 'button', label: 'Button', description: 'Call-to-action button' },
  { type: 'image', label: 'Image', description: 'Banner or product image' },
  { type: 'divider', label: 'Divider', description: 'Horizontal separator' },
  { type: 'spacer', label: 'Spacer', description: 'Adjust vertical spacing' },
  { type: 'raw_html', label: 'Raw HTML', description: 'Custom HTML block' },
];

const alignOptions: Array<{ value: 'left' | 'center' | 'right'; label: string }> = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
];

const headingLevels: Array<{ value: 'h1' | 'h2' | 'h3'; label: string }> = [
  { value: 'h1', label: 'H1' },
  { value: 'h2', label: 'H2' },
  { value: 'h3', label: 'H3' },
];

export function TemplateBlockEditor({ blocks, onChange, availableVariables = [] }: TemplateBlockEditorProps) {
  const handleAddBlock = (type: TemplateBlockType) => {
    onChange([...blocks, createBlock(type)]);
  };

  const handleUpdateBlock = (id: string, payload: Partial<TemplateBlock>) => {
    onChange(
      blocks.map((block) => (block.id === id ? ({ ...block, ...payload } as TemplateBlock) : block)),
    );
  };

  const handleRemoveBlock = (id: string) => {
    onChange(blocks.filter((block) => block.id !== id));
  };

  const moveBlock = (id: string, direction: 'up' | 'down') => {
    const index = blocks.findIndex((block) => block.id === id);
    if (index === -1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= blocks.length) {
      return;
    }

    const next = [...blocks];
    const [current] = next.splice(index, 1);
    next.splice(targetIndex, 0, current);
    onChange(next);
  };

  const duplicateBlock = (id: string) => {
    const existing = blocks.find((block) => block.id === id);
    if (!existing) return;

    const duplicate = {
      ...existing,
      id: generateId(),
    } as TemplateBlock;

    const index = blocks.findIndex((block) => block.id === id);
    const next = [...blocks];
    next.splice(index + 1, 0, duplicate);
    onChange(next);
  };

  const insertVariable = (blockId: string, field: 'text' | 'label' | 'html', variable: string) => {
    const token = `{{${variable}}}`;
    onChange(
      blocks.map((block) => {
        if (block.id !== blockId) {
          return block;
        }

        if (block.type === 'heading' && field === 'text') {
          return { ...block, text: `${block.text} ${token}` };
        }

        if (block.type === 'text' && field === 'text') {
          return { ...block, text: `${block.text} ${token}` };
        }

        if (block.type === 'button' && field === 'label') {
          return { ...block, label: `${block.label} ${token}` };
        }

        if (block.type === 'raw_html' && field === 'html') {
          return { ...block, html: `${block.html}${token}` };
        }

        return block;
      }),
    );
  };

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border bg-muted/40 p-4">
        <h3 className="text-sm font-semibold text-muted-foreground">Add content blocks</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {BLOCK_OPTIONS.map((option) => (
            <button
              key={option.type}
              type="button"
              onClick={() => handleAddBlock(option.type)}
              className="flex items-start gap-3 rounded-lg border border-border bg-card px-3 py-3 text-left text-sm transition hover:border-blue-500 hover:bg-blue-50/50 hover:text-foreground"
            >
              <div className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                <Plus className="h-4 w-4" />
              </div>
              <div>
                <p className="font-semibold text-foreground">{option.label}</p>
                <p className="text-xs text-muted-foreground">{option.description}</p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {availableVariables.length > 0 && (
        <section className="rounded-lg border border-border bg-muted/40 px-4 py-3">
          <h4 className="text-xs font-semibold uppercase text-muted-foreground">Merge variables</h4>
          <p className="mt-1 text-xs text-muted-foreground">
            Click a variable to append it to the active block.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {availableVariables.map((variable) => (
              <span
                key={variable}
                className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600"
              >
                {'{{'}
                {variable}
                {'}}'}
              </span>
            ))}
          </div>
        </section>
      )}

      <div className="space-y-4">
        {blocks.length === 0 && (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 px-6 py-12 text-center text-sm text-muted-foreground">
            No blocks added yet. Start by selecting a block type above.
          </div>
        )}

        {blocks.map((block, index) => (
          <div key={block.id} className="space-y-3 rounded-lg border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-foreground">
                  {BLOCK_OPTIONS.find((group) => group.type === block.type)?.label ?? block.type}
                </h4>
                <p className="text-xs text-muted-foreground">Block #{index + 1}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => moveBlock(block.id, 'up')}
                  disabled={index === 0}
                  className="rounded-lg border border-border p-1 text-muted-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Move block up"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => moveBlock(block.id, 'down')}
                  disabled={index === blocks.length - 1}
                  className="rounded-lg border border-border p-1 text-muted-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Move block down"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => duplicateBlock(block.id)}
                  className="rounded-lg border border-border px-2 py-1 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
                >
                  Duplicate
                </button>
                <button
                  type="button"
                  onClick={() => handleRemoveBlock(block.id)}
                  className="rounded-lg border border-border p-1 text-muted-foreground transition hover:bg-rose-50 hover:text-rose-600"
                  aria-label="Remove block"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {block.type === 'heading' && (
              <div className="space-y-3">
                <div className="flex flex-col gap-3 md:flex-row">
                  <div className="flex-1">
                    <label className="text-xs font-semibold uppercase text-muted-foreground">Heading</label>
                    <input
                      type="text"
                      value={block.text}
                      onChange={(event) => handleUpdateBlock(block.id, { text: event.target.value })}
                      className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase text-muted-foreground">
                      Level
                    </label>
                    <select
                      value={block.level}
                      onChange={(event) =>
                        handleUpdateBlock(block.id, { level: event.target.value as 'h1' | 'h2' | 'h3' })
                      }
                      className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {headingLevels.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase text-muted-foreground">Alignment</label>
                    <select
                      value={block.align}
                      onChange={(event) =>
                        handleUpdateBlock(block.id, { align: event.target.value as 'left' | 'center' | 'right' })
                      }
                      className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {alignOptions.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {availableVariables.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {availableVariables.map((variable) => (
                      <button
                        key={variable}
                        type="button"
                        onClick={() => insertVariable(block.id, 'text', variable)}
                        className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600 transition hover:bg-blue-100"
                      >
                        {'{{'}
                        {variable}
                        {'}}'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {block.type === 'text' && (
              <div className="space-y-3">
                <label className="text-xs font-semibold uppercase text-muted-foreground">
                  Paragraph text
                </label>
                <textarea
                  value={block.text}
                  onChange={(event) => handleUpdateBlock(block.id, { text: event.target.value })}
                  rows={5}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Write the body copy for this section..."
                />
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <select
                    value={block.align}
                    onChange={(event) =>
                      handleUpdateBlock(block.id, { align: event.target.value as 'left' | 'center' | 'right' })
                    }
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 md:w-40"
                  >
                    {alignOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        Align {option.label}
                      </option>
                    ))}
                  </select>

                  {availableVariables.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {availableVariables.map((variable) => (
                        <button
                          key={variable}
                          type="button"
                          onClick={() => insertVariable(block.id, 'text', variable)}
                          className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600 transition hover:bg-blue-100"
                        >
                          {'{{'}
                          {variable}
                          {'}}'}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {block.type === 'button' && (
              <div className="space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold uppercase text-muted-foreground">Button label</label>
                    <input
                      type="text"
                      value={block.label}
                      onChange={(event) => handleUpdateBlock(block.id, { label: event.target.value })}
                      className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase text-muted-foreground">Link URL</label>
                    <input
                      type="text"
                      value={block.url}
                      onChange={(event) => handleUpdateBlock(block.id, { url: event.target.value })}
                      className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <label className="text-xs font-semibold uppercase text-muted-foreground">Alignment</label>
                    <select
                      value={block.align}
                      onChange={(event) =>
                        handleUpdateBlock(block.id, { align: event.target.value as 'left' | 'center' | 'right' })
                      }
                      className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {alignOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase text-muted-foreground">
                      Background
                    </label>
                    <input
                      type="color"
                      value={block.backgroundColor}
                      onChange={(event) =>
                        handleUpdateBlock(block.id, { backgroundColor: event.target.value })
                      }
                      className="mt-2 h-10 w-full rounded-lg border border-border bg-card"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase text-muted-foreground">Text color</label>
                    <input
                      type="color"
                      value={block.textColor}
                      onChange={(event) => handleUpdateBlock(block.id, { textColor: event.target.value })}
                      className="mt-2 h-10 w-full rounded-lg border border-border bg-card"
                    />
                  </div>
                </div>
              </div>
            )}

            {block.type === 'image' && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold uppercase text-muted-foreground">Image URL</label>
                  <input
                    type="url"
                    value={block.url}
                    onChange={(event) => handleUpdateBlock(block.id, { url: event.target.value })}
                    className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://..."
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-[2fr_1fr]">
                  <div>
                    <label className="text-xs font-semibold uppercase text-muted-foreground">Alt text</label>
                    <input
                      type="text"
                      value={block.altText}
                      onChange={(event) => handleUpdateBlock(block.id, { altText: event.target.value })}
                      className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase text-muted-foreground">Width (px)</label>
                    <input
                      type="number"
                      value={block.width}
                      onChange={(event) =>
                        handleUpdateBlock(block.id, { width: Number(event.target.value) || 0 })
                      }
                      min={100}
                      max={640}
                      className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-muted-foreground">Alignment</label>
                  <select
                    value={block.align}
                    onChange={(event) =>
                      handleUpdateBlock(block.id, { align: event.target.value as 'left' | 'center' | 'right' })
                    }
                    className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {alignOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {block.type === 'divider' && (
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase text-muted-foreground">Thickness (px)</label>
                  <input
                    type="number"
                    value={block.thickness}
                    min={1}
                    max={6}
                    onChange={(event) =>
                      handleUpdateBlock(block.id, { thickness: Number(event.target.value) || 1 })
                    }
                    className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-muted-foreground">Color</label>
                  <input
                    type="color"
                    value={block.color}
                    onChange={(event) => handleUpdateBlock(block.id, { color: event.target.value })}
                    className="mt-2 h-10 w-full rounded-lg border border-border bg-card"
                  />
                </div>
              </div>
            )}

            {block.type === 'spacer' && (
              <div>
                <label className="text-xs font-semibold uppercase text-muted-foreground">
                  Spacer height (px)
                </label>
                <input
                  type="number"
                  min={8}
                  max={96}
                  value={block.height}
                  onChange={(event) =>
                    handleUpdateBlock(block.id, { height: Number(event.target.value) || 8 })
                  }
                  className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            {block.type === 'raw_html' && (
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase text-muted-foreground">Custom HTML</label>
                <textarea
                  value={block.html}
                  onChange={(event) => handleUpdateBlock(block.id, { html: event.target.value })}
                  rows={8}
                  className="w-full rounded-lg border border-border px-3 py-2 font-mono text-xs focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Paste or write your custom HTML snippet here..."
                />
                {availableVariables.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {availableVariables.map((variable) => (
                      <button
                        key={variable}
                        type="button"
                        onClick={() => insertVariable(block.id, 'html', variable)}
                        className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600 transition hover:bg-blue-100"
                      >
                        {'{{'}
                        {variable}
                        {'}}'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}


