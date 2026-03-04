# import pytesseract
# from PIL import Image
# import pdf2image
# import cv2
# import numpy as np
# from transformers import pipeline, AutoTokenizer, AutoModelForSequenceClassification
# import torch

# class MedicalLabAssistant:
#     def __init__(self):
#         """Initialize the Medical Lab Assistant with necessary models"""
#         # Initialize OCR
#         self.ocr = pytesseract.pytesseract
        
#         # Initialize medical NLP pipeline using BioBERT
#         try:
#             self.nlp = pipeline(
#                 "text-classification",
#                 model="dmis-lab/biobert-base-cased-v1.2",
#                 tokenizer="dmis-lab/biobert-base-cased-v1.2"
#             )
#         except Exception as e:
#             print(f"Warning: Could not load NLP model: {str(e)}")
#             self.nlp = None
        
#         # Initialize medical image model using CheXNet
#         try:
#             self.image_classifier = pipeline(
#                 "image-classification",
#                 model="google/vit-base-patch16-224-in21k",
#                 tokenizer="google/vit-base-patch16-224-in21k"
#             )
#         except Exception as e:
#             print(f"Warning: Could not load image classification model: {str(e)}")
#             self.image_classifier = None
    
#     def extract_text_from_image(self, image_path):
#         """Extract text from various image formats"""
#         try:
#             image = Image.open(image_path)
#             text = self.ocr.image_to_string(image)
#             return text.strip()
#         except Exception as e:
#             return f"Error processing image: {str(e)}"
    
#     def process_pdf(self, pdf_path):
#         """Convert PDF to images and extract text"""
#         try:
#             # Convert PDF to images
#             images = pdf2image.convert_from_path(
#                 pdf_path,
#                 poppler_path=r"C:\Program Files\poppler-23.11.0\Library\bin"  # Adjust this path for your system
#             )
#             extracted_text = []
            
#             # Process each page
#             for image in images:
#                 text = self.ocr.image_to_string(image)
#                 extracted_text.append(text.strip())
            
#             return "\n\n".join(extracted_text)
#         except Exception as e:
#             return f"Error processing PDF: {str(e)}"
    
#     def analyze_medical_text(self, text):
#         """Analyze medical text and suggest possible diagnoses"""
#         if self.nlp is None:
#             return "NLP model not loaded"
        
#         try:
#             # Process text through medical NLP pipeline
#             analysis = self.nlp(text[:512])  # Truncate to max length
            
#             # Extract relevant medical conditions and their probabilities
#             possible_conditions = []
#             if isinstance(analysis, list):
#                 for result in analysis:
#                     if result['score'] > 0.3:
#                         possible_conditions.append({
#                             'condition': result['label'],
#                             'confidence': f"{result['score'] * 100:.2f}%"
#                         })
#             else:
#                 possible_conditions.append({
#                     'condition': analysis['label'],
#                     'confidence': f"{analysis['score'] * 100:.2f}%"
#                 })
            
#             return possible_conditions
#         except Exception as e:
#             return f"Error analyzing text: {str(e)}"
    
#     def analyze_xray(self, image_path):
#         """Analyze X-ray images for abnormalities"""
#         if self.image_classifier is None:
#             return "Image classifier model not loaded"
            
#         try:
#             # Load and preprocess image
#             image = Image.open(image_path)
            
#             # Run image through classifier
#             predictions = self.image_classifier(image)
            
#             # Process results
#             findings = []
#             if isinstance(predictions, list):
#                 for pred in predictions:
#                     if pred['score'] > 0.2:
#                         findings.append({
#                             'finding': pred['label'],
#                             'confidence': f"{pred['score'] * 100:.2f}%"
#                         })
#             else:
#                 findings.append({
#                     'finding': predictions['label'],
#                     'confidence': f"{predictions['score'] * 100:.2f}%"
#                 })
            
#             return findings
#         except Exception as e:
#             return f"Error analyzing X-ray: {str(e)}"
    
