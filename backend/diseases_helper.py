import sys
import json
import os

# Set Python path to find backend app modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.services.ai_service import get_all_diseases
from app.services.translation_service import translate_disease_data

def main():
    lang = sys.argv[1] if len(sys.argv) > 1 else "en"
    
    try:
        diseases = get_all_diseases()
        translated = [translate_disease_data(d, lang) for d in diseases]
        print(json.dumps(translated))
    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    main()
