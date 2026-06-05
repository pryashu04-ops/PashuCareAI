import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import api from "../services/api";
import { 
  Users, 
  Activity, 
  Cpu, 
  Database, 
  MessageSquare, 
  HeartPulse, 
  Clock, 
  HardDrive, 
  AlertCircle 
} from "lucide-react";

const AdminDashboard = () => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/api/admin/stats");
      setData(res.data);
    } catch (err) {
      console.error("Failed to load admin stats:", err);
      let msg = "Failed to fetch administrative metrics.";
      if (err.response && err.response.data && err.response.data.detail) {
        msg = err.response.data.detail;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/admin/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-500 mx-auto"></div>
          <p className="text-slate-400 text-sm">Retrieving system analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
        <div className="max-w-md w-full bg-slate-900 border border-red-500/30 rounded-2xl p-6 text-center space-y-4 shadow-xl">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
          <h3 className="text-xl font-bold text-white">Administrative Error</h3>
          <p className="text-slate-400 text-sm">{error}</p>
          <button
            onClick={fetchStats}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl text-sm transition-all"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  const { stats, recentActivity, systemStats } = data || {};
  
  // Format bytes to readable string (e.g. GB)
  const formatGB = (bytes) => {
    if (!bytes) return "0 GB";
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  return (
    <div className="bg-slate-950 min-h-screen text-white pb-12">
      {/* Header bar */}
      <div className="border-b border-slate-900 bg-slate-900/40 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">🛡️</span>
            <div>
              <h1 className="text-lg font-bold text-white leading-tight">Admin Dashboard</h1>
              <p className="text-xs text-red-500 font-mono">PashuCare AI Security Panel</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-slate-400 hidden sm:inline">
              Welcome, <strong className="text-white">{user?.name || "Administrator"}</strong>
            </span>
            <button
              onClick={handleLogout}
              className="px-4 py-2 border border-slate-800 hover:bg-slate-900 text-slate-350 hover:text-white rounded-xl text-xs font-semibold transition-all cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-8">
        
        {/* Analytics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1 */}
          <motion.div 
            whileHover={{ y: -4 }}
            className="bg-slate-900 border border-slate-800/80 p-6 rounded-2xl flex items-center justify-between shadow-xl"
          >
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-400">Total System Users</p>
              <h3 className="text-4xl font-extrabold text-white">{stats?.totalUsers || 0}</h3>
            </div>
            <div className="h-12 w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-450 shadow-inner">
              <Users className="w-6 h-6" />
            </div>
          </motion.div>

          {/* Card 2 */}
          <motion.div 
            whileHover={{ y: -4 }}
            className="bg-slate-900 border border-slate-800/80 p-6 rounded-2xl flex items-center justify-between shadow-xl"
          >
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-400">Disease Detections</p>
              <h3 className="text-4xl font-extrabold text-white">{stats?.totalDetections || 0}</h3>
            </div>
            <div className="h-12 w-12 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-450 shadow-inner">
              <HeartPulse className="w-6 h-6" />
            </div>
          </motion.div>

          {/* Card 3 */}
          <motion.div 
            whileHover={{ y: -4 }}
            className="bg-slate-900 border border-slate-800/80 p-6 rounded-2xl flex items-center justify-between shadow-xl"
          >
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-400">Chatbot Messages</p>
              <h3 className="text-4xl font-extrabold text-white">{stats?.totalMessages || 0}</h3>
            </div>
            <div className="h-12 w-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-450 shadow-inner">
              <MessageSquare className="w-6 h-6" />
            </div>
          </motion.div>
        </div>

        {/* Dashboard Center Splitting */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Recent Detections Activity */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 lg:col-span-2 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center space-x-2">
              <Activity className="w-5 h-5 text-rose-500" />
              <span>Recent Disease Detections</span>
            </h3>
            
            <div className="divide-y divide-slate-800">
              {recentActivity?.recentDetections && recentActivity.recentDetections.length > 0 ? (
                recentActivity.recentDetections.map((detection) => (
                  <div key={detection.id} className="py-3 flex items-center justify-between hover:bg-slate-800/20 px-2 rounded-lg transition-all">
                    <div>
                      <p className="text-sm font-semibold text-white">{detection.disease_name}</p>
                      <p className="text-xs text-slate-400">
                        Animal: <span className="text-slate-350">{detection.animal_type}</span> • ID: <span className="font-mono text-slate-500">{detection.id.substring(0, 8)}...</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-slate-500 flex items-center justify-end">
                        <Clock className="w-3.5 h-3.5 mr-1" />
                        {new Date(detection.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-6 text-center text-slate-500 text-sm">
                  No diagnostics records found.
                </div>
              )}
            </div>
          </div>

          {/* System Environment Monitor */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
            <h3 className="text-lg font-bold text-white flex items-center space-x-2">
              <Cpu className="w-5 h-5 text-emerald-500" />
              <span>System & Environment</span>
            </h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl">
                <span className="text-xs font-semibold text-slate-400">Operating System</span>
                <span className="text-sm font-bold text-white flex items-center">
                  <span className="mr-1.5 text-slate-500">💻</span>
                  {systemStats?.os || "N/A"}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl">
                <span className="text-xs font-semibold text-slate-400">Backend Runtime</span>
                <span className="text-sm font-bold text-emerald-450 font-mono">
                  {systemStats?.nodeVersion || "Node.js"}
                </span>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">System Memory usage</span>
                  <span className="text-xs font-bold text-white flex items-center">
                    <HardDrive className="w-3.5 h-3.5 mr-1 text-slate-550" />
                    {formatGB(systemStats?.memory?.total - systemStats?.memory?.free)} / {formatGB(systemStats?.memory?.total)}
                  </span>
                </div>
                {systemStats?.memory?.total > 0 && (
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-emerald-500 h-full rounded-full transition-all duration-550"
                      style={{ 
                        width: `${Math.round(((systemStats.memory.total - systemStats.memory.free) / systemStats.memory.total) * 100)}%` 
                      }}
                    ></div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Recent Registered Users */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <h3 className="text-lg font-bold text-white flex items-center space-x-2">
            <Users className="w-5 h-5 text-blue-500" />
            <span>Recent System Registrations</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recentActivity?.recentUsers && recentActivity.recentUsers.length > 0 ? (
              recentActivity.recentUsers.map((userObj) => (
                <div key={userObj.id} className="p-4 bg-slate-950 rounded-xl border border-slate-900 hover:border-slate-800 flex items-center justify-between transition-all">
                  <div>
                    <h4 className="text-sm font-semibold text-white">{userObj.name}</h4>
                    <p className="text-xs text-slate-400 font-mono">{userObj.email}</p>
                  </div>
                  <span className="text-xs text-slate-550">
                    Joined: {new Date(userObj.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))
            ) : (
              <div className="col-span-full py-6 text-center text-slate-500 text-sm">
                No user registrations found.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
