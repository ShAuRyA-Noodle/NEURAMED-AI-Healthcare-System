import speech_recognition as sr
import pyttsx3
import cv2
import numpy as np
import pytesseract
from PIL import Image
import os
import requests
import json
import time
import matplotlib.pyplot as plt
from transformers import pipeline
import torch
import torchvision
from torchvision import transforms

class HealthcareAISystem:
    def __init__(self, api_key=None):
        print("Initializing Healthcare AI System...")
        
        # Get API key from environment variable if not provided
        self.api_key = api_key or os.environ.get("GROQ_API_KEY")
        if not self.api_key:
            print("Warning: No API key provided for the LLM. Set GROQ_API_KEY environment variable or provide it during initialization.")
        
        # Initialize components
        self.init_voice_system()
        self.init_lab_report_system()
        self.init_imaging_system()
        
        print("Healthcare AI System initialized and ready.")
    
    def init_voice_system(self):
        """Initialize the voice-based diagnosis system"""
        print("Loading voice diagnosis system...")
        
        try:
            # Initialize text-to-speech engine
            self.tts_engine = pyttsx3.init()
            voices = self.tts_engine.getProperty('voices')
            self.tts_engine.setProperty('voice', voices[1].id)  # Set to a female voice
            self.tts_engine.setProperty('rate', 150)  # Speed of speech
            
            # Initialize speech recognition
            self.recognizer = sr.Recognizer()
            self.recognizer.energy_threshold = 300  # Adjust based on environment
            
            print("Voice diagnosis system loaded successfully.")
        except Exception as e:
            print(f"Error initializing voice system: {e}")
            self.tts_engine = None
            self.recognizer = None
    
    def init_lab_report_system(self):
        """Initialize the lab report analysis system"""
        print("Loading lab report analysis system...")
        
        try:
            # Ensure pytesseract is correctly configured
            pytesseract.pytesseract.tesseract_cmd = r'tesseract'  # Update path as needed
            print("Lab report analysis system loaded successfully.")
        except Exception as e:
            print(f"Error initializing lab report system: {e}")
    
    def init_imaging_system(self):
        """Initialize the medical imaging analysis system"""
        print("Loading medical imaging system...")
        
        try:
            # Initialize image preprocessing
            self.image_transform = transforms.Compose([
                transforms.Resize(256),
                transforms.CenterCrop(224),
                transforms.ToTensor(),
            ])
            
            print("Medical imaging system loaded successfully.")
        except Exception as e:
            print(f"Error initializing imaging system: {e}")
    
    def run_voice_diagnosis(self):
        """Run the voice-based diagnosis system"""
        if not self.tts_engine or not self.recognizer:
            print("Voice diagnosis system not properly initialized. Please check the setup.")
            return
        
        print("\n=== Voice Diagnosis System ===")
        print("1. Text input")
        print("2. Voice input")
        choice = input("Select input method (1/2): ")
        
        if choice == '1':
            # Text input
            symptoms = input("\nDescribe your symptoms: ")
            
            # Get diagnosis from LLM
            prompt = self.create_diagnosis_prompt(symptoms)
            diagnosis = self.query_llm(prompt)
            
            print("\nDiagnosis result:")
            print(diagnosis)
            
            # Ask if user wants voice output
            voice_output = input("\nDo you want to hear the diagnosis? (y/n): ")
            if voice_output.lower() == 'y':
                self.speak_text(diagnosis)
                
        elif choice == '2':
            # Voice input
            print("\nPlease describe your symptoms when prompted...")
            self.speak_text("Please describe your symptoms.")
            
            try:
                with sr.Microphone() as source:
                    print("Listening...")
                    self.recognizer.adjust_for_ambient_noise(source)
                    audio = self.recognizer.listen(source)
                
                print("Processing speech...")
                symptoms = self.recognizer.recognize_google(audio)
                print(f"You said: {symptoms}")
                
                # Get diagnosis from LLM
                prompt = self.create_diagnosis_prompt(symptoms)
                diagnosis = self.query_llm(prompt)
                
                print("\nDiagnosis result:")
                print(diagnosis)
                
                # Speak the diagnosis
                self.speak_text(diagnosis)
                
            except sr.UnknownValueError:
                print("Sorry, I could not understand what you said.")
                self.speak_text("Sorry, I could not understand what you said.")
            except sr.RequestError:
                print("Sorry, there was an error with the speech recognition service.")
                self.speak_text("Sorry, there was an error with the speech recognition service.")
        else:
            print("Invalid choice.")
    
    def run_lab_report_analysis(self):
        """Run the lab report analysis system"""
        print("\n=== Lab Report Analysis System ===")
        
        # Get the file path
        file_path = input("Enter the path to the lab report image: ")
        
        if not os.path.exists(file_path):
            print(f"Error: File {file_path} does not exist.")
            return
        
        try:
            # Load the image
            image = Image.open(file_path)
            print(f"Image loaded: {file_path}")
            
            # Extract text from the image
            print("Processing lab report...")
            extracted_text = self.extract_text_from_lab_report(image)
            
            print("\nExtracted text from lab report:")
            print(extracted_text)
            
            # Send to LLM for analysis
            prompt = self.create_lab_report_prompt(extracted_text)
            analysis = self.query_llm(prompt)
            
            # Display the results
            print("\n=== Lab Report Analysis Results ===")
            print(analysis)
            
            # Ask if user wants to save the results
            save_choice = input("\nDo you want to save the results to a file? (y/n): ")
            if save_choice.lower() == 'y':
                output_path = input("Enter the output file path: ")
                try:
                    with open(output_path, 'w') as f:
                        f.write("=== Lab Report Analysis Results ===\n\n")
                        f.write("Extracted Text:\n")
                        f.write(extracted_text)
                        f.write("\n\nAnalysis:\n")
                        f.write(analysis)
                    
                    print(f"Results saved to {output_path}")
                except Exception as e:
                    print(f"Error saving results: {e}")
            
        except Exception as e:
            print(f"Error processing lab report: {e}")
    
    def run_medical_imaging_analysis(self):
        """Run the medical imaging analysis system"""
        print("\n=== Medical Imaging Analysis System ===")
        
        # Get the file path
        file_path = input("Enter the path to the medical image (X-ray/CT scan): ")
        
        if not os.path.exists(file_path):
            print(f"Error: File {file_path} does not exist.")
            return
        
        try:
            # Load the image
            image = Image.open(file_path)
            print(f"Image loaded: {file_path}")
            
            # Preprocess the image
            processed_image = self.preprocess_image_for_analysis(image)
            
            # Generate a detailed description of the image to send to LLM
            image_description = self.generate_image_description(processed_image)
            
            # Send to LLM for analysis
            prompt = self.create_imaging_prompt(image_description, file_path.split('/')[-1])
            analysis = self.query_llm(prompt)
            
            # Display the results
            print("\n=== Medical Imaging Analysis Results ===")
            print(analysis)
            
            # Ask if user wants to save the results
            save_choice = input("\nDo you want to save the results to a file? (y/n): ")
            if save_choice.lower() == 'y':
                output_path = input("Enter the output file path: ")
                try:
                    with open(output_path, 'w') as f:
                        f.write("=== Medical Imaging Analysis Results ===\n\n")
                        f.write(analysis)
                        f.write("\n\nIMPORTANT: These results are for demonstration purposes only and should not be used for diagnosis.\n")
                        f.write("Always consult with a qualified healthcare professional for proper interpretation of medical images.\n")
                    
                    print(f"Results saved to {output_path}")
                except Exception as e:
                    print(f"Error saving results: {e}")
            
        except Exception as e:
            print(f"Error processing medical image: {e}")
    
    # Helper methods for voice diagnosis
    def speak_text(self, text):
        """Convert text to speech"""
        if self.tts_engine:
            self.tts_engine.say(text)
            self.tts_engine.runAndWait()
    
    def create_diagnosis_prompt(self, symptoms):
        """Create a prompt for the LLM to diagnose based on symptoms"""
        prompt = f"""
        You are a medical AI assistant providing preliminary analysis of patient symptoms.
        
        Patient symptoms:
        {symptoms}
        
        Based on these symptoms, please provide:
        1. Possible diagnoses (with confidence levels)
        2. Recommended next steps or tests
        3. Whether the patient should seek immediate medical attention
        4. Any lifestyle recommendations or home care tips
        
        Format your response in a clear, structured way that would be helpful for both patients and healthcare providers.
        """
        return prompt
    
    # Helper methods for lab report analysis
    def extract_text_from_lab_report(self, image):
        """Extract text from lab report image"""
        # Convert PIL Image to OpenCV format
        img = np.array(image)
        
        # Convert to grayscale
        if len(img.shape) > 2 and img.shape[2] == 3:
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        else:
            gray = img
        
        # Apply threshold to get black and white image
        _, binary = cv2.threshold(gray, 150, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        
        # Extract text using pytesseract
        text = pytesseract.image_to_string(binary)
        
        return text
    
    def create_lab_report_prompt(self, extracted_text):
        """Create a prompt for the LLM to analyze lab report data"""
        prompt = f"""
        You are a medical AI assistant analyzing lab test results.
        
        Below is the text extracted from a patient's lab report using OCR. Please analyze the values, 
        identify any abnormal results, and provide a comprehensive interpretation.
        
        Lab Report Text:
        {extracted_text}
        
        Please provide:
        1. A structured list of all identified lab values and whether they are within normal ranges
        2. Highlighted abnormal values and their potential clinical significance
        3. Overall assessment of the patient's health based on these results
        4. Recommendations for follow-up tests or consultations, if necessary
        
        If certain values are unclear or missing, please note this and explain what information would be helpful for a complete analysis.
        """
        return prompt
    
    # Helper methods for medical imaging analysis
    def preprocess_image_for_analysis(self, image):
        """Preprocess the medical image for analysis"""
        # Ensure image is in RGB format
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Apply transformations
        processed_image = self.image_transform(image)
        
        return processed_image
    
    def generate_image_description(self, processed_image):
        """Generate a description of the image for the LLM"""
        # In a real implementation, this would use an image feature extraction model
        # For now, we'll return a basic description
        return "Medical image (X-ray/CT scan) showing possible anatomical structures and potential abnormalities."
    
    def create_imaging_prompt(self, image_description, filename):
        """Create a prompt for the LLM to analyze medical imaging"""
        image_type = "X-ray" if "xray" in filename.lower() or "x-ray" in filename.lower() else "CT scan"
        body_part = "chest" # Simplified - in reality, would be detected from filename or image content
        
        prompt = f"""
        You are a medical AI assistant analyzing a {image_type} of the {body_part}.
        
        Image description: {image_description}
        
        Based on the image information provided, please:
        1. Identify possible abnormalities or conditions that might be present
        2. Provide a detailed analysis of what these findings might indicate
        3. Suggest potential diagnoses with reasoning
        4. Recommend any follow-up imaging or tests that might be beneficial
        
        Format your response as a professional radiology report with clear sections for Findings, Impression, and Recommendations.
        """
        return prompt
    
    def query_llm(self, prompt):
        """Query the LLM API with the prompt"""
        if not self.api_key:
            return "Error: No API key provided. Please set the GROQ_API_KEY environment variable or provide it during initialization."
        
        url = "https://api.groq.com/openai/v1/chat/completions"
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        data = {
            "model": "llama3-70b-8192",  # Or another Groq model as needed
            "messages": [
                {"role": "system", "content": "You are a helpful medical AI assistant providing analysis and guidance based on patient data. Always remind users that AI analysis is not a substitute for professional medical care."},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.3,
            "max_tokens": 1024
        }
        
        try:
            print("Sending request to LLM...")
            response = requests.post(url, headers=headers, json=data)
            response.raise_for_status()
            
            result = response.json()
            return result["choices"][0]["message"]["content"]
        except requests.exceptions.RequestException as e:
            return f"Error querying LLM: {str(e)}"
        except (KeyError, IndexError) as e:
            return f"Error parsing LLM response: {str(e)}"


def main():
    """Main function to run the Healthcare AI System"""
    # Check for API key
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        api_key = input("Please enter your Groq API key (or set GROQ_API_KEY environment variable): ")
    
    # Create the healthcare system
    healthcare_system = HealthcareAISystem(api_key)
    
    while True:
        # Display menu
        print("\n==============================")
        print("  Healthcare AI System Menu")
        print("==============================")
        print("1. Voice Diagnosis System")
        print("2. Lab Report Analysis")
        print("3. Medical Imaging Analysis")
        print("4. Exit")
        
        # Get user choice
        choice = input("\nEnter your choice (1-4): ")
        
        if choice == '1':
            healthcare_system.run_voice_diagnosis()
        elif choice == '2':
            healthcare_system.run_lab_report_analysis()
        elif choice == '3':
            healthcare_system.run_medical_imaging_analysis()
        elif choice == '4':
            print("Exiting Healthcare AI System. Goodbye!")
            break
        else:
            print("Invalid choice. Please try again.")


if __name__ == "__main__":
    main()