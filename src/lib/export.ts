import * as XLSX from 'xlsx';
import type { ColumnDef, ImageItem } from './types';

function buildRows(items: ImageItem[], columns: ColumnDef[]) {
  return items
    .filter((it) => it.status === 'completed' && it.rows)
    .flatMap((it) =>
      it.rows!.map((r) => {
        const row: Record<string, string> = { 'File Name': it.name };
        for (const col of columns) row[col.name] = r[col.name] ?? '';
        return row;
      })
    );
}

export function exportToExcel(items: ImageItem[], columns: ColumnDef[]) {
  const rows = buildRows(items, columns);
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Extracted Data');
  XLSX.writeFile(workbook, `ocr_export_${new Date().toISOString().split('T')[0]}.xlsx`);
}

export function exportToCsv(items: ImageItem[], columns: ColumnDef[]) {
  const rows = buildRows(items, columns);
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(worksheet);
  // BOM so Excel opens UTF-8 CSVs correctly
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ocr_export_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
