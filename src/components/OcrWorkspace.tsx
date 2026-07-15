import React, { useState, useEffect } from 'react';
import type { OcrBatch, OcrPage } from '../types';
import { API_BASE } from '../types';

interface OcrWorkspaceProps {
  batchId: string;
  onReset: () => void;
  showToast: (message: string, type: 'success' | 'error') => void;
}

const OcrWorkspace: React.FC<OcrWorkspaceProps> = ({ batchId, onReset, showToast }) => {
  const [batch, setBatch] = useState<OcrBatch | null>(null);
  const [selectedFileIndex, setSelectedFileIndex] = useState<number | null>(null);
  const [currentPageNum, setCurrentPageNum] = useState<number>(1);
  
  // Cache of page texts that we edit or load: Map<`${fileIndex}-${pageNum}`, OcrPage>
  const [pageCache, setPageCache] = useState<Record<string, OcrPage>>({});
  const [isPageLoading, setIsPageLoading] = useState(false);
  const [editedText, setEditedText] = useState('');

  // 1. Fetch initial status and listen to SSE stream
  useEffect(() => {
    const fetchInitialBatchStatus = async () => {
      try {
        const response = await fetch(`${API_BASE}/extract-text/${batchId}`);
        if (!response.ok) throw new Error('Không thể tải trạng thái OCR');
        const resData = await response.json();
        const batchData: OcrBatch = resData.data;
        setBatch(batchData);
      } catch (err: any) {
        showToast(err.message, 'error');
      }
    };

    fetchInitialBatchStatus();

    // Thiết lập EventSource lắng nghe tiến độ từ server
    const eventSource = new EventSource(`${API_BASE}/extract-text/${batchId}/stream`);

    eventSource.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'progress') {
          setBatch((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              files: prev.files.map((f) =>
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
          // Khi hoàn tất 1 file hoặc hoàn tất cả lô, fetch lại dữ liệu đầy đủ 1 lần
          const response = await fetch(`${API_BASE}/extract-text/${batchId}`);
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

    eventSource.onerror = () => {
      console.warn('Lỗi kết nối SSE hoặc luồng kết thúc, đóng kết nối');
      eventSource.close();
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

  const selectedFile = selectedFileIndex !== null ? batch?.files.find(f => f.fileIndex === selectedFileIndex) : null;

  // 2. Fetch page text when selected file or current page changes
  useEffect(() => {
    if (selectedFileIndex === null || !selectedFile || selectedFile.status !== 'completed') {
      return;
    }

    const cacheKey = `${selectedFileIndex}-${currentPageNum}`;
    
    if (pageCache[cacheKey]) {
      setEditedText(pageCache[cacheKey].text);
      return;
    }

    const fetchPageDetail = async () => {
      setIsPageLoading(true);
      try {
        const response = await fetch(`${API_BASE}/extract-text/${batchId}/files/${selectedFileIndex}/pages/${currentPageNum}`);
        if (!response.ok) throw new Error('Lỗi khi tải nội dung trang');
        const resData = await response.json();
        const pageData: OcrPage = resData.data;

        setPageCache(prev => ({
          ...prev,
          [cacheKey]: pageData
        }));
        setEditedText(pageData.text);
      } catch (err: any) {
        showToast(err.message, 'error');
      } finally {
        setIsPageLoading(false);
      }
    };

    fetchPageDetail();
  }, [selectedFileIndex, currentPageNum, selectedFile?.status]);

  // Reset current page to 1 when changing files
  const handleFileSelect = (index: number) => {
    setSelectedFileIndex(index);
    setCurrentPageNum(1);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setEditedText(text);

    // Save edited text back into our page cache
    if (selectedFileIndex !== null) {
      const cacheKey = `${selectedFileIndex}-${currentPageNum}`;
      setPageCache(prev => {
        const cached = prev[cacheKey];
        if (!cached) return prev;
        return {
          ...prev,
          [cacheKey]: {
            ...cached,
            text
          }
        };
      });
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(editedText);
    showToast('Đã sao chép văn bản vào clipboard', 'success');
  };

  const handleDownloadPage = () => {
    if (!selectedFile) return;
    const blob = new Blob([editedText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedFile.fileName}_trang_${currentPageNum}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadAll = async () => {
    if (!selectedFile) return;
    showToast('Đang tạo file tải xuống cho toàn bộ tài liệu...', 'success');
    
    try {
      // Fetch all pages' texts (either from cache or by fetching them)
      const allPagesText: string[] = [];
      
      for (let p = 1; p <= selectedFile.totalPages; p++) {
        const cacheKey = `${selectedFileIndex}-${p}`;
        if (pageCache[cacheKey]) {
          allPagesText.push(`--- TRANG ${p} --- \n\n${pageCache[cacheKey].text}`);
        } else {
          const response = await fetch(`${API_BASE}/extract-text/${batchId}/files/${selectedFileIndex}/pages/${p}`);
          if (!response.ok) throw new Error(`Lỗi tải trang ${p}`);
          const resData = await response.json();
          allPagesText.push(`--- TRANG ${p} --- \n\n${resData.data.text}`);
        }
      }

      const fullText = allPagesText.join('\n\n\n');
      const blob = new Blob([fullText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${selectedFile.fileName}_full.txt`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      showToast('Lỗi tải toàn bộ tài liệu: ' + err.message, 'error');
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
    if (['jpg', 'jpeg', 'png', 'webp', 'bmp', 'tiff'].includes(ext || '')) return '🖼️';
    if (ext === 'pdf') return '📄';
    return '📝';
  };

  return (
    <div className="workspace ocr-workspace" style={{ display: 'flex', height: 'calc(100vh - 140px)', gap: '16px', padding: '16px' }}>
      {/* Left panel: File list */}
      <div className="workspace-panel file-list-panel" style={{ flex: '1', maxWidth: '350px', display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)' }}>
        <div className="panel-header" style={{ padding: '16px', borderBottom: '1px solid var(--border-glass)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '16px' }}>📁 Danh sách tệp</h3>
          <span className="panel-header-badge">{batch?.files.length || 0} files</span>
        </div>
        <div className="panel-content" style={{ flex: '1', overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {batch?.files.map((file, idx) => {
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
                    {file.status === 'completed' && <span style={{ color: '#10b981' }}>✓ Hoàn thành</span>}
                    {file.status === 'active' && <span style={{ color: '#3b82f6' }}>⚡ Đang quét ({progressPct}%)</span>}
                    {file.status === 'waiting' && <span style={{ color: '#9ca3af' }}>⏳ Chờ hàng đợi</span>}
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

      {/* Right panel: OCR review & edit */}
      <div className="workspace-panel review-panel" style={{ flex: '3', display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)' }}>
        {selectedFile ? (
          <>
            <div className="panel-header" style={{ padding: '16px', borderBottom: '1px solid var(--border-glass)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ textAlign: 'left' }}>
                <h3 style={{ margin: 0, fontSize: '16px' }}>🔍 Review văn bản OCR</h3>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>File: {selectedFile.fileName}</span>
              </div>
              {selectedFile.status === 'completed' && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-ghost" onClick={handleDownloadAll} style={{ fontSize: '13px' }}>
                    💾 Tải toàn bộ .txt
                  </button>
                  <button className="btn btn-ghost" onClick={handleDownloadPage} style={{ fontSize: '13px' }}>
                    📄 Tải trang này
                  </button>
                  <button className="btn btn-primary" onClick={handleCopy} style={{ fontSize: '13px' }}>
                    📋 Copy trang này
                  </button>
                </div>
              )}
            </div>

            <div className="panel-content" style={{ flex: '1', display: 'flex', flexDirection: 'column', padding: '16px', overflow: 'hidden' }}>
              {selectedFile.status === 'completed' ? (
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
                        disabled={currentPageNum === selectedFile.totalPages || isPageLoading}
                        onClick={() => setCurrentPageNum(prev => Math.min(prev + 1, selectedFile.totalPages))}
                        style={{ padding: '4px 12px', height: '32px' }}
                      >
                        Trang sau ▶
                      </button>
                    </div>

                    <span style={{ fontSize: '14px', fontWeight: '500' }}>
                      Trang {currentPageNum} / {selectedFile.totalPages}
                    </span>

                    {/* Confidence Score Badge */}
                    {pageCache[`${selectedFileIndex}-${currentPageNum}`] && (
                      <span
                        style={{
                          fontSize: '12px',
                          background: 'rgba(16, 185, 129, 0.1)',
                          border: '1px solid rgba(16, 185, 129, 0.2)',
                          color: '#10b981',
                          padding: '4px 8px',
                          borderRadius: '12px'
                        }}
                      >
                        Độ tin cậy: {Math.round(pageCache[`${selectedFileIndex}-${currentPageNum}`].confidence * 100)}%
                      </span>
                    )}
                  </div>

                  {/* Textarea review */}
                  <div style={{ flex: '1', position: 'relative' }}>
                    {isPageLoading ? (
                      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: 'rgba(0,0,0,0.5)', zIndex: 10 }}>
                        <div className="progress-spinner" style={{ width: '32px', height: '32px', marginBottom: '8px' }} />
                        <span>Đang tải nội dung trang...</span>
                      </div>
                    ) : null}
                    
                    <textarea
                      value={editedText}
                      onChange={handleTextChange}
                      placeholder="Không có văn bản trích xuất được hoặc trang trống."
                      style={{
                        width: '100%',
                        height: '100%',
                        background: 'rgba(0,0,0,0.2)',
                        border: '1px solid var(--border-glass)',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--text-primary)',
                        padding: '16px',
                        fontSize: '14px',
                        lineHeight: '1.6',
                        resize: 'none',
                        fontFamily: 'monospace',
                        outline: 'none'
                      }}
                    />
                  </div>
                </div>
              ) : selectedFile.status === 'failed' ? (
                <div className="empty-state" style={{ margin: 'auto' }}>
                  <div className="empty-state-icon" style={{ color: '#ef4444' }}>❌</div>
                  <h3 style={{ color: '#ef4444' }}>Lỗi xử lý tệp tin</h3>
                  <p>{selectedFile.failedReason || 'Đã xảy ra lỗi không xác định trong quá trình OCR'}</p>
                </div>
              ) : (
                <div className="empty-state" style={{ margin: 'auto' }}>
                  <div className="progress-spinner" style={{ width: '48px', height: '48px', marginBottom: '16px' }} />
                  <h3>Đang tiến hành nhận diện OCR...</h3>
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
            <div className="empty-state-icon">📄</div>
            <h3>Chưa chọn tệp tin</h3>
            <p>Vui lòng click chọn tệp tin ở danh sách bên trái để review văn bản OCR</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default OcrWorkspace;
