import React from 'react';
import { Camera, Layers, Settings, Maximize, Grid, Download } from 'lucide-react';

const ViewportControls: React.FC = () => {
  return (
    <div className="viewport-controls">
      <div className="control-group">
        <button className="control-button" title="Camera Settings">
          <Camera size={20} />
        </button>
        <button className="control-button" title="Layers">
          <Layers size={20} />
        </button>
        <button className="control-button" title="View Settings">
          <Settings size={20} />
        </button>
      </div>
      <div className="control-group">
        <button className="control-button" title="Toggle Grid">
          <Grid size={20} />
        </button>
        <button className="control-button" title="Toggle Fullscreen">
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