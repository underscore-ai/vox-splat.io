import React from 'react';
import { Camera, Layers, Settings, Maximize, Grid, Download } from 'lucide-react';

interface ViewportControlsProps {
  onToggleProperties: () => void;
  onToggleGrid: () => void;
  showGrid: boolean;
  onToggleFullscreen: () => void;
  isFullscreen: boolean;
  onToggleCameraTools: () => void;
  showCameraTools: boolean;
}

const ViewportControls: React.FC<ViewportControlsProps> = ({ 
  onToggleProperties, 
  onToggleGrid,
  showGrid,
  onToggleFullscreen,
  isFullscreen,
  onToggleCameraTools,
  showCameraTools
}) => {
  return (
    <div className="viewport-controls">
      <div className="control-group">
        <button 
          className={`control-button ${showCameraTools ? 'control-button-active' : ''}`} 
          title="Camera Settings"
          onClick={onToggleCameraTools}
        >
          <Camera size={20} />
        </button>
        <button className="control-button" title="Layers" onClick={onToggleProperties}>
          <Layers size={20} />
        </button>
        <button className="control-button" title="View Settings">
          <Settings size={20} />
        </button>
      </div>
      <div className="control-group">
        <button 
          className={`control-button ${!showGrid ? 'control-button-disabled' : ''}`} 
          title="Toggle Grid" 
          onClick={onToggleGrid}
        >
          <Grid size={20} />
        </button>
        <button 
          className={`control-button ${isFullscreen ? 'control-button-active' : ''}`} 
          title="Toggle Fullscreen"
          onClick={onToggleFullscreen}
        >
          <Maximize size={20} />
        </button>
        <button className="control-button" title="Export">
          <Download size={20} />
        </button>
      </div>
    </div>
  );
};

export default ViewportControls; 