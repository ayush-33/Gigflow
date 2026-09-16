import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { setAccessToken, clearAccessToken } from "../utils/auth";
import api from "../api/api";
import { connectSocket, disconnectSocket, onSocketChange } from "../utils/socket";

const AuthContext = createContext(null);

let restorePromise = null;

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
    let active = true;

    const restore = async () => {
      const savedUser = localStorage.getItem("user");

      if (!savedUser) {
        setAuthReady(true);
        return;
      }

      try {
        if (!restorePromise) {
          restorePromise = api.post("/auth/refresh");
        }
        const { data } = await restorePromise;

        if (!active) return;

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
        if (active) {
          console.error("Auth restore failed:", err);
          clearAccessToken();
          localStorage.removeItem("user");
          setUser(null);
        }
      } finally {
        restorePromise = null;
        if (active) {
          setAuthReady(true);
        }
      }
    };

    restore();

    return () => {
      active = false;
    };
  }, []);

  // ✅ Keep socket React state synchronized when socket client changes (e.g. after refresh token)
  useEffect(() => {
    const unsubscribe = onSocketChange((newSocket) => {
      setSocket(newSocket);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const login = useCallback((accessToken, userData) => {
    setAccessToken(accessToken);
    localStorage.setItem("user", JSON.stringify(userData));
    setUser(userData);
    const s = connectSocket();
    setSocket(s);
  }, []);

  const logout = useCallback(async () => {
    try { await api.post("/auth/logout"); } catch { }
    clearAccessToken();
    localStorage.removeItem("user");
    disconnectSocket();
    setSocket(null);
    setUser(null);
  }, []);

  const providerValue = useMemo(() => ({
    user,
    setUser,
    login,
    logout,
    authReady,
    socket
  }), [user, login, logout, authReady, socket]);

  // ✅ Don't render children until auth state is restored
  // This prevents profile/protected pages from firing API calls before token is ready
  if (!authReady) return <div>Loading...</div>;

  return (
    <AuthContext.Provider value={providerValue}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
