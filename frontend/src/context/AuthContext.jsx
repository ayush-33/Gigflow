import { createContext, useState, useEffect } from "react";

// create context
export const AuthContext = createContext();

// provider component
export const AuthProvider = ({ children }) => {

  const [userToken, setUserToken] = useState(null);

  // check if token already exists when app loads
  useEffect(() => {
    const token = localStorage.getItem("token");

    if (token) {
      setUserToken(token);
    }
  }, []);

  // login function
  const login = (token) => {
    localStorage.setItem("token", token);
    setUserToken(token);
  };

  // logout function
  const logout = () => {
    localStorage.removeItem("token");
    setUserToken(null);
  };

  return (
    <AuthContext.Provider value={{ userToken, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};