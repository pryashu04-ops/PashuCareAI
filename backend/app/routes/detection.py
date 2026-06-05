"""Disease detection routes — upload image, get results, view history."""

import os
import uuid
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends, Query
from bson import ObjectId

from ..models.detection import DetectionResult
from ..services.ai_service import detect_disease, get_all_diseases
from ..middleware.auth import get_current_user
from ..database import get_db
from ..config import settings

router = APIRouter(prefix="/api", tags=["Detection"])



import logging
logger = logging.getLogger("PashuCareAPI.detection")


@router.post("/detect", response_model=DetectionResult)
async def detect_upload(
    file: UploadFile = File(...),
    animal_type: str = Form("Cow"),
    lang: str = Form("en"),
    user=Depends(get_current_user),
):
    """Accept an uploaded image, run AI analysis, store and return result."""
    from ..services.translation_service import get_validation_message
    
    # 1. Validate image format on upload
    filename_lower = file.filename.lower()
    valid_exts = (".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif", ".bmp", ".jfif")
    is_image_mime = file.content_type.startswith("image/")
    is_valid_ext = filename_lower.endswith(valid_exts)
    
    if not (is_image_mime or is_valid_ext):
        logger.warning(f"Invalid file type uploaded: {file.filename} (MIME: {file.content_type})")
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload a valid image file (JPG, PNG, WEBP, HEIC, BMP, JFIF).")

    try:
        content = await file.read()
    except Exception as e:
        logger.error(f"Failed to read uploaded file {file.filename}: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail="Failed to read uploaded image file.")

    # 2. Validate image size
    if len(content) > 10 * 1024 * 1024:  # 10MB limit
        logger.warning(f"Uploaded file exceeds size limit: {len(content)} bytes")
        raise HTTPException(status_code=400, detail=get_validation_message("file_too_large", lang))

    if len(content) == 0:
        logger.warning("Empty file uploaded")
        raise HTTPException(status_code=400, detail=get_validation_message("empty_file", lang))

    # 3. Preprocess image (scaling, normalization, converting color spaces)
    from ..services.ai_service import preprocess_image
    try:
        preprocessed_bytes, _ = preprocess_image(content)
        logger.info(f"Successfully preprocessed image {file.filename}")
    except ValueError as ve:
        logger.warning(f"Preprocessing decoding error: {ve}")
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"Unexpected image preprocessing failure: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail="Image preprocessing failed. Please ensure the image is not corrupted.")

    # 4. Animal Classification Validation
    from ..services.ai_service import classify_animal
    try:
        detected_animal = classify_animal(preprocessed_bytes, file.filename, animal_type)
        logger.info(f"Animal classification result: detected={detected_animal}, expected={animal_type}")
    except Exception as e:
        logger.error(f"Animal classification service failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Animal identification service failed.")

    # Reject non-target animals / objects
    if detected_animal not in ["Cow", "Goat", "Sheep"]:
        logger.warning(f"Unsupported animal detected: {detected_animal}")
        raise HTTPException(
            status_code=400,
            detail=get_validation_message("animal_not_supported", lang)
        )
    
    # Reject mismatched animals
    if detected_animal != animal_type:
        logger.warning(f"Mismatched animal type: expected {animal_type}, but detected {detected_animal}")
        raise HTTPException(
            status_code=400,
            detail=get_validation_message("invalid_animal", lang, detected=detected_animal, expected=animal_type.lower())
        )

    # 5. Run AI Disease Prediction
    try:
        disease = detect_disease(preprocessed_bytes, animal_type, file.filename)
    except Exception as e:
        logger.error(f"AI prediction pipeline failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="AI prediction failed to execute.")

    if "error" in disease:
        err_type = disease["error"]
        logger.error(f"AI prediction service returned error: {err_type}")
        raise HTTPException(status_code=400, detail=err_type)

    confidence = disease.get("confidence", 0)
    logger.info(f"AI Prediction: {disease['name']} with {confidence}% confidence")

    # Save uploaded image to filesystem
    try:
        ext = os.path.splitext(file.filename)[1] or ".jpg"
        filename = f"{uuid.uuid4().hex}{ext}"
        filepath = os.path.join(settings.UPLOAD_DIR, filename)
        with open(filepath, "wb") as f:
            f.write(content)
        logger.info(f"Saved uploaded image to {filepath}")
    except Exception as e:
        logger.error(f"Failed to save uploaded image: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to save image file on server.")

    now = datetime.now(timezone.utc).isoformat()
    user_id = str(user.get("_id", "anonymous"))

    # Build result model
    result = DetectionResult(
        disease_name=disease["name"],
        animal_type=disease["animal"],
        confidence=confidence,
        severity=disease["severity"],
        severity_color=disease["severity_color"],
        symptoms=disease["symptoms"],
        causes=disease["causes"],
        why_it_happened=disease["why_it_happened"],
        description=disease.get("description", disease.get("why_it_happened", "")),
        prevention=disease["prevention"],
        medicine=disease["medicine"],
        treatment=disease.get("treatment", disease.get("medicine", [])),
        first_aid=disease["first_aid"],
        food_recommendations=disease["food_recommendations"],
        hygiene_tips=disease["hygiene_tips"],
        image_url=f"/uploads/{filename}",
        timestamp=now,
        user_id=user_id,
        emergency="",
        quality_warning=disease.get("quality_warning", ""),
        health_status=disease.get("health_status", "Diseased"),
        recommendations=disease.get("recommendations", [])
    )

    # 6. Save Prediction in MongoDB
    db = get_db()
    if db is not None:
        try:
            doc = result.model_dump()
            insert_result = await db.detections.insert_one(doc)
            result.id = str(insert_result.inserted_id)
            logger.info(f"Saved prediction to database with ID: {result.id}")
        except Exception as e:
            logger.error(f"Database insertion failed: {e}", exc_info=True)
            # We still proceed to return the prediction to user even if DB fails,
            # but we set a temporary ID
            result.id = f"temp_{uuid.uuid4().hex}"
    else:
        logger.error("Database connection unavailable, prediction not stored in persistent db")
        result.id = f"temp_{uuid.uuid4().hex}"

    # Translate result to requested language for response
    try:
        from ..services.translation_service import translate_disease_data
        translated_dict = translate_disease_data(result.model_dump(), lang)
        translated_dict["id"] = result.id
        return DetectionResult(**translated_dict)
    except Exception as e:
        logger.error(f"Translation failed for result: {e}", exc_info=True)
        # Return untranslated English result as fallback
        return result


@router.get("/detections", response_model=List[DetectionResult])
async def get_detections(
    lang: str = Query("en"),
    user=Depends(get_current_user)
):
    """Return detection history for the current user, translated to requested language."""
    db = get_db()
    if db is None:
        return []

    user_id = str(user.get("_id", "anonymous"))
    cursor = db.detections.find({"user_id": user_id}).sort("timestamp", -1).limit(50)
    results = []
    from ..services.translation_service import translate_disease_data
    async for doc in cursor:
        doc["id"] = str(doc.pop("_id"))
        translated_doc = translate_disease_data(doc, lang)
        # Ensure emergency field is present
        if "emergency" not in translated_doc:
            translated_doc["emergency"] = ""
        results.append(DetectionResult(**translated_doc))
    return results


@router.get("/detections/{detection_id}", response_model=DetectionResult)
async def get_detection(
    detection_id: str,
    lang: str = Query("en"),
    user=Depends(get_current_user)
):
    """Return a single detection, translated to requested language."""
    db = get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    try:
        obj_id = ObjectId(detection_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid detection ID format")
        
    user_id = str(user.get("_id", "anonymous"))
    doc = await db.detections.find_one({"_id": obj_id, "user_id": user_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Detection not found")
        
    doc["id"] = str(doc.pop("_id"))
    from ..services.translation_service import translate_disease_data
    translated_doc = translate_disease_data(doc, lang)
    if "emergency" not in translated_doc:
        translated_doc["emergency"] = ""
    return DetectionResult(**translated_doc)


@router.get("/diseases")
async def get_diseases(lang: str = Query("en")):
    """Return the complete disease catalogue, translated to requested language."""
    diseases = get_all_diseases()
    from ..services.translation_service import translate_disease_data
    return [translate_disease_data(d, lang) for d in diseases]
