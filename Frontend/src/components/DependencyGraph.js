import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

const DependencyGraph = ({ structureAnalysis, repoInfo, fileStructure }) => {
  const svgRef = useRef();
  const [selectedNode, setSelectedNode] = useState(null);
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [currentPath, setCurrentPath] = useState([]);
  const [breadcrumbs, setBreadcrumbs] = useState([{ name: 'Root', path: [] }]);

  // Get file color based on extension
  const getFileColor = (extension) => {
    const fileTypeConfig = {
      'js': '#f7df1e',
      'jsx': '#61dafb',
      'ts': '#3178c6',
      'tsx': '#3178c6',
      'py': '#3776ab',
      'java': '#ed8b00',
      'cpp': '#00599c',
      'c': '#a8b9cc',
      'html': '#e34f26',
      'css': '#1572b6',
      'json': '#000000',
      'md': '#083fa1',
      'yml': '#cb171e',
      'yaml': '#cb171e',
      'xml': '#0060ac',
      'default': '#6c757d'
    };
    return fileTypeConfig[extension] || fileTypeConfig.default;
  };

  // Parse structure for specific path
  const parseStructureForPath = useCallback((path) => {
    // Use real GitHub repository structure if available
    if (!fileStructure || !repoInfo) {
      // Fallback to sample data if no real data available
      const structure = {
        'root': {
          directories: ['src', 'public', 'docs'],
          files: ['package.json', 'README.md', '.gitignore']
        },
        'src': {
          directories: ['components', 'pages', 'utils'],
          files: ['App.js', 'index.js', 'App.css']
        },
        'components': {
          directories: [],
          files: ['Header.js', 'Footer.js', 'Sidebar.js', 'DependencyGraph.js']
        }
      };
      const currentLevel = path.length === 0 ? 'root' : path[path.length - 1];
      const levelData = structure[currentLevel] || { directories: [], files: [] };
      
      const nodes = [];
      const links = [];

      // Add back button if not at root
      if (path.length > 0) {
        nodes.push({
          id: 'back',
          name: '← Back',
          type: 'back',
          size: 15,
          color: '#6c757d'
        });
      }

      // Add directories and files from fallback data
      levelData.directories.forEach(dir => {
        nodes.push({
          id: dir,
          name: dir,
          type: 'directory',
          size: 20,
          color: '#ffd700',
          canDrillDown: true
        });
      });

      levelData.files.forEach(file => {
        const extension = file.split('.').pop().toLowerCase();
        nodes.push({
          id: file,
          name: file,
          type: 'file',
          extension,
          size: 12,
          color: getFileColor(extension)
        });
      });

      // Create links
      for (let i = 1; i < nodes.length; i++) {
        links.push({
          source: nodes[0].id === 'back' ? nodes[1].id : nodes[0].id,
          target: nodes[i].id,
          type: 'contains'
        });
      }

      return { nodes, links };
    }

    // Parse real GitHub file structure
    const allFiles = fileStructure.split('\n').filter(file => file.trim());
    
    // Build hierarchical structure from file paths
    const currentPathStr = path.join('/');
    const directories = new Set();
    const files = [];
    
    allFiles.forEach(filePath => {
      if (currentPathStr === '') {
        // Root level
        const parts = filePath.split('/');
        if (parts.length === 1) {
          // File in root
          files.push(parts[0]);
        } else {
          // Directory in root
          directories.add(parts[0]);
        }
      } else {
        // Subdirectory level
        if (filePath.startsWith(currentPathStr + '/')) {
          const relativePath = filePath.substring(currentPathStr.length + 1);
          const parts = relativePath.split('/');
          if (parts.length === 1) {
            // File in current directory
            files.push(parts[0]);
          } else {
            // Subdirectory in current directory
            directories.add(parts[0]);
          }
        }
      }
    });

    const levelData = {
      directories: Array.from(directories),
      files: files
    };
    
    const nodes = [];
    const links = [];

    // Add back button if not at root
    if (path.length > 0) {
      nodes.push({
        id: 'back',
        name: '← Back',
        type: 'back',
        size: 15,
        color: '#6c757d'
      });
    }

    // Add directories
    levelData.directories.forEach(dir => {
      nodes.push({
        id: dir,
        name: dir,
        type: 'directory',
        size: 20,
        color: '#ffd700',
        canDrillDown: true
      });
    });

    // Add files
    levelData.files.forEach(file => {
      const extension = file.split('.').pop().toLowerCase();
      nodes.push({
        id: file,
        name: file,
        type: 'file',
        extension,
        size: 12,
        color: getFileColor(extension)
      });
    });

    // Create links
    for (let i = 1; i < nodes.length; i++) {
      links.push({
        source: nodes[0].id === 'back' ? nodes[1].id : nodes[0].id,
        target: nodes[i].id,
        type: 'contains'
      });
    }

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
        navigateToDirectory(d.id);
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
