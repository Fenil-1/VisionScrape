import type { LucideIcon } from 'lucide-react';
import { Table2, Contact, BookOpen, ReceiptText, AudioLines } from 'lucide-react';

export interface ModuleDef {
  id: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  available: boolean;
}

// To add a new module: add an entry here, then render its component
// in the switch inside App.tsx.
export const MODULES: ModuleDef[] = [
  {
    id: 'leads-scraper',
    title: 'Leads Scraper',
    subtitle: 'Extract every row from table & list screenshots',
    icon: Table2,
    available: true,
  },
  {
    id: 'audio-transcription',
    title: 'Audio Transcription',
    subtitle: 'English audio (.aac & more) → timestamped text',
    icon: AudioLines,
    available: true,
  },
  {
    id: 'business-cards',
    title: 'Business Card Extractor',
    subtitle: 'One contact per card image',
    icon: Contact,
    available: false,
  },
  {
    id: 'brochure-scraper',
    title: 'Brochure / Catalog Scraper',
    subtitle: 'Products & prices from brochures',
    icon: BookOpen,
    available: false,
  },
  {
    id: 'invoice-scraper',
    title: 'Invoice / Bill Scraper',
    subtitle: 'Line items from invoices & receipts',
    icon: ReceiptText,
    available: false,
  },
];
