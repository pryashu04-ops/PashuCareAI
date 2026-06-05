import sys
import os
import json
import asyncio

# Ensure stdout handles UTF-8 characters correctly
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# Add backend directory to Python path dynamically
current_dir = os.path.dirname(os.path.abspath(__file__))
workspace_root = os.path.abspath(os.path.join(current_dir, "..", "..", ".."))
backend_path = os.path.join(workspace_root, "backend")
if backend_path not in sys.path:
    sys.path.append(backend_path)

# pyrefly: ignore [missing-import]
from app.database import connect_db, get_db
# pyrefly: ignore [missing-import]
from app.services.chat_service import generate_response

async def test_cases():
    await connect_db()
    db = get_db()
    
    session_id = "test_session_123"
    user_id = "test_user_456"
    
    # Clean old test messages
    await db.chat_messages.delete_many({"session_id": session_id})
    await db.detections.delete_many({"user_id": user_id})
    
    print("--- TEST CASE 1: Greeting in Hindi ---")
    res1 = await generate_response(session_id, user_id, "नमस्ते, आप कौन हैं?", "hi")
    print(f"User: नमस्ते, आप कौन हैं?\nAI: {res1}\n")

    print("--- TEST CASE 2: Unsupported Animal (Dog) in English ---")
    res2 = await generate_response(session_id, user_id, "How do I take care of my dog?", "en")
    print(f"User: How do I take care of my dog?\nAI: {res2}\n")

    print("--- TEST CASE 3: Unsupported Animal (Cat) in Kannada ---")
    res3 = await generate_response(session_id, user_id, "ನನ್ನ ಬೆಕ್ಕಿಗೆ ಚಿಕಿತ್ಸೆ ಹೇಗೆ?", "kn")
    print(f"User: ನನ್ನ ಬೆಕ್ಕಿಗೆ ಚಿಕಿತ್ಸೆ ಹೇಗೆ?\nAI: {res3}\n")

    print("--- TEST CASE 4: Off-topic Query in Hindi ---")
    res4 = await generate_response(session_id, user_id, "मुझे कोडिंग सिखाइए", "hi")
    print(f"User: मुझे कोडिंग सिखाइए\nAI: {res4}\n")

    print("--- TEST CASE 5: Supported Topic (Feeding) in Hindi ---")
    res5 = await generate_response(session_id, user_id, "गाय के लिए हरा चारा कैसे तैयार करें?", "hi")
    print(f"User: गाय के लिए हरा चारा कैसे तैयार करें?\nAI: {res5}\n")

if __name__ == "__main__":
    asyncio.run(test_cases())
