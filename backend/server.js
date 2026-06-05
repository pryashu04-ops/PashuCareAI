require('dotenv').config();
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  console.warn("[WARN] Could not set custom DNS servers:", e.message);
}

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');

const app = express();
const port = process.env.PORT || 8000;

// Setup directories
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploadsDir));

// Database connection config
const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const dbName = process.env.DATABASE_NAME || 'pashucare_ai';

console.log(`[INFO] Connecting to MongoDB Atlas database: ${dbName}...`);
mongoose.connect(mongoURI, { dbName, serverSelectionTimeoutMS: 3000 })
  .then(() => {
    console.log(`[INFO] Successfully connected to MongoDB database: ${dbName}`);
  })
  .catch(err => {
    console.warn(`[WARN] MongoDB Atlas connection failed (${err.message}). Using local JSON database fallback (mock_database.json).`);
  });

// Check if mongoose is currently connected
const isDbConnected = () => mongoose.connection.readyState === 1;

// --- Mongoose Schemas & Models ---
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  created_at: { type: String, default: () => new Date().toISOString() }
});
const User = mongoose.model('User', userSchema, 'users');

const detectionSchema = new mongoose.Schema({
  disease_name: String,
  animal_type: String,
  confidence: Number,
  severity: String,
  severity_color: String,
  symptoms: [String],
  causes: [String],
  why_it_happened: String,
  prevention: [String],
  medicine: [String],
  first_aid: [String],
  food_recommendations: [String],
  hygiene_tips: [String],
  image_url: String,
  timestamp: { type: String, default: () => new Date().toISOString() },
  user_id: String,
  emergency: { type: String, default: "" }
});
const Detection = mongoose.model('Detection', detectionSchema, 'detections');

const chatSessionSchema = new mongoose.Schema({
  user_id: { type: String, required: true },
  title: { type: String, default: 'New Chat' },
  created_at: { type: String, default: () => new Date().toISOString() },
  updated_at: { type: String, default: () => new Date().toISOString() }
});
const ChatSession = mongoose.model('ChatSession', chatSessionSchema, 'chat_sessions');

const chatMessageSchema = new mongoose.Schema({
  session_id: { type: String, required: true },
  user_id: { type: String, required: true },
  role: { type: String, required: true }, // "user" or "assistant"
  text: { type: String, required: true },
  text_en: { type: String, required: true },
  language: { type: String, default: 'en' },
  imageUrl: { type: String, default: null },
  timestamp: { type: String, default: () => new Date().toISOString() }
});
const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema, 'chat_messages');

// --- JSON Mock Database Helper Utilities ---
const DB_FILE = path.join(__dirname, 'mock_database.json');

const readMockDb = () => {
  if (fs.existsSync(DB_FILE)) {
    try {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      return JSON.parse(data);
    } catch (err) {
      console.error("[ERROR] Failed to read mock database file:", err.message);
    }
  }
  return {};
};

const writeMockDb = (data) => {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error("[ERROR] Failed to write mock database file:", err.message);
  }
};

// --- Repository abstraction layers with JSON fallback ---

const findUserByEmail = async (email) => {
  email = email.toLowerCase().trim();
  if (isDbConnected()) {
    try {
      return await User.findOne({ email });
    } catch (err) {
      console.warn("[WARN] DB error, falling back to mock database:", err.message);
    }
  }
  const dbData = readMockDb();
  const user = (dbData.users || []).find(u => u.email.toLowerCase() === email);
  if (user) {
    return {
      _id: user._id,
      id: user._id,
      name: user.name,
      email: user.email,
      password: user.password,
      toObject: () => user
    };
  }
  return null;
};

const findUserById = async (id) => {
  if (isDbConnected()) {
    try {
      return await User.findById(id);
    } catch (err) {
      console.warn("[WARN] DB error, falling back to mock database:", err.message);
    }
  }
  const dbData = readMockDb();
  const user = (dbData.users || []).find(u => u._id === id);
  if (user) {
    return {
      _id: user._id,
      id: user._id,
      name: user.name,
      email: user.email,
      password: user.password,
      toObject: () => user
    };
  }
  return null;
};

