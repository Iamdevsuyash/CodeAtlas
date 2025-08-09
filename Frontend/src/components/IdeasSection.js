import React, { useState, useEffect } from "react";

const IdeasSection = () => {
  const [posts, setPosts] = useState([]);
  const [discussions, setDiscussions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [discussionsLoading, setDiscussionsLoading] = useState(true);
  const [repoName, setRepoName] = useState("");
  const [idea, setIdea] = useState("");
  const [discussionTitle, setDiscussionTitle] = useState("");
  const [discussionContent, setDiscussionContent] = useState("");
  const [error, setError] = useState(null);
  const [discussionError, setDiscussionError] = useState(null);
  const [openReplies, setOpenReplies] = useState({}); // { [postId]: true/false }
  const [comments, setComments] = useState({}); // { [postId]: [comments] }
  const [commentInputs, setCommentInputs] = useState({}); // { [postId]: text }
  const [commentLoading, setCommentLoading] = useState({}); // { [postId]: true/false }
  const [commentError, setCommentError] = useState({}); // { [postId]: errorMsg }
  const [activeTab, setActiveTab] = useState("ideas"); // "ideas" or "discussions"

  // Discussion-specific states
  const [discussionReplies, setDiscussionReplies] = useState({}); // { [discussionId]: [replies] }
  const [discussionReplyInputs, setDiscussionReplyInputs] = useState({}); // { [discussionId]: text }
  const [discussionReplyLoading, setDiscussionReplyLoading] = useState({}); // { [discussionId]: true/false }
  const [discussionReplyError, setDiscussionReplyError] = useState({}); // { [discussionId]: errorMsg }
  const [openDiscussionReplies, setOpenDiscussionReplies] = useState({}); // { [discussionId]: true/false }

  const fetchPosts = () => {
    setLoading(true);
    console.log(
      "Fetching posts from https://codeatlas1.onrender.com/api/posts"
    );
    fetch("https://codeatlas1.onrender.com/api/posts")
      .then((res) => {
        console.log("Response status:", res.status);
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        console.log("Posts data received:", data);
        setPosts(data);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error fetching posts:", error);
        setError(
          "Failed to load posts. Please check if the backend server is running."
        );
        setLoading(false);
      });
  };

  const fetchDiscussions = () => {
    setDiscussionsLoading(true);
    console.log(
      "Fetching discussions from https://codeatlas1.onrender.com/api/discussions"
    );
    fetch("https://codeatlas1.onrender.com/api/discussions")
      .then((res) => {
        console.log("Discussions response status:", res.status);
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        console.log("Discussions data received:", data);
        setDiscussions(data);
        setDiscussionsLoading(false);
      })
      .catch((error) => {
        console.error("Error fetching discussions:", error);
        setDiscussionError(
          "Failed to load discussions. Please check if the discussions server is running."
        );
        setDiscussionsLoading(false);
      });
  };

  useEffect(() => {
    fetchPosts();
    fetchDiscussions();
  }, []);

  const handleIdeaFormSubmit = (e) => {
    e.preventDefault();
    setError(null);
    fetch("https://codeatlas1.onrender.com/api/posts", {
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

  const handleDiscussionFormSubmit = (e) => {
    e.preventDefault();
    setDiscussionError(null);
    fetch("https://codeatlas1.onrender.com/api/discussions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        author: "Anonymous",
        title: discussionTitle,
        content: discussionContent,
        timestamp: new Date().toISOString(),
      }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          setDiscussionError(data.error || "Failed to post discussion.");
        } else {
          setDiscussionTitle("");
          setDiscussionContent("");
          fetchDiscussions();
        }
      })
      .catch(() => {
        setDiscussionError("Network error. Please try again.");
      });
  };

  // Handle discussion like
  const handleDiscussionLike = (discussionId) => {
    fetch(
      `https://codeatlas1.onrender.com/api/discussions/${discussionId}/like`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      }
    )
      .then((res) => res.json())
      .then((data) => {
        if (data.likes !== undefined) {
          setDiscussions((prev) =>
            prev.map((d) =>
              d.id === discussionId ? { ...d, likes: data.likes } : d
            )
          );
        }
      })
      .catch(() => {
        console.error("Failed to like discussion");
      });
  };

  // Fetch replies for a discussion
  const fetchDiscussionReplies = (discussionId) => {
    setDiscussionReplyLoading((prev) => ({ ...prev, [discussionId]: true }));
    fetch(
      `https://codeatlas1.onrender.com/api/discussions/${discussionId}/replies`
    )
      .then((res) => res.json())
      .then((data) => {
        setDiscussionReplies((prev) => ({ ...prev, [discussionId]: data }));
        setDiscussionReplyLoading((prev) => ({
          ...prev,
          [discussionId]: false,
        }));
      })
      .catch(() => {
        setDiscussionReplyLoading((prev) => ({
          ...prev,
          [discussionId]: false,
        }));
      });
  };

  // Toggle discussion reply thread
  const handleDiscussionReplyClick = (discussionId) => {
    setOpenDiscussionReplies((prev) => {
      const isOpen = !prev[discussionId];
      if (isOpen && !discussionReplies[discussionId]) {
        fetchDiscussionReplies(discussionId);
      }
      return { ...prev, [discussionId]: isOpen };
    });
  };

  // Handle discussion reply input change
  const handleDiscussionReplyInput = (discussionId, value) => {
    setDiscussionReplyInputs((prev) => ({ ...prev, [discussionId]: value }));
  };

  // Submit a discussion reply
  const handleDiscussionReplySubmit = (e, discussionId) => {
    e.preventDefault();
    setDiscussionReplyError((prev) => ({ ...prev, [discussionId]: null }));
    fetch(
      `https://codeatlas1.onrender.com/api/discussions/${discussionId}/replies`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          author: "Anonymous",
          content: discussionReplyInputs[discussionId],
        }),
      }
    )
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          setDiscussionReplyError((prev) => ({
            ...prev,
            [discussionId]: data.error || "Failed to post reply.",
          }));
        } else {
          setDiscussionReplyInputs((prev) => ({ ...prev, [discussionId]: "" }));
          fetchDiscussionReplies(discussionId);
        }
      })
      .catch(() => {
        setDiscussionReplyError((prev) => ({
          ...prev,
          [discussionId]: "Network error. Please try again.",
        }));
      });
  };

  // Fetch comments for a post
  const fetchComments = (postId) => {
    setCommentLoading((prev) => ({ ...prev, [postId]: true }));
    fetch(`https://codeatlas1.onrender.com/posts/${postId}/comments`)
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
    fetch(`https://codeatlas1.onrender.com/posts/${postId}/comments`, {
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
        {/* Tab Navigation */}
        <div className="tab-navigation" style={{ marginBottom: "20px" }}>
          <button
            className={`tab-btn ${activeTab === "ideas" ? "active" : ""}`}
            onClick={() => setActiveTab("ideas")}
            style={{
              padding: "10px 20px",
              marginRight: "10px",
              background: activeTab === "ideas" ? "#007bff" : "#333",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
            }}
          >
            💡 Ideas & Projects
          </button>
          <button
            className={`tab-btn ${activeTab === "discussions" ? "active" : ""}`}
            onClick={() => setActiveTab("discussions")}
            style={{
              padding: "10px 20px",
              background: activeTab === "discussions" ? "#007bff" : "#333",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
            }}
          >
            💬 Community Discussions
          </button>
        </div>

        {activeTab === "ideas" && (
          <>
            {error && (
              <div
                style={{
                  color: "red",
                  marginBottom: "10px",
                  textAlign: "center",
                }}
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
                        <div
                          className="avatar"
                          style={{ background: "#3c3c3c" }}
                        >
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
                            {comments[post.id] &&
                            comments[post.id].length > 0 ? (
                              comments[post.id].map((c) => (
                                <div
                                  key={c.id}
                                  style={{
                                    borderBottom: "1px solid #333",
                                    padding: "6px 0",
                                  }}
                                >
                                  <span
                                    style={{ color: "#a0a0a0", fontSize: 12 }}
                                  >
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
                                style={{
                                  color: "red",
                                  fontSize: 12,
                                  marginTop: 4,
                                }}
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
          </>
        )}

        {activeTab === "discussions" && (
          <>
            {discussionError && (
              <div
                style={{
                  color: "red",
                  marginBottom: "10px",
                  textAlign: "center",
                }}
              >
                {discussionError}
              </div>
            )}

            <div className="thread-container" id="discussionsContainer">
              {discussionsLoading ? (
                <div className="loading">
                  <div className="spinner"></div>Loading discussions...
                </div>
              ) : discussions.length > 0 ? (
                discussions.map((discussion) => (
                  <div className="thread-post" key={discussion.id}>
                    <div className="post-header">
                      <div className="post-header-left">
                        <div
                          className="avatar"
                          style={{ background: "#4a90e2" }}
                        >
                          💬
                        </div>
                        <div>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                            }}
                          >
                            <div className="username">{discussion.author}</div>
                          </div>
                          <div className="post-meta">
                            Posted on{" "}
                            {new Date(discussion.timestamp).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="post-content">
                      <h4 style={{ margin: "0 0 10px 0", color: "#fff" }}>
                        {discussion.title}
                      </h4>
                      <p style={{ margin: 0, color: "#ccc" }}>
                        {discussion.content}
                      </p>
                    </div>
                    <div className="post-actions">
                      <div className="action-left">
                        <button
                          className="action-btn"
                          type="button"
                          onClick={() => handleDiscussionLike(discussion.id)}
                          style={{ marginRight: "10px" }}
                        >
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 16 16"
                            fill="currentColor"
                          >
                            <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z" />
                            <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z" />
                          </svg>
                          Like ({discussion.likes})
                        </button>
                        <button
                          className="action-btn"
                          type="button"
                          onClick={() =>
                            handleDiscussionReplyClick(discussion.id)
                          }
                        >
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 16 16"
                            fill="currentColor"
                          >
                            <path d="M1 11.5a.5.5 0 0 0 .5.5h11.793l-3.147 3.146a.5.5 0 0 0 .708.708l4-4a.5.5 0 0 0 0-.708l-4-4a.5.5 0 0 0-.708.708L13.293 11H1.5a.5.5 0 0 0-.5.5z" />
                          </svg>
                          Reply (
                          {discussion.replies ? discussion.replies.length : 0})
                        </button>
                      </div>
                    </div>
                    {/* Discussion Replies Thread */}
                    {openDiscussionReplies[discussion.id] && (
                      <div
                        style={{
                          background: "#232323",
                          borderRadius: 6,
                          margin: "10px 0",
                          padding: 12,
                        }}
                      >
                        {discussionReplyLoading[discussion.id] ? (
                          <div className="loading">
                            <div className="spinner"></div>Loading replies...
                          </div>
                        ) : (
                          <>
                            {discussionReplies[discussion.id] &&
                            discussionReplies[discussion.id].length > 0 ? (
                              discussionReplies[discussion.id].map((reply) => (
                                <div
                                  key={reply.id}
                                  style={{
                                    borderBottom: "1px solid #333",
                                    padding: "6px 0",
                                  }}
                                >
                                  <div
                                    style={{
                                      display: "flex",
                                      justifyContent: "space-between",
                                      alignItems: "center",
                                    }}
                                  >
                                    <span
                                      style={{ color: "#a0a0a0", fontSize: 12 }}
                                    >
                                      <strong>{reply.author}</strong>:{" "}
                                      {reply.content}
                                    </span>
                                    <span
                                      style={{
                                        color: "#666",
                                        fontSize: 11,
                                      }}
                                    >
                                      {new Date(
                                        reply.timestamp
                                      ).toLocaleString()}
                                    </span>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="empty-state">No replies yet.</div>
                            )}
                            <form
                              onSubmit={(e) =>
                                handleDiscussionReplySubmit(e, discussion.id)
                              }
                              style={{ marginTop: 10, display: "flex", gap: 8 }}
                            >
                              <input
                                type="text"
                                placeholder="Write a reply..."
                                value={
                                  discussionReplyInputs[discussion.id] || ""
                                }
                                onChange={(e) =>
                                  handleDiscussionReplyInput(
                                    discussion.id,
                                    e.target.value
                                  )
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
                            {discussionReplyError[discussion.id] && (
                              <div
                                style={{
                                  color: "red",
                                  fontSize: 12,
                                  marginTop: 4,
                                }}
                              >
                                {discussionReplyError[discussion.id]}
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
                  No discussions have been started yet. Be the first!
                </div>
              )}
            </div>

            <div className="compose-area">
              <form id="discussionForm" onSubmit={handleDiscussionFormSubmit}>
                <div className="compose-header">
                  <button className="compose-type active" type="button">
                    💬 Start Discussion
                  </button>
                </div>

                <input
                  type="text"
                  id="discussionTitle"
                  className="compose-input"
                  placeholder="Discussion Title"
                  required
                  style={{ marginBottom: "10px", height: "40px" }}
                  value={discussionTitle}
                  onChange={(e) => setDiscussionTitle(e.target.value)}
                />
                <textarea
                  id="discussionContent"
                  className="compose-input"
                  placeholder="Share your thoughts, questions, or topics for discussion..."
                  required
                  value={discussionContent}
                  onChange={(e) => setDiscussionContent(e.target.value)}
                ></textarea>

                <div className="compose-actions">
                  <button className="post-btn" type="submit">
                    Start Discussion
                  </button>
                  <div className="char-count">
                    {discussionContent.length}/500 characters
                  </div>
                </div>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default IdeasSection;
