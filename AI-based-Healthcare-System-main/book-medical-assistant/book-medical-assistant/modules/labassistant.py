

import pytesseract
from PIL import Image
import pdf2image
import cv2
import numpy as np
from transformers import pipeline
import torch

class MedicalLabAssistant:
    def __init__(self):
        """Initialize the Medical Lab Assistant with necessary models"""
        # Initialize OCR
        self.ocr = pytesseract.pytesseract
        
        # Initialize medical NLP pipeline
        try:
            self.nlp = pipeline("text-classification", 
                              model="biodatlab/biobert-disease-diagnosis",
                              return_all_scores=True)
        except Exception as e:
            print(f"Warning: Could not load NLP model: {str(e)}")
            self.nlp = None
        
        # Initialize medical image model
        try:
            self.image_classifier = pipeline(
                "image-classification",
                model="nickmuchi/densenet121-chest-xray-pneumonia",
            )
        except Exception as e:
            print(f"Warning: Could not load image classification model: {str(e)}")
            self.image_classifier = None
    
    def extract_text_from_image(self, image_path):
        """Extract text from various image formats"""
        try:
            image = Image.open(image_path)
            text = self.ocr.image_to_string(image)
            return text.strip()
        except Exception as e:
            return f"Error processing image: {str(e)}"
    
    def process_pdf(self, pdf_path):
        """Convert PDF to images and extract text"""
        try:
            # Convert PDF to images
            images = pdf2image.convert_from_path(pdf_path)
            extracted_text = []
            
            # Process each page
            for image in images:
                text = self.ocr.image_to_string(image)
                extracted_text.append(text.strip())
            
            return "\n\n".join(extracted_text)
        except Exception as e:
            return f"Error processing PDF: {str(e)}"
    
    def analyze_medical_text(self, text):
        """Analyze medical text and suggest possible diagnoses"""
        if self.nlp is None:
            return "NLP model not loaded"
        
        try:
            # Process text through medical NLP pipeline
            analysis = self.nlp(text)
            
            # Extract relevant medical conditions and their probabilities
            possible_conditions = []
            for result in analysis[0]:
                if result['score'] > 0.3:  # Threshold for relevant conditions
                    possible_conditions.append({
                        'condition': result['label'],
                        'confidence': f"{result['score'] * 100:.2f}%"
                    })
            
            return possible_conditions
        except Exception as e:
            return f"Error analyzing text: {str(e)}"
    
    def analyze_xray(self, image_path):
        """Analyze X-ray images for abnormalities"""
        if self.image_classifier is None:
            return "Image classifier model not loaded"
            
        try:
            # Load and preprocess image
            image = Image.open(image_path)
            
            # Run image through classifier
            predictions = self.image_classifier(image)
            
            # Process results
            findings = []
            for pred in predictions:
                if pred['score'] > 0.2:  # Threshold for relevant findings
                    findings.append({
                        'finding': pred['label'],
                        'confidence': f"{pred['score'] * 100:.2f}%"
                    })
            
            return findings
        except Exception as e:
            return f"Error analyzing X-ray: {str(e)}"
    
    def process_report(self, file_path):
        """Main function to process medical reports"""
        # Determine file type
        file_type = file_path.split('.')[-1].lower()
        
        # Extract text based on file type
        if file_type == 'pdf':
            text = self.process_pdf(file_path)
        elif file_type in ['jpg', 'jpeg', 'png']:
            text = self.extract_text_from_image(file_path)
        else:
            return "Unsupported file format"
        
        # Analyze the extracted text
        text_analysis = self.analyze_medical_text(text)
        
        # If file is an image, also perform X-ray analysis
        xray_analysis = None
        if file_type in ['jpg', 'jpeg', 'png']:
            xray_analysis = self.analyze_xray(file_path)
        
        return {
            'extracted_text': text,
            'possible_diagnoses': text_analysis,
            'xray_findings': xray_analysis
        }

# Example usage
def main():
    assistant = MedicalLabAssistant()
    
    # Example processing a medical report
    result = assistant.process_report("patient_report.pdf")
    print("Extracted Text:", result['extracted_text'][:200])  # First 200 chars
    print("\nPossible Diagnoses:", result['possible_diagnoses'])
    
    # Example processing an X-ray
    xray_result = assistant.process_report("chest_xray.jpg")
    print("\nX-ray Findings:", xray_result['xray_findings'])

if __name__ == "__main__":
    main()