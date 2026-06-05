import os
import sys

# Add backend directory to Python path dynamically
current_dir = os.path.dirname(os.path.abspath(__file__))
workspace_root = os.path.abspath(os.path.join(current_dir, "..", "..", ".."))
backend_path = os.path.join(workspace_root, "backend")
if backend_path not in sys.path:
    sys.path.append(backend_path)

# pyrefly: ignore [missing-import]
from app.services.ai_service import detect_disease

def test_real_image():
    dataset_dir = os.path.join(workspace_root, "dataset", "diseased goat")
    if os.path.isdir(os.path.join(dataset_dir, "diseased goat")):
        dataset_dir = os.path.join(dataset_dir, "diseased goat")
        
    def get_win_path(p):
        abs_p = os.path.abspath(p)
        if os.name == 'nt' and not abs_p.startswith('\\\\?\\'):
            return '\\\\?\\' + abs_p
        return abs_p
        
    win_dataset_dir = get_win_path(dataset_dir)
    files = [f for f in os.listdir(win_dataset_dir) if os.path.isfile(os.path.join(win_dataset_dir, f))]
    if not files:
        print("No files found in diseased goat folder.")
        return
        
    test_file = os.path.join(win_dataset_dir, files[0])
    print(f"Testing real image: {files[0]}")
    
    with open(test_file, "rb") as f:
        image_bytes = f.read()
        
    result = detect_disease(image_bytes, "Goat")
    print("\n--- Detection Result ---")
    print(f"Disease Name: {result.get('name')}")
    print(f"Animal Type: {result.get('animal')}")
    print(f"Confidence: {result.get('confidence')}%")
    print(f"Severity: {result.get('severity')}")
    print(f"Symptoms (First 2): {result.get('symptoms')[:2] if result.get('symptoms') else 'None'}")
    print(f"Medicine: {result.get('medicine')}")
    
    assert result.get('name') == "Goat Pox", f"Expected Goat Pox, got {result.get('name')}"
    print("\nPassed: Successfully classified real diseased goat image as Goat Pox with full metadata!")

if __name__ == '__main__':
    test_real_image()
