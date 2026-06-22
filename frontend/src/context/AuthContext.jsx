import { createContext, useContext, useState, useEffect } from "react";
import { setAccessToken, clearAccessToken } from "../utils/auth";
import api from "../api/api";
import { connectSocket, disconnectSocket } from "../utils/socket";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("user")) || null; }
    catch { return null; }
  });

  // ✅ KEY FIX: on page refresh, silently restore the access token
  // The httpOnly refresh cookie is still valid — use it to get a new access token
  const [authReady, setAuthReady] = useState(false);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const restore = async () => {
      const savedUser = localStorage.getItem("user");

      if (!savedUser) {
        setAuthReady(true);
        return;
      }

      try {
        const { data } = await api.post("/auth/refresh");

        if (data?.accessToken) {
          setAccessToken(data.accessToken);
          if (data.user) {
            setUser(data.user);
            localStorage.setItem("user", JSON.stringify(data.user));
          } else {
            setUser(JSON.parse(savedUser));
          }
          const s = connectSocket();
          setSocket(s);
        } else {
          throw new Error("No token received");
        }

      } catch (err) {
        console.error("Auth restore failed:", err);

        clearAccessToken();
        localStorage.removeItem("user");
        setUser(null);
      } finally {
        setAuthReady(true);
      }
    };

    restore();
  }, []);

  const login = (accessToken, userData) => {
    setAccessToken(accessToken);
    localStorage.setItem("user", JSON.stringify(userData));
    setUser(userData);
    const s = connectSocket();
    setSocket(s);
  };

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch {}
    clearAccessToken();
    localStorage.removeItem("user");
    disconnectSocket();
    setSocket(null);
    setUser(null);
  };

  // ✅ Don't render children until auth state is restored
  // This prevents profile/protected pages from firing API calls before token is ready
  if (!authReady) return <div>Loading...</div>;

  return (
    <AuthContext.Provider value={{ user, setUser, login, logout, authReady, socket }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);