const saveUser = async (userData) => {
  if (isDbConnected()) {
    try {
      const u = new User(userData);
      await u.save();
      return u;
    } catch (err) {
      console.warn("[WARN] DB error, falling back to mock database:", err.message);
    }
  }
  const dbData = readMockDb();
  if (!dbData.users) dbData.users = [];
  const _id = new mongoose.Types.ObjectId().toString();
  const newUser = {
    _id,
    name: userData.name,
    email: userData.email,
    password: userData.password,
    created_at: new Date().toISOString()
  };
  dbData.users.push(newUser);
  writeMockDb(dbData);
  return {
    _id,
    ...newUser,
    toObject: () => newUser
  };
};

const saveDetection = async (data) => {
  if (isDbConnected()) {
    try {
      const doc = new Detection(data);
      await doc.save();
      const obj = doc.toObject();
      obj.id = obj._id.toString();
      delete obj._id;
      return obj;
    } catch (err) {
      console.warn("[WARN] DB error, falling back to mock database:", err.message);
    }
  }
  const dbData = readMockDb();
  if (!dbData.detections) dbData.detections = [];
  const _id = new mongoose.Types.ObjectId().toString();
  const newDoc = {
    ...data,
    _id,
    timestamp: new Date().toISOString()
  };
  dbData.detections.push(newDoc);
  writeMockDb(dbData);
  
  const { _id: docId, ...rest } = newDoc;
  return { id: docId, ...rest };
};

const findDetectionsByUser = async (userId) => {
  if (isDbConnected()) {
    try {
      return await Detection.find({ user_id: userId }).sort({ timestamp: -1 }).limit(50);
    } catch (err) {
      console.warn("[WARN] DB error, falling back to mock database:", err.message);
    }
  }
  const dbData = readMockDb();
  return (dbData.detections || [])
    .filter(d => d.user_id === userId)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 50);
};

const findDetectionByIdAndUser = async (id, userId) => {
  if (isDbConnected()) {
    try {
      return await Detection.findOne({ _id: id, user_id: userId });
    } catch (err) {
      console.warn("[WARN] DB error, falling back to mock database:", err.message);
    }
  }
  const dbData = readMockDb();
  return (dbData.detections || []).find(d => d._id === id && d.user_id === userId);
};

const findSessionsByUser = async (userId) => {
  if (isDbConnected()) {
    try {
      return await ChatSession.find({ user_id: userId }).sort({ updated_at: -1 });
    } catch (err) {
      console.warn("[WARN] DB error, falling back to mock database:", err.message);
    }
  }
  const dbData = readMockDb();
  return (dbData.chat_sessions || [])
    .filter(s => s.user_id === userId)
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
};

const findSessionByIdAndUser = async (id, userId) => {
  if (isDbConnected()) {
    try {
      return await ChatSession.findOne({ _id: id, user_id: userId });
    } catch (err) {
      console.warn("[WARN] DB error, falling back to mock database:", err.message);
    }
  }
  const dbData = readMockDb();
  return (dbData.chat_sessions || []).find(s => s._id === id && s.user_id === userId);
};

