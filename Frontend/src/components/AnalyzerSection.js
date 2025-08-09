import React, { useState, useEffect } from "react";
import DependencyGraph from "./DependencyGraph";

const AnalyzerSection = () => {
  const [repoUrl, setRepoUrl] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [repoInfo, setRepoInfo] = useState(null);
  const [animateCards, setAnimateCards] = useState(false);

  useEffect(() => {
    if (analysis) {
      setAnimateCards(true);
      setTimeout(() => setAnimateCards(false), 600);
    }
  }, [analysis]);

  const extractRepoInfo = (url) => {
    const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (match) {
      return {
        owner: match[1],
        name: match[2],
        fullName: `${match[1]}/${match[2]}`,
      };
    }
    return null;
  };

  const handleAnalyzeRepo = (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setAnalysis(null);

    const info = extractRepoInfo(repoUrl);
    setRepoInfo(info);

    fetch("https://codeatlas1.onrender.com/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repo_url: repoUrl }),
      credentials: "include",
    })
      .then(async (res) => {
        if (!res.ok) {
          const errData = await res
            .json()
            .catch(() => ({ error: "An unknown error occurred." }));
          throw new Error(
            errData.error || `Request failed with status ${res.status}`
          );
        }
        return res.json();
      })
      .then((data) => {
        if (data.error) {
          throw new Error(data.error);
        }
        setAnalysis(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  };

  const parseStructureAnalysis = (htmlContent) => {
    if (!htmlContent) return null;

    // Extract key metrics from the HTML content
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = htmlContent;
    const text = tempDiv.textContent || tempDiv.innerText || "";

    // Simple parsing to extract metrics
    const lines = text.split("\n").filter((line) => line.trim());
    const metrics = {
      totalFiles: 0,
      languages: [],
      directories: [],
      keyFiles: [],
    };

    lines.forEach((line) => {
      if (line.includes("files") || line.includes("Files")) {
        const match = line.match(/(\d+)/);
        if (match) metrics.totalFiles = parseInt(match[1]);
      }
      if (
        line.includes(".js") ||
        line.includes(".py") ||
        line.includes(".java") ||
        line.includes(".cpp")
      ) {
        const lang = line.match(/\.(\w+)/);
        if (lang && !metrics.languages.includes(lang[1])) {
          metrics.languages.push(lang[1]);
        }
      }
    });

    return metrics;
  };

  const renderOverviewTab = () => {
    if (!analysis) return null;

    const metrics = parseStructureAnalysis(analysis.structure_analysis);

    return (
      <div className="overview-grid">
        <div className={`metric-card ${animateCards ? "animate" : ""}`}>
          <div className="metric-icon">📊</div>
          <div className="metric-content">
            <h3>Repository Analysis</h3>
            <div className="metric-value">{repoInfo?.name || "Repository"}</div>
            <div className="metric-label">Successfully Analyzed</div>
          </div>
        </div>

        <div className={`metric-card ${animateCards ? "animate" : ""}`}>
          <div className="metric-icon">📁</div>
          <div className="metric-content">
            <h3>Total Files</h3>
            <div className="metric-value">{metrics?.totalFiles || "N/A"}</div>
            <div className="metric-label">Files Detected</div>
          </div>
        </div>

        <div className={`metric-card ${animateCards ? "animate" : ""}`}>
          <div className="metric-icon">💻</div>
          <div className="metric-content">
            <h3>Languages</h3>
            <div className="metric-value">
              {metrics?.languages?.length || 0}
            </div>
            <div className="metric-label">Programming Languages</div>
          </div>
        </div>

        <div className={`metric-card ${animateCards ? "animate" : ""}`}>
          <div className="metric-icon">⚡</div>
          <div className="metric-content">
            <h3>Analysis Status</h3>
            <div className="metric-value status-complete">Complete</div>
            <div className="metric-label">Ready for Review</div>
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-header">
            <h3>🔍 Quick Insights</h3>
          </div>
          <div className="summary-content">
            <div className="insight-item">
              <span className="insight-icon">🎯</span>
              <span>
                Repository: <strong>{repoInfo?.fullName}</strong>
              </span>
            </div>
            <div className="insight-item">
              <span className="insight-icon">🏗️</span>
              <span>Structure analyzed and documented</span>
            </div>
            <div className="insight-item">
              <span className="insight-icon">📋</span>
              <span>Setup guide generated</span>
            </div>
            <div className="insight-item">
              <span className="insight-icon">✅</span>
              <span>README summary available</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderReadmeTab = () => {
    if (!analysis?.readme_summary)
      return <div className="no-data">No README analysis available</div>;

    return (
      <div className="content-tab">
        <div className="content-header">
          <div className="content-icon">📖</div>
          <div>
            <h3>README Analysis</h3>
            <p>AI-powered summary and insights from the repository's README</p>
          </div>
        </div>
        <div className="content-body">
          <div
            className="formatted-content"
            dangerouslySetInnerHTML={{ __html: analysis.readme_summary }}
          />
        </div>
      </div>
    );
  };

  const renderStructureTab = () => {
    if (!analysis?.structure_analysis)
      return <div className="no-data">No structure analysis available</div>;

    return (
      <div className="content-tab">
        <div className="content-header">
          <div className="content-icon">🏗️</div>
          <div>
            <h3>Repository Structure</h3>
            <p>
              Detailed analysis of the codebase organization and architecture
            </p>
          </div>
        </div>
        <div className="content-body">
          <div
            className="formatted-content"
            dangerouslySetInnerHTML={{ __html: analysis.structure_analysis }}
          />
        </div>
      </div>
    );
  };

  const renderSetupTab = () => {
    if (!analysis?.setup_guide)
      return <div className="no-data">No setup guide available</div>;

    return (
      <div className="content-tab">
        <div className="content-header">
          <div className="content-icon">⚙️</div>
          <div>
            <h3>Setup Guide</h3>
            <p>
              Step-by-step instructions to get the repository running locally
            </p>
          </div>
        </div>
        <div className="content-body">
          <div
            className="formatted-content"
            dangerouslySetInnerHTML={{ __html: analysis.setup_guide }}
          />
        </div>
      </div>
    );
  };

  const renderGraphTab = () => {
    if (!analysis?.structure_analysis)
      return (
        <div className="no-data">
          No structure analysis available for graph visualization
        </div>
      );

    return (
      <DependencyGraph
        structureAnalysis={analysis.structure_analysis}
        repoInfo={repoInfo}
        fileStructure={analysis.file_structure}
      />
    );
  };

  return (
    <div className="analyzer-section">
      <div className="analyzer-header">
        <div className="header-content">
          <div className="header-icon">🔬</div>
          <div>
            <h1>Repository Analyzer</h1>
            <p>
              AI-powered analysis of GitHub repositories with detailed insights
            </p>
          </div>
        </div>
      </div>

      <div className="analyzer-search">
        <form className="modern-search-bar" onSubmit={handleAnalyzeRepo}>
          <div className="search-input-group">
            <div className="search-icon">🔍</div>
            <input
              type="text"
              placeholder="Enter GitHub repository URL (e.g., https://github.com/owner/repo)"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              className="search-input"
            />
            <button type="submit" disabled={loading} className="search-button">
              {loading ? (
                <>
                  <div className="loading-spinner"></div>
                  Analyzing...
                </>
              ) : (
                <>
                  <span className="button-icon">⚡</span>
                  Analyze
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {error && (
        <div className="error-banner">
          <div className="error-icon">⚠️</div>
          <div className="error-content">
            <h4>Analysis Failed</h4>
            <p>{error}</p>
          </div>
        </div>
      )}

      {loading && (
        <div className="loading-banner">
          <div className="loading-animation">
            <div className="loading-dots">
              <div></div>
              <div></div>
              <div></div>
            </div>
          </div>
          <div className="loading-content">
            <h4>Analyzing Repository</h4>
            <p>
              Please wait while we analyze the repository structure and generate
              insights...
            </p>
          </div>
        </div>
      )}

      {analysis && (
        <div className="analysis-container">
          <div className="analysis-tabs">
            <button
              className={`tab-button ${
                activeTab === "overview" ? "active" : ""
              }`}
              onClick={() => setActiveTab("overview")}
            >
              <span className="tab-icon">📊</span>
              Overview
            </button>
            <button
              className={`tab-button ${activeTab === "readme" ? "active" : ""}`}
              onClick={() => setActiveTab("readme")}
            >
              <span className="tab-icon">📖</span>
              README
            </button>
            <button
              className={`tab-button ${
                activeTab === "structure" ? "active" : ""
              }`}
              onClick={() => setActiveTab("structure")}
            >
              <span className="tab-icon">🏗️</span>
              Structure
            </button>
            <button
              className={`tab-button ${activeTab === "setup" ? "active" : ""}`}
              onClick={() => setActiveTab("setup")}
            >
              <span className="tab-icon">⚙️</span>
              Setup
            </button>
            <button
              className={`tab-button ${activeTab === "graph" ? "active" : ""}`}
              onClick={() => setActiveTab("graph")}
            >
              <span className="tab-icon">🕸️</span>
              Graph
            </button>
          </div>

          <div className="tab-content">
            {activeTab === "overview" && renderOverviewTab()}
            {activeTab === "readme" && renderReadmeTab()}
            {activeTab === "structure" && renderStructureTab()}
            {activeTab === "setup" && renderSetupTab()}
            {activeTab === "graph" && renderGraphTab()}
          </div>
        </div>
      )}

      {!analysis && !loading && (
        <div className="welcome-state">
          <div className="welcome-icon">🚀</div>
          <h3>Ready to Analyze</h3>
          <p>
            Enter a GitHub repository URL above to get started with AI-powered
            analysis
          </p>
          <div className="feature-list">
            <div className="feature-item">
              <span className="feature-icon">📖</span>
              <span>README Summary & Insights</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">🏗️</span>
              <span>Code Structure Analysis</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">⚙️</span>
              <span>Setup Guide Generation</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalyzerSection;
