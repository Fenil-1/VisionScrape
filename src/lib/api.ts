import type { ColumnDef } from './types';

// Downscale + re-encode an image to JPEG to keep request bodies small.
// The cap is generous (2600px) so small text in dense table screenshots stays legible.
// Falls back to the original file on failure.
export async function fileToBase64Jpeg(
  file: File
): Promise<{ mimeType: string; data: string }> {
  try {
    const bitmap = await createImageBitmap(file);
    const MAX = 2600;
    const scale = Math.min(1, MAX / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    return { mimeType: 'image/jpeg', data: dataUrl.split(',')[1] };
  } catch {
    // Fallback: send original bytes (e.g. unsupported format for canvas)
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    return { mimeType: file.type || 'image/jpeg', data };
  }
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function extractImage(
  image: { mimeType: string; data: string },
  columns: ColumnDef[],
  model: string,
  extraInstructions: string
): Promise<Record<string, string>[]> {
  const res = await fetch('/api/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ images: [image], columns, model, extraInstructions }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, body?.error || `Request failed (${res.status})`);
  }
  return (body?.rows ?? []) as Record<string, string>[];
}

// Retry with backoff — waits longer on 429/503 (rate limit / overload).
export async function extractWithRetry(
  image: { mimeType: string; data: string },
  columns: ColumnDef[],
  model: string,
  extraInstructions: string,
  maxAttempts = 3
): Promise<Record<string, string>[]> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await extractImage(image, columns, model, extraInstructions);
    } catch (err) {
      lastErr = err;
      if (attempt === maxAttempts) break;
      const status = err instanceof ApiError ? err.status : 0;
      // Don't retry client-side errors except rate limits
      if (status >= 400 && status < 500 && status !== 429) break;
      const base = status === 429 || status === 503 ? 15000 : 2000;
      await new Promise((r) => setTimeout(r, base * attempt));
    }
  }
  throw lastErr;
}