const saveChatSession = async (userId, title) => {
  if (isDbConnected()) {
    try {
      const s = new ChatSession({ user_id: userId, title });
      await s.save();
      return s;
    } catch (err) {
      console.warn("[WARN] DB error, falling back to mock database:", err.message);
    }
  }
  const dbData = readMockDb();
  if (!dbData.chat_sessions) dbData.chat_sessions = [];
  const _id = new mongoose.Types.ObjectId().toString();
  const newSession = {
    _id,
    user_id: userId,
    title,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  dbData.chat_sessions.push(newSession);
  writeMockDb(dbData);
  return {
    _id,
    ...newSession,
    toObject: () => newSession
  };
};

const updateSessionTimestamp = async (id) => {
  if (isDbConnected()) {
    try {
      await ChatSession.findByIdAndUpdate(id, { updated_at: new Date().toISOString() });
      return;
    } catch (err) {
      console.warn("[WARN] DB error, falling back to mock database:", err.message);
    }
  }
  const dbData = readMockDb();
  const s = (dbData.chat_sessions || []).find(sess => sess._id === id);
  if (s) {
    s.updated_at = new Date().toISOString();
    writeMockDb(dbData);
  }
};

const deleteSession = async (id, userId) => {
  if (isDbConnected()) {
    try {
      const deleted = await ChatSession.findOneAndDelete({ _id: id, user_id: userId });
      if (deleted) {
        await ChatMessage.deleteMany({ session_id: id });
        return true;
      }
      return false;
    } catch (err) {
      console.warn("[WARN] DB error, falling back to mock database:", err.message);
    }
  }
  const dbData = readMockDb();
  const index = (dbData.chat_sessions || []).findIndex(s => s._id === id && s.user_id === userId);
  if (index !== -1) {
    dbData.chat_sessions.splice(index, 1);
    dbData.chat_messages = (dbData.chat_messages || []).filter(m => m.session_id !== id);
    writeMockDb(dbData);
    return true;
  }
  return false;
};

const findMessagesBySession = async (sessionId) => {
  if (isDbConnected()) {
    try {
      return await ChatMessage.find({ session_id: sessionId }).sort({ timestamp: 1 });
    } catch (err) {
      console.warn("[WARN] DB error, falling back to mock database:", err.message);
    }
  }
  const dbData = readMockDb();
  return (dbData.chat_messages || [])
    .filter(m => m.session_id === sessionId)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
};

const saveChatMessage = async (data) => {
  if (isDbConnected()) {
    try {
      const m = new ChatMessage(data);
      await m.save();
      return m;
    } catch (err) {
      console.warn("[WARN] DB error, falling back to mock database:", err.message);
    }
  }
  const dbData = readMockDb();
  if (!dbData.chat_messages) dbData.chat_messages = [];
  const _id = new mongoose.Types.ObjectId().toString();
  const newMsg = {
    ...data,
    _id,
    timestamp: new Date().toISOString()
  };
  dbData.chat_messages.push(newMsg);
  writeMockDb(dbData);
  return {
    _id,
    ...newMsg,
    toObject: () => newMsg
  };
};

const findMessageBySessionAndText = async (sessionId, role, text) => {
  if (isDbConnected()) {
    try {
      return await ChatMessage.findOne({ session_id: sessionId, role, text });
    } catch (err) {
      console.warn("[WARN] DB error, falling back to mock database:", err.message);
    }
  }
  const dbData = readMockDb();
  return (dbData.chat_messages || []).find(m => m.session_id === sessionId && m.role === role && m.text === text);
};

// --- Auth Middleware ---
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ detail: "Not authenticated" });
    }
    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET || 'supersecretkeychangeme';
    const decoded = jwt.verify(token, secret);
    
    const user = await findUserById(decoded.id);
    if (!user) {
      return res.status(401).json({ detail: "User session expired or not found" });
    }
    
    // Set user context
    const userIdStr = (user._id || user.id).toString();
    req.user = {
      _id: userIdStr,
      id: userIdStr,
      name: user.name,
      email: user.email
    };
    next();
  } catch (error) {
    console.error("Auth middleware error:", error.message);
    return res.status(401).json({ detail: "Invalid or expired authorization token" });
  }
};

// --- Helper function to spawn Python scripts safely ---
const runPythonScript = (scriptName, args = [], inputData = null) => {
  return new Promise((resolve, reject) => {
    // Locate the virtual env python executable on Windows
    let pythonExecutable = path.join(__dirname, 'venv', 'Scripts', 'python.exe');
    if (!fs.existsSync(pythonExecutable)) {
      pythonExecutable = path.join(__dirname, 'venv', 'scripts', 'python.exe');
    }
    if (!fs.existsSync(pythonExecutable)) {
      pythonExecutable = 'python';
    }

    const child = spawn(pythonExecutable, [scriptName, ...args], { 
      cwd: __dirname,
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
        PYTHONUTF8: '1'
      }
    });
    
    let stdout = '';
    let stderr = '';

    if (inputData) {
      child.stdin.write(inputData);
      child.stdin.end();
    }

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `Python script exited with code ${code}`));
      } else {
        resolve(stdout.trim());
      }
    });
  });
};

