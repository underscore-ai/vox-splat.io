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

  return (
    <div 
      className="App"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
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

      <ProjectsPanel
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
        recentProjects={recentProjects}
        onProjectSelect={handleProjectSelect}
      />

      <main className={`app-main ${isDragging ? 'dragging' : ''}`}>
        {viewportObjects.length === 0 && !isLoading && (
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
            <button onClick={handleReset}>
              Try Again
            </button>
          </div>
        )}

        {viewportObjects.length > 0 && !isLoading && (
          <>
            <button className="return-button" onClick={handleReset}>
              <ArrowLeft size={20} />
              Return
            </button>
            <Viewer3D objects={viewportObjects} />
            {showProperties && (
              <FileProperties
                objects={viewportObjects}
                onToggleVisibility={toggleObjectVisibility}
                onRemoveObject={removeObject}
                onUpdatePointSize={updatePointSize}
                onClose={() => setShowProperties(false)}
              />
            )}
            <ViewportControls />
          </>
        )}

        {isDragging && (
          <div className="drag-overlay">
            <Box size={48} />
            <h2>Drop files here</h2>
            <p>Drop your .ply or .splat files to add them to the viewport</p>
          </div>
        )}
      </main>

      {viewportObjects.length === 0 && !isLoading && (
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
      )}
    </div>
  );
}

export default App;