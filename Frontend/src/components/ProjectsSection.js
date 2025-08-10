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
    gunRef.current = Gun({
      peers: [getGunUrl()],
      localStorage: false,
      radisk: false,
    });

    console.log("Gun.js initialized:", gunRef.current);

    return () => {
      if (gunRef.current) {
        gunRef.current.off();
      }
    };
  }, []);

  // Load teams from Gun.js
  useEffect(() => {
    if (gunRef.current) {
      const teamsNode = gunRef.current.get('teams');
      teamsNode.map().on((team, id) => {
        if (team) {
          setTeams(prevTeams => {
            const teamExists = prevTeams.find(t => t.id === id);
            if (!teamExists) {
              return [...prevTeams, { ...team, id }];
            }
            return prevTeams; // Or update if needed
          });
        }
      });
    }
  }, []);

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
    const chatRoom = gunRef.current.get("chats").get(selectedTeam.id);
    const membersNode = gunRef.current.get(`members_${selectedTeam.id}`);
    const tasksNode = gunRef.current.get(`tasks_${selectedTeam.id}`);
    const presence = gunRef.current.get(`presence_${selectedTeam.id}`);

    // 1. Chat Listener
    chatRoom.map().on((message, key) => {
      if (message && message.text && message.author && message.timestamp) {
        setChatMessages(prev =>
          [...prev.filter(m => m.id !== key), { ...message, id: key }].sort((a, b) => a.timestamp - b.timestamp)
        );
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
      console.log(`Cleaning up listeners for team: ${selectedTeam.id}`);
      chatRoom.off();
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
      createdBy: user?.username || "Anonymous",
      createdAt: Date.now(),
    };

    // Save the new team to the 'teams' node in Gun.js
    gunRef.current.get('teams').get(teamId).put(newTeamData, (ack) => {
      if (ack.err) {
        console.error('Error creating team:', ack.err);
        return;
      }

      // Also, add the creator as the first member
      const memberData = {
        username: user?.username || "Anonymous",
        role: "Team Lead",
        avatar: (user?.username || "A").charAt(0).toUpperCase(),
        joinedAt: Date.now(),
      };
      gunRef.current.get(`members_${teamId}`).get(user.username).put(memberData);

      console.log('Team created successfully:', teamId);
      setNewTeamName("");
      setNewTeamDescription("");
      setShowCreateTeam(false);
      // The useEffect hook will automatically add the new team to the state
      // and we can select it once it appears.
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
    const messageId = `msg_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    gunRef.current
      .get("chats")
      .get(selectedTeam.id)
      .get(messageId)
      .put(message);

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

  const joinTeam = (team) => {
    if (!user || !gunRef.current) return;

    const membersNode = gunRef.current.get(`members_${team.id}`);

    // Check if user is already a member
    membersNode.get(user.username).once((memberData) => {
      if (memberData) {
        // Already a member, just select the team
        setSelectedTeam(team);
      } else {
        // Not a member, add them to the team in Gun.js
        const newMember = {
          username: user.username,
          role: "Developer",
          avatar: user.username.charAt(0).toUpperCase(),
          joinedAt: Date.now(),
        };
        membersNode.get(user.username).put(newMember, (ack) => {
          if (ack.err) {
            console.error('Error joining team:', ack.err);
          } else {
            console.log('Successfully joined team:', team.name);
            setSelectedTeam(team);
          }
        });
      }
    });
  };

  const renderTeamList = () => (
    <div className="team-list">
      <div className="team-list-header">
        <h3>Available Teams</h3>
        <button
          className="create-team-btn"
          onClick={() => setShowCreateTeam(true)}
        >
          + Create Team
        </button>
      </div>

      {showCreateTeam && (
        <div className="create-team-form">
          <input
            type="text"
            placeholder="Team Name"
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            className="team-input"
          />
          <textarea
            placeholder="Team Description"
            value={newTeamDescription}
            onChange={(e) => setNewTeamDescription(e.target.value)}
            className="team-textarea"
          />
          <div className="form-actions">
            <button onClick={createTeam} className="btn-primary">
              Create
            </button>
            <button
              onClick={() => setShowCreateTeam(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="teams-grid">
        {teams.map((team) => (
          <div key={team.id} className="team-card">
            <div className="team-card-header">
              <h4>{team.name}</h4>
              <span className="member-count">
                {team.members.length} members
              </span>
            </div>
            <p className="team-description">{team.description}</p>
            <div className="team-members-preview">
              {team.members.slice(0, 3).map((member) => (
                <div key={member.username} className="member-avatar-small">
                  {member.avatar}
                </div>
              ))}
              {team.members.length > 3 && (
                <div className="member-avatar-small more">
                  +{team.members.length - 3}
                </div>
              )}
            </div>
            <button className="join-team-btn" onClick={() => joinTeam(team)}>
              {team.members.some((m) => m.username === user?.username)
                ? "Enter Team"
                : "Join Team"}
            </button>
          </div>
        ))}
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
        <div className="add-task-form">
          <input
            type="text"
            placeholder="Task Title"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            className="task-input"
          />
          <textarea
            placeholder="Task Description"
            value={newTaskDescription}
            onChange={(e) => setNewTaskDescription(e.target.value)}
            className="task-textarea"
          />
          <select
            value={newTaskAssignee}
            onChange={(e) => setNewTaskAssignee(e.target.value)}
            className="task-select"
          >
            <option value="">Select Assignee</option>
            {teamMembers.map((member) => (
              <option key={member.username} value={member.username}>
                {member.username}
              </option>
            ))}
          </select>
          <select
            value={newTaskPriority}
            onChange={(e) => setNewTaskPriority(e.target.value)}
            className="task-select"
          >
            <option value="low">Low Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="high">High Priority</option>
          </select>
          <div className="form-actions">
            <button onClick={addTask} className="btn-primary">
              Add Task
            </button>
            <button
              onClick={() => setShowAddTask(false)}
              className="btn-secondary"
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
                <div key={task.id} className="kanban-task" draggable>
                  <div className="task-header">
                    <span className="task-title">{task.title}</span>
                    <span className={`task-priority ${task.priority}`}>
                      {task.priority}
                    </span>
                  </div>
                  <p className="task-description">{task.description}</p>
                  <div className="task-footer">
                    <span className="task-assignee">{task.assignee}</span>
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
                        >
                          →
                        </button>
                      )}
                    </div>
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
