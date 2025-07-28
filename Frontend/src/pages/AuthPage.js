import React, { useState } from 'react';
import LoginPage from '../components/LoginPage';
import RegisterPage from '../components/RegisterPage';
import './AuthPage.css';

const AuthPage = () => {
    const [isLogin, setIsLogin] = useState(true);

    const switchToRegister = () => setIsLogin(false);
    const switchToLogin = () => setIsLogin(true);

    return (
        <div className="auth-page">
            <div className="auth-container">
                <div className="auth-info">
                    <div className="info-content">
                        <h2>Welcome to DevBoost</h2>
                        <p>Your ultimate platform for code analysis and development insights.</p>
                    </div>
                </div>
                <div className="auth-form-section">
                    {isLogin ? (
                        <LoginPage onSwitchToRegister={switchToRegister} />
                    ) : (
                        <RegisterPage onSwitchToLogin={switchToLogin} />
                    )}
                </div>
            </div>
        </div>
    );
};

export default AuthPage; 