import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '@shared';

export interface AuthContextType {
  token: string | null;
  user: User | null;
  login: (username: string, password: string) => Promise<User>;
  logout: () => void;
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('dhcp_auth_token') || null);
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('dhcp_auth_user');
    return saved ? (JSON.parse(saved) as User) : null;
  });
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (token) {
      // Validate current token
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => {
          if (!res.ok) throw new Error('Token expired');
          return res.json();
        })
        .then(data => {
          setUser(data.user);
          localStorage.setItem('dhcp_auth_user', JSON.stringify(data.user));
        })
        .catch(() => {
          logout();
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = async (username: string, password: string): Promise<User> => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Authentication failed');
    }

    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('dhcp_auth_token', data.token);
    localStorage.setItem('dhcp_auth_user', JSON.stringify(data.user));
    return data.user;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('dhcp_auth_token');
    localStorage.removeItem('dhcp_auth_user');
  };

  const apiFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
    const headers = new Headers(options.headers || {});
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const response = await fetch(url, {
      ...options,
      headers
    });

    if (response.status === 401) {
      logout();
      throw new Error('Session expired, please login again.');
    }

    return response;
  };

  return (
    <AuthContext.Provider value={{ token, user, login, logout, apiFetch, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
