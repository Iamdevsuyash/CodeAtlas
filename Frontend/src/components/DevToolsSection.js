
import React from 'react';

const DevToolsSection = () => {
  return (
    <div id="devtools-content" className="section-content">
      <div className="tools-grid">
        <div className="tool-card">
          <div className="tool-title">GitHub CLI</div>
          <div className="tool-desc">
            Take GitHub to the command line. Work with issues, pull requests, checks, releases and more.
          </div>
          <div style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
            <button type="button" className="tool-link">
              cli.github.com
            </button>
            <button className="filter-btn">Install</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DevToolsSection; 