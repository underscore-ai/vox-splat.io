// src/App.tsx
import React, { useState } from 'react';
import FileUpload from './components/FileUpload';
import Viewer3D from './components/Viewer3D';
import { SplatData } from './types/SplatTypes';
import './App.css';

function App() {
  const [splatData, setSplatData] = useState<SplatData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileLoad = (data: SplatData) => {
    setSplatData(data);
    setError(null);
  };

  const handleLoadingChange = (loading: boolean) => {
    setIsLoading(loading);
  };

  const handleError = (errorMessage: string) => {
    setError(errorMessage);
    setIsLoading(false);
  };

  return (
    <div className="App">
      <header className="app-header">
        <h1>Vox-Splat</h1>
        <p>Upload and visualize your .ply or .splat files</p>
      </header>

      <main className="app-main">
        {!splatData && (
          <FileUpload
            onFileLoad={handleFileLoad}
            onLoadingChange={handleLoadingChange}
            onError={handleError}
          />
        )}

        {isLoading && (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Processing your file...</p>
          </div>
        )}

        {error && (
          <div className="error-container">
            <h3>Error</h3>
            <p>{error}</p>
            <button onClick={() => {
              setError(null);
              setSplatData(null);
            }}>
              Try Again
            </button>
          </div>
        )}

        {splatData && !isLoading && (
          <>
            <div className="viewer-info">
              <span>Points: {splatData.points.length.toLocaleString()}</span>
              <button onClick={() => setSplatData(null)}>
                Load New File
              </button>
            </div>
            <Viewer3D splatData={splatData} />
          </>
        )}
      </main>
    </div>
  );
}

export default App;