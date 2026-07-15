import React, { useState } from 'react';
import type { TableItem } from '../types';
import { API_BASE } from '../types';

interface ExportButtonProps {
  tables: TableItem[];
  disabled: boolean;
}

const ExportButton: React.FC<ExportButtonProps> = ({ tables, disabled }) => {
  const [exportingAll, setExportingAll] = useState(false);
  const [exportingIndividual, setExportingIndividual] = useState(false);

  const getSafeFilename = (name: string) => {
    // Loại bỏ ký tự đặc biệt không được làm tên file trên OS
    return name.trim().replace(/[/\\?%*:|"<>]/g, '_') + '.xlsx';
  };

  // Xuất 1 bảng duy nhất (gọi khi chỉ có 1 bảng)
  const exportSingleTable = async (table: TableItem, filename: string) => {
    setExportingAll(true);
    try {
      const response = await fetch(`${API_BASE}/export-excel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tables: [table] }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Export thất bại');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      alert('Lỗi xuất Excel: ' + error.message);
    } finally {
      setExportingAll(false);
    }
  };

  // Xuất gộp toàn bộ các bảng vào 1 file duy nhất (mỗi bảng là 1 sheet)
  const handleExportCombined = async () => {
    if (tables.length === 0) return;

    setExportingAll(true);
    try {
      const response = await fetch(`${API_BASE}/export-excel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tables }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Export thất bại');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'extracted_data_combined.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      alert('Lỗi xuất Excel gộp: ' + error.message);
    } finally {
      setExportingAll(false);
    }
  };

  // Xuất mỗi bảng thành một file Excel riêng lẻ và nén toàn bộ thành file ZIP
  const handleExportIndividualZip = async () => {
    if (tables.length === 0) return;

    setExportingIndividual(true);
    try {
      const response = await fetch(`${API_BASE}/export-excel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tables,
          options: { zip: true }
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Export ZIP thất bại');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'extracted_tables_individual.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      alert('Lỗi tải file ZIP: ' + error.message);
    } finally {
      setExportingIndividual(false);
    }
  };

  if (tables.length === 0) return null;

  // Nếu chỉ có 1 bảng duy nhất -> hiện nút Export đơn giản
  if (tables.length === 1) {
    const table = tables[0];
    const isExporting = exportingAll || exportingIndividual;
    return (
      <button
        className="btn btn-success"
        onClick={() => exportSingleTable(table, getSafeFilename(table.tableName || 'Table'))}
        disabled={disabled || isExporting}
      >
        {isExporting ? (
          <>
            <span className="progress-spinner" style={{ width: 18, height: 18, margin: 0, borderWidth: 2 }} />
            Đang xuất...
          </>
        ) : (
          <>📊 Xuất Excel</>
        )}
      </button>
    );
  }

  // Nếu có từ 2 bảng trở lên -> Hiện 2 nút lựa chọn (Gộp chung / File riêng lẻ dạng ZIP)
  return (
    <div style={{ display: 'flex', gap: '10px' }}>
      <button
        className="btn btn-success-outline"
        onClick={handleExportCombined}
        disabled={disabled || exportingAll || exportingIndividual}
      >
        {exportingAll ? (
          <>
            <span className="progress-spinner" style={{ width: 18, height: 18, margin: 0, borderWidth: 2 }} />
            Đang xuất gộp...
          </>
        ) : (
          <>📊 Xuất 1 File gộp (nhiều sheet)</>
        )}
      </button>
      
      <button
        className="btn btn-success"
        onClick={handleExportIndividualZip}
        disabled={disabled || exportingAll || exportingIndividual}
      >
        {exportingIndividual ? (
          <>
            <span className="progress-spinner" style={{ width: 18, height: 18, margin: 0, borderWidth: 2 }} />
            Đang tạo ZIP...
          </>
        ) : (
          <>🗂️ Xuất File ZIP (các bảng riêng)</>
        )}
      </button>
    </div>
  );
};

export default ExportButton;
