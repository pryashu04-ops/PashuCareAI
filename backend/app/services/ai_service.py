"""
AI Disease Detection Service for PashuCare AI.

Uses OpenCV image analysis to select the best‑matching disease from a
comprehensive catalogue. Replace `analyse_image()` with a real
TensorFlow / YOLOv8 model for production use.
"""

import cv2
import numpy as np
try:
    import joblib
except ImportError:
    joblib = None
import os

# Load the trained machine learning models
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
MODEL_DIR = os.path.join(BASE_DIR, "ai-model")
MODEL_PATH = os.path.join(MODEL_DIR, "cow_disease_model.pkl")
SHEEP_MODEL_PATH = os.path.join(MODEL_DIR, "sheep_disease_model.pkl")
GOAT_MODEL_PATH = os.path.join(MODEL_DIR, "goat_disease_model.pkl")

# Initialize global model variables
ai_model = None
if os.path.exists(MODEL_PATH) and joblib is not None:
    try:
        ai_model = joblib.load(MODEL_PATH)
        print(f"[INFO] Successfully loaded Cow AI Model from {MODEL_PATH}")
    except Exception as e:
        print(f"[ERROR] Failed to load Cow AI Model: {e}")
        ai_model = None
else:
    print(f"[WARN] Cow AI Model not found at {MODEL_PATH} or joblib missing. Falling back to simulated detection.")
    ai_model = None

sheep_model = None
if os.path.exists(SHEEP_MODEL_PATH) and joblib is not None:
    try:
        sheep_model = joblib.load(SHEEP_MODEL_PATH)
        print(f"[INFO] Successfully loaded Sheep AI Model from {SHEEP_MODEL_PATH}")
    except Exception as e:
        print(f"[ERROR] Failed to load Sheep AI Model: {e}")
        sheep_model = None
else:
    print(f"[WARN] Sheep AI Model not found at {SHEEP_MODEL_PATH} or joblib missing. Falling back to simulated detection.")
    sheep_model = None

goat_model = None
if os.path.exists(GOAT_MODEL_PATH) and joblib is not None:
    try:
        goat_model = joblib.load(GOAT_MODEL_PATH)
        print(f"[INFO] Successfully loaded Goat AI Model from {GOAT_MODEL_PATH}")
    except Exception as e:
        print(f"[ERROR] Failed to load Goat AI Model: {e}")
        goat_model = None
else:
    print(f"[WARN] Goat AI Model not found at {GOAT_MODEL_PATH} or joblib missing. Falling back to simulated detection.")
    goat_model = None

# ── Disease catalogue ────────────────────────────────────────────────────────
from .disease_catalogue import DISEASES


def preprocess_image(image_bytes: bytes) -> tuple[bytes, np.ndarray]:
    """
    Preprocess the uploaded image:
    1. Decode using OpenCV / PIL HEIC fallback.
    2. Resize normalization (resolutions bounded between 300px and 500px).
    3. Noise reduction using Gaussian Blur.
    4. Auto brightness correction and contrast enhancement using CLAHE.
    5. Sharpness improvement using Unsharp Masking.
    """
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    if img is None:
        try:
            from PIL import Image
            import io
            try:
                import pillow_heif
                pillow_heif.register_heif_opener()
            except ImportError:
                pass
            
            pil_img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            # Convert PIL image to OpenCV format (RGB to BGR)
            img = np.array(pil_img)
            img = img[:, :, ::-1].copy()
        except Exception as e:
            print(f"[ERROR] Decoding image failed in preprocessing: {e}")
            raise ValueError("Could not decode image. Please upload a valid image file like JPG, PNG, or HEIC.")

    # 1. Resize Normalization
    h, w = img.shape[:2]
    max_size = 500
    min_size = 300
    if max(h, w) > max_size:
        scale = max_size / max(h, w)
        img = cv2.resize(img, (int(w * scale), int(h * scale)))
    elif max(h, w) < min_size:
        scale = min_size / max(h, w)
        img = cv2.resize(img, (int(w * scale), int(h * scale)))

    # 2. Noise Reduction using Gaussian Blur
    img = cv2.GaussianBlur(img, (3, 3), 0)

    # 3. Auto Brightness and Contrast Enhancement using CLAHE
    ycrcb = cv2.cvtColor(img, cv2.COLOR_BGR2YCrCb)
    y, cr, cb = cv2.split(ycrcb)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    y_enhanced = clahe.apply(y)
    ycrcb_enhanced = cv2.merge((y_enhanced, cr, cb))
    img_enhanced = cv2.cvtColor(ycrcb_enhanced, cv2.COLOR_YCrCb2BGR)

    # 4. Sharpness Improvement using Unsharp Masking
    blurred = cv2.GaussianBlur(img_enhanced, (3, 3), 1.0)
    img_sharpened = cv2.addWeighted(img_enhanced, 1.5, blurred, -0.5, 0)

    # Convert back to bytes for Gemini/subsequent functions
    success, encoded_img = cv2.imencode(".jpg", img_sharpened)
    if not success:
        preprocessed_bytes = image_bytes
    else:
        preprocessed_bytes = encoded_img.tobytes()
        
    return preprocessed_bytes, img_sharpened


