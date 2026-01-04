import React, { createContext, useContext, useState, useEffect } from 'react';
import { setBackendType as setApiBackendType, BackendType } from '../services/api';

interface BackendContextType {
  backend: BackendType;
  switchBackend: (type: BackendType) => void;
}

const BackendContext = createContext<BackendContextType | undefined>(undefined);

export const BackendProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Initialize from localStorage or default
  const [backend, setBackend] = useState<BackendType>(() => {
    const saved = localStorage.getItem('backendType');
    return (saved === 'java' || saved === 'python') ? saved : 'python';
  });

  // Initialize API service on mount (sync with state)
  useEffect(() => {
    setApiBackendType(backend);
  }, [backend]);

  const switchBackend = (type: BackendType) => {
    setBackend(type);
    localStorage.setItem('backendType', type);
    setApiBackendType(type);
    // Reload to ensure fresh state from new backend
    window.location.reload();
  };

  return (
    <BackendContext.Provider value={{ backend, switchBackend }}>
      {children}
    </BackendContext.Provider>
  );
};

export const useBackend = () => {
  const context = useContext(BackendContext);
  if (!context) {
    throw new Error('useBackend must be used within a BackendProvider');
  }
  return context;
};
