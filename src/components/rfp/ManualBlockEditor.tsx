'use client';

import { useCallback, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown } from 'lucide-react';
import type { GeneratedBlock } from '@/types/generatedSection';

function cloneBlocks(blocks: GeneratedBlock[]): GeneratedBlock[] {
  return JSON.parse(JSON.stringify(blocks)) as GeneratedBlock[];
}

export function validateGeneratedBlocks(blocks: unknown): GeneratedBlock[] {
  if (!Array.isArray(blocks)) {
    throw new Error('Content must be an array of blocks.');
  }
  const out: GeneratedBlock[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (!b || typeof b !== 'object') {
      throw new Error(`Block ${i + 1} is invalid.`);
    }
    const type = (b as { type?: string }).type;
    switch (type) {
      case 'heading': {
        const level = (b as { level?: number }).level;
        const text = (b as { text?: string }).text;
        if (level !== 1 && level !== 2 && level !== 3) {
          throw new Error(`Heading block ${i + 1} needs level 1, 2, or 3.`);
        }
        if (typeof text !== 'string' || !text.trim()) {
          throw new Error(`Heading block ${i + 1} needs text.`);
        }
        out.push({ type: 'heading', level, text });
        break;
      }
      case 'paragraph': {
        const text = (b as { text?: string }).text;
        if (typeof text !== 'string') {
          throw new Error(`Paragraph block ${i + 1} needs text.`);
        }
        out.push({ type: 'paragraph', text });
        break;
      }
      case 'bullet_list':
      case 'numbered_list': {
        const items = (b as { items?: unknown }).items;
        if (!Array.isArray(items) || items.some((x) => typeof x !== 'string')) {
          throw new Error(`List block ${i + 1} needs string items.`);
        }
        out.push({ type, items: [...items] } as GeneratedBlock);
        break;
      }
      case 'table': {
        const headers = (b as { headers?: unknown }).headers;
        const rows = (b as { rows?: unknown }).rows;
        if (
          !Array.isArray(headers) ||
          headers.some((h) => typeof h !== 'string') ||
          !Array.isArray(rows) ||
          rows.some(
            (row) =>
              !Array.isArray(row) || row.some((cell) => typeof cell !== 'string'),
          )
        ) {
          throw new Error(`Table block ${i + 1} needs headers and rows.`);
        }
        out.push({ type: 'table', headers: [...headers], rows: rows.map((r) => [...r]) });
        break;
      }
      case 'tbc': {
        const label = (b as { label?: string }).label;
        if (typeof label !== 'string' || !label.trim()) {
          throw new Error(`TBC block ${i + 1} needs a label.`);
        }
        out.push({
          type: 'tbc',
          label,
          fieldId: (b as { fieldId?: string }).fieldId,
        });
        break;
      }
      default:
        throw new Error(`Block ${i + 1} has unsupported type "${String(type)}".`);
    }
  }
  if (out.filter((b) => b.type !== 'tbc').length === 0 && out.length === 0) {
    throw new Error('Section must contain at least one block.');
  }
  return out;
}

interface ManualBlockEditorProps {
  initialBlocks: GeneratedBlock[];
  disabled?: boolean;
  onSave: (blocks: GeneratedBlock[]) => void | Promise<void>;
  onCancel: () => void;
  saving?: boolean;
}

