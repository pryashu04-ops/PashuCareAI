import sys
import json
import os

# Set Python path to find backend app modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.services.ai_service import classify_animal, detect_disease
from app.services.translation_service import translate_disease_data

def main():
    if len(sys.argv) < 5:
        print(json.dumps({"error": "Missing arguments. Expected: detect_helper.py <image_path> <animal_type> <lang> <filename>"}))
        return
        
    image_path = sys.argv[1]
    animal_type = sys.argv[2]
    lang = sys.argv[3]
    filename = sys.argv[4]
    
    try:
        if not os.path.exists(image_path):
            print(json.dumps({"error": f"Image file not found: {image_path}"}))
            return

        with open(image_path, "rb") as f:
            content = f.read()
            
        if len(content) == 0:
            print(json.dumps({"error": "Empty file content"}))
            return

        # 1. Animal classification check
        detected_animal = classify_animal(content, filename, animal_type)
        if detected_animal not in ["Cow", "Goat", "Sheep"]:
            from app.services.translation_service import get_validation_message
            err_msg = get_validation_message('animal_not_supported', lang)
            print(json.dumps({"error": err_msg}))
            return
            
        if detected_animal != animal_type:
            from app.services.translation_service import get_validation_message
            err_msg = get_validation_message('invalid_animal', lang, detected=detected_animal, expected=animal_type)
            print(json.dumps({"error": err_msg}))
            return

        # 2. Disease detection
        disease = detect_disease(content, animal_type, filename)
        if "error" in disease:
            print(json.dumps({"error": disease["error"]}))
            return

        if disease.get("confidence", 0) < 40:
            from app.services.translation_service import get_validation_message
            err_msg = get_validation_message('unable_to_identify', lang)
            print(json.dumps({"error": err_msg}))
            return

        # 3. Translate disease data
        translated = translate_disease_data(disease, lang)
        
        # Output the raw result as JSON
        print(json.dumps(translated))
    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    main()
