import httpx
from fastapi import APIRouter, Query
import math
from ..config import settings

router = APIRouter(prefix="/api/vets", tags=["Veterinary"])

def calculate_distance(lat1, lon1, lat2, lon2):
    R = 6371  # Earth radius in km
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = math.sin(d_lat/2) * math.sin(d_lat/2) + \
        math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * \
        math.sin(d_lon/2) * math.sin(d_lon/2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c

@router.get("/nearby")
async def get_nearby_vets(
    lat: float = Query(..., description="User latitude"),
    lng: float = Query(..., description="User longitude"),
    radius: int = Query(20000, description="Search radius in meters"),
):
    """
    Find nearby veterinary hospitals using Overpass API (OpenStreetMap).
    """
    overpass_url = "https://overpass-api.de/api/interpreter"
    
    # Overpass QL query for veterinary clinics within a radius
    overpass_query = f"""
    [out:json][timeout:25];
    (
      node["amenity"="veterinary"](around:{radius},{lat},{lng});
      way["amenity"="veterinary"](around:{radius},{lat},{lng});
      relation["amenity"="veterinary"](around:{radius},{lat},{lng});
    );
    out center;
    """
    
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(overpass_url, data={'data': overpass_query}, timeout=30.0)
            data = resp.json()

        elements = data.get("elements", [])
        
        if not elements:
            return {
                "results": [
                    {
                        "name": "Sri Veterinary Hospital (Demo)",
                        "address": "Main Road, Near Bus Stand",
                        "lat": lat + 0.008,
                        "lng": lng + 0.005,
                        "distance": "1.2 km",
                        "phone": "+91 98765 43210",
                        "open_now": True,
                        "rating": 4.5,
                    },
                    {
                        "name": "Pashupathi Animal Clinic (Demo)",
                        "address": "Market Circle, 2nd Cross",
                        "lat": lat - 0.005,
                        "lng": lng + 0.012,
                        "distance": "2.8 km",
                        "phone": "+91 98765 12345",
                        "open_now": True,
                        "rating": 4.2,
                    }
                ],
                "using_sample_data": True,
                "error": "No veterinary clinics found in your area on OpenStreetMap. Showing sample data."
            }

        results = []
        for el in elements:
            # For ways/relations, coordinates are in 'center'
            el_lat = el.get("lat") or el.get("center", {}).get("lat", 0)
            el_lng = el.get("lon") or el.get("center", {}).get("lon", 0)
            tags = el.get("tags", {})
            
            name = tags.get("name", tags.get("name:en", "Veterinary Clinic"))
            address = tags.get("addr:full", tags.get("addr:street", tags.get("addr:city", "Local Veterinary Service")))
            phone = tags.get("phone", tags.get("contact:phone", ""))
            opening_hours = tags.get("opening_hours", "")
            
            dist_km = calculate_distance(lat, lng, el_lat, el_lng)
            
            results.append({
                "name": name,
                "address": address,
                "lat": el_lat,
                "lng": el_lng,
                "distance": f"{dist_km:.1f} km",
                "phone": phone,
                "open_now": True if opening_hours else False,
                "opening_hours": opening_hours,
                "rating": 4.0, # OSM doesn't have ratings, fallback to generic
                "dist_val": dist_km
            })

        # Sort by distance
        results.sort(key=lambda x: x["dist_val"])
        
        # Remove the sort key before returning
        for r in results:
            del r["dist_val"]

        return {"results": results[:15], "using_sample_data": False}

    except Exception as e:
        return {"results": [], "error": f"Overpass API Error: {str(e)}", "using_sample_data": False}

@router.get("/config")
async def get_maps_config():
    """Return map provider configuration."""
    return {
        "provider": "google",
        "api_key": settings.GOOGLE_MAPS_API_KEY
    }

