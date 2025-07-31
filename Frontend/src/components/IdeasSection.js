import React, { useState, useEffect } from "react";

const IdeasSection = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [repoName, setRepoName] = useState("");
  const [idea, setIdea] = useState("");
  const [error, setError] = useState(null);
  const [openReplies, setOpenReplies] = useState({}); // { [postId]: true/false }
  const [comments, setComments] = useState({}); // { [postId]: [comments] }
  const [commentInputs, setCommentInputs] = useState({}); // { [postId]: text }
  const [commentLoading, setCommentLoading] = useState({}); // { [postId]: true/false }
  const [commentError, setCommentError] = useState({}); // { [postId]: errorMsg }

  const fetchPosts = () => {
    setLoading(true);
    fetch("http://localhost:5000/api/posts")
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
    setError(null);
    fetch("http://localhost:5000/api/posts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ repo_name: repoName, idea: idea }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          setError(data.message || data.error || "Failed to post idea.");
        } else {
          setRepoName("");
          setIdea("");
          fetchPosts();
        }
      })
      .catch(() => {
        setError("Network error. Please try again.");
      });
  };

  // Fetch comments for a post
  const fetchComments = (postId) => {
    setCommentLoading((prev) => ({ ...prev, [postId]: true }));
    fetch(`http://localhost:5000/api/posts/${postId}/comments`)
      .then((res) => res.json())
      .then((data) => {
        setComments((prev) => ({ ...prev, [postId]: data }));
        setCommentLoading((prev) => ({ ...prev, [postId]: false }));
      });
  };

  // Toggle reply thread
  const handleReplyClick = (postId) => {
    setOpenReplies((prev) => {
      const isOpen = !prev[postId];
      if (isOpen && !comments[postId]) fetchComments(postId);
      return { ...prev, [postId]: isOpen };
    });
  };

  // Handle comment input change
  const handleCommentInput = (postId, value) => {
    setCommentInputs((prev) => ({ ...prev, [postId]: value }));
  };

  // Submit a comment
  const handleCommentSubmit = (e, postId) => {
    e.preventDefault();
    setCommentError((prev) => ({ ...prev, [postId]: null }));
    fetch(`http://localhost:5000/api/posts/${postId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ text: commentInputs[postId] }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          setCommentError((prev) => ({
            ...prev,
            [postId]: data.message || data.error || "Failed to post comment.",
          }));
        } else {
          setCommentInputs((prev) => ({ ...prev, [postId]: "" }));
          fetchComments(postId);
        }
      })
      .catch(() => {
        setCommentError((prev) => ({
          ...prev,
          [postId]: "Network error. Please try again.",
        }));
      });
  };

  return (
    <div id="ideas-content" className="section-content">
      <div className="ideas-section">
        {error && (
          <div
            style={{ color: "red", marginBottom: "10px", textAlign: "center" }}
          >
            {error}
          </div>
        )}
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
                    <div className="avatar" style={{ background: "#3c3c3c" }}>
                      💡
                    </div>
                    <div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <div className="username">{post.repo_name}</div>
                      </div>
                      <div className="post-meta">
                        Posted on {post.timestamp}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="post-content">{post.idea}</div>
                <div className="post-actions">
                  <div className="action-left">
                    <button
                      className="action-btn"
                      type="button"
                      onClick={() => handleReplyClick(post.id)}
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 16 16"
                        fill="currentColor"
                      >
                        <path d="M1 11.5a.5.5 0 0 0 .5.5h11.793l-3.147 3.146a.5.5 0 0 0 .708.708l4-4a.5.5 0 0 0 0-.708l-4-4a.5.5 0 0 0-.708.708L13.293 11H1.5a.5.5 0 0 0-.5.5z" />
                      </svg>
                      Reply ({post.comments_count})
                    </button>
                  </div>
                </div>
                {/* Replies Thread */}
                {openReplies[post.id] && (
                  <div
                    style={{
                      background: "#232323",
                      borderRadius: 6,
                      margin: "10px 0",
                      padding: 12,
                    }}
                  >
                    {commentLoading[post.id] ? (
                      <div className="loading">
                        <div className="spinner"></div>Loading replies...
                      </div>
                    ) : (
                      <>
                        {comments[post.id] && comments[post.id].length > 0 ? (
                          comments[post.id].map((c) => (
                            <div
                              key={c.id}
                              style={{
                                borderBottom: "1px solid #333",
                                padding: "6px 0",
                              }}
                            >
                              <span style={{ color: "#a0a0a0", fontSize: 12 }}>
                                {c.text}
                              </span>
                              <span
                                style={{
                                  float: "right",
                                  color: "#666",
                                  fontSize: 11,
                                }}
                              >
                                {c.timestamp}
                              </span>
                            </div>
                          ))
                        ) : (
                          <div className="empty-state">No replies yet.</div>
                        )}
                        <form
                          onSubmit={(e) => handleCommentSubmit(e, post.id)}
                          style={{ marginTop: 10, display: "flex", gap: 8 }}
                        >
                          <input
                            type="text"
                            placeholder="Write a reply..."
                            value={commentInputs[post.id] || ""}
                            onChange={(e) =>
                              handleCommentInput(post.id, e.target.value)
                            }
                            style={{
                              flex: 1,
                              background: "#2d2d2d",
                              color: "#fff",
                              border: "1px solid #444",
                              borderRadius: 3,
                              padding: 6,
                              fontSize: 13,
                            }}
                            maxLength={200}
                            required
                          />
                          <button
                            type="submit"
                            className="post-btn"
                            style={{ padding: "6px 14px", fontSize: 13 }}
                          >
                            Reply
                          </button>
                        </form>
                        {commentError[post.id] && (
                          <div
                            style={{ color: "red", fontSize: 12, marginTop: 4 }}
                          >
                            {commentError[post.id]}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="empty-state">
              No ideas have been shared yet. Be the first!
            </div>
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
              style={{ marginBottom: "10px", height: "40px" }}
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
              <div className="char-count">{idea.length}/500 characters</div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default IdeasSection;
