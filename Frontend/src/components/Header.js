import React from 'react';

const Header = () => {
    return (
        <div className="title-bar">
            <div className="app-logo">
                <div className="logo-icon">CA</div>
                <div className="logo-text">
                    <h1>CodeAtlas</h1>
                    <p>Supercharge your development workflow</p>
                </div>
            </div>
            <div className="header-actions">
                <div className="user-display">OPEN WORKSPACE</div>
            </div>
        </div>
    );
};

export default Header; 
