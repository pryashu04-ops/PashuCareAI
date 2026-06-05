import React, { createContext, useState, useContext, useEffect } from "react";
import api from "../services/api";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem("pashucare_token"));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Synchronize localStorage and user session on token changes
  useEffect(() => {
    if (token) {
      localStorage.setItem("pashucare_token", token);
      fetchUserProfile();
    } else {
      localStorage.removeItem("pashucare_token");
      setUser(null);
      setLoading(false);
    }
  }, [token]);

  const fetchUserProfile = async () => {
    try {
      setLoading(true);
      const res = await api.get("/api/auth/me");
      setUser(res.data);
      setError(null);
    } catch (err) {
      console.error("Failed to load user profile:", err);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.post("/api/auth/login", { email, password });
      setToken(res.data.token);
      setUser(res.data.user);
      return { success: true };
    } catch (err) {
      let msg = "Login failed. Please check credentials.";
      if (!err.response) {
        msg = "Network Connection Refused: Backend API server is stopped or unreachable at http://127.0.0.1:8000. Please start the server.";
      } else if (err.response.data && err.response.data.detail) {
        msg = err.response.data.detail;
      } else if (err.response.data && err.response.data.message) {
        msg = err.response.data.message;
      }
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setLoading(false);
    }
  };

  const register = async (name, email, password) => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.post("/api/auth/register", { name, email, password });
      setToken(res.data.token);
      setUser(res.data.user);
      return { success: true };
    } catch (err) {
      let msg = "Registration failed. Try again.";
      if (!err.response) {
        msg = "Network Connection Refused: Backend API server is stopped or unreachable at http://127.0.0.1:8000. Please start the server.";
      } else if (err.response.data && err.response.data.detail) {
        msg = err.response.data.detail;
      } else if (err.response.data && err.response.data.message) {
        msg = err.response.data.message;
      }
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, error, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
