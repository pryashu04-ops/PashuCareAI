import os
import cv2
import numpy as np
import joblib
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score

DATASET_DIR = r"c:\Users\DELL\Documents\cow disease project\dataset"
MODEL_DIR = r"c:\Users\DELL\Documents\cow disease project\ai-model"
MODEL_PATH = os.path.join(MODEL_DIR, "sheep_disease_model.pkl")

# Define classes based on dataset folders
CLASSES = {
    "healthy": "Healthy",
    "diseased sheep": "Sheep Scab (Psoroptic Mange)",
    "sheep_pox": "Sheep Pox",
    "orf": "Orf (Contagious Ecthyma)",
    "foot_rot": "Foot Rot",
    "bluetongue": "Bluetongue",
    "ringworm": "Ringworm",
    "mange": "Sarcoptic Mange"
}

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
    
    # Process all classes defined in CLASSES
    for folder_name, disease_name in CLASSES.items():
        folder_path = os.path.join(DATASET_DIR, folder_name)
        print(f"Processing class: {folder_name} ({disease_name})...")
        if os.path.exists(folder_path):
            files = os.listdir(folder_path)
            # For healthy, limit to 100 to balance the dataset
            if folder_name == "healthy":
                files = files[:100]
                
            for filename in files:
                img_path = os.path.join(folder_path, filename)
                features = extract_features(img_path)
                if features is not None:
                    X.append(features)
                    y.append(disease_name)
                    
    return np.array(X), np.array(y)

def train():
    X, y = load_dataset()
    if len(X) == 0:
        print("No valid images found for training.")
        return
        
    print(f"\nTotal samples: {len(X)}")
    
    # Train using class_weight='balanced' on the entire dataset
    print("Training Random Forest Classifier on full dataset...")
    clf = RandomForestClassifier(n_estimators=100, class_weight='balanced', random_state=42, n_jobs=-1)
    clf.fit(X, y)
    
    print("Evaluating model on training set...")
    y_pred = clf.predict(X)
    acc = accuracy_score(y, y_pred)
    print(f"\nTraining Accuracy: {acc * 100:.2f}%")
    print("\nClassification Report:")
    print(classification_report(y, y_pred, zero_division=0))
    
    # Save the model
    os.makedirs(MODEL_DIR, exist_ok=True)
    joblib.dump(clf, MODEL_PATH)
    print(f"\nModel saved successfully at: {MODEL_PATH}")

if __name__ == '__main__':
    train()