def extract_features(img_bytes: bytes) -> np.ndarray:
    """Extract HSV histogram and edge‑density features from uploaded image bytes."""
    nparr = np.frombuffer(img_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    # Fallback to pillow-heif and Pillow if cv2.imdecode fails
    if img is None:
        try:
            from PIL import Image
            import io
            try:
                import pillow_heif
                pillow_heif.register_heif_opener()
            except ImportError:
                pass
            
            pil_img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
            # Convert PIL image to OpenCV format (RGB to BGR)
            img = np.array(pil_img)
            img = img[:, :, ::-1].copy()
        except Exception as e:
            print(f"[ERROR] Decoding image failed: {e}")
            raise ValueError("Could not decode image. Please upload a valid image file like JPG, PNG, or HEIC.")

    # Resize to 64x64 for consistency
    img = cv2.resize(img, (64, 64))

    # 1. HSV Histogram
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    hist = cv2.calcHist([hsv], [0, 1, 2], None, [8, 8, 8], [0, 180, 0, 256, 0, 256])
    hist = cv2.normalize(hist, hist).flatten()

    # 2. Edge Density
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 100, 200)
    edge_density = np.sum(edges > 0) / (gray.shape[0] * gray.shape[1])

    # Combine features
    features = np.hstack([hist, edge_density])
    return features


def analyze_image_quality(image_bytes: bytes) -> tuple[bool, str]:
    """
    Evaluate image quality based on blur level, lighting, and resolution.
    Returns (is_poor_quality, quality_message).
    """
    try:
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            return True, "Unable to decode image."

        h, w = img.shape[:2]
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        # 1. Blur Check (Laplacian Variance)
        lap_var = cv2.Laplacian(gray, cv2.CV_64F).var()
        is_blurry = lap_var < 35.0

        # 2. Lighting Check (Average Brightness)
        avg_brightness = np.mean(gray)
        is_poor_lighting = avg_brightness < 30 or avg_brightness > 235

        # 3. Resolution Check
        is_low_res = w < 150 or h < 150

        if is_blurry or is_poor_lighting or is_low_res:
            return True, "Image quality is low. Results may be less accurate."

        return False, ""
    except Exception:
        return False, ""


from datetime import datetime, timezone

def normalize_disease_name(raw_name: str, animal_type: str) -> str:
    name_lower = raw_name.lower().strip()
    animal_lower = animal_type.lower().strip()
    
    # Check for healthy
    if "healthy" in name_lower or "normal" in name_lower:
        return "Healthy"
        
    # Get all disease names for this animal (excluding Healthy)
    matching = [d for d in DISEASES if d["animal"].lower() == animal_lower]
    disease_names = [d["name"] for d in matching if d["name"] != "Healthy"]
    
    # 1. Direct match with common variations
    # PPR / Peste des Petits Ruminants
    if "ppr" in name_lower or "peste des" in name_lower or "ruminants" in name_lower:
        matched = [d for d in disease_names if "peste des" in d.lower() or "ppr" in d.lower()]
        if matched: return matched[0]
        
    # Orf / Contagious Ecthyma
    if "orf" in name_lower or "ecthyma" in name_lower:
        matched = [d for d in disease_names if "orf" in d.lower() or "ecthyma" in d.lower()]
        if matched: return matched[0]
        
    # Foot and Mouth Disease / FMD
    if "fmd" in name_lower or "foot and mouth" in name_lower or "foot-and-mouth" in name_lower:
        matched = [d for d in disease_names if "foot and mouth" in d.lower() or "foot-and-mouth" in d.lower() or "fmd" in d.lower()]
        if matched: return matched[0]
        
    # Lumpy Skin Disease / LSD
    if "lsd" in name_lower or "lumpy skin" in name_lower:
        matched = [d for d in disease_names if "lumpy skin" in d.lower() or "lsd" in d.lower()]
        if matched: return matched[0]
        
    # Bluetongue
    if "bluetongue" in name_lower or "blue tongue" in name_lower:
        matched = [d for d in disease_names if "bluetongue" in d.lower() or "blue tongue" in d.lower()]
        if matched: return matched[0]
        
    # Mange
    if "mange" in name_lower or "scab" in name_lower:
        matched = []
        if "sarcoptic" in name_lower:
            matched = [d for d in disease_names if "sarcoptic" in d.lower()]
        elif "psoroptic" in name_lower or "scab" in name_lower:
            matched = [d for d in disease_names if "psoroptic" in d.lower() or "scab" in d.lower()]
        if not matched:
            matched = [d for d in disease_names if "mange" in d.lower()]
        if matched: return matched[0]
        
    # Sheep Pox / Goat Pox
    if "sheep pox" in name_lower or "sheeppox" in name_lower:
        matched = [d for d in disease_names if "sheep pox" in d.lower()]
        if matched: return matched[0]
    if "goat pox" in name_lower or "goatpox" in name_lower:
        matched = [d for d in disease_names if "goat pox" in d.lower()]
        if matched: return matched[0]
        
    # Foot rot
    if "foot rot" in name_lower or "footrot" in name_lower:
        matched = [d for d in disease_names if "foot rot" in d.lower() or "footrot" in d.lower()]
        if matched: return matched[0]
        
    # Ringworm
    if "ringworm" in name_lower:
        matched = [d for d in disease_names if "ringworm" in d.lower()]
        if matched: return matched[0]
        
    # 2. General Substring Match
    for disease in disease_names:
        if disease.lower() in name_lower or name_lower in disease.lower():
            return disease
            
    return None