#     def process_report(self, file_path):
#         """Main function to process medical reports"""
#         # Determine file type
#         file_type = file_path.split('.')[-1].lower()
        
#         # Extract text based on file type
#         if file_type == 'pdf':
#             text = self.process_pdf(file_path)
#         elif file_type in ['jpg', 'jpeg', 'png']:
#             text = self.extract_text_from_image(file_path)
#         else:
#             return "Unsupported file format"
        
#         # Analyze the extracted text
#         text_analysis = self.analyze_medical_text(text)
        
#         # If file is an image, also perform X-ray analysis
#         xray_analysis = None
#         if file_type in ['jpg', 'jpeg', 'png']:
#             xray_analysis = self.analyze_xray(file_path)
        
#         return {
#             'extracted_text': text,
#             'possible_diagnoses': text_analysis,
#             'xray_findings': xray_analysis
#         }

# # Example usage
# def main():
#     assistant = MedicalLabAssistant()
    
#     # Example processing a medical report
#     result = assistant.process_report("patient_report.pdf")
#     print("Extracted Text:", result['extracted_text'][:200])  # First 200 chars
#     print("\nPossible Diagnoses:", result['possible_diagnoses'])
    
#     # Example processing an X-ray
#     xray_result = assistant.process_report("chest_xray.jpg")
#     print("\nX-ray Findings:", xray_result['xray_findings'])

# if __name__ == "__main__":
#     main()


# import pytesseract
# from PIL import Image
# import fitz  # PyMuPDF
# import cv2
# import numpy as np
# from transformers import pipeline, AutoTokenizer, AutoModelForSequenceClassification
# import torch
# import io

# class MedicalLabAssistant:
#     def __init__(self):
#         """Initialize the Medical Lab Assistant with necessary models"""
#         # Initialize OCR
#         self.ocr = pytesseract.pytesseract
        
#         # Initialize medical NLP pipeline using BioBERT
#         try:
#             self.nlp = pipeline(
#                 "text-classification",
#                 model="dmis-lab/biobert-base-cased-v1.2",
#                 tokenizer="dmis-lab/biobert-base-cased-v1.2"
#             )
#         except Exception as e:
#             print(f"Warning: Could not load NLP model: {str(e)}")
#             self.nlp = None
        
#         # Initialize medical image model using ViT
#         try:
#             self.image_classifier = pipeline(
#                 "image-classification",
#                 model="google/vit-base-patch16-224-in21k",
#                 tokenizer="google/vit-base-patch16-224-in21k"
#             )
#         except Exception as e:
#             print(f"Warning: Could not load image classification model: {str(e)}")
#             self.image_classifier = None
    
#     def extract_text_from_image(self, image_path):
#         """Extract text from various image formats"""
#         try:
#             image = Image.open(image_path)
#             text = self.ocr.image_to_string(image)
#             return text.strip()
#         except Exception as e:
#             return f"Error processing image: {str(e)}"
    
#     def process_pdf(self, pdf_path):
#         """Convert PDF to images and extract text using PyMuPDF"""
#         try:
#             # Open the PDF
#             pdf_document = fitz.open(pdf_path)
#             extracted_text = []
            
#             # Process each page
#             for page_num in range(pdf_document.page_count):
#                 # Get the page
#                 page = pdf_document[page_num]
                
#                 # Get text directly from PDF
#                 text = page.get_text()
#                 if text.strip():
#                     extracted_text.append(text.strip())
#                 else:
#                     # If no text found, try OCR on the page image
#                     pix = page.get_pixmap()
#                     img_data = pix.tobytes()
#                     img = Image.frombytes("RGB", [pix.width, pix.height], img_data)
#                     ocr_text = self.ocr.image_to_string(img)
#                     extracted_text.append(ocr_text.strip())
            
#             pdf_document.close()
#             return "\n\n".join(extracted_text)
#         except Exception as e:
#             return f"Error processing PDF: {str(e)}"
    
