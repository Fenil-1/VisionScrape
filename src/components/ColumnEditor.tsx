import { Plus, Trash2, RotateCcw } from 'lucide-react';
import type { ColumnDef } from '../lib/types';
import { DEFAULT_COLUMNS } from '../lib/types';

interface Props {
  columns: ColumnDef[];
  onChange: (columns: ColumnDef[]) => void;
  disabled: boolean;
}

export function ColumnEditor({ columns, onChange, disabled }: Props) {
  const update = (i: number, patch: Partial<ColumnDef>) => {
    const next = columns.slice();
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Columns to Extract</h2>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => onChange(DEFAULT_COLUMNS)}
          disabled={disabled}
          title="Reset to default business-card columns"
        >
          <RotateCcw size={14} /> Reset
        </button>
      </div>
      <p className="hint">
        Define the spreadsheet columns. The hint tells the AI what to look for in each image.
      </p>
      <div className="column-list">
        {columns.map((col, i) => (
          <div className="column-row" key={i}>
            <input
              type="text"
              value={col.name}
              placeholder="Column name"
              onChange={(e) => update(i, { name: e.target.value })}
              disabled={disabled}
            />
            <input
              type="text"
              className="hint-input"
              value={col.hint}
              placeholder="What to extract (hint for the AI)"
              onChange={(e) => update(i, { hint: e.target.value })}
              disabled={disabled}
            />
            <button
              className="btn btn-ghost btn-icon"
              onClick={() => onChange(columns.filter((_, j) => j !== i))}
              disabled={disabled || columns.length <= 1}
              title="Remove column"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => onChange([...columns, { name: '', hint: '' }])}
        disabled={disabled}
      >
        <Plus size={14} /> Add column
      </button>
    </div>
  );
}