def generate_simulated_visual_analysis(disease_name: str, animal_type: str, symptoms: list[str]) -> dict:
    keys = ["skin_lesions", "scabs", "hair_loss", "nodules", "mouth_sores", "hoof_infections", "swelling", "eye_or_nasal_discharge"]
    if disease_name == "Healthy":
        return {k: "Not Detected" for k in keys}
        
    findings = {}
    symptoms_str = " ".join(symptoms).lower()
    disease_lower = disease_name.lower()
    
    # 1. Skin lesions
    if any(w in symptoms_str for w in ["lesion", "ulcer", "blister", "sore", "wound", "pustule", "papule"]) or any(w in disease_lower for w in ["ringworm", "pox", "dermatitis", "lsd", "lumpy"]):
        findings["skin_lesions"] = "Detected - visible skin irritation or lesions"
    else:
        findings["skin_lesions"] = "Not Detected"
        
    # 2. Scabs
    if any(w in symptoms_str for w in ["scab", "crust"]) or any(w in disease_lower for w in ["orf", "pox", "mange"]):
        findings["scabs"] = "Detected - crusty scabs present"
    else:
        findings["scabs"] = "Not Detected"
        
    # 3. Hair loss
    if any(w in symptoms_str for w in ["hair loss", "alopecia", "wool loss", "patchy"]) or any(w in disease_lower for w in ["ringworm", "mange", "lice"]):
        findings["hair_loss"] = "Detected - patchy hair or wool loss"
    else:
        findings["hair_loss"] = "Not Detected"
        
    # 4. Nodules
    if any(w in symptoms_str for w in ["nodule", "lump", "bump"]) or any(w in disease_lower for w in ["lumpy", "lsd", "pox"]):
        findings["nodules"] = "Detected - firm skin nodules or lumps"
    else:
        findings["nodules"] = "Not Detected"
        
    # 5. Mouth sores
    if any(w in symptoms_str for w in ["mouth", "tongue", "salivation", "drool", "oral"]) or any(w in disease_lower for w in ["fmd", "foot and mouth", "ppr", "orf"]):
        findings["mouth_sores"] = "Detected - lesions or sores around oral cavity"
    else:
        findings["mouth_sores"] = "Not Detected"
        
    # 6. Hoof infections
    if any(w in symptoms_str for w in ["hoof", "foot", "lame", "footrot", "interdigital"]) or any(w in disease_lower for w in ["footrot", "foot rot", "fmd", "foot and mouth"]):
        findings["hoof_infections"] = "Detected - signs of inflammation or rot in hooves"
    else:
        findings["hoof_infections"] = "Not Detected"
        
    # 7. Swelling
    if any(w in symptoms_str for w in ["swell", "edema", "enlarge"]):
        findings["swelling"] = "Detected - localized swelling observed"
    else:
        findings["swelling"] = "Not Detected"
        
    # 8. Eye or nasal discharge
    if any(w in symptoms_str for w in ["discharge", "tear", "nasal", "mucus", "runny"]):
        findings["eye_or_nasal_discharge"] = "Detected - active ocular or nasal discharge"
    else:
        findings["eye_or_nasal_discharge"] = "Not Detected"
        
    return findings

def generate_simulated_top_predictions(disease_name: str, confidence: int, animal_type: str) -> list[dict]:
    matching = [d for d in DISEASES if d["animal"].lower() == animal_type.lower()]
    other_diseases = [d["name"] for d in matching if d["name"] != disease_name]
    
    if len(other_diseases) < 2:
        other_diseases = ["Healthy", "Pneumonia"]
        
    rem = 100 - confidence
    conf2 = int(rem * 0.6)
    conf3 = rem - conf2
    
    return [
        {"disease_name": disease_name, "confidence": confidence},
        {"disease_name": other_diseases[0], "confidence": conf2},
        {"disease_name": other_diseases[1], "confidence": conf3}
    ]

def get_confidence_category(confidence: int) -> str:
    if confidence > 80:
        return "High Confidence (>80%)"
    elif confidence >= 60:
        return "Medium Confidence (60-80%)"
    elif confidence >= 40:
        return "Low Confidence (40-60%)"
    else:
        return "Unknown (<40%)"

