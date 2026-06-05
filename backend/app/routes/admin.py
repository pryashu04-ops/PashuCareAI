"""Admin dashboard routes."""

import os
import sys
import platform
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends
from ..middleware.auth import get_current_user
from ..database import get_db

router = APIRouter(prefix="/api/admin", tags=["Admin"])


async def get_current_admin(user=Depends(get_current_user)):
    """Middleware dependency to enforce admin role."""
    if user.get("role") != "admin":
        raise HTTPException(
            status_code=403,
            detail="Forbidden: Admin access required"
        )
    return user


@router.get("/stats")
async def get_admin_stats(admin=Depends(get_current_admin)):
    """Fetch analytics, recent activities, and system metrics for the admin dashboard."""
    db = get_db()
    if db is None:
        raise HTTPException(status_code=503, detail="Database not available")

    total_users = 0
    total_detections = 0
    total_messages = 0
    recent_detections = []
    recent_users = []

    # Check if we are running with mock db
    is_mock = hasattr(db, "users") and hasattr(db.users, "documents")

    if is_mock:
        total_users = len(db.users.documents)
        total_detections = len(db.detections.documents)
        total_messages = len(db.chat_messages.documents)

        # Recent activities from mock db
        sorted_detections = sorted(db.detections.documents, key=lambda x: x.get("timestamp", ""), reverse=True)[:5]
        recent_detections = [{
            "id": str(d.get("_id")),
            "disease_name": d.get("disease_name"),
            "animal_type": d.get("animal_type"),
            "timestamp": d.get("timestamp"),
            "user_id": d.get("user_id")
        } for d in sorted_detections]

        sorted_users = sorted(db.users.documents, key=lambda x: x.get("created_at", ""), reverse=True)[:5]
        recent_users = [{
            "id": str(u.get("_id")),
            "name": u.get("name"),
            "email": u.get("email"),
            "created_at": u.get("created_at")
        } for u in sorted_users]
    else:
        total_users = await db.users.count_documents({})
        total_detections = await db.detections.count_documents({})
        total_messages = await db.chat_messages.count_documents({})

        # Recent activities from MongoDB Atlas
        cursor = db.detections.find({}).sort("timestamp", -1).limit(5)
        async for d in cursor:
            recent_detections.append({
                "id": str(d.get("_id")),
                "disease_name": d.get("disease_name"),
                "animal_type": d.get("animal_type"),
                "timestamp": d.get("timestamp"),
                "user_id": d.get("user_id")
            })

        cursor = db.users.find({}).sort("created_at", -1).limit(5)
        async for u in cursor:
            recent_users.append({
                "id": str(u.get("_id")),
                "name": u.get("name"),
                "email": u.get("email"),
                "created_at": u.get("created_at")
            })

    # System statistics
    free_mem = 0
    total_mem = 0
    try:
        import psutil
        mem = psutil.virtual_memory()
        free_mem = mem.available
        total_mem = mem.total
    except Exception:
        pass

    system_stats = {
        "os": platform.system(),
        "uptime": 0,
        "memory": {
            "free": free_mem,
            "total": total_mem
        },
        "nodeVersion": f"Python {platform.python_version()}"
    }

    return {
        "stats": {
            "totalUsers": total_users,
            "totalDetections": total_detections,
            "totalMessages": total_messages
        },
        "recentActivity": {
            "recentDetections": recent_detections,
            "recentUsers": recent_users
        },
        "systemStats": system_stats
    }
