export interface ColumnDef {
  name: string;
  hint: string;
}

export type ImageStatus = 'pending' | 'processing' | 'completed' | 'error';

export interface ImageItem {
  id: string;
  file: File;
  name: string;
  url: string; // object URL for preview
  status: ImageStatus;
  rows?: Record<string, string>[]; // one image can contain many records (table screenshots)
  error?: string;
}

export const DEFAULT_COLUMNS: ColumnDef[] = [
  { name: 'Company Name', hint: 'The business/company name' },
  { name: 'Person Name', hint: 'Name of the individual person' },
  { name: 'Mobile Number', hint: 'Mobile/phone number(s), comma-separated if multiple' },
  { name: 'Email', hint: 'Email address(es)' },
  { name: 'Website', hint: 'Website URL' },
  { name: 'Address', hint: 'Full postal address' },
];

export const MODELS = [
  { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite (fastest, cheapest)' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (balanced)' },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (best quality)' },
];