// --- Bulletproof Python JSON parsing helper ---
const parsePythonJson = (output) => {
  const lines = output.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || 
        (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        return JSON.parse(trimmed);
      } catch (e) {
        // Continue searching
      }
    }
  }
  throw new Error("Could not find valid JSON in Python output: " + output);
};

// --- Multer Configuration ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    const uniqueName = `${require('crypto').randomBytes(16).toString('hex')}${ext}`;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

// --- API ROUTES ---

// 1. Authentication Routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ detail: "Name, email and password are required" });
    }

    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ detail: "Email already registered" });
    }

    if (password.length < 8) {
      return res.status(400).json({ detail: "Password must be at least 8 characters." });
    }
    const specialCharRegex = /[!@#$%^&*(),.?":{}|<>_]/;
    if (!specialCharRegex.test(password)) {
      return res.status(400).json({ detail: "Password must include at least one special character." });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const userDoc = await saveUser({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword
    });

    const userIdStr = (userDoc._id || userDoc.id).toString();
    const secret = process.env.JWT_SECRET || 'supersecretkeychangeme';
    const token = jwt.sign({ id: userIdStr }, secret, { expiresIn: `${process.env.JWT_EXPIRE_HOURS || 24}h` });

    res.json({
      token,
      user: {
        id: userIdStr,
        name: userDoc.name,
        email: userDoc.email
      }
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ detail: "Server error during registration" });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ detail: "Email and password are required" });
    }

    const user = await findUserByEmail(email);
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ detail: "Invalid email or password" });
    }

    const userIdStr = (user._id || user.id).toString();
    const secret = process.env.JWT_SECRET || 'supersecretkeychangeme';
    const token = jwt.sign({ id: userIdStr }, secret, { expiresIn: `${process.env.JWT_EXPIRE_HOURS || 24}h` });

    res.json({
      token,
      user: {
        id: userIdStr,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ detail: "Server error during login" });
  }
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json(req.user);
});

// 2. Veterinary Locator Routes
app.get('/api/vets/config', (req, res) => {
  res.json({
    provider: "google",
    api_key: process.env.GOOGLE_MAPS_API_KEY || ""
  });
});

