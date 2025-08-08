
import React, { useState } from 'react';

const RegisterPage = ({ onSwitchToLogin }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        try {
            const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
            const response = await fetch(`${apiUrl}/api/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
            const data = await response.json();
            if (response.ok) {
                setMessage(data.message + ". You can now log in.");
                setUsername('');
                setPassword('');
            } else {
                setError(data.error);
            }
        } catch (err) {
            setError('Failed to connect to the server.');
        }
    };

    return (
        <div className="auth-form-container">
            <h2>Register for DevBoost</h2>
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
                {message && <p className="auth-success">{message}</p>}
                <button type="submit">Register</button>
                <p className="switch-auth">
                    Already have an account?{' '}
                    <button type="button" onClick={onSwitchToLogin} className="link-button">
                        Login
                    </button>
                </p>
            </form>
        </div>
    );
};

export default RegisterPage; 