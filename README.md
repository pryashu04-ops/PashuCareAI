# 🩺 PashuCareAI - Livestock Disease Detection & AI Assistant

PashuCareAI is a full-stack, AI-powered livestock health diagnostics and consultation platform designed to support farmers with real-time veterinary care. Using advanced computer vision and multimodal large language models, the platform identifies diseases in **Cows, Sheep, and Goats**, provides localized translation support, and features a smart veterinary chatbot.

---

## 🌟 Key Features

*   **Multimodal AI Diagnosis**: Upload photos of livestock to detect diseases (e.g., Lumpy Skin Disease, Sheep Scab, Mastitis) using a hybrid approach (Gemini + local ML fallbacks).
*   **Dual-Engine Architecture**:
    *   **Gemini 2.5 Flash**: Delivers context-aware conversation and detailed diagnostic reports.
    *   **Local ML Models**: Scikit-Learn models (`cow_disease_model.pkl`, `sheep_disease_model.pkl`, `goat_disease_model.pkl`) run instantly when API keys are restricted or rate-limited.
*   **Real-time Multi-Language Chat**: Get immediate guidance in **English, Hindi (हिन्दी)**, and **Kannada (ಕನ್ನಡ)**.
*   **Data Persistence**: Built with a robust MongoDB database to store authentication profiles, diagnostic reports, and user chat histories.
*   **Smart Geolocation**: Built-in Google Maps finder to locate nearest veterinary clinics within a 10 km radius.

---

## 🛠️ Technology Stack

### Frontend
*   **Core**: React.js
*   **Styling**: Modern CSS design system (Dark-mode theme, sleek cards, micro-animations)
*   **APIs**: Google Maps JavaScript API & Google Places API

### Backend
*   **Framework**: Node.js (Express server proxy) + FastAPI (Python AI Core)
*   **Database**: MongoDB Atlas
*   **Languages**: JavaScript, Python 3.13
*   **AI Models**: Gemini 2.5 Flash & Scikit-Learn

---

## 🚀 Setup & Installation

### Prerequisites
*   Node.js (v18+)
*   Python (v3.10+)
*   MongoDB Atlas Cluster
*   Google Cloud & Gemini API Keys

### 1. Backend Setup
1. Navigate to the `backend` folder:
   ```bash
   cd backend
   ```
2. Install Node.js dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the `backend/` directory:
   ```env
   PORT=8000
   MONGO_URI=your_mongodb_uri
   GEMINI_API_KEY=your_gemini_key
   GOOGLE_MAPS_API_KEY=your_google_maps_key
   JWT_SECRET=your_jwt_secret
   ```
4. Set up the Python virtual environment:
   ```bash
   python -m venv venv
   .\venv\Scripts\activate
   pip install -r requirements.txt
   ```
5. Start the backend server:
   ```bash
   node server.js
   ```

### 2. Frontend Setup
1. Navigate to the `frontend` folder:
   ```bash
   cd ../frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the React app:
   ```bash
   npm start
   ```

---

## 📁 Repository Structure

```
PashuCareAI/
├── backend/                   # Express & Python API server
│   ├── app/                   # FastAPI routes, config, and services
│   │   ├── services/          # AI, chat, and translation logic
│   │   └── routes/            # API endpoints
│   ├── ai-model/              # Local Scikit-learn model files (.pkl)
│   ├── uploads/               # Diagnostic image storage
│   └── server.js              # Node.js entry point
├── frontend/                  # React Single Page Application (SPA)
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   ├── context/           # Auth and language contexts
│   │   └── pages/             # Frontend page views (Detect, Chat, Finder)
│   └── public/
└── README.md                  # Documentation
```

---

## 🛡️ License
Distributed under the MIT License. See `LICENSE` for more information.