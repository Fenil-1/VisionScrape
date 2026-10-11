export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export interface TranscriptResult {
  duration: number;
  segments: TranscriptSegment[];
}

export async function transcribeFile(file: File): Promise<TranscriptResult> {
  const form = new FormData();
  form.append('file', file);
  let res: Response;
  try {
    res = await fetch('/api/transcribe', { method: 'POST', body: form });
  } catch {
    throw new Error('Cannot reach the transcription server.');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (!data) {
      throw new Error('Transcription server is not ready yet (the model may still be loading) — retry in a few seconds.');
    }
    throw new Error(data.detail || data.error || `Transcription failed (${res.status})`);
  }
  return data as TranscriptResult;
}

export function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${String(m).padStart(2, '0')}:${s.toFixed(1).padStart(4, '0')}`;
}

export function transcriptToText(name: string, segments: TranscriptSegment[]): string {
  const lines = segments.map((s) => `[${formatTime(s.start)} → ${formatTime(s.end)}] ${s.text}`);
  return `${name}\n${'-'.repeat(name.length)}\n${lines.join('\n')}\n`;
}
