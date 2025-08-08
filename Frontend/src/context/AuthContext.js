
import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkStatus = async () => {
            try {
                const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
                const response = await fetch(`${apiUrl}/api/status`, { credentials: 'include' });
                if (response.ok) {
                    const data = await response.json();
                    if (data.logged_in) {
                        setUser(data.user);
                    }
                }
            } catch (error) {
                console.error("Could not fetch auth status:", error);
            } finally {
                setLoading(false);
            }
        };
        checkStatus();
    }, []);

    const login = (userData) => {
        setUser(userData);
    };

    const logout = async () => {
        const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
        await fetch(`${apiUrl}/api/logout`, { method: 'POST', credentials: 'include' });
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, setUser, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    return useContext(AuthContext);
}; 