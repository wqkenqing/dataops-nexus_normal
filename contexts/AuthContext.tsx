import React, { createContext, useContext, useState, useEffect } from 'react';

interface AuthContextType {
    isAuthenticated: boolean;
    user: { name: string; role: string } | null;
    login: (username: string) => Promise<void>;
    logout: () => void;
    isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser] = useState<{ name: string; role: string } | null>(null);
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

    const login = async (username: string) => {
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 800));

        // Mock successful login
        const mockUser = {
            name: username || 'Admin User',
            role: 'DevOps Lead'
        };

        localStorage.setItem('nexus_auth', JSON.stringify(mockUser));
        setUser(mockUser);
        setIsAuthenticated(true);
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
