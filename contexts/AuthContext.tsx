import React, { createContext, useContext, useState, useEffect } from 'react';

interface AuthContextType {
    isAuthenticated: boolean;
    user: { name: string; role: string; token: string } | null;
    login: (username: string, password: string) => Promise<void>;
    logout: () => void;
    isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser] = useState<{ name: string; role: string; token: string } | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Check local storage for persisted session
        const storedAuth = localStorage.getItem('nexus_auth');
        if (storedAuth) {
            setIsAuthenticated(true);
            setUser(JSON.parse(storedAuth));
        }
        setIsLoading(false);
    }, []);

    const login = async (username: string, password: string) => {
        try {
            // Retrieve Auth Configuration (Prioritize Runtime Env, then build-time, fallback to dynamic Window Hostname)
            const env = (window as any)._env_ || import.meta.env;
            const clientId = env.VITE_AUTH_CLIENT_ID || '231814316654413e';
            const authApiUrl = env.VITE_AUTH_API_URL || `http://${window.location.hostname}:8081`;
            
            // Connect directly to the centralized Auth Service domain
            const response = await fetch(`${authApiUrl}/api/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password, clientId })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || 'Login failed');
            }

            const data = await response.json();

            // Expected data format from AuthResponse: { token: '...', username: '...', role: '...' }
            const authUser = {
                name: data.username || username,
                role: data.role || 'ROLE_USER',
                token: data.token
            };

            localStorage.setItem('nexus_auth', JSON.stringify(authUser));
            setUser(authUser);
            setIsAuthenticated(true);
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    };

    const logout = () => {
        localStorage.removeItem('nexus_auth');
        setUser(null);
        setIsAuthenticated(false);
    };

    return (
        <AuthContext.Provider value={{ isAuthenticated, user, login, logout, isLoading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
