import os
import argparse
import cv2
import numpy as np
import torch
from PIL import Image
import groq
import json
from typing import Dict, List, Tuple, Optional

# Configuration for different models
MODEL_CONFIG = {
    'pneumonia': {
        'weights_path': 'path/to/pneumonia_model.pt',
        'confidence': 0.5,
        'classes': ['normal', 'pneumonia']
    },
    'tumor': {
        'weights_path': 'path/to/tumor_model.pt',
        'confidence': 0.5,
        'classes': ['normal', 'tumor']
    },
    'breast_cancer': {
        'weights_path': 'path/to/breast_cancer_model.pt',
        'confidence': 0.5,
        'classes': ['normal', 'malignant', 'benign']
    }
}

# Groq API Configuration
GROQ_API_KEY = os.environ.get('GROQ_API_KEY', '')
if not GROQ_API_KEY:
    print("Warning: GROQ_API_KEY not found in environment variables")

# Initialize Groq client
groq_client = groq.Client(api_key=GROQ_API_KEY)

def load_image(image_path: str) -> Tuple[np.ndarray, Tuple[int, int]]:
    """Load and preprocess the image."""
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Image not found: {image_path}")
    
    # Read image
    img = cv2.imread(image_path)
    if img is None:
        raise ValueError(f"Failed to read image: {image_path}")
    
    # Store original dimensions
    original_dimensions = img.shape[1], img.shape[0]  # width, height
    
    # Convert to RGB (YOLO models typically expect RGB)
    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    
    return img, original_dimensions

def image_type_classification(image_path: str) -> str:
    """
    Determine the type of medical image (pneumonia, tumor, or breast cancer)
    based on image analysis or metadata.
    """
    # For this example, using a basic image classifier
    # In practice, you might use another ML model or metadata
    
    img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
    
    # Simple features to distinguish between types
    # This is just a placeholder - you would need a more sophisticated approach
    height, width = img.shape
    mean_intensity = np.mean(img)
    std_intensity = np.std(img)
    
    # Simple decision rules - replace with your actual classification logic
    if width / height > 1.5:  # Chest X-rays tend to be wider
        return 'pneumonia'
    elif mean_intensity < 100 and std_intensity > 50:  # Tumor MRIs might have these characteristics
        return 'tumor'
    else:
        return 'breast_cancer'  # Default to breast cancer

def run_detection(image_path: str, model_type: str) -> Dict:
    """Run the appropriate YOLO model on the image."""
    if model_type not in MODEL_CONFIG:
        raise ValueError(f"Unknown model type: {model_type}")
    
    config = MODEL_CONFIG[model_type]
    
    # Load the appropriate model
    model = torch.hub.load('ultralytics/yolov5', 'custom', path=config['weights_path'])
    model.conf = config['confidence']
    
    # Prepare image
    img, dimensions = load_image(image_path)
    
    # Run inference
    results = model(img)
    
    # Process results
    detections = []
    if len(results.xyxy[0]) > 0:
        for pred in results.xyxy[0].cpu().numpy():
            x1, y1, x2, y2, conf, cls_id = pred
            class_name = config['classes'][int(cls_id)]
            detections.append({
                'class': class_name,
                'confidence': float(conf),
                'bbox': [float(x1), float(y1), float(x2), float(y2)]
            })
    
    return {
        'model_type': model_type,
        'detections': detections,
        'image_dimensions': dimensions
    }

def get_diagnosis_from_groq(detection_results: Dict) -> str:
    """Use Groq LLM to analyze detection results and provide a diagnosis."""
    if not GROQ_API_KEY:
        return "Cannot generate diagnosis: Groq API key not provided."
    
    # Format the context for the LLM
    context = f"""
    Medical Image Analysis Results:
    Model type: {detection_results['model_type']}
    
    Detections:
    """
    
    if len(detection_results['detections']) == 0:
        context += "No abnormalities detected."
    else:
        for i, detection in enumerate(detection_results['detections']):
            context += f"Detection {i+1}: {detection['class']} (confidence: {detection['confidence']:.2f})\n"
    
    # Prepare the prompt for Groq
    prompt = f"""
    {context}
    
    Based on the medical image analysis results above, provide a brief medical diagnosis and recommendation.
    Focus on explaining what the findings might indicate, potential concerns, and what follow-up steps would be appropriate.
    """
    
    # Call Groq API
    try:
        response = groq_client.chat.completions.create(
            model="llama3-70b-8192",  # or whatever model you're using
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            max_tokens=500
        )
        diagnosis = response.choices[0].message.content
    except Exception as e:
        diagnosis = f"Error getting diagnosis from Groq: {str(e)}"
    
    return diagnosis

def save_results(image_path: str, detection_results: Dict, diagnosis: str, output_dir: str = "results"):
    """Save detection results and diagnosis to file."""
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    # Create base filename from input image
    base_filename = os.path.splitext(os.path.basename(image_path))[0]
    
    # Save JSON results
    result_data = {
        'image_path': image_path,
        'detection_results': detection_results,
        'diagnosis': diagnosis
    }
    
    json_path = os.path.join(output_dir, f"{base_filename}_results.json")
    with open(json_path, 'w') as f:
        json.dump(result_data, f, indent=2)
    
    # Save annotated image
    img = cv2.imread(image_path)
    for detection in detection_results['detections']:
        bbox = detection['bbox']
        x1, y1, x2, y2 = map(int, bbox)
        label = f"{detection['class']} {detection['confidence']:.2f}"
        
        # Draw bounding box
        cv2.rectangle(img, (x1, y1), (x2, y2), (0, 255, 0), 2)
        
        # Draw label
        cv2.putText(img, label, (x1, y1-10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
    
    # Save the annotated image
    cv2.imwrite(os.path.join(output_dir, f"{base_filename}_annotated.jpg"), img)
    
    print(f"Results saved to {output_dir}/{base_filename}_results.json")
    print(f"Annotated image saved to {output_dir}/{base_filename}_annotated.jpg")

def main():
    parser = argparse.ArgumentParser(description='Medical Image Analysis System')
    parser.add_argument('--image', required=True, help='Path to the medical image for analysis')
    parser.add_argument('--model', choices=['auto', 'pneumonia', 'tumor', 'breast_cancer'], 
                       default='auto', help='Model type to use for analysis')
    parser.add_argument('--output', default='results', help='Directory to save results')
    
    args = parser.parse_args()
    
    # Determine model type if auto is selected
    model_type = args.model
    if model_type == 'auto':
        model_type = image_type_classification(args.image)
        print(f"Auto-detected image type: {model_type}")
    
    # Run detection
    print(f"Running {model_type} detection on {args.image}...")
    detection_results = run_detection(args.image, model_type)
    
    # Get diagnosis
    print("Generating diagnosis using Groq LLM...")
    diagnosis = get_diagnosis_from_groq(detection_results)
    
    # Save results
    save_results(args.image, detection_results, diagnosis, args.output)
    
    # Print summary
    print("\n=== ANALYSIS SUMMARY ===")
    print(f"Image: {args.image}")
    print(f"Model: {model_type}")
    print(f"Detections: {len(detection_results['detections'])}")
    print("\nDiagnosis:")
    print(diagnosis)
    print("\nResults saved to:", args.output)

if __name__ == "__main__":
    main()