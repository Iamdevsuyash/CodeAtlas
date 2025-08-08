
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const LoginPage = ({ onSwitchToRegister }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
            const response = await fetch(`${apiUrl}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
                credentials: 'include'
            });
            const data = await response.json();
            if (response.ok) {
                login(data.user);
                navigate('/');
            } else {
                setError(data.error);
            }
        } catch (err) {
            setError('Failed to connect to the server.');
        }
    };

    return (
        <div className="auth-form-container">
            <h2>Login to DevBoost</h2>
            <form onSubmit={handleSubmit} className="auth-form">
                <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Username"
                    required
                />
                <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    required
                />
                {error && <p className="auth-error">{error}</p>}
                <button type="submit">Login</button>
                <p className="switch-auth">
                    Don't have an account?{' '}
                    <button type="button" onClick={onSwitchToRegister} className="link-button">
                        Register
                    </button>
                </p>
            </form>
        </div>
    );
};

export default LoginPage; 