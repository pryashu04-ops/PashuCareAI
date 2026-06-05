import sys
import json
import os
import asyncio

# Force UTF-8 encoding for standard streams
if hasattr(sys.stdin, 'reconfigure'):
    sys.stdin.reconfigure(encoding='utf-8', errors='ignore')
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='ignore')

# Set Python path to find backend app modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import connect_db
from app.services.chat_service import generate_response

async def main():
    try:
        # Read the raw input JSON from stdin
        input_data = sys.stdin.read()
        params = json.loads(input_data)
        
        session_id = params.get("session_id")
        user_id = params.get("user_id")
        message_text = params.get("message_text")
        lang = params.get("lang", "en")
        
        if not user_id:
            print(json.dumps({"error": "Missing 'user_id' in parameters"}))
            return
            
        # Establish MongoDB database connection before running chat generation
        await connect_db()
        
        response = await generate_response(session_id, user_id, message_text, lang)
        print(json.dumps({"response": response, "session_id": session_id}))
    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    asyncio.run(main())
