import React, { useState, useEffect } from 'react';
import type { TableBatch, TableFile, TableItem } from '../types';
import { API_BASE, mapFastAPIPagesToTableItems, flattenTable } from '../types';
import TableEditor from './TableEditor';
import ExcelPreview from './ExcelPreview';

interface TableWorkspaceProps {
  batchId: string;
  onReset: () => void;
  showToast: (message: string, type: 'success' | 'error') => void;
}

const TableWorkspace: React.FC<TableWorkspaceProps> = ({ batchId, onReset, showToast }) => {
  const [batch, setBatch] = useState<TableBatch | null>(null);
  const [selectedFileIndex, setSelectedFileIndex] = useState<number | null>(null);
  const [currentPageNum, setCurrentPageNum] = useState<number>(1);
  
  // Cache of page tables: Map<`${fileIndex}-${pageNum}`, TableItem[]>
  const [pageCache, setPageCache] = useState<Record<string, TableItem[]>>({});
  const [isPageLoading, setIsPageLoading] = useState(false);
  const [exportingType, setExportingType] = useState<'combined' | 'zip' | null>(null);

  // 1. Fetch initial status and listen to SSE stream
  useEffect(() => {
    const fetchInitialBatchStatus = async () => {
      try {
        const response = await fetch(`${API_BASE}/extract-tables/${batchId}`);
        if (!response.ok) throw new Error('Không thể tải trạng thái trích xuất');
        const resData = await response.json();
        const batchData: TableBatch = resData.data;
        setBatch(batchData);
      } catch (err: any) {
        showToast(err.message, 'error');
      }
    };

    fetchInitialBatchStatus();

    // Thiết lập EventSource lắng nghe tiến độ từ server
    const eventSource = new EventSource(`${API_BASE}/extract-tables/${batchId}/stream`);

    eventSource.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'progress') {
          setBatch((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              files: prev.files.map((f: TableFile) =>
                f.fileIndex === data.fileIndex
                  ? {
                      ...f,
                      completedPages: data.completed,
                      totalPages: data.total,
                      status: data.status,
                    }
                  : f
              ),
            };
          });
        } else if (data.type === 'file_done' || data.type === 'file_failed' || data.type === 'batch_done') {
          // Khi hoàn tất 1 file hoặc hoàn tất cả lô, fetch lại dữ liệu đầy đủ 1 lần để đồng bộ tablePageNumbers
          const response = await fetch(`${API_BASE}/extract-tables/${batchId}`);
          if (response.ok) {
            const resData = await response.json();
            setBatch(resData.data);
          }
          if (data.type === 'batch_done') {
            eventSource.close();
          }
        }
      } catch (err) {
        console.error('Lỗi khi phân tích dữ liệu SSE:', err);
      }
    };

    eventSource.onerror = (err) => {
      console.warn('Lỗi hoặc kết nối SSE bị ngắt, trình duyệt sẽ tự động kết nối lại:', err);
    };

    return () => {
      eventSource.close();
    };
  }, [batchId]);

  // Auto-select first file if nothing is selected yet
  useEffect(() => {
    if (selectedFileIndex === null && batch && batch.files.length > 0) {
      setSelectedFileIndex(0);
    }
  }, [batch, selectedFileIndex]);

  const selectedFile = selectedFileIndex !== null ? batch?.files.find((f: TableFile) => f.fileIndex === selectedFileIndex) : null;
  const pageNumbers = selectedFile?.tablePageNumbers || [];
  const actualPageNum = pageNumbers[currentPageNum - 1] || 0;

  // 2. Fetch page tables when file or page changes
  useEffect(() => {
    if (selectedFileIndex === null || !selectedFile || selectedFile.status !== 'completed' || pageNumbers.length === 0) {
      return;
    }

    if (!actualPageNum) return;

    const cacheKey = `${selectedFileIndex}-${actualPageNum}`;
    
    if (pageCache[cacheKey]) {
      return;
    }

    const fetchPageDetail = async () => {
      setIsPageLoading(true);
      try {
        const response = await fetch(`${API_BASE}/extract-tables/${batchId}/files/${selectedFileIndex}/pages/${actualPageNum}`);
        if (!response.ok) throw new Error('Lỗi khi tải bảng dữ liệu của trang');
        const resData = await response.json();
        const pageData = resData.data;

        // Map backend page tables to frontend TableItems
        const fileTables = mapFastAPIPagesToTableItems([pageData], selectedFile.fileName);
        const flattened = fileTables.map(flattenTable);

        setPageCache(prev => ({
          ...prev,
          [cacheKey]: flattened
        }));
      } catch (err: any) {
        showToast(err.message, 'error');
      } finally {
        setIsPageLoading(false);
      }
    };

    fetchPageDetail();
  }, [selectedFileIndex, currentPageNum, selectedFile?.status, actualPageNum]);

  const handleFileSelect = (index: number) => {
    setSelectedFileIndex(index);
    setCurrentPageNum(1);
  };

  const currentCacheKey = `${selectedFileIndex}-${actualPageNum}`;
  const currentTables = pageCache[currentCacheKey] || [];

  const handleTablesChange = (newTables: TableItem[]) => {
    setPageCache(prev => ({
      ...prev,
      [currentCacheKey]: newTables
    }));
  };

  // 3. Compile tables for export (fetch only pages in tablePageNumbers list on-demand)
  const compileAllTablesForExport = async (): Promise<TableItem[]> => {
    if (!selectedFile || pageNumbers.length === 0) return [];
    
    const allTables: TableItem[] = [];
    
    for (const p of pageNumbers) {
      const cacheKey = `${selectedFileIndex}-${p}`;
      if (pageCache[cacheKey]) {
        allTables.push(...pageCache[cacheKey]);
      } else {
        const response = await fetch(`${API_BASE}/extract-tables/${batchId}/files/${selectedFileIndex}/pages/${p}`);
        if (!response.ok) throw new Error(`Lỗi tải bảng trang ${p}`);
        const resData = await response.json();
        const pageTables = mapFastAPIPagesToTableItems([resData.data], selectedFile.fileName);
        allTables.push(...pageTables.map(flattenTable));
      }
    }
    
    return allTables;
  };

  const handleExportCombined = async () => {
    if (!selectedFile) return;
    setExportingType('combined');
    showToast('Đang tải danh sách bảng toàn bộ các trang...', 'success');

    try {
      const tables = await compileAllTablesForExport();
      if (tables.length === 0) {
        showToast('Không có bảng nào để xuất', 'error');
        return;
      }

      const response = await fetch(`${API_BASE}/export-excel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tables }),
      });

      if (!response.ok) throw new Error('Export Excel thất bại');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedFile.fileName.split('.')[0]}_combined.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      showToast('Đã tải xuống file Excel thành công', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setExportingType(null);
    }
  };

  const handleExportIndividualZip = async () => {
    if (!selectedFile) return;
    setExportingType('zip');
    showToast('Đang tải danh sách bảng toàn bộ các trang...', 'success');

    try {
      const tables = await compileAllTablesForExport();
      if (tables.length === 0) {
        showToast('Không có bảng nào để xuất', 'error');
        return;
      }

      const response = await fetch(`${API_BASE}/export-excel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tables,
          options: { zip: true }
        }),
      });

      if (!response.ok) throw new Error('Export ZIP thất bại');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedFile.fileName.split('.')[0]}_individual.zip`;
      a.click();
      window.URL.revokeObjectURL(url);
      showToast('Đã tải xuống file ZIP thành công', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setExportingType(null);
    }
  };

  const handleCancelJob = async () => {
    if (!selectedFile) return;
    try {
      const response = await fetch(`${API_BASE}/jobs/${selectedFile.jobId}/cancel`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Không thể gửi yêu cầu huỷ tác vụ');
      showToast('Đã gửi yêu cầu huỷ tác vụ', 'success');
      
      setBatch(prev => {
        if (!prev) return null;
        return {
          ...prev,
          files: prev.files.map(f => f.jobId === selectedFile.jobId ? { ...f, status: 'failed', failedReason: 'Huỷ bởi người dùng' } : f)
        };
      });
    } catch (err: any) {
      showToast('Lỗi huỷ tác vụ: ' + err.message, 'error');
    }
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return '📄';
    if (['doc', 'docx'].includes(ext || '')) return '📝';
    return '🖼️';
  };

  return (
    <div className="workspace table-workspace" style={{ display: 'flex', height: 'calc(100vh - 140px)', gap: '16px', padding: '16px' }}>
      {/* Left panel: File list */}
      <div className="workspace-panel file-list-panel" style={{ flex: '1', maxWidth: '350px', display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)' }}>
        <div className="panel-header" style={{ padding: '16px', borderBottom: '1px solid var(--border-glass)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '16px' }}>📁 Danh sách tệp</h3>
          <span className="panel-header-badge">{batch?.files.length || 0} tệp</span>
        </div>
        <div className="panel-content" style={{ flex: '1', overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {batch?.files.map((file: TableFile, idx: number) => {
            const isSelected = selectedFileIndex === idx;
            const progressPct = file.totalPages > 0 ? Math.round((file.completedPages / file.totalPages) * 100) : 0;
            
            return (
              <div
                key={file.fileIndex}
                onClick={() => handleFileSelect(idx)}
                style={{
                  padding: '12px',
                  borderRadius: 'var(--radius-sm)',
                  border: isSelected ? '1px solid var(--accent-primary)' : '1px solid rgba(255,255,255,0.05)',
                  background: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'rgba(255,255,255,0.02)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  textAlign: 'left'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span>{getFileIcon(file.fileName)}</span>
                  <div style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '14px', fontWeight: isSelected ? '600' : '400' }} title={file.fileName}>
                    {file.fileName}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  <span>Trang: {file.completedPages}/{file.totalPages || '?'}</span>
                  <span>
                    {file.status === 'completed' && <span style={{ color: '#10b981' }}>✓ Xong</span>}
                    {file.status === 'active' && <span style={{ color: '#3b82f6' }}>⚡ Đang trích xuất ({progressPct}%)</span>}
                    {file.status === 'waiting' && <span style={{ color: '#9ca3af' }}>⏳ Hàng đợi</span>}
                    {file.status === 'failed' && <span style={{ color: '#ef4444' }}>❌ Lỗi</span>}
                  </span>
                </div>

                {file.status === 'active' && (
                  <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', marginTop: '6px', overflow: 'hidden' }}>
                    <div style={{ width: `${progressPct}%`, height: '100%', background: '#3b82f6', borderRadius: '2px' }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div style={{ padding: '16px', borderTop: '1px solid var(--border-glass)' }}>
          <button className="btn btn-ghost" onClick={onReset} style={{ width: '100%' }}>
            ↩️ Upload tệp mới
          </button>
        </div>
      </div>

      {/* Right panel: Table editor & Excel preview */}
      <div className="workspace-panel review-panel" style={{ flex: '3', display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)' }}>
        {selectedFile ? (
          <>
            <div className="panel-header" style={{ padding: '16px', borderBottom: '1px solid var(--border-glass)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ textAlign: 'left' }}>
                <h3 style={{ margin: 0, fontSize: '16px' }}>📝 Chỉnh sửa & Excel Preview</h3>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>File: {selectedFile.fileName}</span>
              </div>
              {selectedFile.status === 'completed' && pageNumbers.length > 0 && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    className="btn btn-success-outline" 
                    onClick={handleExportCombined} 
                    disabled={exportingType !== null}
                    style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    {exportingType === 'combined' && <span className="progress-spinner" style={{ width: 14, height: 14, margin: 0, borderWidth: 2 }} />}
                    📊 Xuất 1 File Excel (nhiều sheet)
                  </button>
                  <button 
                    className="btn btn-success" 
                    onClick={handleExportIndividualZip} 
                    disabled={exportingType !== null}
                    style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    {exportingType === 'zip' && <span className="progress-spinner" style={{ width: 14, height: 14, margin: 0, borderWidth: 2 }} />}
                    🗂️ Xuất File ZIP (bảng riêng)
                  </button>
                </div>
              )}
            </div>

            <div className="panel-content" style={{ flex: '1', display: 'flex', flexDirection: 'column', padding: '16px', overflow: 'hidden' }}>
              {selectedFile.status === 'completed' ? (
                pageNumbers.length > 0 ? (
                  <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '12px', height: '100%' }}>
                    {/* Pagination control */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          className="btn btn-ghost"
                          disabled={currentPageNum === 1 || isPageLoading}
                          onClick={() => setCurrentPageNum(prev => Math.max(prev - 1, 1))}
                          style={{ padding: '4px 12px', height: '32px' }}
                        >
                          ◀ Trang trước
                        </button>
                        <button
                          className="btn btn-ghost"
                          disabled={currentPageNum === pageNumbers.length || isPageLoading}
                          onClick={() => setCurrentPageNum(prev => Math.min(prev + 1, pageNumbers.length))}
                          style={{ padding: '4px 12px', height: '32px' }}
                        >
                          Trang sau ▶
                        </button>
                      </div>

                      <span style={{ fontSize: '14px', fontWeight: '500' }}>
                        Trang {currentPageNum} / {pageNumbers.length} (Trang gốc: {actualPageNum})
                      </span>

                      <span className="panel-header-badge">
                        {currentTables.length} bảng ở trang này
                      </span>
                    </div>

                    {/* Table workspace splitter */}
                    <div style={{ flex: '1', display: 'flex', gap: '16px', height: 'calc(100% - 60px)', position: 'relative' }}>
                      {isPageLoading ? (
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: 'rgba(0,0,0,0.5)', zIndex: 10 }}>
                          <div className="progress-spinner" style={{ width: '32px', height: '32px', marginBottom: '8px' }} />
                          <span>Đang tải bảng của trang...</span>
                        </div>
                      ) : null}
                      
                      {/* Left: Table Editor */}
                      <div style={{ flex: '1', overflowY: 'auto', background: 'rgba(0,0,0,0.1)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', padding: '12px' }}>
                        {currentTables.length > 0 ? (
                          <TableEditor tables={currentTables} onTablesChange={handleTablesChange} />
                        ) : (
                          <div className="empty-state" style={{ height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                            <p>Không tìm thấy bảng biểu tại trang này</p>
                          </div>
                        )}
                      </div>

                      {/* Right: Excel Preview */}
                      <div style={{ flex: '1', overflowY: 'auto', background: 'rgba(0,0,0,0.1)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', padding: '12px' }}>
                        <ExcelPreview tables={currentTables} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="empty-state" style={{ margin: 'auto' }}>
                    <div className="empty-state-icon">📋</div>
                    <h3>Không có dữ liệu bảng</h3>
                    <p>Tài liệu quét thành công nhưng không phát hiện bảng dữ liệu nào ở bất kỳ trang nào.</p>
                  </div>
                )
              ) : selectedFile.status === 'failed' ? (
                <div className="empty-state" style={{ margin: 'auto' }}>
                  <div className="empty-state-icon" style={{ color: '#ef4444' }}>❌</div>
                  <h3 style={{ color: '#ef4444' }}>Lỗi trích xuất bảng</h3>
                  <p>{selectedFile.failedReason || 'Đã xảy ra lỗi không xác định trong quá trình xử lý Document AI'}</p>
                </div>
              ) : (
                <div className="empty-state" style={{ margin: 'auto' }}>
                  <div className="progress-spinner" style={{ width: '48px', height: '48px', marginBottom: '16px' }} />
                  <h3>Đang tiến hành nhận diện trích xuất bảng...</h3>
                  <p>Hệ thống đang chạy ngầm phân tích tệp tin. Giao diện sẽ tự động cập nhật khi hoàn tất.</p>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                    Tiến độ: {selectedFile.completedPages}/{selectedFile.totalPages || '?'} trang
                  </span>
                  <button 
                    className="btn btn-ghost" 
                    onClick={handleCancelJob} 
                    style={{ borderColor: 'rgba(239, 68, 68, 0.3)', color: '#ef4444' }}
                  >
                    🚫 Huỷ tác vụ
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="empty-state" style={{ margin: 'auto' }}>
            <div className="empty-state-icon">📋</div>
            <h3>Chưa chọn tệp tin</h3>
            <p>Vui lòng click chọn tệp tin ở danh sách bên trái để chỉnh sửa bảng dữ liệu</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TableWorkspace;
