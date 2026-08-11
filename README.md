# VisionScrape — AI Image → Spreadsheet

Turn screenshots and photos into clean spreadsheets. Drop hundreds of images —
CRM/lead-list screenshots, tables, business cards — define the columns you want,
and Gemini extracts **every row from every image** into an editable table you can
export as **.xlsx** or **.csv**.

Built with React + Vite + TypeScript. Runs locally with `npm run dev` or deploys
to Vercel as-is. Your API credentials stay server-side and are never shipped to
the browser.

## Modules

| Module | Status |
|---|---|
| **Leads Scraper** — extract every row from table/list screenshots (CRM exports, Leadfeeder, directories…) | ✅ Available |
| Business Card Extractor — one contact per card image | 🔜 Planned |
| Brochure / Catalog Scraper — products & prices | 🔜 Planned |
| Invoice / Bill Scraper — line items | 🔜 Planned |

New modules plug into `src/modules.ts` + a component in `App.tsx` — the sidebar,
extraction engine, and export pipeline are shared.

## Features

- **Custom columns** — name each spreadsheet column and give the AI a hint of what
  to extract. Setup persists between sessions.
- **Multi-row extraction** — one screenshot with 25 table rows becomes 25
  spreadsheet rows. Single-record images (cards) work too.
- **Batch processing** — drop 300 images at once; processed 4 at a time with
  automatic retry/backoff on rate limits. Stop anytime; only pending/failed
  images are reprocessed.
- **Multilingual** — Hindi/Gujarati/English (and more) translated to English.
- **Editable results** — fix any cell inline before exporting; zoom any source image.
- **Export** — `.xlsx` or `.csv` (UTF-8 with BOM, Excel-safe), with a File Name
  column tracing every row back to its image.
- **Cost-efficient** — images are downscaled client-side (max 2600px) before upload.

## Quick start

```bash
git clone <your-repo-url>
cd <repo>
npm install
cp .env.example .env.local   # add ONE credential (see below)
npm run dev                  # → http://localhost:5173
```

## Authentication — pick ONE

The backend resolves credentials in this order:

| Priority | Method | Env var | Where to get it |
|---|---|---|---|
| 1 | **Google AI Studio API key** (easiest, free tier) | `GEMINI_API_KEY` | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| 2 | **Vertex AI express key** | `VERTEX_API_KEY` | Google Cloud Console → Vertex AI |
| 3 | **Google login (ADC)** — no key at all, local use | `GOOGLE_CLOUD_PROJECT` (optional) | see below |

**Option 1 & 2:** put the key in `.env.local`. Done.

**Option 3 (no API key, local only):** requires the [gcloud CLI](https://cloud.google.com/sdk/docs/install)
and a GCP project with the Vertex AI API enabled and billing active:

```bash
gcloud auth application-default login
gcloud config set project YOUR_PROJECT_ID     # or set GOOGLE_CLOUD_PROJECT in .env.local
gcloud services enable aiplatform.googleapis.com
```

### Models

Selectable in the UI: `gemini-2.5-flash-lite` (default — fastest/cheapest),
`gemini-2.5-flash` (better on messy images), `gemini-2.5-pro` (best quality).
To add or change models, edit `MODELS` in [src/lib/types.ts](src/lib/types.ts)
and `ALLOWED_MODELS` in [api/_lib/extract-core.ts](api/_lib/extract-core.ts).

Using a different provider (OpenAI, Claude, etc.)? All extraction logic lives in
one function — `runExtraction()` in [api/_lib/extract-core.ts](api/_lib/extract-core.ts).
Swap the HTTP call there and everything else (UI, batching, export) keeps working.

## Deploying to Vercel

1. Push this repo to GitHub and import it in [Vercel](https://vercel.com) —
   the Vite frontend and the `api/extract.ts` serverless function are detected
   automatically, no config needed.
2. In Project Settings → Environment Variables, set `GEMINI_API_KEY`
   (or `VERTEX_API_KEY`).

> Note: the Google-login (ADC) option is for local development only — hosted
> deployments should use an API key.

Any other Node host works too: build with `npm run build`, serve `dist/`, and
provide a POST `/api/extract` endpoint that calls `runExtraction()` (see
[vite.config.ts](vite.config.ts) for a reference middleware implementation).

## Usage tips

- **Table screenshots:** capture full rows (a half-cut row at the edge may be
  skipped). Overlapping consecutive screenshots is fine — dedupe in Excel after.
- **Extra Instructions** box: tell the AI about your images, e.g.
  *"CRM contact-list screenshots. Extract every visible row. If a cell shows
  'not found', return an empty string."*
- **Spot-check first:** process ~10 images on Flash Lite, check the table, then
  switch to Flash if accuracy needs a bump.
- **Export before closing the tab** — extracted rows live in browser memory.
  Column setup and instructions persist; rows do not.

## Architecture

```
src/
  App.tsx                    module switcher
  modules.ts                 module registry (add new modules here)
  components/
    AppSidebar.tsx           left navigation
    LeadsScraper.tsx         the Leads Scraper module
    Dropzone.tsx, ColumnEditor.tsx, ResultsTable.tsx
  lib/
    api.ts                   client → /api/extract, image downscaling, retry/backoff
    export.ts                .xlsx / .csv export (SheetJS)
    types.ts                 shared types, default columns, model list
api/
  extract.ts                 Vercel serverless function (production)
  _lib/extract-core.ts       ALL extraction logic: auth resolution, prompt, parsing
vite.config.ts               dev server + local /api/extract middleware (no Vercel CLI needed)
```

## License

MIT — see [LICENSE](LICENSE).