def get_local_symptoms(animal_type_str: str, pred_str: str, edge_den: float, dom_hue: float) -> list[str]:
    if pred_str == "Healthy":
        return []
    symptoms = []
    if edge_den > 0.08:
        symptoms.append("skin lesions")
    if edge_den > 0.12:
        symptoms.append("hair loss")
    if edge_den > 0.15:
        symptoms.append("visible wounds")
    if dom_hue > 0.3:
        symptoms.append("swelling")
    if dom_hue > 0.5:
        symptoms.append("eye infections")
    if dom_hue > 0.7:
        symptoms.append("mouth lesions")
    
    # Ensure we return at least one symptom if it's diseased
    if not symptoms:
        symptoms = ["abnormal body condition"]
    return symptoms

def detect_disease(image_bytes: bytes, animal_type: str = "Cow", filename: str = "") -> dict:
    """Run detection using both Dataset Prediction and AI Vision Prediction with Ensemble comparison."""
    # Ensure only supported animals are processed
    allowed_animals = {"Cow", "Sheep", "Goat"}
    if animal_type not in allowed_animals:
        return {
            "id": 0,
            "name": "Not found",
            "animal": animal_type,
            "confidence": 0,
            "severity": "None",
            "severity_color": "gray",
            "symptoms": [],
            "causes": [],
            "prevention": [],
            "medicine": [],
            "first_aid": [],
            "food_recommendations": [],
            "hygiene_tips": [],
            "why_it_happened": "Animal type not supported for detection.",
            "image_url": "",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "user_id": "anonymous",
            "emergency": "",
            "quality_warning": "",
            "health_status": "Uncertain",
            "recommendations": [],
            "confidence_category": "Unknown (<40%)",
            "top_predictions": [],
            "visual_analysis": {}
        }

    # Analyze Image Quality
    is_poor_quality, quality_message = analyze_image_quality(image_bytes)

    # Define matching diseases from the catalogue for this animal
    matching = [d for d in DISEASES if d["animal"].lower() == animal_type.lower()]
    disease_names = [d["name"] for d in matching if d["name"] != "Healthy"]

    # 1. Get Dataset Prediction
    dataset_pred = None
    dataset_conf = 0
    dataset_top_predictions = []
    try:
        features = extract_features(image_bytes)
        edge_density = features[-1]
    except ValueError as e:
        return {"error": str(e)}

    # Run Cow model
    if ai_model is not None and animal_type == "Cow":
        try:
            dataset_pred = ai_model.predict([features])[0]
            probs = ai_model.predict_proba([features])[0]
            dataset_conf = int(np.max(probs) * 100)
            class_probs = list(zip(ai_model.classes_, probs))
            class_probs.sort(key=lambda x: x[1], reverse=True)
            dataset_top_predictions = [{"disease_name": name, "confidence": int(prob * 100)} for name, prob in class_probs[:3]]
        except Exception as e:
            print(f"[WARN] Cow prediction model failed: {e}")
            dataset_pred = None

    # Run Sheep model
    elif sheep_model is not None and animal_type == "Sheep":
        try:
            dataset_pred = sheep_model.predict([features])[0]
            probs = sheep_model.predict_proba([features])[0]
            dataset_conf = int(np.max(probs) * 100)
            class_probs = list(zip(sheep_model.classes_, probs))
            class_probs.sort(key=lambda x: x[1], reverse=True)
            dataset_top_predictions = [{"disease_name": name, "confidence": int(prob * 100)} for name, prob in class_probs[:3]]
        except Exception as e:
            print(f"[WARN] Sheep prediction model failed: {e}")
            dataset_pred = None

    # Run Goat model
    elif goat_model is not None and animal_type == "Goat":
        try:
            dataset_pred = goat_model.predict([features])[0]
            probs = goat_model.predict_proba([features])[0]
            dataset_conf = int(np.max(probs) * 100)
            class_probs = list(zip(goat_model.classes_, probs))
            class_probs.sort(key=lambda x: x[1], reverse=True)
            dataset_top_predictions = [{"disease_name": name, "confidence": int(prob * 100)} for name, prob in class_probs[:3]]
        except Exception as e:
            print(f"[WARN] Goat prediction model failed: {e}")
            dataset_pred = None

    # Fallback/heuristic classifier if model prediction failed or was None
    if dataset_pred is None:
        if edge_density < 0.05:
            dataset_pred = "Healthy"
            dataset_conf = 95
        else:
            dominant_hue = int(features[0] * 255)
            index = (dominant_hue + int(edge_density * 100)) % len(matching)
            chosen = matching[index]
            dataset_pred = chosen["name"]
            base_conf = 75
            quality_bonus = min(20, int(edge_density * 100))
            dataset_conf = min(97, max(72, base_conf + quality_bonus + (dominant_hue % 8)))
        dataset_top_predictions = generate_simulated_top_predictions(dataset_pred, dataset_conf, animal_type)

    if not dataset_top_predictions:
        dataset_top_predictions = generate_simulated_top_predictions(dataset_pred, dataset_conf, animal_type)

    # 2. Get AI Vision Prediction (Gemini fallback)
    is_model_conf_low = (dataset_conf <= 80)
    vision_pred = None
    vision_conf = 0
    vision_symptoms = []
    vision_description = ""
    vision_possible = []
    vision_top_predictions = []
    vision_visual_analysis = {}
    gemini_successful = False
    
    from ..config import settings
    if settings.GEMINI_API_KEY and is_model_conf_low:
        import base64
        import httpx
        import json
        import re
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={settings.GEMINI_API_KEY}"
            base64_img = base64.b64encode(image_bytes).decode('utf-8')
            
            mime_type = "image/jpeg"
            fn_lower = filename.lower()
            if fn_lower.endswith(".png"): mime_type = "image/png"
            elif fn_lower.endswith(".webp"): mime_type = "image/webp"
            elif fn_lower.endswith(".heic"): mime_type = "image/heic"
            
            prompt = (
                f"Analyze this image of a {animal_type} for livestock health concerns.\n"
                "You must specifically examine and evaluate the following visual factors:\n"
                "- Skin lesions or scabs (skin_lesions)\n"
                "- Scabs (scabs)\n"
                "- Hair loss (hair_loss)\n"
                "- Nodules or lumps (nodules)\n"
                "- Mouth sores or excessive salivation (mouth_sores)\n"
                "- Hoof infections or lameness indicators (hoof_infections)\n"
                "- Swelling or edema (swelling)\n"
                "- Eye or nasal discharge (eye_or_nasal_discharge)\n\n"
                "Identify if the animal is Healthy or has a disease.\n"
                f"The supported disease categories for {animal_type} are:\n"
                f"{', '.join(disease_names)}\n\n"
                "Return your response in strict JSON format with the following keys:\n"
                "{\n"
                '  "detected_disease": "<Disease Name or Healthy or Unknown>",\n'
                '  "confidence": <integer confidence score between 0 and 100>,\n'
                '  "top_predictions": [\n'
                '     {"disease_name": "<Disease Name 1>", "confidence": <percentage>},\n'
                '     {"disease_name": "<Disease Name 2>", "confidence": <percentage>},\n'
                '     {"disease_name": "<Disease Name 3>", "confidence": <percentage>}\n'
                '  ],\n'
                '  "visual_analysis": {\n'
                '     "skin_lesions": "<brief finding or Not Detected>",\n'
                '     "scabs": "<brief finding or Not Detected>",\n'
                '     "hair_loss": "<brief finding or Not Detected>",\n'
                '     "nodules": "<brief finding or Not Detected>",\n'
                '     "mouth_sores": "<brief finding or Not Detected>",\n'
                '     "hoof_infections": "<brief finding or Not Detected>",\n'
                '     "swelling": "<brief finding or Not Detected>",\n'
                '     "eye_or_nasal_discharge": "<brief finding or Not Detected>"\n'
                '  },\n'
                '  "symptoms_found": ["symptom 1", "symptom 2", ...],\n'
                '  "description": "<detailed analysis description of what was observed>",\n'
                '  "possible_conditions": ["Condition A", "Condition B", ...]\n'
                "}\n"
                "Note: The disease names in top_predictions MUST match the supported categories listed above. If the animal is healthy, set detected_disease to 'Healthy', confidence to 95, and top_predictions with Healthy as first."
            )
            
            payload = {
                "contents": [{
                    "parts": [
                        {"text": prompt},
                        {
                            "inline_data": {
                                "mime_type": mime_type,
                                "data": base64_img
                            }
                        }
                    ]
                }],
                "generationConfig": {
                    "temperature": 0.0,
                    "maxOutputTokens": 600
                }
            }
            
            with httpx.Client(timeout=15.0) as client:
                response = client.post(url, json=payload)
                if response.status_code == 200:
                    res_json = response.json()
                    candidates = res_json.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        if parts:
                            text = parts[0].get("text", "").strip()
                            json_match = re.search(r"\{.*\}", text, re.DOTALL)
                            if json_match:
                                gemini_data = json.loads(json_match.group(0))
                                vision_pred_raw = gemini_data.get("detected_disease", "Unknown")
                                
                                if "healthy" in vision_pred_raw.lower():
                                    vision_pred = "Healthy"
                                elif "unknown" in vision_pred_raw.lower():
                                    vision_pred = "Unknown"
                                else:
                                    normalized = normalize_disease_name(vision_pred_raw, animal_type)
                                    if normalized:
                                        vision_pred = normalized
                                    else:
                                        vision_pred = "Unknown"
                                        
                                vision_conf = int(gemini_data.get("confidence", 80))
                                vision_symptoms = gemini_data.get("symptoms_found", [])
                                vision_description = gemini_data.get("description", "")
                                vision_possible = gemini_data.get("possible_conditions", [])
                                
                                gemini_top = gemini_data.get("top_predictions", [])
                                for item in gemini_top:
                                    if isinstance(item, dict) and "disease_name" in item:
                                        raw_dname = item["disease_name"]
                                        normalized_dname = "Healthy" if "healthy" in raw_dname.lower() else normalize_disease_name(raw_dname, animal_type)
                                        if normalized_dname:
                                            vision_top_predictions.append({
                                                "disease_name": normalized_dname,
                                                "confidence": int(item.get("confidence", 10))
                                            })
                                if not vision_top_predictions:
                                    vision_top_predictions = generate_simulated_top_predictions(vision_pred, vision_conf, animal_type)
                                    
                                vision_visual_analysis = gemini_data.get("visual_analysis", {})
                                for key in ["skin_lesions", "scabs", "hair_loss", "nodules", "mouth_sores", "hoof_infections", "swelling", "eye_or_nasal_discharge"]:
                                    if key not in vision_visual_analysis:
                                        vision_visual_analysis[key] = "Not Detected"
                                        
                                gemini_successful = True
        except Exception as e:
            print(f"[ERROR] Gemini detection failed: {e}")

    # Fallback to local heuristic predictions if Gemini was not configured, failed, or was not triggered
    if vision_pred is None:
        vision_pred = dataset_pred
        vision_conf = dataset_conf
        dominant_hue = features[0]
        vision_symptoms = get_local_symptoms(animal_type, dataset_pred, edge_density, dominant_hue)
        vision_description = f"Local heuristic analysis predicted {dataset_pred} based on image edge density of {edge_density:.4f}."
        vision_possible = [d["name"] for d in matching if d["name"] != "Healthy" and d["name"].lower() != dataset_pred.lower()][:2]
        vision_top_predictions = dataset_top_predictions
        vision_visual_analysis = generate_simulated_visual_analysis(dataset_pred, animal_type, vision_symptoms)

    # Helper function to compute symptom evidence overlap score
    def score_symptoms(symptoms_found: list[str], disease_symptoms: list[str]) -> float:
        if not symptoms_found or not disease_symptoms:
            return 0.0
        score = 0.0
        expanded_found = []
        for s in symptoms_found:
            s_low = s.lower()
            expanded_found.append(s_low)
            if "hair" in s_low or "wool" in s_low or "coat" in s_low:
                expanded_found.extend(["hair", "wool", "coat", "lesion", "loss"])
            if "scab" in s_low or "lesion" in s_low or "wound" in s_low or "sore" in s_low or "nodule" in s_low:
                expanded_found.extend(["scab", "lesion", "wound", "sore", "nodule", "skin"])
            if "itching" in s_low or "rubbing" in s_low or "irritation" in s_low:
                expanded_found.extend(["itching", "rubbing", "scratching", "irritation"])
            if "swelling" in s_low or "edema" in s_low or "lump" in s_low:
                expanded_found.extend(["swelling", "edema", "lump"])
            if "mouth" in s_low or "salivation" in s_low or "drool" in s_low:
                expanded_found.extend(["mouth", "salivation", "drool"])
            if "eye" in s_low or "discharge" in s_low:
                expanded_found.extend(["eye", "discharge"])
            if "hoof" in s_low or "lame" in s_low or "foot" in s_low:
                expanded_found.extend(["hoof", "lameness", "foot"])
                
        for s_found in expanded_found:
            for s_official in disease_symptoms:
                s_official_lower = s_official.lower()
                if s_found in s_official_lower or s_official_lower in s_found:
                    score += 1.0
                    break
        return score

    # 3. Hybrid/Ensemble Comparison with Symptom Evidence Scoring
    if dataset_pred.lower() == vision_pred.lower():
        final_pred = dataset_pred
        final_conf = max(dataset_conf, vision_conf)
        final_top_predictions = vision_top_predictions if gemini_successful else dataset_top_predictions
        final_visual_analysis = vision_visual_analysis
    else:
        entry_dataset = next((d for d in matching if d["name"].lower() == dataset_pred.lower()), None)
        entry_vision = next((d for d in matching if d["name"].lower() == vision_pred.lower()), None)
        symptoms_dataset = entry_dataset.get("symptoms", []) if entry_dataset else []
        symptoms_vision = entry_vision.get("symptoms", []) if entry_vision else []
        
        score_dataset = score_symptoms(vision_symptoms, symptoms_dataset)
        score_vision = score_symptoms(vision_symptoms, symptoms_vision)
        
        if score_dataset > score_vision:
            final_pred = dataset_pred
            final_conf = max(60, dataset_conf - 10)
            final_top_predictions = dataset_top_predictions
            final_visual_analysis = generate_simulated_visual_analysis(dataset_pred, animal_type, symptoms_dataset)
        elif score_vision > score_dataset:
            final_pred = vision_pred
            final_conf = max(60, vision_conf - 10)
            final_top_predictions = vision_top_predictions
            final_visual_analysis = vision_visual_analysis
        else:
            if vision_conf >= dataset_conf:
                final_pred = vision_pred
                final_conf = max(60, vision_conf - 10)
                final_top_predictions = vision_top_predictions
                final_visual_analysis = vision_visual_analysis
            else:
                final_pred = dataset_pred
                final_conf = max(60, dataset_conf - 10)
                final_top_predictions = dataset_top_predictions
                final_visual_analysis = generate_simulated_visual_analysis(dataset_pred, animal_type, symptoms_dataset)

    # 4. Prevent False Disease Detection (Only if Gemini was successfully queried)
    if gemini_successful and final_pred != "Healthy":
        entry_final = next((d for d in matching if d["name"].lower() == final_pred.lower()), None)
        symptoms_final = entry_final.get("symptoms", []) if entry_final else []
        
        evidence_score = score_symptoms(vision_symptoms, symptoms_final)
        if evidence_score == 0.0 or len(vision_symptoms) == 0:
            final_pred = "Healthy"
            final_conf = 95
            final_top_predictions = generate_simulated_top_predictions("Healthy", 95, animal_type)
            final_visual_analysis = generate_simulated_visual_analysis("Healthy", animal_type, [])

    # 5. Build Result details
    if final_pred == "Healthy":
        result = {
            "id": 999,
            "name": "Healthy",
            "animal": animal_type,
            "confidence": final_conf,
            "severity": "Low",
            "severity_color": "green",
            "symptoms": ["Clear eyes and alert posture", "Smooth and shiny coat", "Normal breathing and appetite"],
            "causes": ["Good nutrition and balanced diet", "Proper vaccination schedule", "Clean and hygienic environment"],
            "prevention": ["Continue regular health checkups", "Maintain current feeding schedule", "Keep up with seasonal vaccinations"],
            "medicine": ["No medicine required", "Routine deworming (every 3-6 months)"],
            "treatment": ["No medicine required", "Routine deworming (every 3-6 months)"],
            "first_aid": ["Not applicable", "Monitor daily for any changes"],
            "food_recommendations": ["Balanced ratio of green and dry fodder", "Access to fresh, clean drinking water", "Provide salt licks"],
            "hygiene_tips": ["Daily cleaning of the shed", "Proper disposal of dung"],
            "why_it_happened": "The animal is in excellent health due to proper care, good hygiene, and a well-balanced diet.",
            "description": "The animal is in excellent health due to proper care, good hygiene, and a well-balanced diet.",
            "health_status": "Healthy",
            "recommendations": ["Continue regular health checkups", "Maintain current feeding schedule", "Keep up with seasonal vaccinations"]
        }
    else:
        chosen = next((d for d in matching if d["name"].lower() == final_pred.lower()), None)
        if chosen is None:
            chosen = matching[0]
        result = dict(chosen)
        result["confidence"] = final_conf
        
        if final_conf >= 90:
            result["health_status"] = "Confirmed"
        elif final_conf >= 75:
            result["health_status"] = "Likely"
        elif final_conf >= 60:
            result["health_status"] = "Possible"
        else:
            result["health_status"] = "Uncertain"
            
        result["recommendations"] = list(chosen.get("prevention", [])) + list(chosen.get("first_aid", []))
        
        if vision_description:
            result["description"] = vision_description
        else:
            result["description"] = chosen.get("description", chosen.get("why_it_happened", ""))

    result["quality_warning"] = quality_message if is_poor_quality else ""
    result["confidence_category"] = get_confidence_category(final_conf)
    
    formatted_top = []
    seen_d = set()
    for item in final_top_predictions:
        dname = item["disease_name"]
        if dname not in seen_d:
            seen_d.add(dname)
            formatted_top.append({
                "disease_name": dname,
                "confidence": min(100, max(1, item["confidence"]))
            })
    if len(formatted_top) < 3:
        backup = generate_simulated_top_predictions(final_pred, final_conf, animal_type)
        for item in backup:
            if item["disease_name"] not in seen_d:
                seen_d.add(item["disease_name"])
                formatted_top.append(item)
    result["top_predictions"] = formatted_top[:3]
    result["visual_analysis"] = final_visual_analysis

    # 6. Return possible conditions for uncertain predictions (confidence below 60)
    if final_conf < 60 and final_pred != "Healthy":
        conds = [c for c in vision_possible if c.lower() != final_pred.lower() and c.lower() != "healthy"]
        if len(conds) < 2:
            backup_conds = [d["name"] for d in matching if d["name"] != "Healthy" and d["name"].lower() != final_pred.lower()]
            for bc in backup_conds:
                if bc not in conds:
                    conds.append(bc)
        cond_a = conds[0] if len(conds) > 0 else "Pneumonia"
        cond_b = conds[1] if len(conds) > 1 else "Skin infection"
        
        possible_text = f"\n\nPossible Conditions:\n- {cond_a}\n- {cond_b}"
        result["description"] += possible_text
        result["why_it_happened"] += possible_text

    return result


