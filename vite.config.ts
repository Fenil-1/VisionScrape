import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

// Local dev API middleware — serves POST /api/extract without needing the Vercel CLI.
// In production (Vercel), api/extract.ts handles the same route.
function localApiPlugin(): Plugin {
  return {
    name: 'local-api',
    configureServer(server) {
      server.middlewares.use('/api/extract', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }
        try {
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          const { runExtraction } = await import('./api/_lib/extract-core');
          const result = await runExtraction(body);
          res.statusCode = result.status;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(result.body));
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err?.message || 'Internal server error' }));
        }
      });
    },
  };
}

// Starts the local Whisper service (transcribe/server.py) alongside the dev server.
// Setup once: python3 -m venv transcribe/.venv && transcribe/.venv/bin/pip install -r transcribe/requirements.txt
function transcribeServerPlugin(): Plugin {
  return {
    name: 'transcribe-server',
    configureServer(server) {
      const python = 'transcribe/.venv/bin/python';
      if (!existsSync(python)) {
        server.config.logger.warn('[transcribe] venv missing — audio transcription disabled (see README)');
        return;
      }
      const child = spawn(python, ['transcribe/server.py'], { stdio: 'inherit' });
      const stop = () => child.kill();
      server.httpServer?.on('close', stop);
      process.on('exit', stop);
    },
  };
}

export default defineConfig(({ mode }) => {
  // Load .env.local / .env into process.env so extract-core can read the API key
  const env = loadEnv(mode, process.cwd(), '');
  if (env.GEMINI_API_KEY) process.env.GEMINI_API_KEY = env.GEMINI_API_KEY;
  if (env.VERTEX_API_KEY) process.env.VERTEX_API_KEY = env.VERTEX_API_KEY;
  if (env.GOOGLE_CLOUD_PROJECT) process.env.GOOGLE_CLOUD_PROJECT = env.GOOGLE_CLOUD_PROJECT;

  return {
    plugins: [react(), localApiPlugin(), transcribeServerPlugin()],
    server: {
      // Whisper on CPU can take minutes for long recordings — don't time the proxy out
      proxy: {
        '/api/transcribe': {
          target: 'http://127.0.0.1:8787',
          timeout: 0,
          proxyTimeout: 0,
          rewrite: () => '/transcribe',
        },
      },
    },
  };
});
