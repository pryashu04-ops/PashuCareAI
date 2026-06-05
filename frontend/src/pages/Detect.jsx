import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import api from "../services/api";
import EmergencyAlert from "../components/EmergencyAlert";
import { Upload, Camera, Trash2, ArrowRight, ShieldAlert, HeartHandshake, EyeOff, Activity, ShieldCheck, Pill, Stethoscope, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const Detect = () => {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();

  const [animalType, setAnimalType] = useState("Cow");
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [error, setError] = useState("");

  const visualAnalysisLabels = {
    en: {
      skin_lesions: "Skin Lesions",
      scabs: "Scabs",
      hair_loss: "Hair Loss",
      nodules: "Nodules / Lumps",
      mouth_sores: "Mouth Sores",
      hoof_infections: "Hoof Infections",
      swelling: "Swelling / Edema",
      eye_or_nasal_discharge: "Eye / Nasal Discharge",
      title: "Symptom-Based Visual Analysis",
    },
    hi: {
      skin_lesions: "त्वचा के घाव",
      scabs: "खुरंड (पपड़ी)",
      hair_loss: "बालों का झड़ना",
      nodules: "गांठें / थक्के",
      mouth_sores: "मुंह के छाले",
      hoof_infections: "खुर का संक्रमण",
      swelling: "सूजन / एडिमा",
      eye_or_nasal_discharge: "आंख / नाक से स्राव",
      title: "लक्षण-आधारित दृश्य विश्लेषण",
    },
    kn: {
      skin_lesions: "ಚರ್ಮದ ಗಾಯಗಳು",
      scabs: "ಒಣಗಿದ ಗಾಯದ ಕ মামುಗಳು",
      hair_loss: "ಕೂದಲು ಉದುರುವುದು",
      nodules: "ಗಂಟುಗಳು / ಬಾವು",
      mouth_sores: "ಬಾಯಿಯ ಹುಣ್ಣುಗಳು",
      hoof_infections: "ಗೊರಸು ಸೋಂಕು",
      swelling: "ಊತ",
      eye_or_nasal_discharge: "ಕಣ್ಣು / ಮೂಗಿನಿಂದ ದ್ರವ ಸೋರುವಿಕೆ",
      title: "ಲಕ್ಷಣ ಆಧಾರಿತ ದೃಶ್ಯ ವಿಶ್ಲೇಷಣೆ",
    }
  };

  const topPredictionsTitles = {
    en: "Top Predictions",
    hi: "शीर्ष भविष्यवाणियां",
    kn: "ಉನ್ನತ ಮುನ್ಸೂಚನೆಗಳು"
  };

  const stepsByLang = {
    en: [
      "Uploading image and establishing API connection...",
      "Preprocessing image (scaling, normalizing contrast)...",
      "Identifying livestock species (Cow / Goat / Sheep)...",
      "Running custom disease prediction model...",
      "Retrieving treatment recommendations...",
      "Translating diagnostic report to selected language..."
    ],
    hi: [
      "छवि अपलोड और एपीआई कनेक्शन स्थापित हो रहा है...",
      "छवि प्रीप्रोसेसिंग (आकार और चमक अनुकूलन)...",
      "पशु प्रजातियों (गाय / बकरी / भेड़) की पहचान...",
      "रोग भविष्यवाणी मॉडल चलाया जा रहा है...",
      "उपचार सिफारिशों की खोज की जा रही है...",
      "नैदानिक रिपोर्ट का चुनिंदा भाषा में अनुवाद..."
    ],
    kn: [
      "ಚಿತ್ರವನ್ನು ಅಪ್ಲೋಡ್ ಮಾಡಲಾಗುತ್ತಿದೆ ಮತ್ತು ಸಂಪರ್ಕ ಸಾಧಿಸಲಾಗುತ್ತಿದೆ...",
      "ಚಿತ್ರದ ಪ್ರಿಪ್ರೊಸೆಸಿಂಗ್ (ಅಳತೆ ಮತ್ತು ಹೊಳಪು ಹೊಂದಾಣಿಕೆ)...",
      "ಜಾನುವಾರು ಪ್ರಭೇದಗಳ (ಹಸು / ಆಡು / ಕುರಿ) ಗುರುತಿಸುವಿಕೆ...",
      "ರೋಗ ಭವಿಷಾವಣೆ ಮಾದರಿಯನ್ನು ಚಲಾಯಿಸಲಾಗುತ್ತಿದೆ...",
      "ಚಿಕಿತ್ಸೆ ಶಿಫಾರಸುಗಳನ್ನು ಪಡೆಯಲಾಗುತ್ತಿದೆ...",
      "ವರದಿಯನ್ನು ಆಯ್ದ ಭಾಷೆಗೆ ಅನುವಾದಿಸಲಾಗುತ್ತಿದೆ..."
    ]
  };

  // Re-fetch translated result when language changes
  useEffect(() => {
    if (result && result.id) {
      const fetchTranslatedResult = async () => {
        try {
          const response = await api.get(`/api/detections/${result.id}?lang=${language}`);
          setResult(response.data);
        } catch (err) {
          console.error("Failed to fetch translation:", err);
        }
      };
      fetchTranslatedResult();
    }
  }, [language]);

  // Camera States
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);

  // Emergency Modal
  const [emergencyOpen, setEmergencyOpen] = useState(false);

  // File Change Handler
  const handleFileChange = (e) => {
    setError("");
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setError("File size exceeds 10MB limit.");
        return;
      }
      const validExts = [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif", ".bmp", ".jfif"];
      const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
      if (!validExts.includes(ext) && !file.type.startsWith("image/")) {
        setError("Invalid file type. Please upload a Cow, Goat, or Sheep image.");
        return;
      }
      setImage(file);
      setImagePreview(URL.createObjectURL(file));
      setResult(null);
    }
  };

  // Drag and Drop Handlers
  const [dragActive, setDragActive] = useState(false);
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    setError("");
    const file = e.dataTransfer.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setError("File size exceeds 10MB limit.");
        return;
      }
      const validExts = [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif", ".bmp", ".jfif"];
      const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
      if (!validExts.includes(ext) && !file.type.startsWith("image/")) {
        setError("Invalid file type. Please upload a Cow, Goat, or Sheep image.");
        return;
      }
      setImage(file);
      setImagePreview(URL.createObjectURL(file));
      setResult(null);
    }
  };

  // Camera Operations
  const startCamera = async () => {
    setError("");
    setResult(null);
    try {
      setCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error(err);
      setError("Could not access camera. Please check permissions.");
      setCameraActive(false);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");

      // Set canvas dimensions equal to video stream feed dimensions
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      canvas.toBlob((blob) => {
        const file = new File([blob], "captured_animal.jpg", { type: "image/jpeg" });
        setImage(file);
        setImagePreview(URL.createObjectURL(file));
        stopCamera();
      }, "image/jpeg");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const removeImage = () => {
    setImage(null);
    setImagePreview(null);
    setResult(null);
    setError("");
  };

  // Submit and Analyze Image
  const handleAnalyze = async () => {
    if (!image) {
      setError("Please select or capture an image first.");
      return;
    }

    if (!user) {
      setError(t("authRequired"));
      navigate("/login");
      return;
    }

    setAnalyzing(true);
    setError("");
    setResult(null);
    setAnalysisStep(0);

    // Dynamic timer to simulate AI workflow step progression
    const interval = setInterval(() => {
      setAnalysisStep((prev) => (prev < 5 ? prev + 1 : prev));
    }, 800);

    const formData = new FormData();
    formData.append("file", image);
    formData.append("animal_type", animalType);
    formData.append("lang", language);

    try {
      const response = await api.post("/api/detect", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setResult(response.data);
      if (response.data.severity_color === "red" || response.data.severity_color === "orange") {
        setEmergencyOpen(true);
      }
    } catch (err) {
      console.error(err);
      if (!err.response) {
        setError("Network error: Could not reach the backend server. Please verify your connection or try again later.");
      } else {
        setError(err.response.data?.detail || "AI analysis failed. Please verify that the image is clear and contains a supported animal.");
      }
    } finally {
      clearInterval(interval);
      setAnalyzing(false);
    }
  };

  const getSeverityBadgeColor = (color) => {
    switch (color) {
      case "red":
        return "bg-red-500/10 border border-red-500/30 text-red-400";
      case "orange":
        return "bg-orange-500/10 border border-orange-500/30 text-orange-400";
      case "amber":
        return "bg-amber-500/10 border border-amber-500/30 text-amber-400";
      default:
        return "bg-green-500/10 border border-green-500/30 text-green-400";
    }
  };

  const langCode = ["en", "hi", "kn"].includes(language) ? language : "en";

  return (
    <div className="bg-slate-950 text-white min-h-screen py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">
            {t("detect")}
          </h1>
          <p className="text-slate-400 text-sm max-w-lg mx-auto">
            {t("detectDesc")}
          </p>
        </div>

        {/* Loading Indicator or Form Box */}
        {analyzing ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl flex flex-col items-center justify-center space-y-6 text-center">
            <div className="relative flex items-center justify-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-emerald-400 border-t-2 border-transparent" />
              <Activity className="absolute w-6 h-6 text-emerald-400 animate-ping" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-white tracking-wide">
                {t("analyzing")}
              </h3>
              <p className="text-sm text-emerald-400 font-semibold max-w-md h-8 animate-pulse">
                {stepsByLang[langCode][analysisStep]}
              </p>
            </div>
            <div className="w-full max-w-xs bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-800">
              <div
                className="bg-gradient-to-r from-emerald-400 to-teal-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${((analysisStep + 1) / 6) * 100}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm flex items-center space-x-2">
                <ShieldAlert className="w-5 h-5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Animal Tab Selector */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-300">
                {t("selectAnimal")}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {["Cow", "Goat", "Sheep"].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      setAnimalType(type);
                      removeImage();
                    }}
                    className={`py-3 rounded-xl font-bold transition-all text-sm flex items-center justify-center space-x-2 border cursor-pointer ${
                      animalType === type
                        ? "bg-gradient-to-r from-emerald-500 to-teal-500 border-emerald-500 text-slate-950 shadow-md shadow-emerald-500/10"
                        : "bg-slate-950 border-slate-850 text-slate-400 hover:text-white"
                    }`}
                  >
                    <span className="text-lg">
                      {type === "Cow" ? "🐄" : type === "Goat" ? "🐐" : "🐑"}
                    </span>
                    <span>{t(type.toLowerCase())}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Image Upload/Capture Section */}
            <div className="space-y-2">
              {!cameraActive && !imagePreview && (
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-4 ${
                    dragActive
                      ? "border-emerald-500 bg-emerald-500/5"
                      : "border-slate-800 bg-slate-950 hover:border-slate-700"
                  }`}
                  onClick={() => document.getElementById("file-input").click()}
                >
                  <input
                    id="file-input"
                    type="file"
                    accept="image/*,.heic,.heif,.webp,.bmp,.jfif"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div className="p-3 bg-emerald-500/10 rounded-full text-emerald-400">
                    <Upload className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">{t("dragDropText")}</p>
                    <p className="text-xs text-slate-500">{t("supportsFormat")}</p>
                  </div>
                </div>
              )}

              {/* Video stream feed */}
              {cameraActive && (
                <div className="relative border border-slate-800 bg-slate-950 rounded-xl overflow-hidden aspect-video flex items-center justify-center">
                  <video
                    ref={videoRef}
                    className="w-full h-full object-cover"
                    playsInline
                    muted
                  />
                  <div className="absolute bottom-4 left-0 right-0 flex justify-center space-x-2 px-4">
                    <button
                      onClick={capturePhoto}
                      className="bg-emerald-500 text-slate-950 font-bold px-4 py-2 rounded-lg text-sm transition hover:bg-emerald-600 cursor-pointer"
                    >
                      {t("capturePhoto")}
                    </button>
                    <button
                      onClick={stopCamera}
                      className="bg-slate-850 border border-slate-700 text-white px-4 py-2 rounded-lg text-sm transition hover:bg-slate-800"
                    >
                      {t("cancel")}
                    </button>
                  </div>
                </div>
              )}

              {/* Preview Selected/Captured image */}
              {imagePreview && (
                <div className="relative border border-slate-800 bg-slate-950 rounded-xl p-4 flex flex-col items-center space-y-3">
                  <img
                    src={imagePreview}
                    alt="Animal Diagnostics Upload"
                    className="max-h-72 rounded-lg object-contain w-full"
                  />
                  <div className="flex space-x-2 w-full">
                    <button
                      onClick={removeImage}
                      className="flex-1 flex items-center justify-center space-x-1 py-2 px-4 border border-slate-800 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>{t("deleteImage")}</span>
                    </button>
                    <button
                      onClick={startCamera}
                      className="flex-1 flex items-center justify-center space-x-1 py-2 px-4 border border-slate-850 bg-slate-900 rounded-lg text-sm hover:bg-slate-800 transition-colors text-emerald-400"
                    >
                      <Camera className="w-4 h-4" />
                      <span>{t("retakePhoto")}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Trigger camera toggle */}
              {!cameraActive && !imagePreview && (
                <button
                  type="button"
                  onClick={startCamera}
                  className="w-full py-3 bg-slate-950 border border-slate-850 hover:bg-slate-900 rounded-xl text-sm font-semibold flex items-center justify-center space-x-2 text-emerald-400 transition"
                >
                  <Camera className="w-5 h-5" />
                  <span>{t("cameraCapture")}</span>
                </button>
              )}
            </div>

            <canvas ref={canvasRef} className="hidden" />

            {/* Action Analyze button */}
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={!image || analyzing}
              className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 font-extrabold text-base rounded-xl transition shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 cursor-pointer"
            >
              <ShieldAlert className="w-5 h-5 shrink-0" />
              <span>{t("analyzeBtn")}</span>
            </button>
          </div>
        )}

        {/* Results display Section */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              transition={{ duration: 0.4 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl"
            >
              {/* Header result */}
              <div className="bg-slate-850 border-b border-slate-800 p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-fadeIn">
                <div className="space-y-1">
                  <span className="text-xs text-emerald-400 font-semibold tracking-widest uppercase">
                    {t("resultTitle")}
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-2 flex-wrap">
                    <span>{result.disease_name}</span>
                    <span className="text-sm sm:text-base opacity-60">({t(result.animal_type.toLowerCase())})</span>
                  </h2>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {result.health_status && (
                    <span className={`px-4 py-1.5 rounded-full text-xs font-bold ${
                      result.health_status.toLowerCase() === "healthy" || result.health_status === "स्वस्थ" || result.health_status === "ಆರೋಗ್ಯಕರ"
                        ? "bg-green-500/10 border border-green-500/30 text-green-400"
                        : "bg-red-500/10 border border-red-500/30 text-red-400"
                    }`}>
                      {t("healthStatus")}: {result.health_status}
                    </span>
                  )}
                  {result.confidence_category && (
                    <span className="px-4 py-1.5 rounded-full text-xs font-bold bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
                      {result.confidence_category}
                    </span>
                  )}
                  <span className={`px-4 py-1.5 rounded-full text-xs font-bold ${getSeverityBadgeColor(result.severity_color)}`}>
                    {result.severity}
                  </span>
                </div>
              </div>

              {/* Quality Warning Alert */}
              {result.quality_warning && (
                <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-3 text-amber-400 text-xs flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 animate-pulse" />
                  <span>{result.quality_warning}</span>
                </div>
              )}

              {/* Body details */}
              <div className="p-6 space-y-6">
                
                {/* Upper section: Image on left, Description and confidence on right */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                  
                  {/* Left Column: Image Preview with overlay */}
                  <div className="md:col-span-5 relative group rounded-xl overflow-hidden border border-slate-800 bg-slate-950 aspect-square flex items-center justify-center">
                    <img
                      src={result.image_url ? `${api.defaults.baseURL || "http://localhost:8000"}${result.image_url}` : imagePreview}
                      alt="Analyzed Animal"
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-60" />
                    
                    {/* Confidence score badge on top of image */}
                    <div className="absolute bottom-4 left-4 right-4 bg-slate-900/90 backdrop-blur-md border border-slate-800 p-3 rounded-xl flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-semibold">{t("confidence")}</p>
                        <p className="text-lg font-black text-emerald-450">{result.confidence}%</p>
                      </div>
                      <div className="w-20 bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-850">
                        <div
                          style={{ width: `${result.confidence}%` }}
                          className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full rounded-full"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Description & Causes */}
                  <div className="md:col-span-7 space-y-4">
                    {/* Description card */}
                    <div className="bg-slate-950/60 border border-slate-850 p-5 rounded-xl space-y-2 hover:border-emerald-500/20 transition-all duration-300">
                      <h3 className="text-sm font-extrabold text-slate-200 uppercase tracking-wider flex items-center space-x-2">
                        <Activity className="w-4 h-4 text-cyan-400" />
                        <span>{t("description")}</span>
                      </h3>
                      <p className="text-slate-300 text-sm leading-relaxed">
                        {result.description}
                      </p>
                    </div>

                    {/* Causes card */}
                    {result.causes && result.causes.length > 0 && (
                      <div className="bg-slate-950/60 border border-slate-850 p-5 rounded-xl space-y-2 hover:border-amber-500/20 transition-all duration-300">
                        <h3 className="text-sm font-extrabold text-slate-200 uppercase tracking-wider flex items-center space-x-2">
                          <AlertTriangle className="w-4 h-4 text-amber-500" />
                          <span>{t("causes")}</span>
                        </h3>
                        <ul className="list-disc list-inside text-slate-300 text-sm space-y-1">
                          {result.causes.map((cause, idx) => (
                            <li key={idx} className="marker:text-amber-500">{cause}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Top Predictions Card */}
                    {result.top_predictions && result.top_predictions.length > 0 && (
                      <div className="bg-slate-950/60 border border-slate-850 p-5 rounded-xl space-y-4 hover:border-indigo-500/20 transition-all duration-300 animate-fadeIn">
                        <h3 className="text-sm font-extrabold text-slate-200 uppercase tracking-wider flex items-center space-x-2">
                          <Activity className="w-4 h-4 text-indigo-400" />
                          <span>{topPredictionsTitles[langCode] || "Top Predictions"}</span>
                        </h3>
                        <div className="space-y-3">
                          {result.top_predictions.map((pred, idx) => (
                            <div key={idx} className="space-y-1">
                              <div className="flex justify-between text-xs font-semibold text-slate-300">
                                <span>{pred.disease_name}</span>
                                <span className="text-emerald-400 font-bold">{pred.confidence}%</span>
                              </div>
                              <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    idx === 0 ? "bg-gradient-to-r from-emerald-500 to-teal-500" : idx === 1 ? "bg-gradient-to-r from-cyan-500 to-indigo-500" : "bg-gradient-to-r from-slate-600 to-slate-800"
                                  }`}
                                  style={{ width: `${pred.confidence}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Symptom Visual Analysis Card */}
                {result.visual_analysis && (
                  <div className="bg-slate-950/60 border border-slate-850 p-5 rounded-xl space-y-4 hover:border-emerald-500/20 transition-all duration-300 animate-fadeIn">
                    <h3 className="text-sm font-extrabold text-slate-200 uppercase tracking-wider flex items-center space-x-2">
                      <Activity className="w-4 h-4 text-emerald-400" />
                      <span>{visualAnalysisLabels[langCode]?.title || "Symptom-Based Visual Analysis"}</span>
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                      {Object.entries(result.visual_analysis).map(([key, value]) => {
                        const isDetected = value && value.toLowerCase().includes("detected") && !value.toLowerCase().includes("not");
                        const label = visualAnalysisLabels[langCode]?.[key] || key;
                        return (
                          <div
                            key={key}
                            className={`p-3 rounded-lg border flex flex-col justify-between space-y-2 transition-all ${
                              isDetected
                                ? "bg-red-500/5 border-red-500/20 hover:border-red-500/40 text-red-300 shadow-md shadow-red-500/5"
                                : "bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-450"
                            }`}
                          >
                            <span className="text-xs font-bold block">{label}</span>
                            <div className="flex items-center space-x-1.5 mt-1">
                              <span className={`w-2 h-2 rounded-full ${isDetected ? "bg-red-500 animate-pulse" : "bg-slate-600"}`} />
                              <span className={`text-[11px] font-medium ${isDetected ? "text-red-400" : "text-slate-500"}`}>{value}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Grid details below */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-850 animate-fadeIn">
                  {/* Symptoms Card */}
                  <div className="bg-slate-950/60 border border-slate-850 p-5 rounded-xl space-y-3 hover:border-orange-500/20 transition-all duration-300">
                    <h3 className="text-sm font-extrabold text-slate-200 uppercase tracking-wider flex items-center space-x-2">
                      <ShieldAlert className="w-4 h-4 text-orange-400" />
                      <span>{t("symptoms")}</span>
                    </h3>
                    <ul className="list-disc list-inside text-slate-300 text-sm space-y-1">
                      {result.symptoms.map((symptom, idx) => (
                        <li key={idx} className="marker:text-orange-400">{symptom}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Treatment Card */}
                  <div className="bg-slate-950/60 border border-slate-850 p-5 rounded-xl space-y-3 hover:border-emerald-500/20 transition-all duration-300">
                    <h3 className="text-sm font-extrabold text-slate-200 uppercase tracking-wider flex items-center space-x-2">
                      <Pill className="w-4 h-4 text-emerald-400" />
                      <span>{t("treatment")}</span>
                    </h3>
                    <ul className="list-disc list-inside text-slate-300 text-sm space-y-1">
                      {result.treatment && result.treatment.map((med, idx) => (
                        <li key={idx} className="marker:text-emerald-400">{med}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Prevention Card */}
                  <div className="bg-slate-950/60 border border-slate-850 p-5 rounded-xl space-y-3 hover:border-teal-500/20 transition-all duration-300">
                    <h3 className="text-sm font-extrabold text-slate-200 uppercase tracking-wider flex items-center space-x-2">
                      <ShieldCheck className="w-4 h-4 text-teal-400" />
                      <span>{t("prevention")}</span>
                    </h3>
                    <ul className="list-disc list-inside text-slate-300 text-sm space-y-1">
                      {result.prevention.map((prev, idx) => (
                        <li key={idx} className="marker:text-teal-400">{prev}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Food Guidance Card */}
                  <div className="bg-slate-950/60 border border-slate-850 p-5 rounded-xl space-y-3 hover:border-emerald-500/20 transition-all duration-300">
                    <h3 className="text-sm font-extrabold text-slate-200 uppercase tracking-wider flex items-center space-x-2">
                      <HeartHandshake className="w-4 h-4 text-emerald-400" />
                      <span>{t("foodRecommendations")}</span>
                    </h3>
                    <ul className="list-disc list-inside text-slate-300 text-sm space-y-1">
                      {result.food_recommendations.map((food, idx) => (
                        <li key={idx} className="marker:text-emerald-400">{food}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Recommendations Card (Ensemble/Combined) */}
                {result.recommendations && result.recommendations.length > 0 && (
                  <div className="bg-slate-950/60 border border-slate-850 p-5 rounded-xl space-y-3 hover:border-teal-500/20 transition-all duration-300">
                    <h3 className="text-sm font-extrabold text-slate-200 uppercase tracking-wider flex items-center space-x-2">
                      <ShieldCheck className="w-4 h-4 text-teal-500" />
                      <span>{t("recommendations")}</span>
                    </h3>
                    <ul className="list-disc list-inside text-slate-300 text-sm space-y-1">
                      {result.recommendations.map((rec, idx) => (
                        <li key={idx} className="marker:text-teal-500">{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Hygiene tips card */}
                {result.hygiene_tips && result.hygiene_tips.length > 0 && (
                  <div className="bg-slate-950/60 border border-slate-850 p-5 rounded-xl space-y-2 hover:border-cyan-500/20 transition-all duration-300">
                    <h3 className="text-sm font-extrabold text-slate-200 uppercase tracking-wider flex items-center space-x-2">
                      <Stethoscope className="w-4 h-4 text-cyan-400" />
                      <span>{t("hygieneSuggestions")}</span>
                    </h3>
                    <ul className="list-disc list-inside text-slate-300 text-sm space-y-1">
                      {result.hygiene_tips.map((tip, idx) => (
                        <li key={idx} className="marker:text-cyan-400">{tip}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Warnings / Doctor disclaimer */}
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start space-x-3 mt-4">
                  <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-amber-500 text-xs font-extrabold uppercase tracking-wider">
                      {t("warningTitle")}
                    </h4>
                    <p className="text-slate-300 text-xs leading-relaxed mt-1">
                      {t("warningText")}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Emergency Red popup */}
      {result && (
        <EmergencyAlert
          isOpen={emergencyOpen}
          onClose={() => setEmergencyOpen(false)}
          diseaseName={result.disease_name}
          firstAid={result.first_aid}
        />
      )}
    </div>
  );
};

export default Detect;
