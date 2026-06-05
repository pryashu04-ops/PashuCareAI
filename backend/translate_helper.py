import sys
import json
import os

# Set Python path to find backend app modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.services.translation_service import translate_disease_data

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Missing lang argument. Expected: translate_helper.py <lang>"}))
        return
        
    lang = sys.argv[1]
    
    try:
        # Read the raw JSON string from stdin to prevent Windows shell escaping issues
        input_data = sys.stdin.read()
        doc = json.loads(input_data)
        
        if isinstance(doc, list):
            translated = []
            for item in doc:
                translated.append(translate_disease_data(item, lang))
        else:
            translated = translate_disease_data(doc, lang)
            
        print(json.dumps(translated))
    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    main()
