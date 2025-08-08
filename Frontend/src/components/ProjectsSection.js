
import React, { useState, useEffect, useRef } from 'react';
import Gun from 'gun';
import { useAuth } from '../context/AuthContext';

const ProjectsSection = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('kanban');
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [teams, setTeams] = useState([]);
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDescription, setNewTeamDescription] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [teamMembers, setTeamMembers] = useState([]);
  const [tasks, setTasks] = useState({
    todo: [],
    inProgress: [],
    review: [],
    done: []
  });
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState('medium');
  const [onlineMembers, setOnlineMembers] = useState(new Set());
  
  const gunRef = useRef(null);
  const chatRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Initialize Gun.js
  useEffect(() => {
    gunRef.current = Gun({
      peers: ['http://localhost:8765/gun'],
      localStorage: false,
      radisk: false
    });
    
    console.log('Gun.js initialized:', gunRef.current);
    
    return () => {
      if (gunRef.current) {
        gunRef.current.off();
      }
    };
  }, []);

  // Load teams from localStorage (in real app, this would be from backend)
  useEffect(() => {
    const savedTeams = localStorage.getItem('devboost_teams');
    if (savedTeams) {
      setTeams(JSON.parse(savedTeams));
    }
  }, []);

  // Set up real-time chat when team is selected
  useEffect(() => {
    if (selectedTeam && gunRef.current) {
      console.log('Setting up chat for team:', selectedTeam.id);
      
      // Clear previous messages when switching teams
      setChatMessages([]);
      
      const chatRoom = gunRef.current.get('chats').get(selectedTeam.id);
      chatRef.current = chatRoom;
      
      // Listen for new messages
      const messageListener = chatRoom.map().on((message, key) => {
        console.log('Received message:', message, 'with key:', key);
        if (message && message.text && message.author && message.timestamp) {
          setChatMessages(prev => {
            const exists = prev.find(msg => msg.id === key);
            if (!exists) {
              const newMessages = [...prev, { ...message, id: key }].sort((a, b) => a.timestamp - b.timestamp);
              console.log('Updated messages:', newMessages);
              return newMessages;
            }
            return prev;
          });
        }
      });

      // Set up presence system
      const presence = gunRef.current.get(`presence_${selectedTeam.id}`);
      if (user) {
        presence.get(user.username).put({
          online: true,
          lastSeen: Date.now(),
          avatar: user.username.charAt(0).toUpperCase()
        });
        
        // Listen for online members
        presence.map().on((memberData, username) => {
          if (memberData && memberData.online) {
            setOnlineMembers(prev => new Set([...prev, username]));
          } else {
            setOnlineMembers(prev => {
              const newSet = new Set(prev);
              newSet.delete(username);
              return newSet;
            });
          }
        });
      }

      // Cleanup function
      return () => {
        console.log('Cleaning up chat listeners for team:', selectedTeam.id);
        if (chatRoom) {
          chatRoom.off();
        }
        if (user && presence) {
          presence.get(user.username).put({
            online: false,
            lastSeen: Date.now()
          });
        }
      };
    }
  }, [selectedTeam, user]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Load team data when selected
  useEffect(() => {
    if (selectedTeam) {
      // Load team members
      setTeamMembers(selectedTeam.members || []);
      
      // Load tasks from localStorage
      const savedTasks = localStorage.getItem(`tasks_${selectedTeam.id}`);
      if (savedTasks) {
        setTasks(JSON.parse(savedTasks));
      } else {
        // Initialize with sample tasks
        const sampleTasks = {
          todo: [
            {
              id: 1,
              title: 'Setup project repository',
              description: 'Initialize Git repo and basic structure',
              assignee: 'John Developer',
              priority: 'high',
              createdAt: Date.now()
            }
          ],
          inProgress: [],
          review: [],
          done: []
        };
        setTasks(sampleTasks);
        localStorage.setItem(`tasks_${selectedTeam.id}`, JSON.stringify(sampleTasks));
      }
    }
  }, [selectedTeam]);

  const createTeam = () => {
    if (!newTeamName.trim()) return;
    
    const newTeam = {
      id: Date.now(),
      name: newTeamName,
      description: newTeamDescription,
      createdBy: user?.username || 'Anonymous',
      createdAt: Date.now(),
      members: [{
        username: user?.username || 'Anonymous',
        role: 'Team Lead',
        avatar: (user?.username || 'A').charAt(0).toUpperCase(),
        joinedAt: Date.now()
      }]
    };
    
    const updatedTeams = [...teams, newTeam];
    setTeams(updatedTeams);
    localStorage.setItem('devboost_teams', JSON.stringify(updatedTeams));
    
    setNewTeamName('');
    setNewTeamDescription('');
    setShowCreateTeam(false);
    setSelectedTeam(newTeam);
  };

  const sendMessage = () => {
    if (!newMessage.trim() || !selectedTeam || !gunRef.current) return;
    
    const message = {
      text: newMessage,
      author: user?.username || 'Anonymous',
      timestamp: Date.now(),
      avatar: (user?.username || 'A').charAt(0).toUpperCase()
    };
    
    console.log('Sending message:', message);
    
    // Use Gun's proper method to add a message with a unique key
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    gunRef.current.get('chats').get(selectedTeam.id).get(messageId).put(message);
    
    setNewMessage('');
  };

  const addTask = () => {
    if (!newTaskTitle.trim()) return;
    
    const newTask = {
      id: Date.now(),
      title: newTaskTitle,
      description: newTaskDescription,
      assignee: newTaskAssignee,
      priority: newTaskPriority,
      createdAt: Date.now(),
      createdBy: user?.username || 'Anonymous'
    };
    
    const updatedTasks = {
      ...tasks,
      todo: [...tasks.todo, newTask]
    };
    
    setTasks(updatedTasks);
    localStorage.setItem(`tasks_${selectedTeam.id}`, JSON.stringify(updatedTasks));
    
    setNewTaskTitle('');
    setNewTaskDescription('');
    setNewTaskAssignee('');
    setNewTaskPriority('medium');
    setShowAddTask(false);
  };

  const moveTask = (taskId, fromColumn, toColumn) => {
    const task = tasks[fromColumn].find(t => t.id === taskId);
    if (!task) return;
    
    const updatedTasks = {
      ...tasks,
      [fromColumn]: tasks[fromColumn].filter(t => t.id !== taskId),
      [toColumn]: [...tasks[toColumn], task]
    };
    
    setTasks(updatedTasks);
    localStorage.setItem(`tasks_${selectedTeam.id}`, JSON.stringify(updatedTasks));
  };

  const joinTeam = (team) => {
    if (!user) return;
    
    const isAlreadyMember = team.members.some(member => member.username === user.username);
    if (isAlreadyMember) {
      setSelectedTeam(team);
      return;
    }
    
    const newMember = {
      username: user.username,
      role: 'Developer',
      avatar: user.username.charAt(0).toUpperCase(),
      joinedAt: Date.now()
    };
    
    const updatedTeam = {
      ...team,
      members: [...team.members, newMember]
    };
    
    const updatedTeams = teams.map(t => t.id === team.id ? updatedTeam : t);
    setTeams(updatedTeams);
    localStorage.setItem('devboost_teams', JSON.stringify(updatedTeams));
    setSelectedTeam(updatedTeam);
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
            <button onClick={createTeam} className="btn-primary">Create</button>
            <button onClick={() => setShowCreateTeam(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}
      
      <div className="teams-grid">
        {teams.map(team => (
          <div key={team.id} className="team-card">
            <div className="team-card-header">
              <h4>{team.name}</h4>
              <span className="member-count">{team.members.length} members</span>
            </div>
            <p className="team-description">{team.description}</p>
            <div className="team-members-preview">
              {team.members.slice(0, 3).map(member => (
                <div key={member.username} className="member-avatar-small">
                  {member.avatar}
                </div>
              ))}
              {team.members.length > 3 && (
                <div className="member-avatar-small more">+{team.members.length - 3}</div>
              )}
            </div>
            <button 
              className="join-team-btn"
              onClick={() => joinTeam(team)}
            >
              {team.members.some(m => m.username === user?.username) ? 'Enter Team' : 'Join Team'}
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
        <button 
          className="add-task-btn"
          onClick={() => setShowAddTask(true)}
        >
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
            {teamMembers.map(member => (
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
            <button onClick={addTask} className="btn-primary">Add Task</button>
            <button onClick={() => setShowAddTask(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}
      
      <div className="kanban-board">
        {Object.entries({
          todo: '📋 To Do',
          inProgress: '🔄 In Progress',
          review: '👀 Review',
          done: '✅ Done'
        }).map(([columnKey, columnTitle]) => (
          <div key={columnKey} className="kanban-column">
            <div className="kanban-header">
              <span>{columnTitle}</span>
              <span className="task-count">{tasks[columnKey].length}</span>
            </div>
            <div className="kanban-tasks">
              {tasks[columnKey].map(task => (
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
                      {columnKey !== 'done' && (
                        <button 
                          className="move-task-btn"
                          onClick={() => {
                            const nextColumn = {
                              todo: 'inProgress',
                              inProgress: 'review',
                              review: 'done'
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
          {Array.from(onlineMembers).map(username => (
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
        {chatMessages.map(message => (
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
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
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
        <button 
          className="back-btn"
          onClick={() => setSelectedTeam(null)}
        >
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
              className={`project-tab ${activeTab === 'kanban' ? 'active' : ''}`}
              onClick={() => setActiveTab('kanban')}
            >
              Kanban Board
            </div>
            <div 
              className={`project-tab ${activeTab === 'chat' ? 'active' : ''}`}
              onClick={() => setActiveTab('chat')}
            >
              Team Chat
            </div>
            <div 
              className={`project-tab ${activeTab === 'members' ? 'active' : ''}`}
              onClick={() => setActiveTab('members')}
            >
              Members
            </div>
          </div>
          
          <div className="project-content">
            {activeTab === 'kanban' && renderKanbanBoard()}
            {activeTab === 'chat' && renderTeamChat()}
            {activeTab === 'members' && (
              <div className="team-members-list">
                <h3>Team Members</h3>
                {teamMembers.map(member => (
                  <div key={member.username} className="team-member-card">
                    <div className="member-avatar">{member.avatar}</div>
                    <div className="member-info">
                      <div className="member-name">{member.username}</div>
                      <div className="member-role">{member.role}</div>
                    </div>
                    <div className={`member-status ${onlineMembers.has(member.username) ? 'online' : 'offline'}`}>
                      {onlineMembers.has(member.username) ? 'Online' : 'Offline'}
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