import type { VercelRequest, VercelResponse } from '@vercel/node';
import { runExtraction } from './_lib/extract-core';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const result = await runExtraction(req.body);
  return res.status(result.status).json(result.body);
}
