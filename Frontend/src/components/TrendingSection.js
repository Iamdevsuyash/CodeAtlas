
import React, { useState, useEffect } from 'react';

const TrendingSection = () => {
    const [trendingRepos, setTrendingRepos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchTrendingRepos = (query = '') => {
        setLoading(true);
        let url = 'http://localhost:5000/api/trending';
        if (query) {
            url += `?search_query=${query}`;
        }

        fetch(url, { credentials: 'include' })
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
        e.preventDefault();
        fetchTrendingRepos(searchQuery);
    };

    return (
        <div>
            <h2>Trending Projects</h2>
            <form className="search-bar" onSubmit={handleSearch}>
                <input
                    type="text"
                    placeholder="Search for trending projects (e.g., 'python data science', 'react components')"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
                <button type="submit" disabled={loading}>
                    {loading ? 'Searching...' : 'Search'}
                </button>
            </form>

            <div className="tools-grid">
                {loading ? (
                    <div className="loading">
                        <div className="spinner"></div>Loading trending repositories...
                    </div>
                ) : trendingRepos.length > 0 ? (
                    trendingRepos.map((repo, index) => (
                        <div className="tool-card" key={index}>
                            <div className="tool-title">
                                <a href={repo.url} target="_blank" rel="noopener noreferrer" className="tool-link">
                                    {repo.name}
                                </a>
                                <div className="repo-stats">
                                    <span>⭐ {repo.stars}</span>
                                    <span>🍴 {repo.forks}</span>
                                </div>
                            </div>
                            <div className="tool-desc">{repo.description}</div>
                            <div className="card-actions">
                                <button className="card-button">Analyze</button>
                                <button className="card-button">Share Idea</button>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="empty-state">No trending repositories found.</div>
                )}
            </div>
        </div>
    );
};

export default TrendingSection; 