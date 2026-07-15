import { useState } from 'react';
import UploadZone from './components/UploadZone';
import OcrWorkspace from './components/OcrWorkspace';
import TableWorkspace from './components/TableWorkspace';
import { API_BASE } from './types';

type AppView = 'upload' | 'workspace' | 'ocr-workspace';

interface ToastState {
  message: string;
  type: 'success' | 'error';
  id: number;
}

function App() {
  const [view, setView] = useState<AppView>('upload');
  const [ocrBatchId, setOcrBatchId] = useState<string | null>(null);
  const [tableBatchId, setTableBatchId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKeysOption, setApiKeysOption] = useState<string>(() => localStorage.getItem('api_keys_option') || 'server');
  const [customApiKeys, setCustomApiKeys] = useState<string>(() => localStorage.getItem('custom_api_keys') || '');

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

  const handleFilesSelected = async (files: File[], _prompt: string, mode: 'table' | 'ocr') => {
    setIsLoading(true);

    try {
      if (mode === 'ocr') {
        const formData = new FormData();
        files.forEach((file) => {
          formData.append('files', file);
        });

        const response = await fetch(`${API_BASE}/extract-text`, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(errText || response.statusText);
        }

        const result = await response.json();
        const batchId = result.data?.batchId || result.batchId;
        
        if (!batchId) {
          throw new Error('Không nhận được ID lô xử lý từ server');
        }

        setOcrBatchId(batchId);
        showToast('Đang khởi tạo hàng đợi quét OCR cho tài liệu...', 'success');
        setView('ocr-workspace');
      } else {
        const formData = new FormData();
        files.forEach((file) => {
          formData.append('files', file);
        });

        const response = await fetch(`${API_BASE}/extract-tables`, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(errText || response.statusText);
        }

        const result = await response.json();
        const batchId = result.data?.batchId || result.batchId;
        
        if (!batchId) {
          throw new Error('Không nhận được ID lô xử lý từ server');
        }

        setTableBatchId(batchId);
        showToast('Đang khởi tạo hàng đợi trích xuất bảng...', 'success');
        setView('workspace');
      }
    } catch (error: any) {
      showToast('Lỗi: ' + error.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setView('upload');
    setOcrBatchId(null);
    setTableBatchId(null);
  };

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

          {view !== 'upload' && (
            <button className="btn btn-ghost" onClick={handleReset}>
              ↩️ Upload mới
            </button>
          )}
        </div>
      </header>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="progress-overlay">
          <div className="progress-overlay-backdrop" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }} />
          <div className="progress-card" style={{ position: 'relative', zIndex: 10 }}>
            <div className="progress-spinner" />
            <h3>Đang tải tài liệu lên...</h3>
            <p>Hệ thống đang khởi tạo lô xử lý dữ liệu</p>
          </div>
        </div>
      )}

      {/* Upload View */}
      {view === 'upload' && (
        <UploadZone onFilesSelected={handleFilesSelected} isLoading={isLoading} />
      )}

      {/* Workspace View */}
      {view === 'workspace' && tableBatchId && (
        <TableWorkspace batchId={tableBatchId} onReset={handleReset} showToast={showToast} />
      )}

      {/* OCR Workspace View */}
      {view === 'ocr-workspace' && ocrBatchId && (
        <OcrWorkspace batchId={ocrBatchId} onReset={handleReset} showToast={showToast} />
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
