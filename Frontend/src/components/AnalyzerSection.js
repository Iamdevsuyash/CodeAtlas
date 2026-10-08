import React, { useCallback, useState, useEffect } from "react";
import { getApiUrl } from "../config/api";
import DependencyGraph from "./DependencyGraph";

const extractRepoInfo = (url) => {
  const match = url.match(/github\.com[/:]([^/\s]+)\/([^/\s#?]+)/);
  if (match) {
    const name = match[2].replace(/\.git$/, "");
    return {
      owner: match[1],
      name,
      fullName: `${match[1]}/${name}`,
    };
  }
  return null;
};

// Survives unmounts (switching sidebar sections) so results aren't re-requested.
const analysisCache = new Map();
let lastAnalysis = null; // { url, data }

const AnalyzerSection = ({ selectedRepo }) => {
  const [repoUrl, setRepoUrl] = useState(lastAnalysis?.url || "");
  const [analysis, setAnalysis] = useState(lastAnalysis?.data || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [repoInfo, setRepoInfo] = useState(
    lastAnalysis ? extractRepoInfo(lastAnalysis.url) : null
  );
  const [animateCards, setAnimateCards] = useState(false);

  const startAnalysis = useCallback((url) => {
    if (!url) return;
    const info = extractRepoInfo(url);
    setRepoInfo(info);
    setError(null);
    const cacheKey = info ? info.fullName.toLowerCase() : url;
    if (analysisCache.has(cacheKey)) {
      const data = analysisCache.get(cacheKey);
      lastAnalysis = { url, data };
      setAnalysis(data);
      return;
    }
    setLoading(true);
    setAnalysis(null);

    fetch(getApiUrl("/api/analyze"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repo_url: url }),
      credentials: "include",
    })
      .then(async (res) => {
        if (!res.ok) {
          const errData = await res.json().catch(() => ({ error: "An unknown error occurred." }));
          throw new Error(errData.error || `Request failed with status ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        if (data.error) throw new Error(data.error);
        analysisCache.set(cacheKey, data);
        lastAnalysis = { url, data };
        setAnalysis(data);
        setActiveTab("overview");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleAnalyzeRepo = (e) => {
    e.preventDefault();
    startAnalysis(repoUrl);
  };

  useEffect(() => {
    // Only analyze a newly selected repo; remounting with the same one reuses the result.
    if (selectedRepo && selectedRepo.url && selectedRepo.url !== lastAnalysis?.url) {
      setRepoUrl(selectedRepo.url);
      startAnalysis(selectedRepo.url);
    }
  }, [selectedRepo, startAnalysis]);

  useEffect(() => {
    if (analysis) {
      setAnimateCards(true);
      const timer = setTimeout(() => setAnimateCards(false), 600);
      return () => clearTimeout(timer);
    }
  }, [analysis]);

  const computeMetrics = (data) => {
    const paths = (data?.file_structure || "").split("\n").filter(Boolean);
    const codeExt = new Set(["js", "jsx", "ts", "tsx", "py", "java", "go", "rs", "rb", "php", "cs",
      "cpp", "cc", "c", "h", "hpp", "swift", "kt", "dart", "scala", "vue", "svelte", "lua", "ex", "sh"]);
    const languages = new Set();
    paths.forEach((p) => {
      const ext = p.includes(".") ? p.split(".").pop().toLowerCase() : "";
      if (codeExt.has(ext)) languages.add(ext);
    });
    return {
      totalFiles: data?.repo?.file_count ?? paths.length,
      languages: Array.from(languages),
    };
  };

  const renderOverviewTab = () => {
    if (!analysis) return null;

    const metrics = computeMetrics(analysis);
    const overview = analysis.project_overview || {};
    const inferred = analysis.readme_source === "generated";

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
            <div className="metric-value">{metrics.totalFiles || "N/A"}</div>
            <div className="metric-label">Files Detected</div>
          </div>
        </div>

        <div className={`metric-card ${animateCards ? "animate" : ""}`}>
          <div className="metric-icon">💻</div>
          <div className="metric-content">
            <h3>Languages</h3>
            <div className="metric-value">{metrics.languages.length}</div>
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
                {overview.category && <> · {overview.category}</>}
              </span>
            </div>
            {overview.purpose && (
              <div className="insight-item">
                <span className="insight-icon">💡</span>
                <span>{overview.purpose}</span>
              </div>
            )}
            {overview.tech_stack?.length > 0 && (
              <div className="insight-item">
                <span className="insight-icon">🧰</span>
                <span>Tech stack: {overview.tech_stack.join(", ")}</span>
              </div>
            )}
            <div className="insight-item">
              <span className="insight-icon">{inferred ? "🧠" : "✅"}</span>
              <span>
                {inferred
                  ? "No README found: purpose inferred from the most relevant source files"
                  : `README summary from ${analysis.readme_path || "README"}`}
              </span>
            </div>
            {analysis.key_files?.length > 0 && (
              <div className="insight-item">
                <span className="insight-icon">🔑</span>
                <span>Key files read: {analysis.key_files.map((f) => f.path).join(", ")}</span>
              </div>
            )}
            {analysis.ai_meta && (
              <div className="insight-item">
                <span className="insight-icon">⚡</span>
                <span>
                  {analysis.ai_meta.cached
                    ? "Served from cache (0 tokens)"
                    : `${analysis.ai_meta.tokens ?? "?"} tokens · ${analysis.ai_meta.model}`}
                </span>
              </div>
            )}
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
            <p>
              {analysis.readme_source === "generated"
                ? "This repository has no README, so CodeAtlas read its most relevant files and wrote one"
                : "AI-powered summary and insights from the repository's README"}
            </p>
          </div>
        </div>
        <div className="content-body">
          <div
            className="formatted-content"
            dangerouslySetInnerHTML={{ __html: analysis.readme_summary }}
          />
        </div>
        {analysis.generated_readme && (
          <>
            <div className="content-header">
              <div className="content-icon">📝</div>
              <div>
                <h3>Generated README</h3>
                <p>Drafted from: {(analysis.key_files || []).map((f) => f.path).join(", ")}</p>
              </div>
              <button
                type="button"
                className="search-button"
                onClick={() =>
                  navigator.clipboard?.writeText(analysis.generated_readme_markdown || "")
                }
              >
                Copy Markdown
              </button>
            </div>
            <div className="content-body">
              <div
                className="formatted-content"
                dangerouslySetInnerHTML={{ __html: analysis.generated_readme }}
              />
            </div>
          </>
        )}
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
    if (!analysis?.file_structure)
      return (
        <div className="no-data">
          No file structure available for graph visualization
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
            <h2>Repository Analyzer</h2>
            <p>AI-powered analysis of GitHub repositories with detailed insights</p>
          </div>
        </div>
        
        <form onSubmit={handleAnalyzeRepo} className="url-input-form">
          <div className="search-input-group">
            <span className="search-icon">🔗</span>
            <input
              type="url"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="Enter GitHub repository URL (e.g., https://github.com/user/repo)"
              className="search-input"
              required
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