#     def analyze_medical_text(self, text):
#         """Analyze medical text and suggest possible diagnoses"""
#         if self.nlp is None:
#             return "NLP model not loaded"
        
#         try:
#             # Process text through medical NLP pipeline
#             analysis = self.nlp(text[:512])  # Truncate to max length
            
#             # Extract relevant medical conditions and their probabilities
#             possible_conditions = []
#             if isinstance(analysis, list):
#                 for result in analysis:
#                     if result['score'] > 0.3:
#                         possible_conditions.append({
#                             'condition': result['label'],
#                             'confidence': f"{result['score'] * 100:.2f}%"
#                         })
#             else:
#                 possible_conditions.append({
#                     'condition': analysis['label'],
#                     'confidence': f"{analysis['score'] * 100:.2f}%"
#                 })
            
#             return possible_conditions
#         except Exception as e:
#             return f"Error analyzing text: {str(e)}"
    
#     def analyze_xray(self, image_path):
#         """Analyze X-ray images for abnormalities"""
#         if self.image_classifier is None:
#             return "Image classifier model not loaded"
            
#         try:
#             # Load and preprocess image
#             image = Image.open(image_path)
            
#             # Run image through classifier
#             predictions = self.image_classifier(image)
            
#             # Process results
#             findings = []
#             if isinstance(predictions, list):
#                 for pred in predictions:
#                     if pred['score'] > 0.2:
#                         findings.append({
#                             'finding': pred['label'],
#                             'confidence': f"{pred['score'] * 100:.2f}%"
#                         })
#             else:
#                 findings.append({
#                     'finding': predictions['label'],
#                     'confidence': f"{predictions['score'] * 100:.2f}%"
#                 })
            
#             return findings
#         except Exception as e:
#             return f"Error analyzing X-ray: {str(e)}"
    
#     def process_report(self, file_path):
#         """Main function to process medical reports"""
#         # Determine file type
#         file_type = file_path.split('.')[-1].lower()
        
#         # Extract text based on file type
#         if file_type == 'pdf':
#             text = self.process_pdf(file_path)
#         elif file_type in ['jpg', 'jpeg', 'png']:
#             text = self.extract_text_from_image(file_path)
#         else:
#             return "Unsupported file format"
        
#         # Analyze the extracted text
#         text_analysis = self.analyze_medical_text(text)
        
#         # If file is an image, also perform X-ray analysis
#         xray_analysis = None
#         if file_type in ['jpg', 'jpeg', 'png']:
#             xray_analysis = self.analyze_xray(file_path)
        
#         return {
#             'extracted_text': text,
#             'possible_diagnoses': text_analysis,
#             'xray_findings': xray_analysis
#         }

# # Example usage
# def main():
#     assistant = MedicalLabAssistant()
    
#     # Example processing a medical report
#     result = assistant.process_report("patient_report.pdf")
#     print("Extracted Text:", result['extracted_text'][:200])  # First 200 chars
#     print("\nPossible Diagnoses:", result['possible_diagnoses'])
    
#     # Example processing an X-ray
#     xray_result = assistant.process_report("chest_xray.jpg")
#     print("\nX-ray Findings:", xray_result['xray_findings'])

# if __name__ == "__main__":
#     main()


import pytesseract
from PIL import Image
import fitz  # PyMuPDF
import cv2
import numpy as np
from transformers import pipeline
import torch
import io
import os
import shutil
from pathlib import Path

