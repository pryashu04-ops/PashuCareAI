import asyncio
import sys
import os

# Ensure the project root is in the path to import backend app modules
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ""))
if project_root not in sys.path:
    sys.path.append(project_root)

from app.database import connect_db, get_db, close_db

async def main():
    try:
        await connect_db()
        db = get_db()
        if db is None:
            print("[ERROR] Database instance is None.")
        else:
            # Determine if real MongoDB client or mock
            from motor.motor_asyncio import AsyncIOMotorDatabase
            if isinstance(db, AsyncIOMotorDatabase):
                # Ping the server
                await db.client.admin.command("ping")
                print("[SUCCESS] Connected to MongoDB Atlas and ping succeeded.")
            else:
                print("[INFO] Using mock in-memory database (MongoDB not reachable).")
    except Exception as e:
        print(f"[EXCEPTION] {e}")
    finally:
        await close_db()

if __name__ == "__main__":
    asyncio.run(main())
