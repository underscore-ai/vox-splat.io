import React from 'react';
import { X, FileBox, Clock } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  lastOpened: Date;
  format: string;
}

interface ProjectsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  recentProjects: Project[];
  onProjectSelect: (project: Project) => void;
}

const ProjectsPanel: React.FC<ProjectsPanelProps> = ({
  isOpen,
  onClose,
  recentProjects,
  onProjectSelect,
}) => {
  return (
    <div className={`projects-panel ${isOpen ? 'open' : ''}`}>
      <div className="projects-panel-header">
        <h2>Recent Projects</h2>
        <button className="close-button" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      <div className="projects-panel-content">
        {recentProjects.length === 0 ? (
          <div className="no-projects">
            <FileBox size={48} />
            <p>No recent projects</p>
            <span>Your recently opened files will appear here</span>
          </div>
        ) : (
          <div className="projects-list">
            {recentProjects.map((project) => (
              <div
                key={project.id}
                className="project-item"
                onClick={() => onProjectSelect(project)}
              >
                <FileBox size={20} />
                <div className="project-info">
                  <h3>{project.name}</h3>
                  <div className="project-meta">
                    <span className="format">{project.format}</span>
                    <span className="last-opened">
                      <Clock size={12} />
                      {new Date(project.lastOpened).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectsPanel; 