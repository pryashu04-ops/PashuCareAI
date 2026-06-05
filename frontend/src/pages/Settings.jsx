import React, { useState } from "react";
import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import { Settings as SettingsIcon, Globe, Moon, User, ShieldAlert, BadgeInfo } from "lucide-react";
import { motion } from "framer-motion";

const Settings = () => {
  const { t, language, setLanguage } = useLanguage();
  const { user } = useAuth();
  const [darkMode, setDarkMode] = useState(true);

  const handleLanguageChange = (e) => {
    setLanguage(e.target.value);
  };

  return (
    <div className="bg-slate-950 text-white min-h-screen py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">
            {t("settingsTitle")}
          </h1>
          <p className="text-slate-400 text-sm">
            Manage your account preferences, language selection, and diagnostics configuration.
          </p>
        </div>

        {/* Settings Box */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-8 shadow-xl">
          {/* User profile details section */}
          {user && (
            <div className="space-y-4 pb-6 border-b border-slate-850">
              <h3 className="text-sm font-extrabold text-slate-400 uppercase tracking-wider flex items-center space-x-2">
                <User className="w-4 h-4 text-emerald-450" />
                <span>{t("profileSection")}</span>
              </h3>
              <div className="bg-slate-950/50 rounded-xl p-4 border border-slate-850 space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Name</span>
                  <span className="font-semibold text-slate-200">{user.name}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Email</span>
                  <span className="font-semibold text-slate-200">{user.email}</span>
                </div>
              </div>
            </div>
          )}

          {/* Preferences Section */}
          <div className="space-y-6">
            <h3 className="text-sm font-extrabold text-slate-400 uppercase tracking-wider flex items-center space-x-2">
              <SettingsIcon className="w-4 h-4 text-cyan-400" />
              <span>Preferences</span>
            </h3>

            {/* Language Selector */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-950/30 p-4 rounded-xl border border-slate-850">
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-200 flex items-center space-x-2">
                  <Globe className="w-4 h-4 text-emerald-450" />
                  <span>{t("languageSelect")}</span>
                </h4>
                <p className="text-xs text-slate-450">Switch translation between English, Kannada, and Hindi</p>
              </div>
              <select
                value={language}
                onChange={handleLanguageChange}
                className="bg-slate-900 border border-slate-700 text-white px-4 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="en">{t("english")}</option>
                <option value="kn">{t("kannada")}</option>
                <option value="hi">{t("hindi")}</option>
              </select>
            </div>

            {/* Theme Selector */}
            <div className="flex justify-between items-center bg-slate-950/30 p-4 rounded-xl border border-slate-850">
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-200 flex items-center space-x-2">
                  <Moon className="w-4 h-4 text-cyan-400" />
                  <span>{t("darkMode")}</span>
                </h4>
                <p className="text-xs text-slate-450">Toggle dark style aesthetics for high-contrast viewing</p>
              </div>
              <button
                type="button"
                onClick={() => setDarkMode(!darkMode)}
                className={`w-14 h-8 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-300 ${
                  darkMode ? "bg-emerald-500" : "bg-slate-700"
                }`}
              >
                <div
                  className={`bg-slate-950 w-6 h-6 rounded-full shadow-md transform transition-transform duration-300 ${
                    darkMode ? "translate-x-6" : ""
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Info Card footer */}
          <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-850 flex items-start space-x-3 text-slate-400">
            <BadgeInfo className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <p className="font-semibold text-slate-350">System Diagnostics</p>
              <p>Device Connectivity: Online</p>
              <p>AI Engine Server Version: {t("appVersion")}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
