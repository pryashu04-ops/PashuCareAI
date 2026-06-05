import asyncio
import httpx
import os
from dotenv import load_dotenv

load_dotenv()

models_to_test = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-flash-latest",
    "gemini-2.0-flash-lite",
    "gemini-1.5-flash-latest",
    "gemini-1.5-flash"
]

async def test_model(key_name, key, model):
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
    payload = {
        "contents": [{"role": "user", "parts": [{"text": "Hello, answer with one word."}]}]
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            response = await client.post(url, json=payload)
            print(f"[{key_name}] Model {model} -> Status: {response.status_code}")
            if response.status_code == 200:
                print(f"  Success response: {response.json().get('candidates', [{}])[0].get('content', {}).get('parts', [{}])[0].get('text', '').strip()}")
                return True
        except Exception as e:
            print(f"[{key_name}] Model {model} -> Error: {e}")
    return False

async def main():
    gemini_key = os.getenv("GEMINI_API_KEY")
    maps_key = os.getenv("GOOGLE_MAPS_API_KEY")
    
    print("=== Testing GEMINI_API_KEY ===")
    for model in models_to_test:
        if await test_model("GEMINI_API_KEY", gemini_key, model):
            print(f"-> GEMINI_API_KEY works with {model}")
            
    print("\n=== Testing GOOGLE_MAPS_API_KEY ===")
    for model in models_to_test:
        if await test_model("GOOGLE_MAPS_API_KEY", maps_key, model):
            print(f"-> GOOGLE_MAPS_API_KEY works with {model}")

if __name__ == "__main__":
    asyncio.run(main())
