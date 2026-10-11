import { useCallback, useRef, useState } from 'react';
import {
  AudioLines,
  Play,
  Square,
  FileText,
  Copy,
  Check,
  Trash2,
  RotateCw,
  Loader2,
  UploadCloud,
} from 'lucide-react';
import {
  transcribeFile,
  formatTime,
  transcriptToText,
  type TranscriptSegment,
} from '../lib/transcribe';

type Status = 'pending' | 'processing' | 'completed' | 'error';

interface AudioItem {
  id: string;
  file: File;
  name: string;
  status: Status;
  duration?: number;
  segments?: TranscriptSegment[];
  error?: string;
}

const AUDIO_RE = /\.(aac|m4a|mp3|wav|ogg|flac|opus|mp4|webm)$/i;

export function AudioTranscriber() {
  const [items, setItems] = useState<AudioItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const stopRef = useRef(false);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const patchItem = useCallback((id: string, patch: Partial<AudioItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }, []);

  const addFiles = useCallback((list: FileList | File[] | null) => {
    if (!list) return;
    const files = Array.from(list).filter((f) => f.type.startsWith('audio/') || AUDIO_RE.test(f.name));
    if (!files.length) return;
    setItems((prev) => {
      const existing = new Set(prev.map((it) => it.name + it.file.size));
      const fresh = files
        .filter((f) => !existing.has(f.name + f.size))
        .map<AudioItem>((f) => ({ id: crypto.randomUUID(), file: f, name: f.name, status: 'pending' }));
      return [...prev, ...fresh];
    });
  }, []);

  // Files go one at a time: the local model handles one transcription at once anyway,
  // and sequential order gives clear per-file progress.
  const processQueue = useCallback(async () => {
    const queue = itemsRef.current.filter((it) => it.status === 'pending' || it.status === 'error');
    if (!queue.length) return;
    setIsProcessing(true);
    stopRef.current = false;
    for (const item of queue) {
      if (stopRef.current) break;
      patchItem(item.id, { status: 'processing', error: undefined });
      try {
        const r = await transcribeFile(item.file);
        patchItem(item.id, { status: 'completed', segments: r.segments, duration: r.duration });
      } catch (err: any) {
        patchItem(item.id, { status: 'error', error: err?.message || 'Transcription failed' });
      }
    }
    setItems((prev) => prev.map((it) => (it.status === 'processing' ? { ...it, status: 'pending' } : it)));
    setIsProcessing(false);
  }, [patchItem]);

  const removeItem = (id: string) => setItems((prev) => prev.filter((it) => it.id !== id));

  const copyOne = async (it: AudioItem) => {
    await navigator.clipboard.writeText(transcriptToText(it.name, it.segments ?? []));
    setCopiedId(it.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const downloadAll = () => {
    const text = items
      .filter((it) => it.segments)
      .map((it) => transcriptToText(it.name, it.segments!))
      .join('\n');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transcriptions.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const todo = items.filter((i) => i.status === 'pending' || i.status === 'error').length;
  const done = items.filter((i) => i.status === 'completed').length;

  return (
    <div className="module-shell">
      <header className="app-header">
        <div className="app-title">
          <AudioLines size={26} />
          <div>
            <h1>Audio Transcription</h1>
            <p>English speech-to-text with timestamps — runs locally, nothing is uploaded</p>
          </div>
        </div>
        <div className="header-actions">
          {!isProcessing ? (
            <button className="btn btn-primary" onClick={processQueue} disabled={todo === 0}>
              <Play size={16} /> Transcribe {todo} file{todo === 1 ? '' : 's'}
            </button>
          ) : (
            <button className="btn btn-danger" onClick={() => (stopRef.current = true)}>
              <Square size={16} /> Stop after current
            </button>
          )}
          <button className="btn" onClick={downloadAll} disabled={done === 0}>
            <FileText size={16} /> .txt
          </button>
        </div>
      </header>

      {items.length > 0 && (
        <div className="progress-strip">
          <div className="progress-bar" style={{ width: `${(done / items.length) * 100}%` }} />
          <span>
            {done}/{items.length} files transcribed
            {isProcessing && ' · transcribing…'}
          </span>
        </div>
      )}

      <main className="app-body">
        <aside className="sidebar">
          <div
            className={`dropzone ${dragOver ? 'dropzone--over' : ''} ${isProcessing ? 'dropzone--disabled' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              if (!isProcessing) setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (!isProcessing) addFiles(e.dataTransfer.files);
            }}
            onClick={() => !isProcessing && inputRef.current?.click()}
          >
            <UploadCloud size={32} />
            <p>
              <strong>Drop .aac files here</strong> or click to browse
            </p>
            <span className="hint">Select multiple files at once. AAC, M4A, MP3, WAV also work.</span>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept="audio/*,.aac,.m4a,.mp3,.wav,.ogg,.flac,.opus"
              hidden
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = '';
              }}
            />
          </div>
        </aside>

        <section className="content">
          {items.length === 0 ? (
            <div className="empty-state">
              <AudioLines size={48} />
              <h2>No audio yet</h2>
              <p>
                Drop one or more audio files on the left, then hit <strong>Transcribe</strong>.
                Each file gets its own transcript, split into timestamped segments.
              </p>
            </div>
          ) : (
            <div className="transcript-list">
              {items.map((it) => (
                <div className="panel transcript-card" key={it.id}>
                  <div className="panel-header">
                    <h2>
                      {it.name}
                      {it.duration !== undefined && ` · ${formatTime(it.duration)}`}
                    </h2>
                    <div className="transcript-actions">
                      {it.status === 'processing' && <Loader2 size={16} className="status-spin" />}
                      {it.status === 'pending' && <span className="status-pending">Queued</span>}
                      {it.status === 'completed' && (
                        <button className="btn btn-sm" onClick={() => copyOne(it)}>
                          {copiedId === it.id ? <Check size={14} /> : <Copy size={14} />}{' '}
                          {copiedId === it.id ? 'Copied' : 'Copy'}
                        </button>
                      )}
                      {it.status === 'error' && (
                        <button
                          className="btn btn-sm"
                          disabled={isProcessing}
                          onClick={() => patchItem(it.id, { status: 'pending', error: undefined })}
                        >
                          <RotateCw size={14} /> Retry
                        </button>
                      )}
                      <button
                        className="btn btn-sm btn-ghost"
                        disabled={it.status === 'processing'}
                        onClick={() => removeItem(it.id)}
                        title="Remove"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  {it.status === 'error' && <p className="status-err">{it.error}</p>}
                  {it.status === 'processing' && <p className="hint">Transcribing…</p>}
                  {it.status === 'completed' &&
                    (it.segments!.length ? (
                      <div className="segment-list">
                        {it.segments!.map((s, i) => (
                          <div className="segment" key={i}>
                            <span className="segment-time">
                              {formatTime(s.start)} → {formatTime(s.end)}
                            </span>
                            <span>{s.text}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="hint">No speech detected.</p>
                    ))}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
