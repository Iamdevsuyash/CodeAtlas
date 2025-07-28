
import React, { useState } from 'react';

const AnalyzerSection = () => {
    const [repoUrl, setRepoUrl] = useState('');
    const [analysis, setAnalysis] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleAnalyzeRepo = (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setAnalysis(null);

        fetch('http://localhost:5000/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ repo_url: repoUrl }),
            credentials: 'include',
        })
            .then(async (res) => {
                if (!res.ok) {
                    const errData = await res.json().catch(() => ({ error: 'An unknown error occurred.' }));
                    throw new Error(errData.error || `Request failed with status ${res.status}`);
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

    return (
        <div>
            <h2>Repository Analyzer</h2>
            <form className="search-bar" onSubmit={handleAnalyzeRepo}>
                <input
                    type="text"
                    placeholder="Enter GitHub repository URL"
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                />
                <button type="submit" disabled={loading}>
                    {loading ? 'Analyzing...' : 'Analyze'}
                </button>
            </form>

            {error && <div className="error-message">{error}</div>}

            {loading && <div className="loading">Analyzing repository...</div>}

            <div className="analysis-results">
                <div className="result-card">
                    <h3>README Analysis</h3>
                    <div
                        className="panel-content"
                        dangerouslySetInnerHTML={{
                            __html: analysis ? analysis.readme_summary : '<p>README analysis will appear here.</p>',
                        }}
                    />
                </div>
                <div className="result-card">
                    <h3>Repository Structure & Setup</h3>
                    <div
                        className="panel-content"
                        dangerouslySetInnerHTML={{
                            __html: analysis
                                ? `${analysis.structure_analysis} ${analysis.setup_guide}`
                                : '<p>Structure and setup guide will appear here.</p>',
                        }}
                    />
                </div>
            </div>
        </div>
    );
};

export default AnalyzerSection; 