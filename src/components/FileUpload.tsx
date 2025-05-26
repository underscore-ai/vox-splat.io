// src/components/FileUpload.tsx
import React, { useRef, useState } from 'react';
import { Upload, File, AlertCircle } from 'lucide-react';
import { FileUploadProps } from '../types/SplatTypes';
import { parsePlyFile } from '../parsers/PlyParser';
import { parseSplatFile } from '../parsers/SplatParser';

const FileUpload: React.FC<FileUploadProps> = ({
  onFileLoad,
  onLoadingChange,
  onError
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFiles = async (files: FileList) => {
    if (files.length === 0) return;
    
    const file = files[0];
    
    // Validate file type
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.ply') && !fileName.endsWith('.splat')) {
      onError('Please upload a .ply or .splat file');
      return;
    }

    // Validate file size (100MB limit for now)
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      onError('File is too large. Please upload files smaller than 100MB.');
      return;
    }

    onLoadingChange(true);

    try {
      const arrayBuffer = await file.arrayBuffer();
      let splatData;

      if (fileName.endsWith('.ply')) {
        splatData = await parsePlyFile(arrayBuffer, file.name, file.size);
      } else {
        splatData = await parseSplatFile(arrayBuffer, file.name, file.size);
      }

      onFileLoad(splatData);
    } catch (error) {
      console.error('Error parsing file:', error);
      onError(error instanceof Error ? error.message : 'Failed to parse file');
    } finally {
      onLoadingChange(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files);
    }
  };

  const openFileSelector = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="upload-container">
      <div
        className={`upload-area ${dragActive ? 'drag-active' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={openFileSelector}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".ply,.splat"
          onChange={handleChange}
          style={{ display: 'none' }}
        />
        
        <div className="upload-content">
          <Upload size={48} className="upload-icon" />
          <h3>Upload your Gaussian Splat file</h3>
          <p>Drag and drop or click to select</p>
          <div className="file-info">
            <File size={16} />
            <span>Supports .ply and .splat files (max 100MB)</span>
          </div>
        </div>
      </div>

      <div className="upload-help">
        <div className="help-item">
          <AlertCircle size={16} />
          <span>Supported formats: PLY, SPLAT</span>
        </div>
      </div>
    </div>
  );
};

export default FileUpload;