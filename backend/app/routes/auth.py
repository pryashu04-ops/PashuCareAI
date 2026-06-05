"""Authentication routes — register, login, and get current user."""

from datetime import datetime, timezone
import re
from fastapi import APIRouter, HTTPException, status, Depends
from bson import ObjectId

from ..models.user import UserCreate, UserLogin, UserResponse, TokenResponse
from ..services.auth_service import hash_password, verify_password, create_token
from ..middleware.auth import get_current_user
from ..database import get_db

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/register", response_model=TokenResponse)
async def register(data: UserCreate):
    """Register a new user account."""
    db = get_db()
    if db is None:
        raise HTTPException(status_code=503, detail="Database not available. Check MongoDB connection.")

    # Check if email already exists
    existing = await db.users.find_one({"email": data.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Validate password requirements
    if len(data.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")
    if not re.search(r'[!@#$%^&*(),.?":{}|<>_]', data.password):
        raise HTTPException(status_code=400, detail="Password must include at least one special character.")

    # Create user document
    user_doc = {
        "name": data.name.strip(),
        "email": data.email.lower().strip(),
        "password": hash_password(data.password),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)

    token = create_token(user_id)
    return TokenResponse(
        token=token,
        user=UserResponse(id=user_id, name=user_doc["name"], email=user_doc["email"]),
    )


@router.post("/login", response_model=TokenResponse)
async def login(data: UserLogin):
    """Login with email and password."""
    db = get_db()
    if db is None:
        raise HTTPException(status_code=503, detail="Database not available. Check MongoDB connection.")

    user = await db.users.find_one({"email": data.email.lower().strip()})
    if not user or not verify_password(data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user_id = str(user["_id"])
    token = create_token(user_id)
    return TokenResponse(
        token=token,
        user=UserResponse(id=user_id, name=user["name"], email=user["email"]),
    )


@router.get("/me", response_model=UserResponse)
async def get_me(user=Depends(get_current_user)):
    """Get the currently authenticated user."""
    return UserResponse(
        id=str(user["_id"]),
        name=user["name"],
        email=user["email"],
    )
