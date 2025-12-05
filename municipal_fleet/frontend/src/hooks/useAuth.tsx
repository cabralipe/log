import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "../lib/api";

type User = {
  id: number;
  email: string;
  role: string;
  municipality: number | null;
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("access");
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get<User>("/auth/users/me/")
      .then((res) => setUser(res.data))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const { data } = await api.post("/auth/login/", { email, password });
    localStorage.setItem("access", data.access);
    localStorage.setItem("refresh", data.refresh);
    const me = await api.get<User>("/auth/users/me/");
    setUser(me.data);
  };

  const logout = async () => {
    const refresh = localStorage.getItem("refresh");
    if (refresh) {
      try {
        await api.post("/auth/logout/", { refresh });
      } catch (_) {
        /* ignore */
      }
    }
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};
