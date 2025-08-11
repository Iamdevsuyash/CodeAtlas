import React, { useState, useEffect, useRef } from "react";
import Gun from "gun";
import { useAuth } from "../context/AuthContext";
import { getGunUrl } from "../config/api";

const ProjectsSection = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("kanban");
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [teams, setTeams] = useState([]);
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamDescription, setNewTeamDescription] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [teamMembers, setTeamMembers] = useState([]);
  const [userTeams, setUserTeams] = useState(new Set()); // Tracks teams the user has joined
  const [tasks, setTasks] = useState({
    todo: [],
    inProgress: [],
    review: [],
    done: [],
  });
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskAssignee, setNewTaskAssignee] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState("medium");
  const [onlineMembers, setOnlineMembers] = useState(new Set());

  const gunRef = useRef(null);
  const chatRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Initialize Gun.js
  useEffect(() => {
    // A more robust initialization, letting Gun manage its own storage options.
    gunRef.current = Gun(getGunUrl());

    console.log("Gun.js initialized:", gunRef.current);

    return () => {
      if (gunRef.current) {
        gunRef.current.off();
      }
    };
  }, []);

  // Load all teams and user's teams from Gun.js
  useEffect(() => {
    if (!gunRef.current) return;

    // 1. Load all teams (doesn't require user to be logged in)
    const teamsNode = gunRef.current.get('teams');
    teamsNode.map().on((team, id) => {
      if (team) {
        setTeams(prev => {
          const teamExists = prev.find(t => t.id === id);
          if (!teamExists) return [...prev, { ...team, id }];
          return prev.map(t => t.id === id ? { ...team, id } : t);
        });
      }
    });

    // 2. Load the current user's list of teams (requires user)
    if (user?.username) {
      const userTeamsNode = gunRef.current.get('users').get(user.username).get('teams');
      userTeamsNode.map().on((isMember, teamId) => {
        setUserTeams(prev => {
          const newSet = new Set(prev);
          isMember ? newSet.add(teamId) : newSet.delete(teamId);
          return newSet;
        });
      });
    }

    // Cleanup listeners on unmount
    return () => {
      teamsNode.off();
      if (user?.username) {
        gunRef.current.get('users').get(user.username).get('teams').off();
      }
    };
  }, [user?.username]); // Rerun only when the user changes

  // Effect for handling all data loading and real-time updates when a team is selected.
  useEffect(() => {
    if (!selectedTeam || !gunRef.current || !user) {
      return;
    }

    console.log(`Setting up listeners for team: ${selectedTeam.name} (${selectedTeam.id})`);

    // --- RESET STATE ---
    setChatMessages([]);
    setTeamMembers([]);
    setOnlineMembers(new Set());
    setTasks({ todo: [], inProgress: [], review: [], done: [] });

    // --- SETUP LISTENERS ---
    const chatNode = gunRef.current.get(`chat_${selectedTeam.id}`);
    const membersNode = gunRef.current.get(`members_${selectedTeam.id}`);
    const tasksNode = gunRef.current.get(`tasks_${selectedTeam.id}`);
    const presence = gunRef.current.get(`presence_${selectedTeam.id}`);

    // 1. Chat Listener
    chatNode.map().on((message, id) => {
      if (message) {
        setChatMessages(prev => {
          // If the message is already in the state, do nothing.
          if (prev.some(m => m.id === id)) {
            return prev;
          }
          // Otherwise, add the new message from another user.
          return [...prev, { ...message, id }].sort((a, b) => a.timestamp - b.timestamp);
        });
      }
    });

    // 2. Members Listener
    membersNode.map().on((memberData, username) => {
      if (memberData) {
        setTeamMembers(prev => [...prev.filter(m => m.username !== username), memberData]);
      }
    });

    // 3. Tasks Listener
    tasksNode.map().on((task, id) => {
      if (task && task.status) {
        setTasks(prev => {
          const newTasks = { ...prev };
          Object.keys(newTasks).forEach(col => {
            newTasks[col] = newTasks[col].filter(t => t.id !== id);
          });
          if (newTasks[task.status]) {
            newTasks[task.status].push({ ...task, id });
          }
          return newTasks;
        });
      }
    });

    // 4. Presence System
    presence.get(user.username).put({ online: true, lastSeen: Date.now() });
    presence.map().on((memberData, username) => {
      setOnlineMembers(prev => {
        const newSet = new Set(prev);
        if (memberData && memberData.online) {
          newSet.add(username);
        } else {
          newSet.delete(username);
        }
        return newSet;
      });
    });

    // --- CLEANUP FUNCTION ---
    return () => {
      console.log(`Cleaning up listeners for team: ${selectedTeam.name}`);
      chatNode.off();
      membersNode.off();
      tasksNode.off();
      presence.off();
      if (user) {
        presence.get(user.username).put({ online: false, lastSeen: Date.now() });
      }
    };
  }, [selectedTeam, user]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const createTeam = () => {
    if (!newTeamName.trim() || !gunRef.current) return;

    const teamId = `team_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newTeamData = {
      name: newTeamName,
      description: newTeamDescription,
      createdBy: user.username,
      createdAt: Date.now(),
    };

    // Save the new team to the 'teams' node in Gun.js
    gunRef.current.get('teams').get(teamId).put(newTeamData, (ack) => {
      if (ack.err) {
        console.error('Error creating team:', ack.err);
        return;
      }

      // Add creator as first member
      const memberData = {
        username: user.username,
        role: "Team Lead",
        avatar: user.username.charAt(0).toUpperCase(),
        joinedAt: Date.now(),
      };
      gunRef.current.get(`members_${teamId}`).get(user.username).put(memberData);

      // Also add the new team to the creator's list of teams
      gunRef.current.get('users').get(user.username).get('teams').get(teamId).put(true);

      console.log('Team created successfully:', teamId);
      setNewTeamName("");
      setNewTeamDescription("");
      setShowCreateTeam(false);
    });
  };

  const sendMessage = () => {
    if (!newMessage.trim() || !selectedTeam || !gunRef.current) return;

    const message = {
      text: newMessage,
      author: user?.username || "Anonymous",
      timestamp: Date.now(),
      avatar: (user?.username || "A").charAt(0).toUpperCase(),
    };

    console.log("Sending message:", message);

    // Use Gun's proper method to add a message with a unique key
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fullMessage = { ...message, id: messageId };

    // 1. Manually update the local UI immediately for a responsive feel.
    setChatMessages(prev => [...prev, fullMessage].sort((a, b) => a.timestamp - b.timestamp));

    // 2. Send the message to Gun.js for other users.
    gunRef.current.get(`chat_${selectedTeam.id}`).get(messageId).put(message);

    // 3. Clear the input box.
    setNewMessage("");
  };

  const addTask = () => {
    if (!newTaskTitle.trim() || !selectedTeam || !gunRef.current) return;

    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newTaskData = {
      title: newTaskTitle,
      description: newTaskDescription,
      assignee: newTaskAssignee,
      priority: newTaskPriority,
      createdAt: Date.now(),
      createdBy: user?.username || "Anonymous",
      status: 'todo' // Default status
    };

    // Save the new task to the team's tasks node in Gun.js
    gunRef.current.get(`tasks_${selectedTeam.id}`).get(taskId).put(newTaskData, (ack) => {
      if (ack.err) {
        console.error('Error adding task:', ack.err);
        return;
      }
      console.log('Task added successfully:', taskId);
      setNewTaskTitle("");
      setNewTaskDescription("");
      setNewTaskAssignee("");
      setNewTaskPriority("medium");
      setShowAddTask(false);
      // The task will be added to the state via the real-time listener.
    });
  };

  const moveTask = (taskId, fromColumn, toColumn) => {
    const task = tasks[fromColumn].find((t) => t.id === taskId);
    if (!task) return;

    const updatedTasks = {
      ...tasks,
      [fromColumn]: tasks[fromColumn].filter((t) => t.id !== taskId),
      [toColumn]: [...tasks[toColumn], task],
    };

    setTasks(updatedTasks);
    localStorage.setItem(
      `tasks_${selectedTeam.id}`,
      JSON.stringify(updatedTasks)
    );
  };

  const joinTeam = (teamId) => {
    if (!user || !gunRef.current) return;

    const memberData = {
      username: user.username,
      role: "Member",
      avatar: (user.username || "A").charAt(0).toUpperCase(),
      joinedAt: Date.now(),
    };

    // Add the user to the team's members list
    gunRef.current.get(`members_${teamId}`).get(user.username).put(memberData);

    // Add the team to the user's list of teams
    gunRef.current.get('users').get(user.username).get('teams').get(teamId).put(true, (ack) => {
       if (ack.err) {
        console.error(`Error adding team to user's list:`, ack.err);
        return;
      }
      console.log(`Successfully joined team ${teamId}`);
      // After joining, find the full team object and select it
      gunRef.current.get('teams').get(teamId).once(teamData => {
          if(teamData) {
              setSelectedTeam(teamData);
          }
      });
    });
  };

  const renderTeamList = () => (
    <div className="team-list">
      <div className="team-list-header">
        <div className="header-content">
          <div className="header-icon">👥</div>
          <div>
            <h2>Team Collaboration</h2>
            <p>Create or join teams to collaborate on projects</p>
          </div>
        </div>
        <button
          className="create-team-btn modern-btn primary"
          onClick={() => setShowCreateTeam(true)}
        >
          <span className="btn-icon">✨</span>
          Create New Team
        </button>
      </div>

      {showCreateTeam && (
        <div className="create-team-form modern-form">
          <div className="form-header">
            <h3>🚀 Create New Team</h3>
            <p>Set up a collaborative workspace for your team</p>
          </div>
          <div className="form-group">
            <label className="form-label">Team Name</label>
            <input
              type="text"
              placeholder="Enter team name..."
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              className="modern-input"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              placeholder="Describe your team's purpose and goals..."
              value={newTeamDescription}
              onChange={(e) => setNewTeamDescription(e.target.value)}
              className="modern-textarea"
              rows="3"
            />
          </div>
          <div className="form-actions">
            <button onClick={createTeam} className="modern-btn primary">
              <span className="btn-icon">🎯</span>
              Create Team
            </button>
            <button
              onClick={() => setShowCreateTeam(false)}
              className="modern-btn secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="teams-grid">
        {teams.map((team) => (
          <div key={team.id} className="team-card modern-card">
            <div className="team-card-header">
              <div className="team-avatar">
                {team.name.charAt(0).toUpperCase()}
              </div>
              <div className="team-info">
                <h4>{team.name}</h4>
                <span className="team-status">
                  {userTeams.has(team.id) ? '✅ Member' : '🔓 Open'}
                </span>
              </div>
            </div>
            <p className="team-description">{team.description}</p>
            <div className="team-stats">
              <div className="stat-item">
                <span className="stat-icon">👥</span>
                <span className="stat-value">5 members</span>
              </div>
              <div className="stat-item">
                <span className="stat-icon">📋</span>
                <span className="stat-value">12 tasks</span>
              </div>
            </div>
            <div className="team-card-actions">
              {userTeams.has(team.id) ? (
                <button 
                  onClick={() => setSelectedTeam(team)}
                  className="modern-btn primary full-width"
                >
                  <span className="btn-icon">🚀</span>
                  Enter Workspace
                </button>
              ) : (
                <button 
                  onClick={() => joinTeam(team.id)}
                  className="modern-btn secondary full-width"
                >
                  <span className="btn-icon">🤝</span>
                  Join Team
                </button>
              )}
            </div>
          </div>
        ))}
        {teams.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">🏢</div>
            <h3>No Teams Yet</h3>
            <p>Create the first team to start collaborating</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderKanbanBoard = () => (
    <div className="kanban-container">
      <div className="kanban-header">
        <h3>Project Board - {selectedTeam.name}</h3>
        <button className="add-task-btn" onClick={() => setShowAddTask(true)}>
          + Add Task
        </button>
      </div>

      {showAddTask && (
        <div className="add-task-form modern-form">
          <div className="form-header">
            <h3>📝 Create New Task</h3>
            <button 
              onClick={() => setShowAddTask(false)}
              className="close-btn"
            >
              ✕
            </button>
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Task Title</label>
              <input
                type="text"
                placeholder="Enter task title..."
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                className="modern-input"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                placeholder="Describe the task details..."
                value={newTaskDescription}
                onChange={(e) => setNewTaskDescription(e.target.value)}
                className="modern-textarea"
                rows="3"
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Assignee</label>
                <select
                  value={newTaskAssignee}
                  onChange={(e) => setNewTaskAssignee(e.target.value)}
                  className="modern-select"
                >
                  <option value="">👤 Select Assignee</option>
                  {teamMembers.map((member) => (
                    <option key={member.username} value={member.username}>
                      {member.username}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Priority</label>
                <select
                  value={newTaskPriority}
                  onChange={(e) => setNewTaskPriority(e.target.value)}
                  className="modern-select"
                >
                  <option value="low">🟢 Low Priority</option>
                  <option value="medium">🟡 Medium Priority</option>
                  <option value="high">🔴 High Priority</option>
                </select>
              </div>
            </div>
          </div>
          <div className="form-actions">
            <button onClick={addTask} className="modern-btn primary">
              <span className="btn-icon">✅</span>
              Create Task
            </button>
            <button
              onClick={() => setShowAddTask(false)}
              className="modern-btn secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="kanban-board">
        {Object.entries({
          todo: "📋 To Do",
          inProgress: "🔄 In Progress",
          review: "👀 Review",
          done: "✅ Done",
        }).map(([columnKey, columnTitle]) => (
          <div key={columnKey} className="kanban-column">
            <div className="kanban-header">
              <span>{columnTitle}</span>
              <span className="task-count">{tasks[columnKey].length}</span>
            </div>
            <div className="kanban-tasks">
              {tasks[columnKey].map((task) => (
                <div key={task.id} className="kanban-task modern-task" draggable>
                  <div className="task-header">
                    <div className="task-title-group">
                      <span className="task-title">{task.title}</span>
                      <span className={`task-priority priority-${task.priority}`}>
                        {task.priority === 'high' ? '🔴' : task.priority === 'medium' ? '🟡' : '🟢'}
                        {task.priority}
                      </span>
                    </div>
                  </div>
                  <p className="task-description">{task.description}</p>
                  <div className="task-footer">
                    <div className="task-assignee-group">
                      {task.assignee && (
                        <div className="assignee-avatar">
                          {task.assignee.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="task-assignee">{task.assignee || 'Unassigned'}</span>
                    </div>
                    <div className="task-actions">
                      {columnKey !== "done" && (
                        <button
                          className="move-task-btn"
                          onClick={() => {
                            const nextColumn = {
                              todo: "inProgress",
                              inProgress: "review",
                              review: "done",
                            }[columnKey];
                            moveTask(task.id, columnKey, nextColumn);
                          }}
                          title={`Move to ${{
                            todo: "In Progress",
                            inProgress: "Review",
                            review: "Done",
                          }[columnKey]}`}
                        >
                          <span className="move-icon">→</span>
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="task-meta">
                    <span className="task-created">Created by {task.createdBy}</span>
                    <span className="task-date">{new Date(task.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderTeamChat = () => (
    <div className="team-chat">
      <div className="chat-header">
        <h4>Team Chat</h4>
        <div className="online-members">
          {Array.from(onlineMembers).map((username) => (
            <div key={username} className="online-member">
              <div className="member-avatar-small online">
                {username.charAt(0).toUpperCase()}
              </div>
              <span>{username}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="chat-messages">
        {chatMessages.map((message) => (
          <div key={message.id} className="chat-message">
            <div className="message-avatar">{message.avatar}</div>
            <div className="message-content">
              <div className="message-header">
                <span className="message-author">{message.author}</span>
                <span className="message-time">
                  {new Date(message.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <p className="message-text">{message.text}</p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-area">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Type a message..."
          className="chat-input"
        />
        <button onClick={sendMessage} className="send-btn">
          Send
        </button>
      </div>
    </div>
  );

  if (!selectedTeam) {
    return (
      <div id="projects-content" className="section-content">
        {renderTeamList()}
      </div>
    );
  }

  return (
    <div id="projects-content" className="section-content">
      <div className="team-header">
        <button className="back-btn" onClick={() => setSelectedTeam(null)}>
          ← Back to Teams
        </button>
        <h2>{selectedTeam.name}</h2>
        <div className="team-info">
          <span>{teamMembers.length} members</span>
          <span>{Array.from(onlineMembers).length} online</span>
        </div>
      </div>

      <div className="project-dashboard">
        <div className="project-main">
          <div className="project-tabs">
            <div
              className={`project-tab ${
                activeTab === "kanban" ? "active" : ""
              }`}
              onClick={() => setActiveTab("kanban")}
            >
              Kanban Board
            </div>
            <div
              className={`project-tab ${activeTab === "chat" ? "active" : ""}`}
              onClick={() => setActiveTab("chat")}
            >
              Team Chat
            </div>
            <div
              className={`project-tab ${
                activeTab === "members" ? "active" : ""
              }`}
              onClick={() => setActiveTab("members")}
            >
              Members
            </div>
          </div>

          <div className="project-content">
            {activeTab === "kanban" && renderKanbanBoard()}
            {activeTab === "chat" && renderTeamChat()}
            {activeTab === "members" && (
              <div className="team-members-list">
                <h3>Team Members</h3>
                {teamMembers.map((member) => (
                  <div key={member.username} className="team-member-card">
                    <div className="member-avatar">{member.avatar}</div>
                    <div className="member-info">
                      <div className="member-name">{member.username}</div>
                      <div className="member-role">{member.role}</div>
                    </div>
                    <div
                      className={`member-status ${
                        onlineMembers.has(member.username)
                          ? "online"
                          : "offline"
                      }`}
                    >
                      {onlineMembers.has(member.username)
                        ? "Online"
                        : "Offline"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectsSection;