class MedicalLabAssistant:
    def __init__(self):
        """Initialize the Medical Lab Assistant with necessary models"""
        print("Initializing Medical Lab Assistant...")
        
        # Create uploads directory if it doesn't exist
        self.upload_dir = Path("medical_uploads")
        self.upload_dir.mkdir(exist_ok=True)
        
        # Initialize OCR
        self.ocr = pytesseract.pytesseract
        
        # Initialize medical NLP pipeline using Clinical BERT
        try:
            print("Loading NLP model...")
            self.nlp = pipeline(
                "text-classification",
                model="emilyalsentzer/Bio_ClinicalBERT",
                use_fast=True
            )
        except Exception as e:
            print(f"Warning: Could not load NLP model: {str(e)}")
            self.nlp = None
        
        # Initialize medical image model
        try:
            print("Loading image classification model...")
            self.image_classifier = pipeline(
                "image-classification",
                model="microsoft/beit-base-patch16-224-pt22k-ft22k",
                use_fast=True
            )
        except Exception as e:
            print(f"Warning: Could not load image classification model: {str(e)}")
            self.image_classifier = None
        
        print("Initialization complete!")

    def process_file(self, file_path):
        """Process a single file and return results"""
        if not os.path.exists(file_path):
            return f"Error: File not found: {file_path}"
            
        print(f"\nProcessing file: {file_path}")
        result = self.process_report(file_path)
        
        # Format and display results
        output = "\n=== Analysis Results ===\n"
        
        if 'extracted_text' in result:
            output += f"\nExtracted Text (first 200 chars):\n{result['extracted_text'][:200]}...\n"
        
        if 'possible_diagnoses' in result:
            output += "\nPossible Diagnoses:\n"
            for diagnosis in result['possible_diagnoses']:
                output += f"- {diagnosis['condition']}: {diagnosis['confidence']}\n"
        
        if 'xray_findings' in result and result['xray_findings']:
            output += "\nX-ray Findings:\n"
            if isinstance(result['xray_findings'], list):
                for finding in result['xray_findings']:
                    output += f"- {finding['finding']}: {finding['confidence']}\n"
            else:
                output += str(result['xray_findings'])
        
        return output

    def process_report(self, file_path):
        """Main function to process medical reports"""
        file_type = file_path.split('.')[-1].lower()
        
        if file_type == 'pdf':
            text = self.process_pdf(file_path)
        elif file_type in ['jpg', 'jpeg', 'png']:
            text = self.extract_text_from_image(file_path)
        else:
            return "Unsupported file format"
        
        text_analysis = self.analyze_medical_text(text)
        
        xray_analysis = None
        if file_type in ['jpg', 'jpeg', 'png']:
            xray_analysis = self.analyze_xray(file_path)
        
        return {
            'extracted_text': text,
            'possible_diagnoses': text_analysis,
            'xray_findings': xray_analysis
        }

    def extract_text_from_image(self, image_path):
        """Extract text from various image formats"""
        try:
            image = Image.open(image_path)
            text = self.ocr.image_to_string(image)
            return text.strip()
        except Exception as e:
            return f"Error processing image: {str(e)}"
    
    def process_pdf(self, pdf_path):
        """Convert PDF to images and extract text using PyMuPDF"""
        try:
            pdf_document = fitz.open(pdf_path)
            extracted_text = []
            
            for page_num in range(pdf_document.page_count):
                page = pdf_document[page_num]
                text = page.get_text()
                if text.strip():
                    extracted_text.append(text.strip())
                else:
                    pix = page.get_pixmap()
                    img_data = pix.tobytes()
                    img = Image.frombytes("RGB", [pix.width, pix.height], img_data)
                    ocr_text = self.ocr.image_to_string(img)
                    extracted_text.append(ocr_text.strip())
            
            pdf_document.close()
            return "\n\n".join(extracted_text)
        except Exception as e:
            return f"Error processing PDF: {str(e)}"
    
    def analyze_medical_text(self, text):
        """Analyze medical text and suggest possible diagnoses"""
        if self.nlp is None:
            return "NLP model not loaded"
        
        try:
            processed_text = f"Medical Report Analysis: {text}"
            analysis = self.nlp(processed_text[:512])
            
            conditions = {
                'LABEL_0': 'Normal',
                'LABEL_1': 'Abnormal findings',
                'LABEL_2': 'Acute condition',
                'LABEL_3': 'Chronic condition'
            }
            
            possible_conditions = []
            if isinstance(analysis, list):
                for result in analysis:
                    if result['score'] > 0.3:
                        label = conditions.get(result['label'], result['label'])
                        possible_conditions.append({
                            'condition': label,
                            'confidence': f"{result['score'] * 100:.2f}%"
                        })
            else:
                label = conditions.get(analysis['label'], analysis['label'])
                possible_conditions.append({
                    'condition': label,
                    'confidence': f"{analysis['score'] * 100:.2f}%"
                })
            
            return possible_conditions
        except Exception as e:
            return f"Error analyzing text: {str(e)}"
    
    def analyze_xray(self, image_path):
        """Analyze X-ray images for abnormalities"""
        if self.image_classifier is None:
            return "Image classifier model not loaded"
            
        try:
            image = Image.open(image_path)
            predictions = self.image_classifier(image)
            
            findings = []
            if isinstance(predictions, list):
                for pred in predictions:
                    if pred['score'] > 0.2:
                        findings.append({
                            'finding': pred['label'],
                            'confidence': f"{pred['score'] * 100:.2f}%"
                        })
            else:
                findings.append({
                    'finding': predictions['label'],
                    'confidence': f"{predictions['score'] * 100:.2f}%"
                })
            
            return findings
        except Exception as e:
            return f"Error analyzing X-ray: {str(e)}"

    def cleanup_uploads(self):
        """Clean up the uploads directory"""
        try:
            shutil.rmtree(self.upload_dir)
            self.upload_dir.mkdir(exist_ok=True)
        except Exception as e:
            print(f"Warning: Could not clean up uploads directory: {str(e)}")

