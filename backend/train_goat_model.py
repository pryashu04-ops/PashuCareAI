import os
import cv2
import numpy as np
import joblib
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score

DATASET_DIR = r"c:\Users\DELL\Documents\cow disease project\dataset"
MODEL_DIR = r"c:\Users\DELL\Documents\cow disease project\ai-model"
MODEL_PATH = os.path.join(MODEL_DIR, "goat_disease_model.pkl")

# Define classes based on dataset folders
CLASSES = {
    "healthy": "Healthy",
    "diseased goat": "Goat Pox"
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
    
    # 1. Load diseased goat images (all available)
    diseased_folder = os.path.join(DATASET_DIR, "diseased goat")
    print(f"Processing class: diseased goat ({CLASSES['diseased goat']})...")
    if os.path.exists(diseased_folder):
        files = os.listdir(diseased_folder)
        for filename in files:
            img_path = os.path.join(diseased_folder, filename)
            features = extract_features(img_path)
            if features is not None:
                X.append(features)
                y.append(CLASSES["diseased goat"])
    
    # 2. Load healthy images (limit to 100 to balance the dataset better)
    healthy_folder = os.path.join(DATASET_DIR, "healthy")
    print(f"Processing class: healthy ({CLASSES['healthy']})...")
    if os.path.exists(healthy_folder):
        files = os.listdir(healthy_folder)
        for i, filename in enumerate(files[:100]):
            img_path = os.path.join(healthy_folder, filename)
            features = extract_features(img_path)
            if features is not None:
                X.append(features)
                y.append(CLASSES["healthy"])
                
    return np.array(X), np.array(y)

def train():
    X, y = load_dataset()
    if len(X) == 0:
        print("No valid images found for training.")
        return
        
    print(f"\nTotal samples: {len(X)} (Diseased Goat: {sum(y == CLASSES['diseased goat'])}, Healthy: {sum(y == CLASSES['healthy'])})")
    
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
