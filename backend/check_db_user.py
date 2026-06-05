import os
import asyncio
from pathlib import Path
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

# Load environment variables from the current directory (backend)
load_dotenv(".env")

MONGODB_URI = os.getenv("MONGODB_URI")
DATABASE_NAME = os.getenv("DATABASE_NAME", "pashucare_ai")

async def main():
    print(f"Connecting to URI: {MONGODB_URI.split('@')[-1] if MONGODB_URI and '@' in MONGODB_URI else MONGODB_URI}")
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client[DATABASE_NAME]
    
    # Check users
    user = await db.users.find_one({"email": "testfarmer1@pashucare.ai"})
    if user:
        print(f"[FOUND USER] {user['name']} ({user['email']}) - Created at: {user['created_at']}")
    else:
        print("[USER NOT FOUND]")
        
    client.close()

if __name__ == "__main__":
    asyncio.run(main())
