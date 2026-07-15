import React, { useCallback, useRef, useState } from 'react';

interface UploadZoneProps {
  onFilesSelected: (files: File[], prompt: string, mode: 'table' | 'ocr') => void;
  isLoading: boolean;
}

const ACCEPT_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const UploadZone: React.FC<UploadZoneProps> = ({ onFilesSelected, isLoading }) => {
  const [dragOver, setDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState<'table' | 'ocr'>('table');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    if (e.dataTransfer.files) {
      const filesArray = Array.from(e.dataTransfer.files).filter(file => 
        ACCEPT_TYPES.includes(file.type) || file.name.endsWith('.docx') || file.name.endsWith('.pdf')
      );
      if (filesArray.length > 0) {
        setSelectedFiles(prev => [...prev, ...filesArray]);
      }
    }
  }, []);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setSelectedFiles(prev => [...prev, ...filesArray]);
    }
  };

  const handleSubmit = () => {
    if (selectedFiles.length > 0) {
      onFilesSelected(selectedFiles, prompt, mode);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return '🖼️';
    if (type.includes('pdf')) return '📄';
    if (type.includes('word') || type.includes('document')) return '📝';
    return '📎';
  };

  const moveFile = (index: number, direction: 'up' | 'down', e: React.MouseEvent) => {
    e.stopPropagation();
    const newFiles = [...selectedFiles];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newFiles.length) return;
    
    const temp = newFiles[index];
    newFiles[index] = newFiles[targetIndex];
    newFiles[targetIndex] = temp;
    setSelectedFiles(newFiles);
  };

  const removeFile = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="upload-section" style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Mode Selector Tabs */}
      <div className="mode-selector" style={{ display: 'flex', gap: '8px', background: 'rgba(255, 255, 255, 0.03)', padding: '4px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)', marginBottom: '16px', alignSelf: 'center', width: '100%', maxWidth: '400px' }}>
        <button
          type="button"
          onClick={() => setMode('table')}
          style={{ flex: 1, padding: '10px', borderRadius: 'var(--radius-sm)', border: 'none', background: mode === 'table' ? 'rgba(59, 130, 246, 0.15)' : 'transparent', color: mode === 'table' ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
        >
          📊 Trích xuất Bảng
        </button>
        <button
          type="button"
          onClick={() => setMode('ocr')}
          style={{ flex: 1, padding: '10px', borderRadius: 'var(--radius-sm)', border: 'none', background: mode === 'ocr' ? 'rgba(59, 130, 246, 0.15)' : 'transparent', color: mode === 'ocr' ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
        >
          🔍 Quét Văn Bản (OCR)
        </button>
      </div>

      <div
        className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_TYPES.join(',')}
          onChange={handleFileChange}
          multiple
          style={{ display: 'none' }}
        />

        <div className="upload-zone-content">
          <span className="upload-icon">📤</span>
          <h3>Kéo thả tệp tin vào đây</h3>
          <p>hoặc nhấn để chọn nhiều ảnh/tài liệu cùng lúc</p>
          <div className="file-types">
            <span className="file-type-badge">PDF (từng trang)</span>
            <span className="file-type-badge">DOC/DOCX (từng bảng)</span>
            <span className="file-type-badge">MULTIPLE IMAGES</span>
          </div>
        </div>
      </div>

      {selectedFiles.length > 0 && (
        <>
          <div className="selected-files-list-title">
            📋 Danh sách tệp tin chờ xử lý ({selectedFiles.length} tệp)
            <span className="selected-files-hint">Dùng nút 🔼 🔽 để sắp xếp thứ tự xử lý</span>
          </div>

          <div className="selected-files-container">
            {selectedFiles.map((file, index) => {
              const isImage = file.type.startsWith('image/');
              return (
                <div key={index} className="selected-file-item">
                  <div className="selected-file-main">
                    <span className="selected-file-icon">{getFileIcon(file.type)}</span>
                    {isImage && (
                      <div className="file-preview-thumbnail">
                        <img src={URL.createObjectURL(file)} alt="preview" />
                      </div>
                    )}
                    <div className="selected-file-info">
                      <div className="selected-file-name" title={file.name}>{file.name}</div>
                      <div className="selected-file-size">{formatSize(file.size)}</div>
                    </div>
                  </div>

                  <div className="selected-file-actions">
                    <button
                      className="order-btn"
                      onClick={(e) => moveFile(index, 'up', e)}
                      disabled={index === 0}
                      title="Di chuyển lên"
                    >
                      🔼
                    </button>
                    <button
                      className="order-btn"
                      onClick={(e) => moveFile(index, 'down', e)}
                      disabled={index === selectedFiles.length - 1}
                      title="Di chuyển xuống"
                    >
                      🔽
                    </button>
                    <button
                      className="selected-file-remove"
                      onClick={(e) => removeFile(index, e)}
                      title="Xóa khỏi danh sách"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="prompt-editor-wrapper" onClick={(e) => e.stopPropagation()}>
            <div className="prompt-editor-header">
              <span className="prompt-editor-label">📝 Hướng dẫn cho AI</span>
              <span className="prompt-editor-hint">Ctrl + Enter để gửi</span>
            </div>
            <textarea
              className="prompt-textarea"
              placeholder={`Viết hướng dẫn bổ sung cho AI (tuỳ chọn)...\n\nVí dụ:\n- Chỉ lấy bảng dữ liệu thứ hai\n- Viết hoa toàn bộ tiêu đề\n- Bỏ qua cột STT`}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              rows={5}
            />
          </div>

          <div className="upload-actions">
            <button
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={isLoading}
              style={{ width: '100%', maxWidth: '300px' }}
            >
              🚀 Trích xuất {selectedFiles.length} dữ liệu
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default UploadZone;
