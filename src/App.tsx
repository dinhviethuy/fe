import { useState, useEffect } from 'react';
import UploadZone from './components/UploadZone';
import TableEditor from './components/TableEditor';
import ExcelPreview from './components/ExcelPreview';
import ExportButton from './components/ExportButton';
import type { TableItem, FileInfo, ExtractResponse } from './types';
import { API_BASE, flattenTable, mapFastAPIPagesToTableItems } from './types';

type AppView = 'upload' | 'workspace';

interface ToastState {
  message: string;
  type: 'success' | 'error';
  id: number;
}

function App() {
  const [view, setView] = useState<AppView>('upload');
  const [tables, setTables] = useState<TableItem[]>([]);
  const [tablesHistory, setTablesHistory] = useState<TableItem[][]>([]);

  const handleTablesChange = (newTables: TableItem[]) => {
    setTablesHistory((prev) => {
      const nextHistory = [...prev, tables];
      if (nextHistory.length > 50) {
        nextHistory.shift();
      }
      return nextHistory;
    });
    setTables(newTables);
  };

  const handleUndo = () => {
    if (tablesHistory.length === 0) return;
    setTablesHistory((prev) => {
      const nextHistory = [...prev];
      const previousState = nextHistory.pop();
      if (previousState) {
        setTables(previousState);
      }
      return nextHistory;
    });
  };

  // Lắng nghe tổ hợp phím Ctrl+Z để hoàn tác toàn cục
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tablesHistory, tables]);
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKeysOption, setApiKeysOption] = useState<string>(() => localStorage.getItem('api_keys_option') || 'server');
  const [customApiKeys, setCustomApiKeys] = useState<string>(() => localStorage.getItem('custom_api_keys') || '');
  const [errors, setErrors] = useState<string[]>([]);

  const handleApiKeysOptionChange = (option: string) => {
    setApiKeysOption(option);
    localStorage.setItem('api_keys_option', option);
  };

  const handleCustomApiKeysChange = (keys: string) => {
    setCustomApiKeys(keys);
    localStorage.setItem('custom_api_keys', keys);
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    const id = Date.now();
    setToast({ message, type, id });
    setTimeout(() => setToast((prev) => (prev?.id === id ? null : prev)), 3000);
  };

  const handleFilesSelected = async (files: File[], prompt: string) => {
    setIsLoading(true);
    setErrors([]);

    try {
      const allMappedTables: TableItem[] = [];
      const errList: string[] = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${API_BASE}/api/v1/extract-tables/`, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errText = await response.text();
          errList.push(`Lỗi file "${file.name}": ${errText || response.statusText}`);
          continue;
        }

        const result = await response.json();
        if (result.status === 'success' && result.pages) {
          const fileTables = mapFastAPIPagesToTableItems(result.pages, file.name);
          allMappedTables.push(...fileTables);
        } else if (result.error) {
          errList.push(`Lỗi file "${file.name}": ${result.error}`);
        }
      }

      if (allMappedTables.length === 0) {
        showToast('Không tìm thấy bảng dữ liệu trong tài liệu', 'error');
        setTables([]);
        setTablesHistory([]);
      } else {
        setTables(allMappedTables.map(flattenTable));
        setTablesHistory([]);
        showToast(
          `Trích xuất thành công ${allMappedTables.length} bảng dữ liệu`,
          'success'
        );
      }

      setErrors(errList);

      if (files.length > 0) {
        setFileInfo({
          filename: files[0].name,
          originalName: files[0].name,
          mimeType: files[0].type,
          previewUrl: '',
        });
      }
      setView('workspace');
    } catch (error: any) {
      showToast('Lỗi kết nối server: ' + error.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = async () => {
    // Xóa file trên server
    if (fileInfo) {
      try {
        await fetch(`${API_BASE}/api/delete-file/${fileInfo.filename}`, {
          method: 'DELETE',
        });
      } catch {
        // Bỏ qua lỗi xóa file
      }
    }

    setView('upload');
    setTables([]);
    setTablesHistory([]);
    setFileInfo(null);
    setErrors([]);
  };

  const totalRows = tables.reduce((sum, t) => sum + t.rows.length, 0);
  const totalCols = tables.reduce((sum, t) => sum + (t.rows[0]?.length || 0), 0);

  return (
    <>
      {/* Header */}
      <header className="app-header">
        <div className="app-logo">
          <div className="app-logo-icon">⚡</div>
          <div>
            <h1>DataExtract AI</h1>
            <span>Trích xuất dữ liệu thông minh</span>
          </div>
        </div>

        <div className="header-controls" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* API Key Configuration Dropdown */}
          <div className="settings-dropdown" style={{ position: 'relative' }}>
            <button 
              className="btn btn-ghost" 
              onClick={() => setShowSettings(!showSettings)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              ⚙️ Cấu hình API Key
            </button>
            {showSettings && (
              <div 
                className="settings-panel" 
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '8px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-glass-strong)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px',
                  width: '320px',
                  boxShadow: 'var(--shadow-lg)',
                  zIndex: 200,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  backdropFilter: 'blur(20px)'
                }}
              >
                <h3 style={{ margin: 0, fontSize: '15px', color: 'var(--text-primary)', textAlign: 'left' }}>🔑 Cấu hình API Key</h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'left' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    <input 
                      type="radio" 
                      name="api_keys_option" 
                      value="server" 
                      checked={apiKeysOption === 'server'}
                      onChange={() => handleApiKeysOptionChange('server')}
                    />
                    Dùng API Key của hệ thống
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    <input 
                      type="radio" 
                      name="api_keys_option" 
                      value="custom" 
                      checked={apiKeysOption === 'custom'}
                      onChange={() => handleApiKeysOptionChange('custom')}
                    />
                    Dùng danh sách API Key cá nhân
                  </label>
                </div>

                {apiKeysOption === 'custom' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'left' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Dán danh sách API key (mỗi dòng 1 key hoặc ngăn cách bằng dấu phẩy):</span>
                    <textarea
                      value={customApiKeys}
                      onChange={(e) => handleCustomApiKeysChange(e.target.value)}
                      placeholder="Dán API keys ở đây..."
                      style={{
                        width: '100%',
                        height: '100px',
                        background: 'rgba(0,0,0,0.2)',
                        border: '1px solid var(--border-glass)',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--text-primary)',
                        padding: '8px',
                        fontSize: '12px',
                        resize: 'vertical',
                        fontFamily: 'monospace',
                        outline: 'none'
                      }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {view === 'workspace' && (
            <button className="btn btn-ghost" onClick={handleReset}>
              ↩️ Upload mới
            </button>
          )}
        </div>
      </header>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="progress-overlay">
          <div className="progress-card">
            <div className="progress-spinner" />
            <h3>Đang phân tích tài liệu...</h3>
            <p>Gemini AI đang trích xuất dữ liệu bảng từ tài liệu của bạn</p>
          </div>
        </div>
      )}

      {/* Upload View */}
      {view === 'upload' && (
        <UploadZone onFilesSelected={handleFilesSelected} isLoading={isLoading} />
      )}

      {/* Workspace View */}
      {view === 'workspace' && (
        <>
          {errors.length > 0 && (
            <div className="warnings-banner" style={{
              background: 'rgba(239, 68, 68, 0.1)',
              borderBottom: '1px solid rgba(239, 68, 68, 0.2)',
              color: 'rgba(239, 68, 68, 0.9)',
              padding: '12px 24px',
              fontSize: '13px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              textAlign: 'left'
            }}>
              <div style={{ fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                ⚠️ Một số tài liệu hoặc trang không thể quét bằng AI (đã tự động xử lý nội bộ nếu có thể):
              </div>
              <ul style={{ margin: 0, paddingLeft: '20px', listStyleType: 'disc' }}>
                {errors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="workspace">
            {/* Left Panel - Edit */}
            <div className="workspace-panel">
              <div className="panel-header">
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  ✏️ Chỉnh sửa dữ liệu
                  <span className="panel-header-badge">
                    {tables.length} bảng
                  </span>
                </h2>
                {tablesHistory.length > 0 && (
                  <button
                    className="btn btn-ghost"
                    onClick={handleUndo}
                    title="Hoàn tác thao tác vừa thực hiện (Ctrl+Z)"
                    style={{
                      padding: '4px 8px',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      height: '28px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      borderRadius: 'var(--radius-sm)'
                    }}
                  >
                    ↩️ Hoàn tác
                  </button>
                )}
              </div>
              <div className="panel-content">
                {tables.length > 0 ? (
                  <TableEditor tables={tables} onTablesChange={handleTablesChange} />
                ) : (
                  <div className="empty-state">
                    <div className="empty-state-icon">📋</div>
                    <h3>Không có dữ liệu</h3>
                    <p>Tài liệu không chứa bảng dữ liệu nào</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Panel - Excel Preview */}
            <div className="workspace-panel">
              <div className="panel-header">
                <h2>
                  📊 Preview Excel
                </h2>
                <span className="panel-header-badge">Realtime</span>
              </div>
              <div className="panel-content panel-content-preview">
                <ExcelPreview tables={tables} />
              </div>
            </div>
          </div>

          {/* Export Bar */}
          <div className="export-bar">
            <div className="export-info">
              <div className="export-info-dot" />
              <span>
                {tables.length} bảng · {totalRows} hàng · {totalCols} cột
              </span>
            </div>
            <div className="export-actions">
              <ExportButton tables={tables} disabled={tables.length === 0} />
            </div>
          </div>
        </>
      )}

      {/* Toast */}
      {toast && (
        <div className={`toast ${toast.type}`} key={toast.id}>
          {toast.type === 'success' ? '✅' : '❌'} {toast.message}
        </div>
      )}
    </>
  );
}

export default App;
