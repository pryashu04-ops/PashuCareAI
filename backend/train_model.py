import os
import cv2
import numpy as np
import joblib
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score

DATASET_DIR = r"c:\Users\DELL\Documents\cow disease project\Cows datasets"
MODEL_DIR = r"c:\Users\DELL\Documents\cow disease project\livestock-disease-detection\ai-model"
MODEL_PATH = os.path.join(MODEL_DIR, "cow_disease_model.pkl")

# Define classes based on dataset folders
CLASSES = {"healthy": "Healthy", "foot-and-mouth": "Foot and Mouth Disease", "lumpy": "Lumpy Skin Disease"}

def extract_features(img_path):
    # Read the image
    img = cv2.imread(img_path)
    if img is None:
        return None
    
    # Resize for consistent feature extraction
    img = cv2.resize(img, (64, 64))
    
    # Extract features (Flattened image + HSV Histogram + Edge Density)
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

def load_dataset():
    print(f"Loading dataset from: {DATASET_DIR}")
    X = []
    y = []
    
    for folder, disease_name in CLASSES.items():
        folder_path = os.path.join(DATASET_DIR, folder)
        if not os.path.exists(folder_path):
            print(f"Warning: Folder {folder} not found in dataset.")
            continue
            
        print(f"Processing class: {folder} ({disease_name})...")
        files = os.listdir(folder_path)
        
        # Load up to 500 images per class to keep training fast
        for i, filename in enumerate(files[:500]):
            img_path = os.path.join(folder_path, filename)
            features = extract_features(img_path)
            if features is not None:
                X.append(features)
                y.append(disease_name)
                
            if (i+1) % 100 == 0:
                print(f"  Loaded {i+1} images...")
                
    return np.array(X), np.array(y)

def train():
    X, y = load_dataset()
    if len(X) == 0:
        print("No valid images found for training.")
        return
        
    print(f"\nTotal samples: {len(X)}")
    print("Splitting dataset into train and test sets...")
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    print("Training Random Forest Classifier (this may take a minute)...")
    clf = RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1)
    clf.fit(X_train, y_train)
    
    print("Evaluating model...")
    y_pred = clf.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    print(f"\nModel Accuracy: {acc * 100:.2f}%")
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred))
    
    # Save the model
    os.makedirs(MODEL_DIR, exist_ok=True)
    joblib.dump(clf, MODEL_PATH)
    print(f"\nModel saved successfully at: {MODEL_PATH}")

if __name__ == '__main__':
    train()
