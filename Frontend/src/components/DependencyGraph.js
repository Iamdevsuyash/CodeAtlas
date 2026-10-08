import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

const FILE_COLORS = {
  js: '#f7df1e', jsx: '#61dafb', ts: '#3178c6', tsx: '#3178c6', py: '#3776ab', java: '#ed8b00',
  cpp: '#00599c', c: '#a8b9cc', html: '#e34f26', css: '#1572b6', json: '#000000', md: '#083fa1',
  yml: '#cb171e', yaml: '#cb171e', xml: '#0060ac', go: '#00add8', rs: '#dea584', rb: '#cc342d'
};
const FILE_CATEGORIES = {
  js: 'Source code', jsx: 'Source code', ts: 'Source code', tsx: 'Source code', py: 'Source code',
  java: 'Source code', cpp: 'Source code', c: 'Source code', go: 'Source code', rs: 'Source code',
  rb: 'Source code', html: 'Markup', css: 'Stylesheet', scss: 'Stylesheet', json: 'Config / data',
  yml: 'Config', yaml: 'Config', toml: 'Config', xml: 'Config / data', md: 'Documentation',
  txt: 'Documentation', png: 'Asset', jpg: 'Asset', svg: 'Asset'
};
const getFileColor = (extension) => FILE_COLORS[extension] || '#6c757d';