app.get('/api/vets/nearby', async (req, res) => {
  const { lat, lng, radius } = req.query;
  if (!lat || !lng) {
    return res.status(400).json({ detail: "Latitude (lat) and Longitude (lng) are required" });
  }

  const userLat = parseFloat(lat);
  const userLng = parseFloat(lng);
  const searchRadius = parseInt(radius) || 20000;

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const sampleData = {
    results: [
      {
        name: "Sri Veterinary Hospital (Demo)",
        address: "Main Road, Near Bus Stand",
        lat: userLat + 0.008,
        lng: userLng + 0.005,
        distance: "1.2 km",
        phone: "+91 98765 43210",
        open_now: true,
        rating: 4.5,
      },
      {
        name: "Pashupathi Animal Clinic (Demo)",
        address: "Market Circle, 2nd Cross",
        lat: userLat - 0.005,
        lng: userLng + 0.012,
        distance: "2.8 km",
        phone: "+91 98765 12345",
        open_now: true,
        rating: 4.2,
      }
    ],
    using_sample_data: true,
    error: "No veterinary clinics found in your area on OpenStreetMap. Showing sample data."
  };

  try {
    const overpassUrl = "https://overpass-api.de/api/interpreter";
    const overpassQuery = `[out:json][timeout:25];(node["amenity"="veterinary"](around:${searchRadius},${userLat},${userLng});way["amenity"="veterinary"](around:${searchRadius},${userLat},${userLng});relation["amenity"="veterinary"](around:${searchRadius},${userLat},${userLng}););out center;`;
    
    const response = await fetch(overpassUrl, {
      method: 'POST',
      body: 'data=' + encodeURIComponent(overpassQuery),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    if (!response.ok) {
      return res.json(sampleData);
    }

    const data = await response.json();
    const elements = data.elements || [];
    if (elements.length === 0) {
      return res.json(sampleData);
    }

    const results = elements.map(el => {
      const elLat = el.lat || (el.center && el.center.lat) || 0;
      const elLng = el.lon || (el.center && el.center.lon) || 0;
      const tags = el.tags || {};
      
      const name = tags.name || tags['name:en'] || "Veterinary Clinic";
      const address = tags['addr:full'] || tags['addr:street'] || tags['addr:city'] || "Local Veterinary Service";
      const phone = tags.phone || tags['contact:phone'] || "";
      const openingHours = tags.opening_hours || "";
      
      const distanceKm = calculateDistance(userLat, userLng, elLat, elLng);
      return {
        name,
        address,
        lat: elLat,
        lng: elLng,
        distance: `${distanceKm.toFixed(1)} km`,
        phone,
        open_now: openingHours ? true : false,
        opening_hours: openingHours,
        rating: 4.0,
        distVal: distanceKm
      };
    });

    results.sort((a, b) => a.distVal - b.distVal);
    const cleanedResults = results.slice(0, 15).map(r => {
      const { distVal, ...rest } = r;
      return rest;
    });

    res.json({ results: cleanedResults, using_sample_data: false });
  } catch (error) {
    console.error("Overpass API error:", error);
    res.json(sampleData);
  }
});

// 3. Disease Detection Route
app.post('/api/detect', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ detail: "No image file provided" });
    }

    const animalType = req.body.animal_type || "Cow";
    const lang = req.body.lang || "en";

    // Run the Python analysis bridge
    console.log(`[INFO] Spawning Python AI detection bridge for ${animalType} (lang: ${lang})...`);
    const output = await runPythonScript('detect_helper.py', [
      req.file.path,
      animalType,
      lang,
      req.file.originalname
    ]);

    const result = parsePythonJson(output);
    if (result.error) {
      // Remove temp file if validation failed
      try { fs.unlinkSync(req.file.path); } catch (e) {}
      return res.status(400).json({ detail: result.error });
    }

    // Save detection record
    const detectionDoc = await saveDetection({
      disease_name: result.name,
      animal_type: result.animal,
      confidence: result.confidence,
      severity: result.severity,
      severity_color: result.severity_color,
      symptoms: result.symptoms,
      causes: result.causes,
      why_it_happened: result.why_it_happened,
      prevention: result.prevention,
      medicine: result.medicine,
      first_aid: result.first_aid,
      food_recommendations: result.food_recommendations,
      hygiene_tips: result.hygiene_tips,
      image_url: `/uploads/${path.basename(req.file.path)}`,
      user_id: req.user.id,
      emergency: result.emergency || ""
    });

    // Map fields to match exactly what frontend expects for DetectionResult
    res.json({
      id: detectionDoc.id,
      disease_name: detectionDoc.disease_name,
      animal_type: detectionDoc.animal_type,
      confidence: detectionDoc.confidence,
      severity: detectionDoc.severity,
      severity_color: detectionDoc.severity_color,
      symptoms: detectionDoc.symptoms,
      causes: detectionDoc.causes,
      why_it_happened: detectionDoc.why_it_happened,
      prevention: detectionDoc.prevention,
      medicine: detectionDoc.medicine,
      first_aid: detectionDoc.first_aid,
      food_recommendations: detectionDoc.food_recommendations,
      hygiene_tips: detectionDoc.hygiene_tips,
      image_url: detectionDoc.image_url,
      timestamp: detectionDoc.timestamp,
      user_id: detectionDoc.user_id,
      emergency: detectionDoc.emergency
    });

  } catch (error) {
    console.error("AI detection error:", error);
    if (req.file) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    }
    res.status(400).json({ detail: error.message || "Image diagnostics failed" });
  }
});

// 4. Detections History
app.get('/api/detections', authenticateToken, async (req, res) => {
  try {
    const lang = req.query.lang || "en";
    const docs = await findDetectionsByUser(req.user.id);
    
    if (docs.length === 0) {
      return res.json([]);
    }

    // Format fields & map _id/id
    const cleanDocs = docs.map(d => {
      const obj = typeof d.toObject === 'function' ? d.toObject() : { ...d };
      obj.id = (obj._id || obj.id).toString();
      delete obj._id;
      delete obj.__v;
      if (!obj.emergency) obj.emergency = "";
      return obj;
    });

    // Spawn Python translation bridge to translate all historical records in one batch
    const translatedOutput = await runPythonScript('translate_helper.py', [lang], JSON.stringify(cleanDocs));
    const translatedDocs = parsePythonJson(translatedOutput);
    
    if (translatedDocs.error) {
      return res.status(500).json({ detail: translatedDocs.error });
    }

    res.json(translatedDocs);
  } catch (error) {
    console.error("Fetch history error:", error);
    res.status(500).json({ detail: "Failed to fetch diagnostics history" });
  }
});

