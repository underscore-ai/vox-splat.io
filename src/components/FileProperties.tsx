import React, { useRef } from 'react';
import Draggable from 'react-draggable';
import { FileIcon, XIcon, Eye, EyeOff, Trash2 } from 'lucide-react';
import { SplatData } from '../types/SplatTypes';

interface ViewportObject {
  id: string;
  data: SplatData;
  isVisible: boolean;
  pointSize?: number;
}

interface FilePropertiesProps {
  objects: ViewportObject[];
  onClose: () => void;
  onToggleVisibility: (objectId: string) => void;
  onRemoveObject: (objectId: string) => void;
  onUpdatePointSize: (objectId: string, size: number) => void;
}

const FileProperties: React.FC<FilePropertiesProps> = ({
  objects,
  onClose,
  onToggleVisibility,
  onRemoveObject,
  onUpdatePointSize,
}) => {
  const nodeRef = useRef<HTMLDivElement>(null) as React.MutableRefObject<HTMLDivElement>;

  return (
    <Draggable handle=".properties-header" bounds="parent" nodeRef={nodeRef}>
      <div ref={nodeRef} className="properties-window">
        <div className="properties-header">
          <div className="header-content">
            <FileIcon size={16} />
            <span>Scene Objects</span>
          </div>
          <button className="close-button" onClick={onClose}>
            <XIcon size={16} />
          </button>
        </div>
        <div className="properties-content">
          {objects.map((obj) => (
            <div key={obj.id} className="object-section">
              <div className="object-header">
                <h3>{obj.data.metadata.fileName}</h3>
                <div className="object-actions">
                  <button
                    className="action-button"
                    onClick={() => onToggleVisibility(obj.id)}
                    title={obj.isVisible ? 'Hide' : 'Show'}
                  >
                    {obj.isVisible ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                  <button
                    className="action-button"
                    onClick={() => onRemoveObject(obj.id)}
                    title="Remove"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="property-group">
                <h4>Display Settings</h4>
                <div className="property-item slider-item">
                  <label htmlFor={`pointSize-${obj.id}`}>Point Size:</label>
                  <div className="slider-container">
                    <input
                      type="range"
                      id={`pointSize-${obj.id}`}
                      min="0.001"
                      max="0.02"
                      step="0.001"
                      value={obj.pointSize || 0.005}
                      onChange={(e) => onUpdatePointSize(obj.id, parseFloat(e.target.value))}
                    />
                    <span className="slider-value">{(obj.pointSize || 0.005).toFixed(3)}</span>
                  </div>
                </div>
              </div>

              <div className="property-group">
                <h4>File Info</h4>
                <div className="property-item">
                  <span className="property-label">Format:</span>
                  <span className="property-value">{obj.data.metadata.format.toUpperCase()}</span>
                </div>
                <div className="property-item">
                  <span className="property-label">Size:</span>
                  <span className="property-value">
                    {(obj.data.metadata.fileSize / 1024 / 1024).toFixed(2)} MB
                  </span>
                </div>
              </div>
              
              <div className="property-group">
                <h4>Point Cloud Info</h4>
                <div className="property-item">
                  <span className="property-label">Points:</span>
                  <span className="property-value">{obj.data.points.length.toLocaleString()}</span>
                </div>
                <div className="property-item">
                  <span className="property-label">Has Colors:</span>
                  <span className="property-value">{obj.data.metadata.hasColors ? 'Yes' : 'No'}</span>
                </div>
                <div className="property-item">
                  <span className="property-label">Has Normals:</span>
                  <span className="property-value">{obj.data.metadata.hasNormals ? 'Yes' : 'No'}</span>
                </div>
              </div>

              <div className="property-group">
                <h4>Bounds</h4>
                <div className="property-item">
                  <span className="property-label">Min:</span>
                  <span className="property-value">
                    [{obj.data.bounds.min.map(v => v.toFixed(2)).join(', ')}]
                  </span>
                </div>
                <div className="property-item">
                  <span className="property-label">Max:</span>
                  <span className="property-value">
                    [{obj.data.bounds.max.map(v => v.toFixed(2)).join(', ')}]
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Draggable>
  );
};

export default FileProperties; 