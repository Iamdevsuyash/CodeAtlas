
import React from 'react';

const ProjectsSection = () => {
  return (
    <div id="projects-content" className="section-content">
      <div className="project-dashboard">
        <div className="project-main">
          <div className="project-tabs">
            <div className="project-tab active">Kanban Board</div>
            <div className="project-tab">Timeline</div>
            <div className="project-tab">Resources</div>
          </div>
          <div className="project-content">
            <div className="kanban-board">
              <div className="kanban-column">
                <div className="kanban-header">
                  <span>📋 To Do</span>
                  <span className="task-count">4</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="project-sidebar">
          <div className="panel-header">Team Members</div>
          <div style={{ padding: '15px' }}>
            <div className="team-section">
              <div className="team-member">
                <div className="member-avatar">JD</div>
                <div className="member-info">
                  <div className="member-name">John Developer</div>
                  <div className="member-role">Project Lead</div>
                </div>
                <div className="member-status"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectsSection; 