app.get('/api/detections/:id', authenticateToken, async (req, res) => {
  try {
    const lang = req.query.lang || "en";
    const d = await findDetectionByIdAndUser(req.params.id, req.user.id);
    if (!d) {
      return res.status(404).json({ detail: "Detection not found" });
    }

    const obj = typeof d.toObject === 'function' ? d.toObject() : { ...d };
    obj.id = (obj._id || obj.id).toString();
    delete obj._id;
    delete obj.__v;
    if (!obj.emergency) obj.emergency = "";

    const translatedOutput = await runPythonScript('translate_helper.py', [lang], JSON.stringify(obj));
    const translatedDoc = parsePythonJson(translatedOutput);
    
    if (translatedDoc.error) {
      return res.status(500).json({ detail: translatedDoc.error });
    }

    res.json(translatedDoc);
  } catch (error) {
    console.error("Fetch single detection error:", error);
    res.status(500).json({ detail: "Failed to fetch diagnostic details" });
  }
});

// 5. Disease Catalog
app.get('/api/diseases', async (req, res) => {
  try {
    const lang = req.query.lang || "en";
    const output = await runPythonScript('diseases_helper.py', [lang]);
    const diseases = parsePythonJson(output);
    if (diseases.error) {
      return res.status(500).json({ detail: diseases.error });
    }
    res.json(diseases);
  } catch (error) {
    console.error("Catalog error:", error);
    res.status(500).json({ detail: "Failed to fetch disease catalog" });
  }
});

// 6. Chat Sessions & Messages
app.get('/api/chat/sessions', authenticateToken, async (req, res) => {
  try {
    const sessions = await findSessionsByUser(req.user.id);
    const cleanSessions = sessions.map(s => {
      const obj = typeof s.toObject === 'function' ? s.toObject() : { ...s };
      return {
        id: (obj._id || obj.id).toString(),
        title: obj.title,
        created_at: obj.created_at,
        updated_at: obj.updated_at
      };
    });
    res.json(cleanSessions);
  } catch (error) {
    console.error("Fetch sessions error:", error);
    res.status(500).json({ detail: "Failed to fetch chat sessions" });
  }
});

app.get('/api/chat/sessions/:session_id/messages', authenticateToken, async (req, res) => {
  try {
    const session = await findSessionByIdAndUser(req.params.session_id, req.user.id);
    if (!session) {
      return res.status(404).json({ detail: "Chat session not found" });
    }

    const messages = await findMessagesBySession(req.params.session_id);
    const cleanMessages = messages.map(m => {
      const obj = typeof m.toObject === 'function' ? m.toObject() : { ...m };
      return {
        id: (obj._id || obj.id).toString(),
        session_id: obj.session_id,
        role: obj.role,
        text: obj.text,
        text_en: obj.text_en,
        language: obj.language,
        imageUrl: obj.imageUrl,
        timestamp: obj.timestamp
      };
    });
    res.json(cleanMessages);
  } catch (error) {
    console.error("Fetch messages error:", error);
    res.status(500).json({ detail: "Failed to fetch messages" });
  }
});

app.delete('/api/chat/sessions/:session_id', authenticateToken, async (req, res) => {
  try {
    const success = await deleteSession(req.params.session_id, req.user.id);
    if (!success) {
      return res.status(404).json({ detail: "Chat session not found" });
    }
    res.json({ success: true, message: "Session deleted successfully" });
  } catch (error) {
    console.error("Delete session error:", error);
    res.status(500).json({ detail: "Failed to delete chat session" });
  }
});

