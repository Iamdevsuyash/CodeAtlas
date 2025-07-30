
import React from 'react';
import { useAuth } from '../context/AuthContext';
import './Sidebar.css';

const Sidebar = ({ activeSection, setActiveSection }) => {
    const { user } = useAuth();

    const handleTabClick = (section) => {
        setActiveSection(section);
    };

    return (
        <div className="sidebar">
            <div className="sidebar-header">
                {user ? `WELCOME, ${user.username.toUpperCase()}` : 'DevBoost'}
            </div>
            <div className="sidebar-tabs">
                <div
                    className={`sidebar-tab ${activeSection === 'analyzer' ? 'active' : ''}`}
                    onClick={() => handleTabClick('analyzer')}
                >
                    <span className="tab-icon">📊</span>
                    Analyser
                </div>
                <div
                    className={`sidebar-tab ${activeSection === 'trending' ? 'active' : ''}`}
                    onClick={() => handleTabClick('trending')}
                >
                    <span className="tab-icon">🔥</span>
                    Trending
                </div>
                <div
                    className={`sidebar-tab ${activeSection === 'related' ? 'active' : ''}`}
                    onClick={() => handleTabClick('related')}
                >
                    <span className="tab-icon">🔗</span>
                    Related Git Repos
                </div>
                <div
                    className={`sidebar-tab ${activeSection === 'devtools' ? 'active' : ''}`}
                    onClick={() => handleTabClick('devtools')}
                >
                    <span className="tab-icon">🛠️</span>
                    Dev Tools
                </div>
                <div
                    className={`sidebar-tab ${activeSection === 'apihub' ? 'active' : ''}`}
                    onClick={() => handleTabClick('apihub')}
                >
                    <span className="tab-icon">🔌</span>
                    API Hub
                </div>
                <div
                    className={`sidebar-tab ${activeSection === 'ideas' ? 'active' : ''}`}
                    onClick={() => handleTabClick('ideas')}
                >
                    <span className="tab-icon">💡</span>
                    Ideas
                    <span className="notification-badge">12</span>
                </div>
                <div
                    className={`sidebar-tab ${activeSection === 'messages' ? 'active' : ''}`}
                    onClick={() => handleTabClick('messages')}
                >
                    <span className="tab-icon">💬</span>
                    Messages
                    <span className="notification-badge">5</span>
                </div>
                <div
                    className={`sidebar-tab ${activeSection === 'projects' ? 'active' : ''}`}
                    onClick={() => handleTabClick('projects')}
                >
                    <span className="tab-icon">📁</span>
                    Projects
                    <span className="notification-badge">8</span>
                </div>
            </div>
        </div>
    );
};

export default Sidebar; 