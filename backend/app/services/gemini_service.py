import base64
import httpx
import logging
from ..config import settings

logger = logging.getLogger(__name__)

async def generate_image_response(image_bytes: bytes, prompt: str, target_lang: str = "en") -> str:
    """Send an image and a textual prompt to Gemini and return the assistant's response.

    Args:
        image_bytes: Raw image data (bytes).
        prompt: User's question or instruction related to the image.
        target_lang: Desired language of the response ("en", "hi", "kn").
    Returns:
        The text response from Gemini.
    """
    if not settings.GEMINI_API_KEY:
        logger.error("Gemini API key not configured.")
        raise RuntimeError("Gemini API key not set")

    # Encode image to base64 for the API payload
    b64_image = base64.b64encode(image_bytes).decode()
    # Determine mime type (fallback to jpeg)
    mime_type = "image/jpeg"

    # Build multipart content: image + text prompt
    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [
                    {"inlineData": {"mimeType": mime_type, "data": b64_image}},
                    {"text": prompt},
                ],
            }
        ],
        "generationConfig": {"temperature": 0.2, "maxOutputTokens": 1200},
    }

    # If a non‑English language is requested, we ask Gemini to respond in that language via system instruction
    if target_lang not in ("en", None):
        system_instruction = f"Please answer in {target_lang.upper()} language."
        payload["systemInstruction"] = {"parts": [{"text": system_instruction}]}

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={settings.GEMINI_API_KEY}"
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(url, json=payload)
        if response.status_code == 200:
            data = response.json()
            candidates = data.get("candidates", [])
            if candidates:
                parts = candidates[0].get("content", {}).get("parts", [])
                if parts:
                    return parts[0].get("text", "")
            logger.error("Gemini returned no candidates for image response.")
            return "Sorry, I could not generate a response for the image."
        else:
            logger.error(f"Gemini API error {response.status_code}: {response.text}")
            return "Sorry, the image analysis service is currently unavailable."
    except Exception as e:
        logger.exception("Exception while calling Gemini for image analysis")
        return f"Error during image analysis: {e}"
