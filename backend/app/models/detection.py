"""Pydantic models for disease detection results."""

from typing import List
from pydantic import BaseModel


class DetectionResult(BaseModel):
    id: str = ""
    disease_name: str = ""
    animal_type: str = ""
    confidence: int = 0
    severity: str = ""
    severity_color: str = ""
    symptoms: List[str] = []
    causes: List[str] = []
    why_it_happened: str = ""
    description: str = ""
    prevention: List[str] = []
    medicine: List[str] = []
    treatment: List[str] = []
    first_aid: List[str] = []
    food_recommendations: List[str] = []
    hygiene_tips: List[str] = []
    image_url: str = ""
    timestamp: str = ""
    user_id: str = ""
    emergency: str = ""
    quality_warning: str = ""
    health_status: str = ""
    recommendations: List[str] = []
