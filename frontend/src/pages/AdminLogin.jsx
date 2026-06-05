import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Lock, Mail, AlertCircle, ArrowRight, Shield } from "lucide-react";
import { motion } from "framer-motion";
import api from "../services/api";

const AdminLogin = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError("");
    if (!email || !password) {
      setLocalError("Please fill in all fields.");
      return;
    }

    setLoading(true);
    try {
      // Authenticate directly to check role first
      const res = await api.post("/api/auth/login", { email, password });
      const user = res.data.user;

      if (user.role !== "admin") {
        setLocalError("Access Denied: You do not have administrator privileges.");
        setLoading(false);
        return;
      }

      // Log in via AuthContext
      const result = await login(email, password);
      if (result.success) {
        navigate("/admin/dashboard");
      } else {
        setLocalError(result.error || "Failed to establish admin session.");
      }
    } catch (err) {
      let msg = "Invalid administrator credentials.";
      if (!err.response) {
        msg = "Network Connection Refused: Backend API server is stopped or unreachable at http://127.0.0.1:8000.";
      } else if (err.response.data && err.response.data.detail) {
        msg = err.response.data.detail;
      }
      setLocalError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-950 min-h-[calc(100vh-4rem)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="max-w-md w-full space-y-8 bg-slate-900 border border-red-500/20 p-8 rounded-2xl shadow-2xl shadow-black/80"
      >
        <div className="text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 border border-red-500/20">
            <Shield className="w-6 h-6" />
          </div>
          <h2 className="mt-4 text-3xl font-extrabold text-white tracking-tight">
            PashuCare Admin Portal
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Authorize to manage system statistics and diagnostics
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {localError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center space-x-3 text-red-400 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{localError}</span>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                Admin Email Address
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                  <Mail className="w-5 h-5" />
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-slate-700 rounded-xl bg-slate-950 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all text-sm"
                  placeholder="admin@example.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                Administrator Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                  <Lock className="w-5 h-5" />
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-slate-700 rounded-xl bg-slate-950 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all text-sm"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white font-extrabold py-3 px-4 rounded-xl shadow-lg shadow-red-500/20 transition-all cursor-pointer"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-white"></div>
            ) : (
              <>
                <span>Authenticate Admin</span>
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

export default AdminLogin;
