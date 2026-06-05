import json
import os
import asyncio
from pathlib import Path
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId

# Load environment variables
env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(env_path)

MONGODB_URI = os.getenv("MONGODB_URI")
DATABASE_NAME = os.getenv("DATABASE_NAME", "pashucare_ai")
DB_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "mock_database.json")

async def migrate():
    if not MONGODB_URI:
        print("[ERROR] MONGODB_URI not set in environment!")
        return

    if not os.path.exists(DB_FILE):
        print(f"[ERROR] Mock database file {DB_FILE} not found!")
        return

    print("Connecting to MongoDB Atlas...")
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client[DATABASE_NAME]

    try:
        await client.admin.command('ping')
        print("[SUCCESS] Connected to MongoDB Atlas.")
    except Exception as e:
        print(f"[ERROR] Failed to connect to MongoDB Atlas: {e}")
        return

    # Load mock database
    with open(DB_FILE, "r") as f:
        data = json.load(f)

    # 1. Migrate Users
    users = data.get("users", [])
    print(f"Loaded {len(users)} users from mock_database.json")
    migrated_users = 0
    for u in users:
        # Convert _id to ObjectId
        user_id = u.get("_id")
        doc = dict(u)
        if user_id:
            doc["_id"] = ObjectId(user_id)
        
        # Check if user already exists
        existing = await db.users.find_one({"email": u["email"].lower()})
        if not existing:
            await db.users.insert_one(doc)
            migrated_users += 1
        else:
            print(f"User {u['email']} already exists in MongoDB, skipping.")

    print(f"Successfully migrated {migrated_users} users.")

    # 2. Migrate Detections
    detections = data.get("detections", [])
    print(f"Loaded {len(detections)} detections from mock_database.json")
    migrated_detections = 0
    for d in detections:
        doc = dict(d)
        det_id = d.get("_id")
        if det_id:
            doc["_id"] = ObjectId(det_id)
        
        # Check if detection already exists
        existing = None
        if det_id:
            existing = await db.detections.find_one({"_id": ObjectId(det_id)})
        
        if not existing:
            await db.detections.insert_one(doc)
            migrated_detections += 1
        else:
            print(f"Detection {det_id} already exists in MongoDB, skipping.")

    print(f"Successfully migrated {migrated_detections} detections.")

    # 3. Migrate Chat Sessions
    sessions = data.get("chat_sessions", [])
    print(f"Loaded {len(sessions)} chat sessions from mock_database.json")
    migrated_sessions = 0
    for s in sessions:
        doc = dict(s)
        session_id = s.get("_id")
        if session_id:
            doc["_id"] = ObjectId(session_id)
        
        existing = None
        if session_id:
            existing = await db.chat_sessions.find_one({"_id": ObjectId(session_id)})
            
        if not existing:
            await db.chat_sessions.insert_one(doc)
            migrated_sessions += 1
        else:
            print(f"Chat session {session_id} already exists in MongoDB, skipping.")

    print(f"Successfully migrated {migrated_sessions} chat sessions.")

    # 4. Migrate Chat Messages
    messages = data.get("chat_messages", [])
    print(f"Loaded {len(messages)} chat messages from mock_database.json")
    migrated_messages = 0
    for m in messages:
        doc = dict(m)
        msg_id = m.get("_id")
        if msg_id:
            doc["_id"] = ObjectId(msg_id)
        
        existing = None
        if msg_id:
            existing = await db.chat_messages.find_one({"_id": ObjectId(msg_id)})
            
        if not existing:
            await db.chat_messages.insert_one(doc)
            migrated_messages += 1
        else:
            print(f"Chat message {msg_id} already exists in MongoDB, skipping.")

    print(f"Successfully migrated {migrated_messages} chat messages.")

    client.close()
    print("[MIGRATION COMPLETE] All mock data successfully migrated/verified in MongoDB Atlas!")

if __name__ == "__main__":
    asyncio.run(migrate())
