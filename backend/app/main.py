"""Main FastAPI Application Entry Point for PashuCare AI."""

import os
import logging

# Configure logging to write to app_errors.log and console
LOG_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOG_FILE = os.path.join(LOG_DIR, "app_errors.log")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("PashuCareAPI")
logger.info("Initializing PashuCare AI Backend...")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse

from .config import settings
from .database import connect_db, close_db
from .routes import auth, detection, vets, chat

app = FastAPI(
    title="PashuCare AI Backend",
    description="FastAPI Backend with MongoDB & OpenCV for livestock disease detection.",
    version="1.0.0"
)

# CORS Middleware Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173", "http://localhost:5173",
        "http://127.0.0.1:5174", "http://localhost:5174",
        "http://127.0.0.1:5175", "http://localhost:5175"
    ],  # Vite dev server origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Uploads directory to serve uploaded images
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")


@app.on_event("startup")
async def startup_event():
    """Run startup tasks such as connecting to the database."""
    await connect_db()


@app.on_event("shutdown")
async def shutdown_event():
    """Run shutdown tasks such as closing the database connection."""
    await close_db()


# Include routers
app.include_router(auth.router)
app.include_router(detection.router)
app.include_router(vets.router)
app.include_router(chat.router)


@app.get("/", response_class=HTMLResponse)
async def root():
    """Basic health check and welcome page."""
    return """
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>PashuCare AI API</title>
        <style>
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                background: #0f172a;
                color: #e2e8f0;
                margin: 0;
            }
            .card {
                text-align: center;
                padding: 3rem;
                border-radius: 1.5rem;
                background: linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(6, 182, 212, 0.15));
                border: 1px solid rgba(255, 255, 255, 0.1);
                backdrop-filter: blur(12px);
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
            }
            h1 {
                font-size: 2.5rem;
                margin-bottom: 0.5rem;
                color: #34d399;
            }
            p {
                opacity: 0.8;
                font-size: 1.1rem;
            }
            a {
                display: inline-block;
                margin-top: 1.5rem;
                color: #06b6d4;
                text-decoration: none;
                font-weight: bold;
                border: 1px solid #06b6d4;
                padding: 0.5rem 1.5rem;
                border-radius: 0.5rem;
                transition: all 0.3s ease;
            }
            a:hover {
                background: #06b6d4;
                color: #0f172a;
            }
        </style>
    </head>
    <body>
        <div class="card">
            <h1>🐄 PashuCare AI API</h1>
            <p>The backend server is running successfully!</p>
            <a href="/docs">View API Documentation →</a>
        </div>
    </body>
    </html>
    """
