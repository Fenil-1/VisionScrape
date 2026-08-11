// Shared extraction logic — used by the Vercel serverless function (api/extract.ts)
// and by the local Vite dev middleware (vite.config.ts).

export interface ColumnDef {
  name: string;
  hint: string;
}

export interface ExtractRequest {
  images: { mimeType: string; data: string }[];
  columns: ColumnDef[];
  model?: string;
  extraInstructions?: string;
}

export interface ExtractResult {
  ok: boolean;
  status: number;
  body: Record<string, unknown>;
}

const ALLOWED_MODELS = new Set([
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
]);

function buildPrompt(columns: ColumnDef[], extraInstructions?: string): string {
  const fieldLines = columns
    .map((c) => `  "${c.name}": string${c.hint ? ` // ${c.hint}` : ''}`)
    .join(',\n');

  return `You are a professional OCR and data-extraction expert and multilingual translator.
Your task is to extract structured information from the provided image(s).

IMPORTANT — MULTIPLE RECORDS: The image may contain ONE record (e.g. a business card)
or MANY records (e.g. a table, list, or spreadsheet screenshot with many rows).
Extract EVERY record/row visible in the image, top to bottom. Do not skip any rows.
Do not invent rows that are not in the image.

LANGUAGE RULE: The image may contain text in Hindi, Gujarati, English, or a mix of languages.
Regardless of the language in the image, ALL values in the output JSON MUST be in English.
Translate any regional-language text accurately into English.

${extraInstructions ? `ADDITIONAL INSTRUCTIONS FROM THE USER:\n${extraInstructions}\n` : ''}
Return the data STRICTLY as a JSON array of objects — one object per record/row —
where every object has exactly these keys:
[
  {
${fieldLines}
  }
]

If a field is not found for a record (e.g. the cell shows "not found" or is empty),
use an empty string for that field. Even if there is only one record, return an array.
Do not include any markdown formatting or extra text, just the raw JSON array.`;
}

// Cached ADC client — reused across requests so we don't re-read credentials per image.
let cachedAuth: import('google-auth-library').GoogleAuth | null = null;

async function getAdcAuth(): Promise<{ token: string; project: string }> {
  const { GoogleAuth } = await import('google-auth-library');
  if (!cachedAuth) {
    cachedAuth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
  }
  const token = await cachedAuth.getAccessToken();
  if (!token) throw new Error('Could not obtain access token from Google login');
  const project =
    process.env.GOOGLE_CLOUD_PROJECT || (await cachedAuth.getProjectId());
  if (!project) {
    throw new Error(
      'No Google Cloud project found. Run: gcloud config set project YOUR_PROJECT_ID, then gcloud auth application-default login'
    );
  }
  return { token, project };
}

export async function runExtraction(req: ExtractRequest): Promise<ExtractResult> {
  const { images, columns, model, extraInstructions } = req;

  if (!images || !Array.isArray(images) || images.length === 0) {
    return { ok: false, status: 400, body: { error: 'Missing images array' } };
  }
  if (!columns || !Array.isArray(columns) || columns.length === 0) {
    return { ok: false, status: 400, body: { error: 'Missing columns definition' } };
  }

  const modelId = ALLOWED_MODELS.has(model || '') ? model! : 'gemini-2.5-flash-lite';

  // Auth resolution order:
  // 1. GEMINI_API_KEY (Google AI Studio) → generativelanguage endpoint
  // 2. VERTEX_API_KEY (Vertex express key) → aiplatform endpoint
  // 3. Application Default Credentials (gcloud auth application-default login) → Vertex AI
  const geminiKey = process.env.GEMINI_API_KEY;
  const vertexKey = process.env.VERTEX_API_KEY;

  let url: string;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (geminiKey) {
    url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${geminiKey}`;
  } else if (vertexKey) {
    url = `https://aiplatform.googleapis.com/v1/publishers/google/models/${modelId}:generateContent?key=${vertexKey}`;
  } else {
    try {
      const { token, project } = await getAdcAuth();
      url = `https://aiplatform.googleapis.com/v1/projects/${project}/locations/global/publishers/google/models/${modelId}:generateContent`;
      headers['Authorization'] = `Bearer ${token}`;
    } catch (err: any) {
      return {
        ok: false,
        status: 500,
        body: {
          error: `Google login not found. In a terminal run: gcloud auth application-default login — or set GEMINI_API_KEY in .env.local. (${err?.message || err})`,
        },
      };
    }
  }

  const payload = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: buildPrompt(columns, extraInstructions) },
          ...images.map((img) => ({
            inlineData: { mimeType: img.mimeType, data: img.data },
          })),
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 32768,
      responseMimeType: 'application/json',
    },
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData: any = await response.json().catch(() => ({}));
      return {
        ok: false,
        status: response.status,
        body: { error: errorData?.error?.message || `Gemini API error: ${response.status}` },
      };
    }

    const data: any = await response.json();
    const responseText: string = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!responseText) {
      return { ok: false, status: 502, body: { error: 'Empty response from AI model' } };
    }

    const cleanJson = responseText.replace(/```json|```/g, '').trim();
    let parsed: unknown;
    try {
      parsed = JSON.parse(cleanJson);
    } catch {
      // Last-resort: extract the outermost [ … ] or { … } block
      const aStart = cleanJson.indexOf('[');
      const aEnd = cleanJson.lastIndexOf(']');
      const oStart = cleanJson.indexOf('{');
      const oEnd = cleanJson.lastIndexOf('}');
      try {
        if (aStart !== -1 && aEnd > aStart) {
          parsed = JSON.parse(cleanJson.slice(aStart, aEnd + 1));
        } else if (oStart !== -1 && oEnd > oStart) {
          parsed = JSON.parse(cleanJson.slice(oStart, oEnd + 1));
        } else {
          return { ok: false, status: 502, body: { error: 'Model returned unparseable JSON' } };
        }
      } catch {
        return { ok: false, status: 502, body: { error: 'Model returned unparseable JSON' } };
      }
    }

    // The model may return an array (many records) or a single object — normalise to array
    const rawRows: Record<string, unknown>[] = Array.isArray(parsed)
      ? parsed.filter((r) => r && typeof r === 'object')
      : parsed && typeof parsed === 'object'
        ? [parsed as Record<string, unknown>]
        : [];

    // Normalise: ensure every requested column exists on every row, values as strings
    const rows = rawRows.map((raw) => {
      const row: Record<string, string> = {};
      for (const col of columns) {
        const v = raw[col.name];
        row[col.name] = v == null ? '' : typeof v === 'string' ? v : JSON.stringify(v);
      }
      return row;
    });
    return { ok: true, status: 200, body: { rows } };
  } catch (error: any) {
    return { ok: false, status: 500, body: { error: error?.message || 'Internal server error' } };
  }
}
