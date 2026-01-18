import React, { createContext, useContext, useState, useEffect } from "react";
import { apiClient } from "../services/api/apiClient";
import type { User } from "../services/api/types";

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem("auth_token");

      if (storedToken) {
        setToken(storedToken);
        try {
          const result = await apiClient.getCurrentUser();
          if (result.isOk()) {
            setUser(result.value.user);
          } else {
            localStorage.removeItem("auth_token");
            setToken(null);
          }
        } catch (error) {
          console.error("Failed to get current user:", error);
          localStorage.removeItem("auth_token");
          setToken(null);
        }
      }

      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = async (
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      console.log("[AuthContext] Attempting login for:", email);
      console.log("[AuthContext] API Base URL:", import.meta.env.VITE_API_BASE_URL);

      const result = await apiClient.login(email, password);
      if (result.isOk()) {
        const { token, user } = result.value;
        console.log("[AuthContext] Login successful:", user.email);
        localStorage.setItem("auth_token", token);
        setToken(token);
        setUser(user);
        return { success: true };
      }

      // エラーメッセージを取得
      const errorMessage =
        result.error.message ||
        "メールアドレスまたはパスワードが正しくありません";
      console.error("[AuthContext] Login failed:", {
        error: result.error,
        message: errorMessage,
        status: result.error.status,
      });
      return { success: false, error: errorMessage };
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "ログイン処理中にエラーが発生しました";
      console.error("[AuthContext] Login exception:", error);
      return { success: false, error: errorMessage };
    }
  };

  const logout = () => {
    localStorage.removeItem("auth_token");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
