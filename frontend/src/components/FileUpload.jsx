import { useState, useRef, useCallback, useEffect } from 'react';
import './FileUpload.css';

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

function isImageType(type) {
  return type.startsWith('image/');
}

export default function FileUpload({
  files,
  onFilesChange,
  maxFiles = MAX_FILES,
  maxSizeBytes = MAX_FILE_SIZE,
  disabled = false
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);
  const objectUrlsRef = useRef(new Set()); // Track Object URLs for cleanup

  // Cleanup Object URLs on unmount to prevent memory leaks
  useEffect(() => {
    const urls = objectUrlsRef.current;
    return () => {
      urls.forEach(url => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, []);

  const validateFile = useCallback((file) => {
    // Check type
    if (!ALLOWED_TYPES[file.type]) {
      return `"${file.name}" is not a supported file type. Use images, PDFs, or Office documents.`;
    }
    // Check size
    if (file.size > maxSizeBytes) {
      return `"${file.name}" is too large (${formatFileSize(file.size)}). Maximum size is ${formatFileSize(maxSizeBytes)}.`;
    }
    return null;
  }, [maxSizeBytes]);

  const handleFiles = useCallback((newFiles) => {
    setError(null);

    // Check file count limit
    if (files.length + newFiles.length > maxFiles) {
      setError(`Maximum ${maxFiles} files allowed. You have ${files.length}, trying to add ${newFiles.length}.`);
      return;
    }

    // Validate each file
    const validFiles = [];
    for (const file of newFiles) {
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }
      // Check for duplicates
      if (!files.some(f => f.name === file.name && f.size === file.size)) {
        validFiles.push(file);
      }
    }

    if (validFiles.length > 0) {
      onFilesChange([...files, ...validFiles]);
    }
  }, [files, maxFiles, validateFile, onFilesChange]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled) return;

    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFiles(droppedFiles);
  }, [disabled, handleFiles]);

  const handleFileInputChange = useCallback((e) => {
    const selectedFiles = Array.from(e.target.files);
    handleFiles(selectedFiles);
    // Reset input so same file can be selected again
    e.target.value = '';
  }, [handleFiles]);

  const handleRemoveFile = useCallback((index) => {
    const newFiles = files.filter((_, i) => i !== index);
    onFilesChange(newFiles);
    setError(null);
  }, [files, onFilesChange]);

  const handleClick = () => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  };

  // Generate preview URL for images with tracking for cleanup
  const getPreviewUrl = useCallback((file) => {
    if (isImageType(file.type)) {
      const url = URL.createObjectURL(file);
      objectUrlsRef.current.add(url);
      return url;
    }
    return null;
  }, []);

  if (files.length === 0 && !isDragging) {
    return (
      <>
        <div
          className={`file-upload-zone compact ${disabled ? 'disabled' : ''}`}
          onClick={handleClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={Object.keys(ALLOWED_TYPES).join(',')}
            onChange={handleFileInputChange}
            style={{ display: 'none' }}
            disabled={disabled}
          />
          <span className="file-upload-icon">📎</span>
          <span className="file-upload-text">Add files</span>
        </div>
        {error && <div className="file-error">{error}</div>}
      </>
    );
  }

  return (
    <div className="file-upload-container">
      <div
        className={`file-upload-zone ${isDragging ? 'dragging' : ''} ${disabled ? 'disabled' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={Object.keys(ALLOWED_TYPES).join(',')}
          onChange={handleFileInputChange}
          style={{ display: 'none' }}
          disabled={disabled}
        />

        {/* File preview grid */}
        <div className="file-preview-grid">
          {files.map((file, index) => {
            const previewUrl = getPreviewUrl(file);
            const typeInfo = ALLOWED_TYPES[file.type] || { icon: '📁', label: 'File' };

            return (
              <div key={`${file.name}-${index}`} className="file-preview-item">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt={file.name}
                    className="file-thumbnail"
                    onLoad={() => {
                      URL.revokeObjectURL(previewUrl);
                      objectUrlsRef.current.delete(previewUrl);
                    }}
                  />
                ) : (
                  <div className="file-icon">{typeInfo.icon}</div>
                )}
                <div className="file-info">
                  <span className="file-name" title={file.name}>
                    {file.name.length > 20 ? file.name.substring(0, 17) + '...' : file.name}
                  </span>
                  <span className="file-size">{formatFileSize(file.size)}</span>
                </div>
                {!disabled && (
                  <button
                    type="button"
                    className="remove-file-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveFile(index);
                    }}
                    title="Remove file"
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}

          {/* Add more button */}
          {files.length < maxFiles && !disabled && (
            <button
              type="button"
              className="add-more-btn"
              onClick={handleClick}
            >
              <span className="add-icon">+</span>
              <span>Add</span>
            </button>
          )}
        </div>

        {/* File count indicator */}
        <div className="file-limit-info">
          {files.length}/{maxFiles} files (+1 credit)
        </div>
      </div>

      {error && <div className="file-error">{error}</div>}
    </div>
  );
}
