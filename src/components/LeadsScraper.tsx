import { useCallback, useEffect, useRef, useState } from 'react';
import { Play, Square, FileSpreadsheet, FileText, Table2 } from 'lucide-react';
import { Dropzone } from './Dropzone';
import { ColumnEditor } from './ColumnEditor';
import { ResultsTable } from './ResultsTable';
import { fileToBase64Jpeg, extractWithRetry } from '../lib/api';
import { exportToExcel, exportToCsv } from '../lib/export';
import type { ColumnDef, ImageItem } from '../lib/types';
import { DEFAULT_COLUMNS, MODELS } from '../lib/types';

const COLUMNS_KEY = 'ocr-extractor-columns';
const INSTRUCTIONS_KEY = 'ocr-extractor-instructions';
const CONCURRENCY = 4;

function loadColumns(): ColumnDef[] {
  try {
    const raw = localStorage.getItem(COLUMNS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_COLUMNS;
}

export function LeadsScraper() {
  const [items, setItems] = useState<ImageItem[]>([]);
  const [columns, setColumns] = useState<ColumnDef[]>(loadColumns);
  const [instructions, setInstructions] = useState(
    () => localStorage.getItem(INSTRUCTIONS_KEY) ?? ''
  );
  const [model, setModel] = useState(MODELS[0].id);
  const [isProcessing, setIsProcessing] = useState(false);
  const stopRef = useRef(false);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => {
    localStorage.setItem(COLUMNS_KEY, JSON.stringify(columns));
  }, [columns]);
  useEffect(() => {
    localStorage.setItem(INSTRUCTIONS_KEY, instructions);
  }, [instructions]);

  const addFiles = useCallback((files: File[]) => {
    setItems((prev) => {
      const existing = new Set(prev.map((it) => it.name + it.file.size));
      const fresh = files
        .filter((f) => !existing.has(f.name + f.size))
        .map<ImageItem>((f) => ({
          id: crypto.randomUUID(),
          file: f,
          name: f.name,
          url: URL.createObjectURL(f),
          status: 'pending',
        }));
      return [...prev, ...fresh];
    });
  }, []);

  const patchItem = useCallback((id: string, patch: Partial<ImageItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }, []);

  const processQueue = useCallback(async () => {
    const validColumns = columns.filter((c) => c.name.trim());
    if (!validColumns.length) {
      alert('Define at least one column with a name before processing.');
      return;
    }
    const queue = itemsRef.current.filter(
      (it) => it.status === 'pending' || it.status === 'error'
    );
    if (!queue.length) return;

    setIsProcessing(true);
    stopRef.current = false;

    let index = 0;
    const worker = async () => {
      while (!stopRef.current) {
        const i = index++;
        if (i >= queue.length) break;
        const item = queue[i];
        patchItem(item.id, { status: 'processing', error: undefined });
        try {
          const encoded = await fileToBase64Jpeg(item.file);
          const rows = await extractWithRetry(encoded, validColumns, model, instructions);
          patchItem(item.id, { status: 'completed', rows });
        } catch (err: any) {
          patchItem(item.id, {
            status: 'error',
            error: err?.message || 'Extraction failed',
          });
        }
      }
    };

    await Promise.all(Array.from({ length: CONCURRENCY }, worker));

    // Anything still marked processing when stopped goes back to pending
    setItems((prev) =>
      prev.map((it) => (it.status === 'processing' ? { ...it, status: 'pending' } : it))
    );
    setIsProcessing(false);
  }, [columns, model, instructions, patchItem]);

  const retryOne = useCallback(
    (id: string) => {
      patchItem(id, { status: 'pending', error: undefined });
    },
    [patchItem]
  );

  const removeItem = useCallback((id: string) => {
    setItems((prev) => {
      const item = prev.find((it) => it.id === id);
      if (item) URL.revokeObjectURL(item.url);
      return prev.filter((it) => it.id !== id);
    });
  }, []);

  const editCell = useCallback(
    (id: string, rowIndex: number, column: string, value: string) => {
      setItems((prev) =>
        prev.map((it) => {
          if (it.id !== id || !it.rows) return it;
          const rows = it.rows.map((r, i) => (i === rowIndex ? { ...r, [column]: value } : r));
          return { ...it, rows };
        })
      );
    },
    []
  );

  const counts = {
    total: items.length,
    done: items.filter((i) => i.status === 'completed').length,
    error: items.filter((i) => i.status === 'error').length,
    pending: items.filter((i) => i.status === 'pending').length,
    rows: items.reduce((n, i) => n + (i.rows?.length ?? 0), 0),
  };
  const exportableColumns = columns.filter((c) => c.name.trim());

  return (
    <div className="module-shell">
      <header className="app-header">
        <div className="app-title">
          <Table2 size={26} />
          <div>
            <h1>Leads Scraper</h1>
            <p>Extract every row from table & list screenshots into a spreadsheet</p>
          </div>
        </div>
        <div className="header-actions">
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={isProcessing}
            title="AI model"
          >
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          {!isProcessing ? (
            <button
              className="btn btn-primary"
              onClick={processQueue}
              disabled={counts.pending + counts.error === 0}
            >
              <Play size={16} /> Process {counts.pending + counts.error} image
              {counts.pending + counts.error === 1 ? '' : 's'}
            </button>
          ) : (
            <button className="btn btn-danger" onClick={() => (stopRef.current = true)}>
              <Square size={16} /> Stop
            </button>
          )}
          <button
            className="btn"
            onClick={() => exportToExcel(items, exportableColumns)}
            disabled={counts.rows === 0}
          >
            <FileSpreadsheet size={16} /> .xlsx
          </button>
          <button
            className="btn"
            onClick={() => exportToCsv(items, exportableColumns)}
            disabled={counts.rows === 0}
          >
            <FileText size={16} /> .csv
          </button>
        </div>
      </header>

      {items.length > 0 && (
        <div className="progress-strip">
          <div
            className="progress-bar"
            style={{ width: `${counts.total ? (counts.done / counts.total) * 100 : 0}%` }}
          />
          <span>
            {counts.done}/{counts.total} images completed · {counts.rows} rows extracted
            {counts.error > 0 && ` · ${counts.error} failed`}
            {isProcessing && ' · processing…'}
          </span>
        </div>
      )}

      <main className="app-body">
        <aside className="sidebar">
          <Dropzone onFiles={addFiles} disabled={isProcessing} />
          <ColumnEditor columns={columns} onChange={setColumns} disabled={isProcessing} />
          <div className="panel">
            <div className="panel-header">
              <h2>Extra Instructions (optional)</h2>
            </div>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="e.g. These are CRM contact-list screenshots. Extract every visible row. If a cell shows 'not found', return an empty string…"
              rows={4}
              disabled={isProcessing}
            />
          </div>
        </aside>

        <section className="content">
          {items.length === 0 ? (
            <div className="empty-state">
              <Table2 size={48} />
              <h2>No images yet</h2>
              <p>
                Drop screenshots of tables, lists or cards on the left, adjust the columns you
                want extracted, then hit <strong>Process</strong>. Every row in every image
                becomes a spreadsheet row. Export to Excel or CSV when done.
              </p>
            </div>
          ) : (
            <ResultsTable
              items={items}
              columns={exportableColumns}
              onEditCell={editCell}
              onRemove={removeItem}
              onRetry={retryOne}
              disabled={isProcessing}
            />
          )}
        </section>
      </main>
    </div>
  );
}
