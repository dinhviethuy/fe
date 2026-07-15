export const API_BASE = 'http://localhost:3000';

export interface MergeRange {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

export interface TableItem {
  tableName?: string;
  headers: string[][] | string[];
  rows: string[][];
  merges?: MergeRange[];
  headerRows?: number[];
}

export function normalizeHeaders(headers: any): string[][] {
  if (!headers) return [];
  if (Array.isArray(headers)) {
    if (headers.length === 0) return [];
    if (Array.isArray(headers[0])) {
      return headers as string[][];
    } else {
      return [headers as string[]];
    }
  }
  return [];
}

export function getTableColCount(table: TableItem): number {
  const norm = normalizeHeaders(table.headers);
  if (norm && norm.length > 0 && norm[0]) {
    return norm[0].length;
  }
  if (table.rows && table.rows.length > 0 && table.rows[0]) {
    return table.rows[0].length;
  }
  return 0;
}

export interface ExtractedTableData {
  hasTable: boolean;
  tables?: TableItem[];
  errors?: string[];
}

export interface FileInfo {
  filename: string;
  originalName: string;
  mimeType: string;
  previewUrl: string;
}

export interface ExtractResponse {
  success: boolean;
  data: ExtractedTableData;
  file?: FileInfo;
  files?: FileInfo[];
  error?: string;
}

export function flattenTable(table: TableItem): TableItem {
  const norm = normalizeHeaders(table.headers);
  const combinedRows = [...norm, ...table.rows];
  const headerRows = table.headerRows || [];
  return {
    ...table,
    headers: [],
    rows: combinedRows,
    headerRows
  };
}

function findBodyStartRowIndex(rows: any[]): number {
  for (let r_idx = 0; r_idx < rows.length; r_idx++) {
    const row = rows[r_idx];
    let numericCells = 0;
    const cells = row.cells || [];
    let populatedCells = 0;
    
    for (const cell of cells) {
      const txt = (cell.text || "").trim();
      if (txt) {
        populatedCells++;
        const cleaned = txt.replace(/[\.,\$\-]/g, "").trim();
        if (cleaned && /^\d+$/.test(cleaned)) {
          numericCells++;
        }
      }
    }
    
    if (populatedCells > 0 && (numericCells / populatedCells) >= 0.5) {
      return r_idx;
    }
  }
  return 0;
}

export function mapFastAPIPagesToTableItems(pages: any[], filename: string): TableItem[] {
  const tableItems: TableItem[] = [];
  if (!pages) return tableItems;

  for (const page of pages) {
    const pageNum = page.pageNumber !== undefined ? page.pageNumber : page.page_number;
    const tables = page.tables || [];
    for (const tbl of tables) {
      const tblIdx = tbl.tableIndex !== undefined ? tbl.tableIndex : tbl.table_index;
      const rows = tbl.rows || [];
      if (rows.length === 0) continue;

      let maxCol = 0;
      for (const r of rows) {
        const cells = r.cells || [];
        for (const c of cells) {
          const colIndex = c.colIndex !== undefined ? c.colIndex : c.col_index;
          if (colIndex > maxCol) {
            maxCol = colIndex;
          }
        }
      }
      const colCount = maxCol + 1;

      const gridRows: string[][] = Array.from({ length: rows.length }, () =>
        Array(colCount).fill("")
      );

      const merges: MergeRange[] = [];

      for (const r of rows) {
        const r_idx = r.rowIndex !== undefined ? r.rowIndex : r.row_index;
        const cells = r.cells || [];
        for (const cell of cells) {
          const c_idx = cell.colIndex !== undefined ? cell.colIndex : cell.col_index;
          const text = cell.text || "";
          const col_span = cell.colSpan !== undefined ? cell.colSpan : (cell.col_span || 1);
          const row_span = cell.rowSpan !== undefined ? cell.rowSpan : (cell.row_span || 1);

          if (r_idx < gridRows.length && c_idx < colCount) {
            gridRows[r_idx][c_idx] = text;
          }

          if (col_span > 1 || row_span > 1) {
            merges.push({
              startRow: r_idx,
              startCol: c_idx,
              endRow: r_idx + row_span - 1,
              endCol: c_idx + col_span - 1
            });
          }
        }
      }

      const bodyStartIdx = findBodyStartRowIndex(rows);
      const headers = gridRows.slice(0, bodyStartIdx);
      const dataRows = gridRows.slice(bodyStartIdx);

      const headerRows: number[] = [];
      for (let i = 0; i < bodyStartIdx; i++) {
        headerRows.push(i);
      }

      tableItems.push({
        tableName: `Bảng (${filename} - Trang ${pageNum} - Bảng ${tblIdx})`,
        headers: headers,
        rows: dataRows,
        merges: merges,
        headerRows: headerRows
      });
    }
  }

  return tableItems;
}

export interface OcrPage {
  pageNumber: number;
  text: string;
  confidence: number;
}

export interface OcrFile {
  fileIndex: number;
  jobId: string;
  fileName: string;
  status: 'waiting' | 'active' | 'completed' | 'failed' | 'processing';
  totalPages: number;
  completedPages: number;
  pages: OcrPage[];
  failedReason?: string;
}

export interface OcrBatch {
  batchId: string;
  status: 'waiting' | 'processing' | 'completed' | 'failed';
  totalFiles: number;
  completedFiles: number;
  files: OcrFile[];
}

export interface TableFile {
  fileIndex: number;
  jobId: string;
  fileName: string;
  status: 'waiting' | 'active' | 'completed' | 'failed' | 'processing';
  totalPages: number;
  completedPages: number;
  pages: any[];
  tablePageNumbers?: number[];
  failedReason?: string;
}

export interface TableBatch {
  batchId: string;
  status: 'waiting' | 'processing' | 'completed' | 'failed';
  totalFiles: number;
  completedFiles: number;
  files: TableFile[];
}


