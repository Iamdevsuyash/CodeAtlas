import React from 'react';
import { useAuth } from '../context/AuthContext';

const Header = () => {
    const { user, logout } = useAuth();
    return (
        <div className="title-bar">
            <div className="app-logo">
                <div className="logo-icon">DB</div>
                <div className="logo-text">
                    <h1>DevBoost</h1>
                    <p>Supercharge your development workflow</p>
                </div>
            </div>
            <div className="header-actions">
                <div className="user-display">{user.username.toUpperCase()}</div>
                <button onClick={logout} className="logout-button">Logout</button>
            </div>
        </div>
    );
};

export default Header; 