def display_menu():
    """Display the main menu options"""
    print("\n=== Medical Lab Assistant ===")
    print("1. Process a medical report or image")
    print("2. Upload and process a file")
    print("3. Exit")
    return input("\nEnter your choice (1-3): ").strip()

def get_file_path():
    """Get file path from user input"""
    print("\nSupported file types: PDF, JPG, JPEG, PNG")
    return input("Enter the full path to your medical report/image (or 'back' to return to menu): ").strip()

def upload_file(assistant):
    """Handle file upload process"""
    print("\nSupported file types: PDF, JPG, JPEG, PNG")
    print("To upload a file, please follow these steps:")
    
    # Get the source file path
    source_path = input("Enter the path to the file you want to upload: ").strip()
    
    if source_path.lower() == 'back':
        return None
        
    if not os.path.exists(source_path):
        print(f"\nError: File not found at '{source_path}'")
        return None
        
    # Validate file extension
    file_ext = source_path.split('.')[-1].lower()
    if file_ext not in ['pdf', 'jpg', 'jpeg', 'png']:
        print("\nError: Unsupported file type. Please use PDF, JPG, JPEG, or PNG files.")
        return None
    
    try:
        # Create a unique filename
        filename = Path(source_path).name
        dest_path = assistant.upload_dir / filename
        
        # Copy the file to uploads directory
        shutil.copy2(source_path, dest_path)
        print(f"\nFile uploaded successfully to: {dest_path}")
        
        return dest_path
        
    except Exception as e:
        print(f"\nError uploading file: {str(e)}")
        return None

def main():
    assistant = MedicalLabAssistant()
    
    while True:
        choice = display_menu()
        
        if choice == '3':
            print("\nCleaning up uploaded files...")
            assistant.cleanup_uploads()
            print("Thank you for using Medical Lab Assistant!")
            break
            
        elif choice == '1':
            file_path = get_file_path()
            
            if file_path.lower() == 'back':
                continue
                
            if os.path.exists(file_path):
                result = assistant.process_file(file_path)
                print(result)
                
                input("\nPress Enter to continue...")
            else:
                print(f"\nError: File not found at '{file_path}'")
                print("Please check the file path and try again.")
                
        elif choice == '2':
            uploaded_file = upload_file(assistant)
            
            if uploaded_file:
                result = assistant.process_file(uploaded_file)
                print(result)
                
                input("\nPress Enter to continue...")
                
        else:
            print("\nInvalid choice. Please try again.")

if __name__ == "__main__":
    main()