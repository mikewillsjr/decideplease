import { useState, useRef } from 'react';
import SpeedSelector from './SpeedSelector';
import './ChairpersonRemarks.css';

// Allowed file types for attachments
const ALLOWED_TYPES = {
  'image/jpeg': { icon: '🖼️', label: 'JPEG' },
  'image/png': { icon: '🖼️', label: 'PNG' },
  'image/gif': { icon: '🖼️', label: 'GIF' },
  'image/webp': { icon: '🖼️', label: 'WebP' },
  'application/pdf': { icon: '📄', label: 'PDF' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { icon: '📝', label: 'DOCX' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { icon: '📊', label: 'XLSX' },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': { icon: '📽️', label: 'PPTX' },
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 5;

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/**
 * Follow-up input bar - allows users to add context/follow-up to decisions.
 * Includes file attachment capability.
 */
export default function ChairpersonRemarks({
  onSubmit,
  isLoading = false,
  disabled = false,
}) {
  const [input, setInput] = useState('');
  const [mode, setMode] = useState('standard');
  const [isExpanded, setIsExpanded] = useState(false);
  const [files, setFiles] = useState([]);
  const [fileError, setFileError] = useState(null);
  const fileInputRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if ((!input.trim() && files.length === 0) || isLoading || disabled) return;

    onSubmit(input.trim(), mode, files);
    setInput('');
    setFiles([]);
    setIsExpanded(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
    if (e.key === 'Escape') {
      setIsExpanded(false);
    }
  };

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFileError(null);

    // Check file count limit
    if (files.length + selectedFiles.length > MAX_FILES) {
      setFileError(`Maximum ${MAX_FILES} files allowed.`);
      return;
    }

    // Validate files
    const validFiles = [];
    for (const file of selectedFiles) {
      if (!ALLOWED_TYPES[file.type]) {
        setFileError(`"${file.name}" is not a supported file type.`);
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        setFileError(`"${file.name}" is too large. Max ${formatFileSize(MAX_FILE_SIZE)}.`);
        return;
      }
      if (!files.some(f => f.name === file.name && f.size === file.size)) {
        validFiles.push(file);
      }
    }

    if (validFiles.length > 0) {
      setFiles([...files, ...validFiles]);
    }
    e.target.value = '';
  };

  const handleRemoveFile = (index) => {
    setFiles(files.filter((_, i) => i !== index));
    setFileError(null);
  };

  const canSubmit = (input.trim().length > 0 || files.length > 0) && !isLoading && !disabled;

  return (
    <div className={`followup-bar ${isExpanded ? 'expanded' : ''} ${isLoading ? 'loading' : ''}`}>
      <form onSubmit={handleSubmit}>
        {!isExpanded ? (
          <button
            type="button"
            className="expand-trigger"
            onClick={() => setIsExpanded(true)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Supplement
          </button>
        ) : (
          <div className="followup-body">
            {/* File attachments preview */}
            {files.length > 0 && (
              <div className="attachments-preview">
                {files.map((file, index) => {
                  const typeInfo = ALLOWED_TYPES[file.type] || { icon: '📁', label: 'File' };
                  return (
                    <div key={`${file.name}-${index}`} className="attachment-chip">
                      <span className="attachment-icon">{typeInfo.icon}</span>
                      <span className="attachment-name">
                        {file.name.length > 15 ? file.name.substring(0, 12) + '...' : file.name}
                      </span>
                      <button
                        type="button"
                        className="remove-attachment"
                        onClick={() => handleRemoveFile(index)}
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {fileError && <div className="file-error-inline">{fileError}</div>}

            <div className="input-row">
              {/* Attachment button */}
              <button
                type="button"
                className="attach-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading || disabled || files.length >= MAX_FILES}
                title="Attach files"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                </svg>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={Object.keys(ALLOWED_TYPES).join(',')}
                onChange={handleFileSelect}
                style={{ display: 'none' }}
                disabled={isLoading || disabled}
              />

              {/* Text input */}
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Add context, follow-up questions, or new information..."
                disabled={isLoading || disabled}
                rows={2}
                autoFocus
              />
            </div>

            <div className="followup-footer">
              <SpeedSelector
                selectedMode={mode}
                onModeChange={setMode}
                disabled={isLoading || disabled}
              />

              <div className="footer-actions">
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={() => {
                    setIsExpanded(false);
                    setInput('');
                    setFiles([]);
                    setFileError(null);
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className={`submit-btn ${canSubmit ? 'ready' : ''}`}
                  disabled={!canSubmit}
                >
                  {isLoading ? (
                    <>
                      <span className="spinner"></span>
                      Processing...
                    </>
                  ) : (
                    'Submit'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
