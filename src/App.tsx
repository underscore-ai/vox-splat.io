// src/App.tsx
import React, { useState, useEffect, DragEvent } from 'react';
import FileUpload from './components/FileUpload';
import Viewer3D from './components/Viewer3D';
import FileProperties from './components/FileProperties';
import ProjectsPanel from './components/ProjectsPanel';
import { SplatData } from './types/SplatTypes';
import { Box, ArrowLeft, Github, Heart } from 'lucide-react';
import './App.css';
import { parsePlyFile } from './parsers/PlyParser';
import { parseSplatFile } from './parsers/SplatParser';
import uaiLogo from './assets/uai.jpeg';
import ViewportControls from './components/ViewportControls';

interface Project {
  id: string;
  name: string;
  lastOpened: Date;
  format: string;
}

interface ViewportObject {
  id: string;
  data: SplatData;
  isVisible: boolean;
  pointSize: number;
}

function App() {
  const [viewportObjects, setViewportObjects] = useState<ViewportObject[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showProperties, setShowProperties] = useState(true);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [highlightedObjectId, setHighlightedObjectId] = useState<string | undefined>();
  const [showGrid, setShowGrid] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showCameraTools, setShowCameraTools] = useState(false);
  const [activeEditingTool, setActiveEditingTool] = useState<string | null>(null);
  const [brushSize, setBrushSize] = useState(20);

  useEffect(() => {
    // Load recent projects from localStorage
    const savedProjects = localStorage.getItem('recentProjects');
    if (savedProjects) {
      setRecentProjects(JSON.parse(savedProjects));
    }
  }, []);

  const handleFileLoad = (data: SplatData) => {
    const newObject: ViewportObject = {
      id: Date.now().toString(),
      data,
      isVisible: true,
      pointSize: 0.005
    };

    setViewportObjects(prev => [...prev, newObject]);
    setError(null);
    setShowProperties(true);

    // Add to recent projects
    const newProject: Project = {
      id: newObject.id,
      name: data.metadata.fileName,
      lastOpened: new Date(),
      format: data.metadata.format,
    };

    const updatedProjects = [
      newProject,
      ...recentProjects.filter(p => p.name !== newProject.name).slice(0, 9)
    ];
    setRecentProjects(updatedProjects);
    localStorage.setItem('recentProjects', JSON.stringify(updatedProjects));
  };

  const handleLoadingChange = (loading: boolean) => {
    setIsLoading(loading);
  };

  const handleError = (errorMessage: string) => {
    setError(errorMessage);
    setIsLoading(false);
  };

  const handleReset = () => {
    setError(null);
    setViewportObjects([]);
    setShowProperties(false);
  };

  const handleProjectSelect = (project: Project) => {
    // Here you would load the project data
    setIsPanelOpen(false);
  };

  const togglePanel = () => {
    setIsPanelOpen(!isPanelOpen);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      try {
        setIsLoading(true);
        // Process each dropped file
        for (const file of files) {
          const fileName = file.name.toLowerCase();
          if (fileName.endsWith('.ply') || fileName.endsWith('.splat')) {
            const arrayBuffer = await file.arrayBuffer();
            let splatData;

            if (fileName.endsWith('.ply')) {
              splatData = await parsePlyFile(arrayBuffer, file.name, file.size);
            } else {
              splatData = await parseSplatFile(arrayBuffer, file.name, file.size);
            }

            handleFileLoad(splatData);
          }
        }
      } catch (error) {
        handleError(error instanceof Error ? error.message : 'Failed to load file');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const toggleObjectVisibility = (objectId: string) => {
    setViewportObjects(prev =>
      prev.map(obj =>
        obj.id === objectId ? { ...obj, isVisible: !obj.isVisible } : obj
      )
    );
  };

  const removeObject = (objectId: string) => {
    setViewportObjects(prev => prev.filter(obj => obj.id !== objectId));
  };

  const updatePointSize = (objectId: string, size: number) => {
    setViewportObjects(prev =>
      prev.map(obj =>
        obj.id === objectId ? { ...obj, pointSize: size } : obj
      )
    );
  };

  const handleObjectHighlight = (objectId: string) => {
    setHighlightedObjectId(objectId);
    setTimeout(() => setHighlightedObjectId(undefined), 1000);
  };

  const toggleGrid = () => {
    setShowGrid(prev => !prev);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const toggleCameraTools = () => {
    setShowCameraTools(prev => !prev);
    setActiveEditingTool(null);
  };

  const handleToolSelect = (tool: string) => {
    setActiveEditingTool(activeEditingTool === tool ? null : tool);
  };

  return (
    <div 
      className="App"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {viewportObjects.length === 0 && !isLoading && !error && (
        <>
          <header className="app-header">
            <div className="header-left" onClick={togglePanel} style={{ cursor: 'pointer' }}>
              <div className="logo-container">
                <img src={uaiLogo} alt="UAI Logo" className="logo-image" />
              </div>
              <div className="header-content">
                <h1>Vox-Splat</h1>
              </div>
            </div>
          </header>

          <main className={`app-main ${isDragging ? 'dragging' : ''}`}>
            <FileUpload
              onFileLoad={handleFileLoad}
              onLoadingChange={handleLoadingChange}
              onError={handleError}
            />
          </main>

          <div className="support-section">
            <h3>Support the Project</h3>
            <p>
              Vox-Splat is an open-source project dedicated to making 3D point cloud visualization accessible to everyone.
              If you find it useful, consider supporting its development!
            </p>
            <div className="support-links">
              <a 
                href="https://github.com/underscore-ai/vox-splat.io" 
                target="_blank" 
                rel="noopener noreferrer"
                className="support-link"
              >
                <Github size={16} />
                Star on GitHub
              </a>
              <a 
                href="https://github.com/underscore-ai" 
                target="_blank" 
                rel="noopener noreferrer"
                className="support-link"
              >
                <Heart size={16} />
                Sponsor
              </a>
            </div>
          </div>
        </>
      )}

      <ProjectsPanel
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
        recentProjects={recentProjects}
        onProjectSelect={handleProjectSelect}
      />

      {isLoading && (
        <main className="app-main">
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Processing your file...</p>
          </div>
        </main>
      )}

      {error && (
        <main className="app-main">
          <div className="error-container">
            <h3>Error</h3>
            <p>{error}</p>
            <button onClick={handleReset}>
              Try Again
            </button>
          </div>
        </main>
      )}

      {viewportObjects.length > 0 && !isLoading && (
        <main className="app-main viewport-main">
          <button className="return-button" onClick={handleReset}>
            <ArrowLeft size={20} />
            Return
          </button>
          <Viewer3D 
            objects={viewportObjects} 
            highlightedObjectId={highlightedObjectId}
            showGrid={showGrid}
            activeTool={activeEditingTool}
            brushSize={brushSize}
          />
          {showProperties && (
            <FileProperties
              objects={viewportObjects}
              onToggleVisibility={toggleObjectVisibility}
              onRemoveObject={removeObject}
              onUpdatePointSize={updatePointSize}
              onClose={() => setShowProperties(false)}
              onObjectHighlight={handleObjectHighlight}
            />
          )}
          <ViewportControls 
            onToggleProperties={() => setShowProperties(!showProperties)} 
            onToggleGrid={toggleGrid}
            showGrid={showGrid}
            onToggleFullscreen={toggleFullscreen}
            isFullscreen={isFullscreen}
            onToggleCameraTools={toggleCameraTools}
            showCameraTools={showCameraTools}
          />
          {showCameraTools && (
            <div className="editing-tools-panel">
              <button 
                className={`editing-tool-button ${activeEditingTool === 'box-select' ? 'active' : ''}`} 
                title="Box Selection"
                onClick={() => handleToolSelect('box-select')}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 3h18v18H3z" />
                </svg>
              </button>
              <div className={`brush-tool-container ${activeEditingTool === 'brush-select' ? 'active' : ''}`}>
                <button 
                  className={`editing-tool-button`}
                  title="Brush Selection"
                  onClick={() => handleToolSelect('brush-select')}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 19l7-7a4.95 4.95 0 1 0-7-7l-7 7" />
                    <path d="M5 19h14" />
                  </svg>
                </button>
                {activeEditingTool === 'brush-select' && (
                  <div className="brush-size-control">
                    <input
                      type="range"
                      min="5"
                      max="50"
                      value={brushSize}
                      onChange={(e) => setBrushSize(Number(e.target.value))}
                    />
                    <span className="brush-size-value">{brushSize}px</span>
                  </div>
                )}
              </div>
              <button 
                className={`editing-tool-button ${activeEditingTool === 'lasso-select' ? 'active' : ''}`} 
                title="Lasso Selection"
                onClick={() => handleToolSelect('lasso-select')}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M7 22a5 5 0 0 1-2-4c0-3 3-6 6-6s6 3 6 6c0 2-.5 4-2 6" />
                  <path d="M5 12c0-4.4 3.6-8 8-8s8 3.6 8 8" />
                </svg>
              </button>
              <div className="tool-separator"></div>
              <button 
                className="editing-tool-button" 
                title="Reset View"
                onClick={() => {/* TODO: Implement reset view */}}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 3v7h-7" />
                  <path d="M21 10c0 7-4 10-11 10-3 0-5.5-1-7-2.5" />
                  <path d="M3 21v-7h7" />
                </svg>
              </button>
            </div>
          )}
        </main>
      )}

      {isDragging && (
        <div className="drag-overlay">
          <Box size={48} />
          <h2>Drop files here</h2>
          <p>Drop your .ply or .splat files to add them to the viewport</p>
        </div>
      )}
    </div>
  );
}

export default App;