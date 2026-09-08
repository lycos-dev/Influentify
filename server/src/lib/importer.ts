import ExcelJS from 'exceljs';
import { normalizeInstagramHandle } from './handles.js';

const HEADER_HINTS = ['instagram', 'ig', 'handle', 'username', 'social', 'profile', 'link'];

function extractFromText(text: string) {
  const handles = new Set<string>();
  const urlRegex = /(?:https?:\/\/)?(?:www\.)?instagram\.com\/([a-zA-Z0-9._]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = urlRegex.exec(text)) !== null) {
    const h = normalizeInstagramHandle(match[1]);
    if (h) handles.add(h);
  }

  // Also catch @handles in pasted markdown / CSV text.
  const atRegex = /(?:^|[\s|,;])@([a-zA-Z0-9._]{1,30})(?=$|[\s|,;])/g;
  while ((match = atRegex.exec(text)) !== null) {
    const h = normalizeInstagramHandle(match[1]);
    if (h) handles.add(h);
  }
  return handles;
}

export async function extractInstagramHandles(buffer: Buffer, filename = ''): Promise<string[]> {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.csv') || lower.endsWith('.txt') || lower.endsWith('.md')) {
    return [...extractFromText(buffer.toString('utf8'))];
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as any);
  const handles = new Set<string>();

  for (const sheet of wb.worksheets) {
    const hintedColumns = new Set<number>();
    const firstRows = Math.min(sheet.rowCount, 6);
    for (let r = 1; r <= firstRows; r++) {
      sheet.getRow(r).eachCell((cell, col) => {
        const text = String(cell.text ?? '').trim().toLowerCase();
        if (HEADER_HINTS.some(h => text.includes(h))) hintedColumns.add(col);
      });
    }

    sheet.eachRow(row => {
      row.eachCell((cell, col) => {
        const text = String(cell.text ?? '').trim();
        if (!text) return;
        const urlMatch = text.match(/(?:https?:\/\/)?(?:www\.)?instagram\.com\/([a-zA-Z0-9._]+)/i);
        if (urlMatch) {
          const h = normalizeInstagramHandle(urlMatch[1]);
          if (h) handles.add(h);
          return;
        }
        if (hintedColumns.has(col)) {
          const h = normalizeInstagramHandle(text);
          if (h) handles.add(h);
        }
      });
    });
  }

  return [...handles];
}
