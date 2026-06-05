import React from "react";
import { AlertOctagon, Phone, X, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "../context/LanguageContext";

const EmergencyAlert = ({ isOpen, onClose, diseaseName, firstAid = [] }) => {
  const { t } = useLanguage();

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="w-full max-w-lg bg-slate-900 border border-red-500/50 rounded-2xl overflow-hidden shadow-2xl shadow-red-900/20"
          >
            {/* Header banner */}
            <div className="bg-gradient-to-r from-red-600 to-rose-700 p-6 text-white relative">
              <div className="absolute top-4 right-4">
                <button
                  onClick={onClose}
                  className="p-1 rounded-full hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex items-center space-x-3">
                <AlertOctagon className="w-8 h-8 text-white animate-pulse" />
                <div>
                  <h2 className="text-xl font-extrabold tracking-wide uppercase">
                    {t("emergencyAlertTitle")}
                  </h2>
                  <p className="text-sm text-red-100 font-semibold mt-1">
                    {t("diseaseName")}: {diseaseName}
                  </p>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start space-x-3">
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-300 font-medium">
                  {t("emergencyAlertText")}
                </p>
              </div>

              {firstAid.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-extrabold text-slate-200 uppercase tracking-wider">
                    {t("immediateSteps")}:
                  </h3>
                  <ul className="space-y-2">
                    {firstAid.map((step, idx) => (
                      <li key={idx} className="flex items-start space-x-2 text-sm text-slate-300">
                        <span className="text-red-400 font-bold shrink-0">{idx + 1}.</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Call vet action */}
              <div className="pt-4 flex flex-col sm:flex-row gap-3">
                <a
                  href="tel:1962" // 1962 is standard emergency veterinary helpline in Karnataka / India
                  className="flex-1 flex items-center justify-center space-x-2 bg-red-600 hover:bg-red-700 text-white font-extrabold py-3 px-4 rounded-xl shadow-lg shadow-red-600/30 transition-all text-center cursor-pointer"
                >
                  <Phone className="w-5 h-5" />
                  <span>{t("callVet")}</span>
                </a>
                <button
                  onClick={onClose}
                  className="px-4 py-3 bg-slate-800 hover:bg-slate-750 text-slate-350 border border-slate-700 rounded-xl font-medium transition-all"
                >
                  {t("dismiss")}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default EmergencyAlert;
