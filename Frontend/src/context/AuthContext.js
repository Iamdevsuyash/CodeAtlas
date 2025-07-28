
import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkStatus = async () => {
            try {
                const response = await fetch('http://localhost:5000/api/status', { credentials: 'include' });
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
        await fetch('http://localhost:5000/api/logout', { method: 'POST', credentials: 'include' });
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