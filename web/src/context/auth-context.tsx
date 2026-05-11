"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ApiUser } from "@/lib/api";
import { API_URL, apiFetch, setStoredToken, getStoredToken } from "@/lib/api";
import {
  clearBbDicomProxyCookie,
  syncBbDicomProxyCookie,
} from "@/lib/bb-dicom-session-client";

type AuthState = {
  token: string | null;
  user: ApiUser | null;
  loading: boolean;
};

type AuthContextValue = AuthState & {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<ApiUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshMe = useCallback(async (t?: string | null) => {
    const active = t ?? getStoredToken();
    if (!active) {
      setUser(null);
      return;
    }
    const me = await apiFetch<ApiUser>("/auth/me", {}, active);
    setUser(me);
  }, []);

  useEffect(() => {
    const t = getStoredToken();
    setToken(t);
    void (async () => {
      try {
        if (t) {
          await syncBbDicomProxyCookie(t);
          await refreshMe(t);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshMe]);

  const login = useCallback(async (email: string, password: string) => {
    let res: Response;
    try {
      res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
    } catch {
      throw new Error(
        `Sem ligação à API (${API_URL}). Confirme NEXT_PUBLIC_API_URL, HTTPS e CORS (WEB_ORIGIN na API).`,
      );
    }
    if (!res.ok) {
      let detail = "";
      try {
        const body = (await res.json()) as {
          message?: string | string[];
        };
        const m = body.message;
        detail = Array.isArray(m) ? m.join("; ") : (m ?? "");
      } catch {
        /* ignore */
      }
      throw new Error(
        detail || `Resposta da API: ${res.status}. Verifique URL e credenciais.`,
      );
    }
    const data = (await res.json()) as {
      access_token: string;
      user: ApiUser;
    };
    setStoredToken(data.access_token);
    setToken(data.access_token);
    setUser(data.user);
    await syncBbDicomProxyCookie(data.access_token);
  }, []);

  const logout = useCallback(() => {
    void clearBbDicomProxyCookie();
    setStoredToken(null);
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      loading,
      login,
      logout,
      refreshMe,
    }),
    [token, user, loading, login, logout, refreshMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth fora de AuthProvider");
  return ctx;
}
