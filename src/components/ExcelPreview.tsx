import React from 'react';
import type { TableItem } from '../types';
import { getTableColCount } from '../types';

interface ExcelPreviewProps {
  tables: TableItem[];
}

const ExcelPreview: React.FC<ExcelPreviewProps> = ({ tables }) => {
  if (tables.length === 0) {
    return null;
  }

  return (
    <div className="excel-preview-container">
      {tables.map((table, tableIndex) => {
        const colCount = getTableColCount(table);
        const R_total = table.rows.length;
        const C_total = colCount;

        // Xây dựng mergeMap cho toàn bộ lưới hàng
        const mergeMap = Array.from({ length: R_total }, () =>
          Array.from({ length: C_total }, () => ({
            rowspan: 1,
            colspan: 1,
            isHidden: false,
          }))
        );

        if (table.merges) {
          table.merges.forEach((merge) => {
            const { startRow, startCol, endRow, endCol } = merge;
            if (
              startRow >= 0 && startRow < R_total &&
              endRow >= 0 && endRow < R_total &&
              startCol >= 0 && startCol < C_total &&
              endCol >= 0 && endCol < C_total
            ) {
              for (let r = startRow; r <= endRow; r++) {
                for (let c = startCol; c <= endCol; c++) {
                  if (r === startRow && c === startCol) {
                    mergeMap[r][c].rowspan = endRow - startRow + 1;
                    mergeMap[r][c].colspan = endCol - startCol + 1;
                  } else {
                    mergeMap[r][c].isHidden = true;
                  }
                }
              }
            }
          });
        }

        return (
          <div key={tableIndex} className="excel-sheet-group">
            <div className="excel-sheet-title">
              <span>📊</span>
              <h4>{table.tableName || `Bảng ${tableIndex + 1}`}</h4>
            </div>

            <div className="excel-grid-container">
              <table className="excel-grid">
                <thead>
                  {/* Dòng chữ cái cột A, B, C... */}
                  <tr className="excel-col-header-row">
                    <th className="excel-corner-cell"></th>
                    {Array.from({ length: C_total }).map((_, colIndex) => (
                      <th key={colIndex} className="excel-col-header">
                        {getColumnLetter(colIndex)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Hiển thị toàn bộ các dòng theo thứ tự tự nhiên */}
                  {table.rows.map((row, rowIndex) => {
                    const isHeader = !!(table.headerRows?.includes(rowIndex));
                    return (
                      <tr key={rowIndex} className={isHeader ? "excel-header-row" : "excel-data-row"}>
                        <td className="excel-row-number">{rowIndex + 1}</td>
                        {row.map((cell, colIndex) => {
                          const mergeInfo = mergeMap[rowIndex]?.[colIndex] || { rowspan: 1, colspan: 1, isHidden: false };
                          if (mergeInfo.isHidden) return null;
                          return (
                            <td
                              key={colIndex}
                              className={isHeader ? "excel-header-cell" : "excel-cell"}
                              rowSpan={mergeInfo.rowspan}
                              colSpan={mergeInfo.colspan}
                              style={isHeader ? {
                                color: 'var(--accent-blue-light)',
                                fontWeight: '600',
                                textAlign: 'center',
                                backgroundColor: 'rgba(74, 108, 247, 0.06)'
                              } : undefined}
                            >
                              {cell}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="excel-status-bar">
              <span>Hàng: {table.rows.length}</span>
              <span>Cột: {colCount}</span>
              <span>Ô: {table.rows.length * colCount}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

function getColumnLetter(index: number): string {
  let result = '';
  let n = index;
  while (n >= 0) {
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26) - 1;
  }
  return result;
}

export default ExcelPreview;