const DependencyGraph = ({ structureAnalysis, repoInfo, fileStructure }) => {
  const svgRef = useRef();
  const [selectedNode, setSelectedNode] = useState(null);
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [currentPath, setCurrentPath] = useState([]);
  const [breadcrumbs, setBreadcrumbs] = useState([{ name: 'Root', path: [] }]);

  // Parse structure for specific path. A hub node represents the current folder and
  // links to every child; ids are prefixed so a file and folder with the same name don't clash.
  const parseStructureForPath = useCallback((path) => {
    const nodes = [];
    const links = [];
    if (!fileStructure) return { nodes, links };

    const allFiles = fileStructure.split('\n').filter(file => file.trim());
    const prefix = path.length ? path.join('/') + '/' : '';
    const dirCounts = new Map();
    const files = [];
    allFiles.forEach(filePath => {
      if (prefix && !filePath.startsWith(prefix)) return;
      const parts = filePath.substring(prefix.length).split('/');
      if (parts.length === 1) {
        files.push(parts[0]);
      } else {
        dirCounts.set(parts[0], (dirCounts.get(parts[0]) || 0) + 1);
      }
    });

    const hubName = path.length ? path[path.length - 1] : (repoInfo?.name || 'Root');
    const childCount = dirCounts.size + files.length;
    nodes.push({
      id: 'hub', name: hubName, type: 'hub', size: 24, color: '#8b5cf6',
      connections: childCount, category: 'Current folder'
    });

    if (path.length > 0) {
      nodes.push({ id: 'back', name: '← Back', type: 'back', size: 15, color: '#6c757d',
        connections: 1, category: 'Navigation' });
    }

    Array.from(dirCounts.keys()).sort().forEach(dir => {
      nodes.push({
        id: `dir:${dir}`, name: dir, type: 'directory', size: 20, color: '#ffd700',
        canDrillDown: true, connections: dirCounts.get(dir), category: 'Directory'
      });
    });

    files.sort().forEach(file => {
      const extension = file.includes('.') ? file.split('.').pop().toLowerCase() : '';
      nodes.push({
        id: `file:${file}`, name: file, type: 'file', extension, size: 12,
        color: getFileColor(extension), connections: 1,
        category: FILE_CATEGORIES[extension] || 'Other file'
      });
    });

    nodes.slice(1).forEach(node => {
      links.push({ source: 'hub', target: node.id, type: 'contains' });
    });

    return { nodes, links };
  }, [fileStructure, repoInfo]);

  // Navigation helpers
  const updateBreadcrumbs = useCallback((path) => {
    const crumbs = [{ name: 'Root', path: [] }];
    for (let i = 0; i < path.length; i++) {
      crumbs.push({
        name: path[i],
        path: path.slice(0, i + 1)
      });
    }
    setBreadcrumbs(crumbs);
  }, []);

  const refreshGraph = useCallback((path) => {
    setIsLoading(true);
    // Remove artificial delay for faster loading
    const data = parseStructureForPath(path);
    setGraphData(data);
    setIsLoading(false);
  }, [parseStructureForPath]);

  // Navigation handlers
  const navigateToDirectory = useCallback((dirName) => {
    const newPath = [...currentPath, dirName];
    setCurrentPath(newPath);
    updateBreadcrumbs(newPath);
    refreshGraph(newPath);
  }, [currentPath, updateBreadcrumbs, refreshGraph]);

  const navigateBack = useCallback(() => {
    const newPath = currentPath.slice(0, -1);
    setCurrentPath(newPath);
    updateBreadcrumbs(newPath);
    refreshGraph(newPath);
  }, [currentPath, updateBreadcrumbs, refreshGraph]);

  const navigateToPath = useCallback((targetPath) => {
    setCurrentPath(targetPath);
    updateBreadcrumbs(targetPath);
    refreshGraph(targetPath);
  }, [updateBreadcrumbs, refreshGraph]);

  // Initialize graph data on component mount
  useEffect(() => {
    const data = parseStructureForPath(currentPath);
    setGraphData(data);
    setIsLoading(false);
  }, [parseStructureForPath, currentPath]);

  // Create D3 visualization
  useEffect(() => {
    if (!graphData || isLoading) return;

    // Clear previous SVG content
    d3.select(svgRef.current).selectAll('*').remove();

    const width = 800;
    const height = 600;

    // Create SVG container
    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', [0, 0, width, height])
      .attr('class', 'dependency-graph-svg')
      .style('background', 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)')
      .style('border-radius', '10px');

    // Create force simulation
    const simulation = d3.forceSimulation(graphData.nodes)
      .force('link', d3.forceLink(graphData.links).id(d => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(d => d.size + 5));

    // Create links
    const linkGroups = svg.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(graphData.links)
      .enter()
      .append('line')
      .attr('class', 'link')
      .attr('stroke', '#4a4a8a')
      .attr('stroke-width', 1.5);

    // Create nodes
    const nodeGroups = svg.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(graphData.nodes)
      .enter()
      .append('g')
      .attr('class', 'node-group')
      .call(d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended))
      .on('click', handleClick)
      .on('mouseover', handleMouseOver)
      .on('mouseout', handleMouseOut);

    // Add circles to nodes
    nodeGroups.append('circle')
      .attr('r', d => d.size)
      .attr('fill', d => d.color)
      .attr('class', 'node')
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 1.5);

    // Add text to nodes
    nodeGroups.append('text')
      .text(d => d.name)
      .attr('class', 'node-label')
      .attr('text-anchor', 'middle')
      .attr('dy', d => d.size + 15)
      .attr('fill', '#ffffff')
      .attr('font-size', '10px')
      .attr('font-family', 'monospace');

    // Add icons to nodes
    nodeGroups.append('text')
      .text(d => {
        if (d.type === 'hub') return '📂';
        if (d.type === 'back') return '🔙';
        if (d.type === 'directory') return '📁';
        if (d.type === 'file') {
          const extension = d.extension;
          if (['js', 'jsx'].includes(extension)) return '📄';
          if (['ts', 'tsx'].includes(extension)) return '📘';
          if (extension === 'py') return '🐍';
          if (extension === 'html') return '🌐';
          if (extension === 'css') return '🎨';
          if (['json', 'yml', 'yaml'].includes(extension)) return '📋';
          if (extension === 'md') return '📝';
          return '📄';
        }
        return '';
      })
      .attr('class', 'node-icon')
      .attr('text-anchor', 'middle')
      .attr('dy', 4)
      .attr('font-size', d => d.size * 0.8);

    // Update positions on each tick
    simulation.on('tick', () => {
      linkGroups
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      nodeGroups
        .attr('transform', d => `translate(${d.x}, ${d.y})`);
    });

    // Event handlers
    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    function handleMouseOver(event, d) {
      const connectedNodeIds = new Set();
      graphData.links.forEach(link => {
        if (link.source.id === d.id) connectedNodeIds.add(link.target.id);
        if (link.target.id === d.id) connectedNodeIds.add(link.source.id);
      });

      nodeGroups
        .select('.node')
        .attr('fill', node => 
          node.id === d.id ? node.color : 
          connectedNodeIds.has(node.id) ? '#ffffff' : 
          '#6c757d'
        )
        .attr('r', node => 
          node.id === d.id ? node.size * 1.2 : 
          connectedNodeIds.has(node.id) ? node.size * 1.1 : 
          node.size
        );

      linkGroups
        .attr('stroke', link => 
          (link.source.id === d.id || link.target.id === d.id) ? 
          '#ffffff' : '#4a4a8a'
        )
        .attr('stroke-width', link => 
          (link.source.id === d.id || link.target.id === d.id) ? 
          3 : 1.5
        );
    }

    function handleMouseOut(event, d) {
      nodeGroups
        .select('.node')
        .attr('fill', node => node.color)
        .attr('r', node => node.size);

      linkGroups
        .attr('stroke', '#4a4a8a')
        .attr('stroke-width', 1.5);
    }

    function handleClick(event, d) {
      if (d.type === 'directory' && d.canDrillDown) {
        navigateToDirectory(d.name);
      } else if (d.type === 'back') {
        navigateBack();
      } else {
        setSelectedNode(d);
      }
    }

    // Cleanup
    return () => {
      simulation.stop();
    };
  }, [graphData, isLoading, navigateBack, navigateToDirectory]);

  if (isLoading) {
    return (
      <div className="graph-loading">
        <div className="graph-loading-animation">
          <div className="loading-graph-dots">
            <div></div>
            <div></div>
            <div></div>
          </div>
        </div>
        <h4>Building Dependency Graph</h4>
        <p>Analyzing file connections and repository structure...</p>
      </div>
    );
  }

  return (
    <div className="dependency-graph-container">
      {/* Breadcrumbs */}
      <div className="graph-breadcrumbs">
        {breadcrumbs.map((crumb, index) => (
          <span key={index}>
            <button 
              className="breadcrumb-link"
              onClick={() => navigateToPath(crumb.path)}
            >
              {crumb.name}
            </button>
            {index < breadcrumbs.length - 1 && <span> / </span>}
          </span>
        ))}
      </div>

      <div className="graph-header">
        <div className="graph-title">
          <h3>🕸️ Interactive Dependency Graph</h3>
          <p>Explore file connections and repository structure</p>
        </div>
        <div className="graph-controls">
          <div className="graph-legend">
            <div className="legend-item">
              <div className="legend-color" style={{ backgroundColor: '#7c4dff' }}></div>
              <span>Contains</span>
            </div>
            <div className="legend-item">
              <div className="legend-color" style={{ backgroundColor: '#28a745' }}></div>
              <span>Imports</span>
            </div>
          </div>
        </div>
      </div>

      <div className="graph-content">
        <div className="graph-visualization">
          <svg ref={svgRef}></svg>
        </div>

        {selectedNode && (
          <div className="node-details">
            <div className="node-details-header">
              <span className="node-icon">
                {selectedNode.type === 'directory' ? '📁' : 
                 selectedNode.extension === 'js' ? '📄' :
                 selectedNode.extension === 'jsx' ? '📄' :
                 selectedNode.extension === 'ts' ? '📘' :
                 selectedNode.extension === 'tsx' ? '📘' :
                 selectedNode.extension === 'py' ? '🐍' :
                 selectedNode.extension === 'html' ? '🌐' :
                 selectedNode.extension === 'css' ? '🎨' :
                 selectedNode.extension === 'json' ? '📋' :
                 selectedNode.extension === 'md' ? '📝' :
                 '📄'}
              </span>
              <div>
                <h4>{selectedNode.name}</h4>
                <p>
                  {selectedNode.type === 'directory' ? 'Directory' : 
                   selectedNode.extension ? `${selectedNode.extension.toUpperCase()} File` : 'File'}
                </p>
              </div>
              <button 
                className="close-details"
                onClick={() => setSelectedNode(null)}
              >
                ✕
              </button>
            </div>
            <div className="node-details-content">
              <div className="detail-item">
                <strong>Type:</strong> {selectedNode.type}
              </div>
              {selectedNode.extension && (
                <div className="detail-item">
                  <strong>Extension:</strong> .{selectedNode.extension}
                </div>
              )}
              {selectedNode.canDrillDown !== undefined && (
                <div className="detail-item">
                  <strong>Drill-down:</strong> {selectedNode.canDrillDown ? 'Available' : 'Not available'}
                </div>
              )}
              <div className="detail-item">
                <strong>Connections:</strong> {selectedNode.connections}
              </div>
              <div className="detail-item">
                <strong>Category:</strong> {selectedNode.category}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="graph-instructions">
        <div className="instruction-item">
          <span className="instruction-icon">🖱️</span>
          <span>Click and drag nodes to explore</span>
        </div>
        <div className="instruction-item">
          <span className="instruction-icon">🔍</span>
          <span>Hover over nodes to highlight connections</span>
        </div>
        <div className="instruction-item">
          <span className="instruction-icon">📱</span>
          <span>Click nodes for detailed information</span>
        </div>
        <div className="instruction-item">
          <span className="instruction-icon">📂</span>
          <span>Click folder icons to navigate into subdirectories</span>
        </div>
      </div>
    </div>
  );
};

export default DependencyGraph;
