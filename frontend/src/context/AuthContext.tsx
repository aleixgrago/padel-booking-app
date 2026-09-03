import { createContext, useContext, useState, ReactNode } from "react";
import { api } from "../api/client";

interface User {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "USER";
}

interface AuthContextValue {
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  // El token de sesión vive en una cookie httpOnly (no accesible desde
  // JS); aquí solo guardamos datos no sensibles para pintar la interfaz.
  const [user, setUser] = useState<User | null>(() => {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  });

  function login(user: User) {
    localStorage.setItem("user", JSON.stringify(user));
    setUser(user);
  }

  function logout() {
    api.logout().catch(() => {
      /* aunque falle la llamada, limpiamos el estado local igualmente */
    });
    localStorage.removeItem("user");
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
