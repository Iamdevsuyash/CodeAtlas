
import React from 'react';

const RelatedSection = () => {
  return (
    <div id="related-content" className="section-content">
      <div className="tools-grid" id="relatedRepos">
        <div className="tool-card">
          <div className="tool-title">Similar Project: React Dashboard</div>
          <div className="tool-desc">
            A comprehensive React dashboard with modern UI components and charts. Perfect for admin interfaces.
          </div>
          <div style={{ margin: '10px 0' }}>
            <span className="skill-tag">React</span>
            <span className="skill-tag">TypeScript</span>
            <span className="skill-tag">Chart.js</span>
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <button type="button" className="tool-link">
              github.com/user/react-dashboard
            </button>
            <button className="post-btn" style={{ padding: '3px 8px', fontSize: '10px' }}>
              Fork & Enhance
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RelatedSection; 