def classify_animal(image_bytes: bytes, filename: str = "", expected_animal: str = "Cow") -> str:
    """
    Classify the animal in the image using Gemini (if available) or fallback heuristics.
    Allowed: 'Cow', 'Goat', 'Sheep'.
    Rejected: 'Human', 'Dog', 'Cat', 'Horse', 'Bird', 'Monkey', 'Wild animals', 'Random objects'.
    """
    from ..config import settings
    import base64
    import httpx
    
    # 1. Try Gemini classification if API key is available
    if settings.GEMINI_API_KEY:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={settings.GEMINI_API_KEY}"
            base64_img = base64.b64encode(image_bytes).decode('utf-8')
            
            mime_type = "image/jpeg"
            fn_lower = filename.lower()
            if fn_lower.endswith(".png"): mime_type = "image/png"
            elif fn_lower.endswith(".webp"): mime_type = "image/webp"
            elif fn_lower.endswith(".heic"): mime_type = "image/heic"
            
            prompt = (
                "Identify the main subject in this image. "
                "You must strictly reply with ONLY ONE of the following exact categories, nothing else:\n"
                "Cow\nGoat\nSheep\nHuman\nDog\nCat\nHorse\nBird\nMonkey\nWild animals\nRandom objects\n"
                "If the image contains an animal not listed above (e.g. elephant, tiger), reply 'Wild animals'."
            )
            
            payload = {
                "contents": [{
                    "parts": [
                        {"text": prompt},
                        {
                            "inline_data": {
                                "mime_type": mime_type,
                                "data": base64_img
                            }
                        }
                    ]
                }],
                "generationConfig": {
                    "temperature": 0.0,
                    "maxOutputTokens": 20
                }
            }
            
            with httpx.Client(timeout=15.0) as client:
                response = client.post(url, json=payload)
                if response.status_code == 200:
                    res_json = response.json()
                    candidates = res_json.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        if parts:
                            gemini_ans = parts[0].get("text", "").strip()
                            ans_lower = gemini_ans.lower()
                            
                            categories = {
                                "cow": "Cow", "goat": "Goat", "sheep": "Sheep",
                                "human": "Human", "dog": "Dog", "cat": "Cat", "horse": "Horse", 
                                "bird": "Bird", "monkey": "Monkey", "wild animal": "Wild animals", 
                                "random object": "Random objects"
                            }
                            
                            for k, v in categories.items():
                                if k in ans_lower:
                                    return v
                            
                            return "Random objects"
        except Exception as e:
            print(f"[ERROR] Gemini classification failed: {e}")

    # 2. Fallback to local heuristic checks if Gemini is unavailable or fails
    import re
    fn = filename.lower() if filename else ""
    
    cow_substrings = ["cow", "cattle", "bull", "calf", "heifer", "bovine"]
    if any(k in fn for k in cow_substrings): return "Cow"
        
    goat_substrings = ["goat", "capra", "billy", "nanny", "ibex"]
    if any(k in fn for k in goat_substrings): return "Goat"
        
    sheep_substrings = ["sheep", "lamb", "ewe", "mutton", "wool"]
    if any(k in fn for k in sheep_substrings): return "Sheep"
        
    human_substrings = ["human", "woman", "person", "child", "people", "selfie", "face", "man", "boy", "girl"]
    if any(k in fn for k in human_substrings): return "Human"
        
    dog_substrings = ["dog", "puppy", "canine", "retriever", "hound"]
    if any(k in fn for k in dog_substrings): return "Dog"
        
    cat_substrings = ["cat", "kitten", "feline", "kitty", "meow"]
    if any(k in fn for k in cat_substrings): return "Cat"
        
    bird_substrings = ["bird", "parrot", "pigeon", "chicken", "avian", "eagle", "hawk"]
    if any(k in fn for k in bird_substrings): return "Bird"
        
    horse_substrings = ["horse", "equine", "stallion", "pony", "mare", "foal"]
    if any(k in fn for k in horse_substrings): return "Horse"
        
    monkey_substrings = ["monkey", "chimpanzee", "gorilla", "ape", "baboon"]
    if any(k in fn for k in monkey_substrings): return "Monkey"
        
    wild_substrings = ["elephant", "tiger", "giraffe", "kangaroo", "leopard", "lion", "bear", "deer", "wild", "snake"]
    if any(k in fn for k in wild_substrings): return "Wild animals"

    # Minimal OpenCV check for faces/skin to detect humans not caught by filename
    try:
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is not None:
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            cascade_path = os.path.join(cv2.data.haarcascades, 'haarcascade_frontalface_default.xml')
            if os.path.exists(cascade_path):
                face_cascade = cv2.CascadeClassifier(cascade_path)
                faces = face_cascade.detectMultiScale(gray, 1.1, 4)
                if len(faces) > 0:
                    return "Human"
            
            # Simple edge detection to reject complex non-animal objects
            edges = cv2.Canny(gray, 100, 200)
            edge_density = np.sum(edges > 0) / (gray.shape[0] * gray.shape[1])
            if edge_density > 0.75:
                return "Random objects"
    except Exception:
        pass

    return expected_animal


def get_all_diseases() -> list:
    """Return the complete disease catalogue."""
    return DISEASES