// 7. Chat Query (Text AI Chat)
app.post('/api/chat', authenticateToken, async (req, res) => {
  try {
    const { session_id, message, messages, lang } = req.body;
    const user_id = req.user.id;
    const language = lang || "en";
    let targetSessionId = session_id;

    if (!targetSessionId) {
      let titleText = message || "New Chat";
      if (messages && messages.length > 0) {
        titleText = messages[messages.length - 1].text || "New Chat";
      }
      const newSession = await saveChatSession(user_id, titleText);
      targetSessionId = (newSession._id || newSession.id).toString();
    }

    // Determine query text and save history context if needed
    let queryText = message || "";
    if (messages && messages.length > 0) {
      for (const msg of messages.slice(0, -1)) {
        const role = (msg.role === 'user') ? 'user' : 'assistant';
        const exists = await findMessageBySessionAndText(targetSessionId, role, msg.text);
        if (!exists) {
          await saveChatMessage({
            session_id: targetSessionId,
            user_id,
            role,
            text: msg.text,
            text_en: msg.text_en || msg.text,
            language
          });
        }
      }
      queryText = messages[messages.length - 1].text;
    }

    // Spawn Python chat helper
    console.log(`[INFO] Spawning Python Chat AI bridge for message: "${queryText.substring(0, 30)}..." (lang: ${language})...`);
    const payload = JSON.stringify({
      session_id: targetSessionId,
      user_id,
      message_text: queryText,
      lang: language
    });

    const output = await runPythonScript('chat_helper.py', [], payload);
    const result = parsePythonJson(output);

    if (result.error) {
      return res.status(500).json({ detail: result.error });
    }

    res.json({
      response: result.response,
      session_id: targetSessionId
    });

  } catch (error) {
    console.error("Text chat error:", error);
    res.status(500).json({ detail: "AI Chat response generation failed" });
  }
});

