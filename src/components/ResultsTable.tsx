import { useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Clock, Trash2, RefreshCw, X } from 'lucide-react';
import type { ColumnDef, ImageItem } from '../lib/types';

interface Props {
  items: ImageItem[];
  columns: ColumnDef[];
  onEditCell: (id: string, rowIndex: number, column: string, value: string) => void;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
  disabled: boolean;
}

function StatusIcon({ item }: { item: ImageItem }) {
  switch (item.status) {
    case 'completed':
      return <CheckCircle2 size={16} className="status-ok" />;
    case 'processing':
      return <Loader2 size={16} className="status-spin" />;
    case 'error':
      return (
        <span title={item.error}>
          <AlertCircle size={16} className="status-err" />
        </span>
      );
    default:
      return <Clock size={16} className="status-pending" />;
  }
}

export function ResultsTable({ items, columns, onEditCell, onRemove, onRetry, disabled }: Props) {
  const [zoom, setZoom] = useState<ImageItem | null>(null);

  if (items.length === 0) return null;

  return (
    <div className="panel table-panel">
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th></th>
              <th>Image</th>
              {columns.map((c) => (
                <th key={c.name}>{c.name}</th>
              ))}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const span =
                item.status === 'completed' && item.rows && item.rows.length > 0
                  ? item.rows.length
                  : 1;

              const metaCells = (
                <>
                  <td className="cell-status" rowSpan={span}>
                    <StatusIcon item={item} />
                  </td>
                  <td className="cell-thumb" rowSpan={span}>
                    <img src={item.url} alt={item.name} onClick={() => setZoom(item)} />
                    <span className="filename" title={item.name}>
                      {item.name}
                    </span>
                    {item.status === 'completed' && (
                      <span className="rowcount">
                        {item.rows?.length ?? 0} row{(item.rows?.length ?? 0) === 1 ? '' : 's'}
                      </span>
                    )}
                  </td>
                </>
              );

              const actionCell = (
                <td className="cell-actions" rowSpan={span}>
                  {item.status === 'error' && (
                    <button
                      className="btn btn-ghost btn-icon"
                      onClick={() => onRetry(item.id)}
                      disabled={disabled}
                      title="Retry this image"
                    >
                      <RefreshCw size={14} />
                    </button>
                  )}
                  <button
                    className="btn btn-ghost btn-icon"
                    onClick={() => onRemove(item.id)}
                    disabled={disabled}
                    title="Remove image and its rows"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              );

              if (item.status === 'completed' && item.rows && item.rows.length > 0) {
                return item.rows.map((row, ri) => (
                  <tr key={`${item.id}-${ri}`}>
                    {ri === 0 && metaCells}
                    {columns.map((c) => (
                      <td key={c.name}>
                        <input
                          className="cell-input"
                          value={row[c.name] ?? ''}
                          onChange={(e) => onEditCell(item.id, ri, c.name, e.target.value)}
                        />
                      </td>
                    ))}
                    {ri === 0 && actionCell}
                  </tr>
                ));
              }

              return (
                <tr key={item.id} className={item.status === 'error' ? 'row-error' : ''}>
                  {metaCells}
                  {columns.map((c, ci) => (
                    <td key={c.name}>
                      <span className="cell-muted">
                        {item.status === 'error' && ci === 0
                          ? item.error
                          : item.status === 'completed'
                            ? ci === 0
                              ? 'No records found in image'
                              : ''
                            : '—'}
                      </span>
                    </td>
                  ))}
                  {actionCell}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {zoom && (
        <div className="zoom-overlay" onClick={() => setZoom(null)}>
          <button className="btn btn-ghost btn-icon zoom-close">
            <X size={20} />
          </button>
          <img src={zoom.url} alt={zoom.name} onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