export function ManualBlockEditor({
  initialBlocks,
  disabled,
  onSave,
  onCancel,
  saving,
}: ManualBlockEditorProps) {
  const [blocks, setBlocks] = useState(() => cloneBlocks(initialBlocks));
  const [showAdvancedJson, setShowAdvancedJson] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const tbcCount = useMemo(() => blocks.filter((b) => b.type === 'tbc').length, [blocks]);

  const updateBlock = useCallback((index: number, next: GeneratedBlock) => {
    setBlocks((prev) => prev.map((b, i) => (i === index ? next : b)));
    setValidationError(null);
  }, []);

  const updateListItem = (
    blockIndex: number,
    itemIndex: number,
    value: string,
    listType: 'bullet_list' | 'numbered_list',
  ) => {
    const block = blocks[blockIndex];
    if (block.type !== listType) return;
    const items = [...block.items];
    items[itemIndex] = value;
    updateBlock(blockIndex, { type: listType, items });
  };

  const addListItem = (blockIndex: number, listType: 'bullet_list' | 'numbered_list') => {
    const block = blocks[blockIndex];
    if (block.type !== listType) return;
    updateBlock(blockIndex, { type: listType, items: [...block.items, ''] });
  };

  const removeListItem = (
    blockIndex: number,
    itemIndex: number,
    listType: 'bullet_list' | 'numbered_list',
  ) => {
    const block = blocks[blockIndex];
    if (block.type !== listType || block.items.length <= 1) return;
    updateBlock(blockIndex, {
      type: listType,
      items: block.items.filter((_, i) => i !== itemIndex),
    });
  };

  const updateTableCell = (
    blockIndex: number,
    rowIndex: number,
    colIndex: number,
    value: string,
    isHeader: boolean,
  ) => {
    const block = blocks[blockIndex];
    if (block.type !== 'table') return;
    if (isHeader) {
      const headers = [...block.headers];
      headers[colIndex] = value;
      updateBlock(blockIndex, { ...block, headers });
      return;
    }
    const rows = block.rows.map((row, ri) =>
      ri === rowIndex ? row.map((cell, ci) => (ci === colIndex ? value : cell)) : row,
    );
    updateBlock(blockIndex, { ...block, rows });
  };

  const addTableRow = (blockIndex: number) => {
    const block = blocks[blockIndex];
    if (block.type !== 'table') return;
    const emptyRow = block.headers.map(() => '');
    updateBlock(blockIndex, { ...block, rows: [...block.rows, emptyRow] });
  };

  const openAdvancedJson = () => {
    setJsonText(JSON.stringify(blocks, null, 2));
    setShowAdvancedJson(true);
    setValidationError(null);
  };

  const applyJsonToStructured = () => {
    try {
      const parsed = JSON.parse(jsonText) as unknown;
      const validated = validateGeneratedBlocks(parsed);
      setBlocks(validated);
      setShowAdvancedJson(false);
      setValidationError(null);
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : 'Invalid JSON');
    }
  };

  const handleSave = async () => {
    setValidationError(null);
    try {
      const toSave = showAdvancedJson
        ? validateGeneratedBlocks(JSON.parse(jsonText))
        : validateGeneratedBlocks(blocks);
      const editableCount = toSave.filter((b) => b.type !== 'tbc').length;
      if (editableCount === 0 && toSave.length === 0) {
        throw new Error('Section must contain at least one editable block.');
      }
      await onSave(toSave);
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : 'Validation failed');
    }
  };

  return (
    <div className="flex flex-col gap-3 border-b border-border bg-[var(--color-neutral-50)] px-3 py-3">
      <div>
        <p className="text-small font-semibold text-text-primary">Edit section manually</p>
        <p className="text-caption text-text-secondary">
          Changes apply to this draft only and create a new version. Confirmed project
          information and TBC items are not changed.
        </p>
        {tbcCount > 0 && (
          <p className="mt-1 inline-flex items-center gap-1 text-caption text-[var(--color-warning-700)]">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {tbcCount} TBC {tbcCount === 1 ? 'marker is' : 'markers are'} protected and cannot be
            edited here.
          </p>
        )}
      </div>

      {!showAdvancedJson ? (
        <div className="flex max-h-72 flex-col gap-3 overflow-y-auto rounded border border-border bg-white p-3">
          {blocks.map((block, index) => (
            <BlockEditorRow
              key={`block-${index}-${block.type}`}
              block={block}
              index={index}
              disabled={disabled || saving}
              onUpdate={(next) => updateBlock(index, next)}
              onListItemChange={(itemIndex, value) =>
                updateListItem(
                  index,
                  itemIndex,
                  value,
                  block.type as 'bullet_list' | 'numbered_list',
                )
              }
              onAddListItem={() =>
                addListItem(index, block.type as 'bullet_list' | 'numbered_list')
              }
              onRemoveListItem={(itemIndex) =>
                removeListItem(index, itemIndex, block.type as 'bullet_list' | 'numbered_list')
              }
              onTableCellChange={(rowIndex, colIndex, value, isHeader) =>
                updateTableCell(index, rowIndex, colIndex, value, isHeader)
              }
              onAddTableRow={() => addTableRow(index)}
            />
          ))}
        </div>
      ) : (
        <textarea
          className="h-48 w-full rounded border border-border bg-white p-2 font-mono text-[11px] text-text-primary"
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          disabled={disabled || saving}
          aria-label="Advanced JSON block editor"
        />
      )}

      <div className="rami-engine-disclosure">
        <button
          type="button"
          className="inline-flex items-center gap-1 text-caption font-medium text-text-secondary hover:text-text-primary"
          onClick={() => (showAdvancedJson ? setShowAdvancedJson(false) : openAdvancedJson())}
          aria-expanded={showAdvancedJson}
        >
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform ${showAdvancedJson ? 'rotate-180' : ''}`}
            aria-hidden
          />
          Advanced JSON
        </button>
        {showAdvancedJson && (
          <p className="mt-1 text-caption text-text-muted">
            Developer mode — edit raw block JSON. Apply JSON before saving, or switch back to the
            structured editor.
          </p>
        )}
      </div>

      {validationError && (
        <p className="text-caption text-[var(--color-danger-700,#b91c1c)]" role="alert">
          {validationError}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {showAdvancedJson ? (
          <button
            type="button"
            className="rounded border border-border bg-white px-2.5 py-1 text-caption font-medium"
            onClick={applyJsonToStructured}
            disabled={disabled || saving}
          >
            Apply JSON
          </button>
        ) : null}
        <button
          type="button"
          className="rounded border border-[var(--color-primary-600)] bg-[var(--color-primary-700)] px-2.5 py-1 text-caption font-medium text-white disabled:opacity-50"
          onClick={() => void handleSave()}
          disabled={disabled || saving}
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        <button
          type="button"
          className="rounded border border-border px-2.5 py-1 text-caption"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function BlockEditorRow({
  block,
  index,
  disabled,
  onUpdate,
  onListItemChange,
  onAddListItem,
  onRemoveListItem,
  onTableCellChange,
  onAddTableRow,
}: {
  block: GeneratedBlock;
  index: number;
  disabled?: boolean;
  onUpdate: (block: GeneratedBlock) => void;
  onListItemChange: (itemIndex: number, value: string) => void;
  onAddListItem: () => void;
  onRemoveListItem: (itemIndex: number) => void;
  onTableCellChange: (
    rowIndex: number,
    colIndex: number,
    value: string,
    isHeader: boolean,
  ) => void;
  onAddTableRow: () => void;
}) {
  const label = `Block ${index + 1}`;

  if (block.type === 'tbc') {
    return (
      <div className="rounded border border-dashed border-[var(--color-warning-200)] bg-[var(--color-warning-50)] px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-warning-700)]">
          TBC — protected
        </p>
        <p className="mt-1 text-small text-text-secondary">{block.label}</p>
        {block.fieldId ? (
          <p className="mt-0.5 text-caption text-text-muted">Unresolved field — not editable</p>
        ) : null}
      </div>
    );
  }

  if (block.type === 'heading') {
    return (
      <fieldset className="space-y-1.5" disabled={disabled}>
        <legend className="text-caption font-medium text-text-muted">{label} — Heading</legend>
        <div className="flex gap-2">
          <select
            className="rounded border border-border bg-white px-2 py-1 text-caption"
            value={block.level}
            onChange={(e) =>
              onUpdate({
                ...block,
                level: Number(e.target.value) as 1 | 2 | 3,
              })
            }
            aria-label="Heading level"
          >
            <option value={1}>H1</option>
            <option value={2}>H2</option>
            <option value={3}>H3</option>
          </select>
          <input
            type="text"
            className="min-w-0 flex-1 rounded border border-border bg-white px-2 py-1 text-small"
            value={block.text}
            onChange={(e) => onUpdate({ ...block, text: e.target.value })}
            aria-label="Heading text"
          />
        </div>
      </fieldset>
    );
  }

  if (block.type === 'paragraph') {
    return (
      <fieldset className="space-y-1.5" disabled={disabled}>
        <legend className="text-caption font-medium text-text-muted">{label} — Paragraph</legend>
        <textarea
          className="min-h-[4rem] w-full rounded border border-border bg-white p-2 text-small"
          value={block.text}
          onChange={(e) => onUpdate({ ...block, text: e.target.value })}
          aria-label="Paragraph text"
        />
      </fieldset>
    );
  }

  if (block.type === 'bullet_list' || block.type === 'numbered_list') {
    const listLabel = block.type === 'bullet_list' ? 'Bullet list' : 'Numbered list';
    return (
      <fieldset className="space-y-1.5" disabled={disabled}>
        <legend className="text-caption font-medium text-text-muted">
          {label} — {listLabel}
        </legend>
        <ul className="space-y-1.5">
          {block.items.map((item, itemIndex) => (
            <li key={itemIndex} className="flex gap-1.5">
              <span className="w-5 shrink-0 pt-2 text-caption text-text-muted">
                {block.type === 'numbered_list' ? `${itemIndex + 1}.` : '•'}
              </span>
              <input
                type="text"
                className="min-w-0 flex-1 rounded border border-border bg-white px-2 py-1 text-small"
                value={item}
                onChange={(e) => onListItemChange(itemIndex, e.target.value)}
                aria-label={`${listLabel} item ${itemIndex + 1}`}
              />
              <button
                type="button"
                className="shrink-0 rounded border border-border px-1.5 text-caption text-text-muted"
                onClick={() => onRemoveListItem(itemIndex)}
                disabled={block.items.length <= 1}
                aria-label="Remove item"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="text-caption text-[var(--color-primary-700)] underline"
          onClick={onAddListItem}
        >
          + Add item
        </button>
      </fieldset>
    );
  }

  if (block.type === 'table') {
    return (
      <fieldset className="space-y-1.5" disabled={disabled}>
        <legend className="text-caption font-medium text-text-muted">{label} — Table</legend>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-caption">
            <thead>
              <tr>
                {block.headers.map((header, colIndex) => (
                  <th key={colIndex} className="border border-border p-1">
                    <input
                      type="text"
                      className="w-full min-w-[4rem] bg-transparent px-1 py-0.5"
                      value={header}
                      onChange={(e) => onTableCellChange(-1, colIndex, e.target.value, true)}
                      aria-label={`Header ${colIndex + 1}`}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, colIndex) => (
                    <td key={colIndex} className="border border-border p-1">
                      <input
                        type="text"
                        className="w-full min-w-[4rem] bg-transparent px-1 py-0.5"
                        value={cell}
                        onChange={(e) =>
                          onTableCellChange(rowIndex, colIndex, e.target.value, false)
                        }
                        aria-label={`Row ${rowIndex + 1} column ${colIndex + 1}`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          className="text-caption text-[var(--color-primary-700)] underline"
          onClick={onAddTableRow}
        >
          + Add row
        </button>
      </fieldset>
    );
  }

  return null;
}
