import React from 'react';
import type { FileInfo } from '../types';
import { API_BASE } from '../types';

interface FilePreviewProps {
  file: FileInfo | null;
}

const FilePreview: React.FC<FilePreviewProps> = ({ file }) => {
  if (!file) {
    return (
      <div className="preview-placeholder">
        <span>👁️</span>
        <p>Preview tài liệu sẽ hiển thị tại đây sau khi upload</p>
      </div>
    );
  }

  const previewUrl = `${API_BASE}${file.previewUrl}`;
  const { mimeType } = file;

  // PDF Preview
  if (mimeType === 'application/pdf') {
    return (
      <div className="preview-container">
        <iframe
          src={previewUrl}
          title="PDF Preview"
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    );
  }

  // Image Preview
  if (mimeType.startsWith('image/')) {
    return (
      <div className="preview-container" style={{ padding: '20px' }}>
        <img src={previewUrl} alt={file.originalName} />
      </div>
    );
  }

  // DOC/DOCX - Không thể preview trực tiếp
  if (mimeType.includes('word') || mimeType.includes('document')) {
    return (
      <div className="preview-placeholder">
        <span>📝</span>
        <p>
          File Word không hỗ trợ preview trực tiếp trên trình duyệt.
          <br />
          <strong>{file.originalName}</strong>
        </p>
        <a
          href={previewUrl}
          download={file.originalName}
          className="btn btn-ghost"
          style={{ marginTop: '16px', display: 'inline-flex' }}
        >
          ⬇️ Tải file gốc
        </a>
      </div>
    );
  }

  return (
    <div className="preview-placeholder">
      <span>📎</span>
      <p>Định dạng file không hỗ trợ preview</p>
    </div>
  );
};

export default FilePreview;
