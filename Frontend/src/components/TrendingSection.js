import React, { useState, useEffect } from "react";
import { getApiUrl } from "../config/api";

const TrendingSection = ({ onAnalyze, onShareIdea }) => {
  const [trendingRepos, setTrendingRepos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Actions
  const handleViewRepo = (repo) => {
    if (repo && repo.url) {
      window.open(repo.url, "_blank", "noopener,noreferrer");
    }
  };

  const handleCopyLink = async (repo) => {
    try {
      if (repo && repo.url && navigator.clipboard) {
        await navigator.clipboard.writeText(repo.url);
      }
    } catch (e) {
      console.warn("Clipboard copy failed", e);
    }
  };

  const fetchTrendingRepos = (query = "") => {
    setLoading(true);
    let url = getApiUrl('/api/trending');
    if (query) {
      url += `?search_query=${encodeURIComponent(query)}`;
    }

    fetch(url, { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          throw new Error(data.error);
        }
        setTrendingRepos(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching trending repos:", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchTrendingRepos();
  }, []);

  const handleSearch = (e) => {
    if (e) e.preventDefault();
    fetchTrendingRepos(searchQuery);
  };

  return (
    <div className="trending-section">
      <div className="trending-header">
        <div className="header-content">
          <div className="header-icon">🔥</div>
          <div>
            <h2>Trending Repositories</h2>
            <p>Discover the hottest GitHub repositories and latest trends</p>
          </div>
        </div>
      </div>
      
      <div className="search-container modern-search">
        <div className="search-input-group">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search trending repositories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSearch(e)}
            className="search-input"
          />
          <button
            onClick={handleSearch}
            className={`modern-btn primary lg ${loading ? 'is-loading' : ''}`}
            aria-label="Search trending repositories"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="btn-spinner" />
                Searching...
              </>
            ) : (
              <>
                <span className="btn-icon">⌘</span>
                Search
              </>
            )}
          </button>
        </div>
      </div>

      <div className="tools-grid">
        {loading ? (
          <div className="loading">
            <div className="spinner"></div>Loading trending repositories...
          </div>
        ) : trendingRepos.length > 0 ? (
          trendingRepos.map((repo) => (
            <div key={repo.id} className="repo-card modern-card">
              <div className="repo-header">
                <div className="repo-avatar">
                  {repo.name.charAt(0).toUpperCase()}
                </div>
                <div className="repo-info">
                  <h3 className="repo-name">{repo.name}</h3>
                  <span className="repo-owner">by {repo.owner}</span>
                </div>
                <div className="repo-language">
                  {repo.language && (
                    <span className="language-tag">{repo.language}</span>
                  )}
                </div>
              </div>
              
              <div className="repo-description">{repo.description}</div>
              
              <div className="repo-stats">
                <div className="stat-item">
                  <span className="stat-icon">⭐</span>
                  <span className="stat-value">{repo.stars}</span>
                  <span className="stat-label">Stars</span>
                </div>
                <div className="stat-item">
                  <span className="stat-icon">🍴</span>
                  <span className="stat-value">{repo.forks}</span>
                  <span className="stat-label">Forks</span>
                </div>
                <div className="stat-item">
                  <span className="stat-icon">👁️</span>
                  <span className="stat-value">{repo.watchers || 'N/A'}</span>
                  <span className="stat-label">Watchers</span>
                </div>
              </div>
              
              <div className="card-actions">
                <button
                  className="icon-btn"
                  onClick={() => onAnalyze(repo)}
                  title="Analyze"
                  aria-label="Analyze"
                >
                  🔬
                </button>
                <button
                  className="icon-btn"
                  onClick={() => handleViewRepo(repo)}
                  title="View Repo"
                  aria-label="View Repo"
                >
                  🌐
                </button>
                <button
                  className="icon-btn"
                  onClick={() => handleCopyLink(repo)}
                  title="Copy Link"
                  aria-label="Copy Link"
                >
                  🔗
                </button>
                <button
                  className="icon-btn"
                  onClick={onShareIdea}
                  title="Share Idea"
                  aria-label="Share Idea"
                >
                  💡
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state">
            <div className="empty-icon">🔍</div>
            <h3>No repositories found</h3>
            <p>Try adjusting your search terms or browse trending repositories</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrendingSection;
