import React, { createContext, useContext, useState, useCallback } from "react";
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
  login: (credentials: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => void;
  refreshAuth: (refreshToken: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [_refreshToken, setRefreshToken] = useState<string | null>(null);

  const login = useCallback(async (credentials: LoginRequest) => {
    try {
      const response: AuthResponse = await authApi.login(credentials);
      setUser(response.user);
      setAccessToken(response.accessToken);
      setRefreshToken(response.refreshToken);
    } catch (error) {
      throw error;
    }
  }, []);

  const register = useCallback(async (data: RegisterRequest) => {
    try {
      const response: AuthResponse = await authApi.register(data);
      setUser(response.user);
      setAccessToken(response.accessToken);
      setRefreshToken(response.refreshToken);
    } catch (error) {
      throw error;
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);
  }, []);

  const refreshAuth = useCallback(async (token: string) => {
    try {
      const response: AuthResponse = await authApi.refresh(token);
      setUser(response.user);
      setAccessToken(response.accessToken);
      setRefreshToken(response.refreshToken);
    } catch (error) {
      // If refresh fails, clear auth
      logout();
      throw error;
    }
  }, [logout]);

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
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
