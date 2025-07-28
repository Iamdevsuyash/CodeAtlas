
import React, { useState, useEffect } from 'react';

const IdeasSection = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [repoName, setRepoName] = useState('');
  const [idea, setIdea] = useState('');

  const fetchPosts = () => {
    setLoading(true);
    fetch('http://localhost:5000/api/posts')
      .then((res) => res.json())
      .then((data) => {
        setPosts(data);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const handleIdeaFormSubmit = (e) => {
    e.preventDefault();
    fetch('http://localhost:5000/api/posts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ repo_name: repoName, idea: idea }),
    })
      .then((res) => res.json())
      .then(() => {
        setRepoName('');
        setIdea('');
        fetchPosts();
      });
  };

  return (
    <div id="ideas-content" className="section-content">
      <div className="ideas-section">
        {/* Filters */}
        <div className="ideas-filters">
          <button className="filter-btn active" data-filter="all">
            All Ideas
          </button>
          <button className="filter-btn" data-filter="new-project">
            New Projects
          </button>
          <button className="filter-btn" data-filter="enhancement">
            Enhancements
          </button>
          <button className="filter-btn" data-filter="collaboration">
            Looking for Team
          </button>
          <input
            type="text"
            className="search-ideas"
            placeholder="Search ideas, projects, skills..."
          />
        </div>

        <div className="thread-container" id="threadContainer">
          {loading ? (
            <div className="loading">
              <div className="spinner"></div>Loading ideas...
            </div>
          ) : posts.length > 0 ? (
            posts.map((post) => (
              <div className="thread-post" key={post.id}>
                <div className="post-header">
                  <div className="post-header-left">
                    <div className="avatar" style={{ background: '#3c3c3c' }}>
                      💡
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div className="username">{post.repo_name}</div>
                      </div>
                      <div className="post-meta">Posted on {post.timestamp}</div>
                    </div>
                  </div>
                </div>
                <div className="post-content">{post.idea}</div>
                <div className="post-actions">
                  <div className="action-left">
                    <button className="action-btn">
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M1 11.5a.5.5 0 0 0 .5.5h11.793l-3.147 3.146a.5.5 0 0 0 .708.708l4-4a.5.5 0 0 0 0-.708l-4-4a.5.5 0 0 0-.708.708L13.293 11H1.5a.5.5 0 0 0-.5.5z" />
                      </svg>
                      Reply ({post.comments_count})
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state">No ideas have been shared yet. Be the first!</div>
          )}
        </div>

        <div className="compose-area">
          <form id="ideaForm" onSubmit={handleIdeaFormSubmit}>
            <div className="compose-header">
              <button className="compose-type active" type="button">
                💡 Share Idea
              </button>
            </div>

            <input
              type="text"
              id="ideaRepoName"
              className="compose-input"
              placeholder="Repository Name (e.g. owner/repo)"
              required
              style={{ marginBottom: '10px', height: '40px' }}
              value={repoName}
              onChange={(e) => setRepoName(e.target.value)}
            />
            <textarea
              id="ideaText"
              className="compose-input"
              placeholder="Share your innovative idea with the community..."
              required
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
            ></textarea>

            <div className="compose-actions">
              <button className="post-btn" type="submit">
                Publish Post
              </button>
              <div className="char-count">
                {idea.length}/500 characters
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default IdeasSection; 