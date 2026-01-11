import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';

interface User {
  id: string;
  email: string;
  name?: string;
}

interface UserContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, name?: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

const STORAGE_KEY = 'chrono_user';

// Generate a unique user ID from email
function generateUserId(email: string): string {
  // Simple hash-like ID from email
  return email.toLowerCase().replace(/[^a-z0-9]/g, '_');
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load user from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Validate the stored user object has required fields
        if (parsed && parsed.email && parsed.id) {
          setUser(parsed);
          console.log(`✅ User loaded from localStorage: ${parsed.email} (userId: ${parsed.id})`);
        } else {
          console.warn('⚠️ Invalid user data in localStorage, clearing it');
          localStorage.removeItem(STORAGE_KEY);
        }
      } else {
        console.log('ℹ️ No user found in localStorage');
      }
    } catch (e) {
      console.error('❌ Failed to load user from storage:', e);
      // Clear corrupted data
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (clearError) {
        console.error('❌ Failed to clear corrupted localStorage:', clearError);
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback((email: string, name?: string) => {
    const normalizedEmail = email.toLowerCase().trim();
    const newUser: User = {
      id: generateUserId(normalizedEmail),
      email: normalizedEmail,
      name: name || normalizedEmail.split('@')[0],
    };
    
    try {
      setUser(newUser);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newUser));
      console.log(`✅ User logged in and saved to localStorage: ${normalizedEmail} (userId: ${newUser.id})`);
    } catch (error) {
      console.error('❌ Failed to save user to localStorage:', error);
      // Still set user in state even if localStorage fails
      setUser(newUser);
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    
    // Clear user data
    localStorage.removeItem(STORAGE_KEY);
    
    // Clear all Gmail account index mappings (browser-specific mappings)
    try {
      const allKeys = Object.keys(localStorage);
      allKeys.forEach(key => {
        if (key.startsWith('gmail_account_index_')) {
          localStorage.removeItem(key);
        }
      });
      console.log('✅ Cleared all Gmail account index mappings');
    } catch (e) {
      console.error('❌ Failed to clear Gmail account index mappings:', e);
    }
    
    // Clear chat history
    try {
      localStorage.removeItem('chat_history');
      console.log('✅ Cleared chat history');
    } catch (e) {
      console.error('❌ Failed to clear chat history:', e);
    }
    
    console.log('✅ User logged out and all data cleared');
  }, []);

  const value = useMemo(() => ({
    user,
    isLoading,
    login,
    logout,
    isAuthenticated: !!user,
  }), [user, isLoading, login, logout]);

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