// 8. Chat Query with Image
app.post('/api/chat/image', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ detail: "No image file provided" });
    }

    const animalType = req.body.animal_type || "Cow";
    const lang = req.body.lang || "en";
    let sessionId = req.body.session_id;

    // Run the Python analysis bridge
    console.log(`[INFO] Spawning Python AI detection bridge for chat image upload (animal: ${animalType}, lang: ${lang})...`);
    const output = await runPythonScript('detect_helper.py', [
      req.file.path,
      animalType,
      lang,
      req.file.originalname
    ]);

    const result = parsePythonJson(output);
    if (result.error) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
      return res.status(400).json({ detail: result.error });
    }

    const imageUrl = `/uploads/${path.basename(req.file.path)}`;

    // Build emergency/warning text if critical
    const formattedSymptoms = (result.symptoms || []).map(s => `- ${s}`).join('\n');
    const formattedFirstAid = (result.first_aid || []).map(f => `- ${f}`).join('\n');
    const formattedMedicine = (result.medicine || []).map(m => `- ${m}`).join('\n');

    let responseText = '';
    let englishResStr = '';

    if (result.name === "Healthy") {
      if (lang === "hi") {
        responseText = `कोई बीमारी नहीं पाई गई। ${result.animal} स्वस्थ प्रतीत होता है।`;
      } else if (lang === "kn") {
        responseText = `ಯಾವುದೇ ರೋಗ ಪತ್ತೆಯಾಗಿಲ್ಲ. ${result.animal} ಆರೋಗ್ಯಕರವಾಗಿ ಕಾಣಿಸುತ್ತಿದೆ.`;
      } else {
        responseText = `No disease detected. ${result.animal} appears healthy.`;
      }
      englishResStr = `No disease detected. ${result.animal} appears healthy.`;
    } else {
      if (lang === "hi") {
        responseText = `मैंने आपकी छवि का विश्लेषण किया है। ऐसा लगता है कि आपके ${result.animal} को **${result.disease_name}** है (विश्वास स्तर: ${result.confidence}%).\n\n` +
                       `**गंभीरता:** ${result.severity}\n\n` +
                       `**लक्षण:**\n${formattedSymptoms}\n\n` +
                       `**प्राथमिक उपचार:**\n${formattedFirstAid}\n\n` +
                       `**सुझाई गई दवाएं:**\n${formattedMedicine}`;
      } else if (lang === "kn") {
        responseText = `ನಾನು ನಿಮ್ಮ ಚಿತ್ರವನ್ನು ವಿಶ್ಲೇಷಿಸಿದ್ದೇನೆ. ನಿಮ್ಮ ${result.animal} ಗೆ **${result.disease_name}** ಇದೆ ಎಂದು ತೋರುತ್ತಿದೆ (ವಿಶ್ವಾಸಾರ್ಹತೆ ಮಟ್ಟ: ${result.confidence}%).\n\n` +
                       `**ತೀವ್ರತೆ:** ${result.severity}\n\n` +
                       `**ರೋಗಲಕ್ಷಣಗಳು:**\n${formattedSymptoms}\n\n` +
                       `**ಪ್ರಥಮ ಚಿಕಿತ್ಸೆ:**\n${formattedFirstAid}\n\n` +
                       `**ಸೂಚಿಸಲಾದ ಔಷಧಗಳು:**\n${formattedMedicine}`;
      } else {
        responseText = `I have analyzed your image. It looks like your ${result.animal} has **${result.disease_name}** (Confidence level: ${result.confidence}%).\n\n` +
                       `**Severity:** ${result.severity}\n\n` +
                       `**Symptoms:**\n${formattedSymptoms}\n\n` +
                       `**First Aid:**\n${formattedFirstAid}\n\n` +
                       `**Suggested Medicine:**\n${formattedMedicine}`;
      }

      const engSymptoms = (result.symptoms || []).map(s => `- ${s}`).join('\n');
      const engFirstAid = (result.first_aid || []).map(f => `- ${f}`).join('\n');
      const engMedicine = (result.medicine || []).map(m => `- ${m}`).join('\n');
      englishResStr = `I have analyzed your image. It looks like your ${result.animal} has **${result.disease_name}** (Confidence level: ${result.confidence}%).\n\n` +
                      `**Severity:** ${result.severity}\n\n` +
                      `**Symptoms:**\n${engSymptoms}\n\n` +
                      `**First Aid:**\n${engFirstAid}\n\n` +
                      `**Suggested Medicine:**\n${engMedicine}`;
    }

    // Save Detection record
    await saveDetection({
      disease_name: result.name,
      animal_type: result.animal,
      confidence: result.confidence,
      severity: result.severity,
      severity_color: result.severity_color,
      symptoms: result.symptoms,
      causes: result.causes,
      why_it_happened: result.why_it_happened,
      prevention: result.prevention,
      medicine: result.medicine,
      first_aid: result.first_aid,
      food_recommendations: result.food_recommendations,
      hygiene_tips: result.hygiene_tips,
      image_url: imageUrl,
      user_id: req.user.id,
      emergency: result.emergency || ""
    });

    // Check or create chat session
    if (!sessionId) {
      const sessionTitle = `${result.disease_name} Diagnosis`;
      const newSession = await saveChatSession(req.user.id, sessionTitle);
      sessionId = (newSession._id || newSession.id).toString();
    } else {
      const sessionExists = await findSessionByIdAndUser(sessionId, req.user.id);
      if (!sessionExists) {
        const sessionTitle = `${result.disease_name} Diagnosis`;
        const newSession = await saveChatSession(req.user.id, sessionTitle);
        sessionId = (newSession._id || newSession.id).toString();
      }
    }

    // Save User message
    await saveChatMessage({
      session_id: sessionId,
      user_id: req.user.id,
      role: 'user',
      text: `Uploaded image for ${animalType} diagnosis`,
      text_en: `Uploaded image for ${animalType} diagnosis`,
      language: lang,
      imageUrl
    });

    // Save Assistant response
    await saveChatMessage({
      session_id: sessionId,
      user_id: req.user.id,
      role: 'assistant',
      text: responseText,
      text_en: englishResStr,
      language: lang
    });

    // Update session timestamp
    await updateSessionTimestamp(sessionId);

    res.json({
      response: responseText,
      image_url: imageUrl,
      disease_name: result.disease_name,
      confidence: result.confidence,
      session_id: sessionId
    });

  } catch (error) {
    console.error("AI chat image error:", error);
    if (req.file) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    }
    res.status(400).json({ detail: error.message || "Failed to process diagnostic image in chat" });
  }
});

// Start Server
app.listen(port, () => {
  console.log(`[INFO] Express server running on port ${port}`);
});
