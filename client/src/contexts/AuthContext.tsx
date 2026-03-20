import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import {
  authApi,
  setAccessToken,
  LoginRequest,
  RegisterRequest,
  AuthResponse,
} from "../lib/api";

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  sessionExpired: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => void;
  refreshAuth: (refreshToken: string) => Promise<void>;
  clearSessionExpired: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const REFRESH_TOKEN_KEY = "refreshToken";

export interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  const logout = useCallback(() => {
    setUser(null);
    setAccessToken(null);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }, []);

  // On mount, attempt to restore session from stored refresh token
  useEffect(() => {
    const stored = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!stored) {
      setIsInitializing(false);
      return;
    }
    authApi
      .refresh(stored)
      .then((response: AuthResponse) => {
        setUser(response.user);
        setAccessToken(response.accessToken);
        if (response.refreshToken) {
          localStorage.setItem(REFRESH_TOKEN_KEY, response.refreshToken);
        }
      })
      .catch(() => {
        localStorage.removeItem(REFRESH_TOKEN_KEY);
      })
      .finally(() => {
        setIsInitializing(false);
      });
  }, []);

  // Listen for auth:expired event dispatched by the 401 interceptor
  useEffect(() => {
    const handleExpired = () => setSessionExpired(true);
    window.addEventListener("auth:expired", handleExpired);
    return () => window.removeEventListener("auth:expired", handleExpired);
  }, []);

  const login = useCallback(async (credentials: LoginRequest) => {
    const response: AuthResponse = await authApi.login(credentials);
    setUser(response.user);
    setAccessToken(response.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, response.refreshToken);
  }, []);

  const register = useCallback(async (data: RegisterRequest) => {
    const response: AuthResponse = await authApi.register(data);
    setUser(response.user);
    setAccessToken(response.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, response.refreshToken);
  }, []);

  const refreshAuth = useCallback(async (token: string) => {
    try {
      const response: AuthResponse = await authApi.refresh(token);
      setUser(response.user);
      setAccessToken(response.accessToken);
      if (response.refreshToken) {
        localStorage.setItem(REFRESH_TOKEN_KEY, response.refreshToken);
      }
    } catch (error) {
      logout();
      throw error;
    }
  }, [logout]);

  const clearSessionExpired = useCallback(() => {
    setSessionExpired(false);
  }, []);

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isInitializing,
    sessionExpired,
    clearSessionExpired,
    login,
    register,
    logout,
    refreshAuth,
  };

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
