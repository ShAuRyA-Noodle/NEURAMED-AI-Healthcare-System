
import os
import json
import time
from gtts import gTTS
import pygame
import speech_recognition as sr
from datetime import datetime
from quesandans import MedicalQuestionnaire
import tempfile
import threading

class MedicalDiagnosisSystem:
    def __init__(self):
        """Initialize the medical diagnosis system."""
        # Initialize components
        self.questionnaire = MedicalQuestionnaire(
            api_key=os.environ.get("GROQ_API_KEY"),
            model_name=os.environ.get("MODEL_PATH", "lama3-70b-8192")
        )
        
        # Initialize pygame mixer for audio
        pygame.mixer.init()
        
        # Initialize temp directory for audio files
        self.temp_dir = tempfile.gettempdir()
        
        # Initialize speech recognition
        self.recognizer = sr.Recognizer()
        try:
            self.microphone = sr.Microphone()
            with self.microphone as source:
                print("Calibrating microphone for ambient noise... Please wait.")
                self.recognizer.adjust_for_ambient_noise(source, duration=2)
        except Exception as e:
            print(f"Error initializing microphone: {e}")
            print("Falling back to text input mode.")
            self.microphone = None
        
        # Flag to track if audio is playing
        self.is_playing = False

    def play_audio(self, file_path):
        """Play audio file using pygame."""
        try:
            pygame.mixer.music.load(file_path)
            pygame.mixer.music.play()
            while pygame.mixer.music.get_busy():
                pygame.time.Clock().tick(10)
        except Exception as e:
            print(f"Audio playback error: {e}")

    def speak_text(self, text: str):
        """Convert text to speech using Google TTS."""
        try:
            # Create a sanitized filename
            safe_filename = f'speech_{abs(hash(text))}.mp3'
            temp_file = os.path.join(self.temp_dir, safe_filename)
            
            # Generate speech
            tts = gTTS(text=text, lang='en')
            tts.save(temp_file)
            
            # Play the audio in a separate thread
            audio_thread = threading.Thread(target=self.play_audio, args=(temp_file,))
            audio_thread.start()
            audio_thread.join()  # Wait for audio to finish
            
            # Clean up
            try:
                os.remove(temp_file)
            except:
                pass
            
        except Exception as e:
            print(f"TTS error: {e}")
            print("Continuing with text-only output")

    def get_user_input(self, prompt: str, timeout=10) -> str:
        """Get user input through speech or text with improved handling."""
        print(f"\n{prompt}")
        
        if self.microphone:
            max_attempts = 2
            for attempt in range(max_attempts):
                with self.microphone as source:
                    print("Listening... (say 'text mode' to switch to typing)")
                    try:
                        audio = self.recognizer.listen(source, timeout=timeout)
                        text = self.recognizer.recognize_google(audio)
                        print(f"You said: {text}")
                        
                        # Check if user wants to switch to text mode
                        if text.lower().strip() in ["text mode", "text"]:
                            print("Switching to text input mode...")
                            return input("Please type your response: ").strip()
                        
                        return text
                    except sr.WaitTimeoutError:
                        if attempt < max_attempts - 1:
                            print("No speech detected, trying again...")
                        else:
                            print("Switching to text input...")
                    except (sr.UnknownValueError, sr.RequestError) as e:
                        if attempt < max_attempts - 1:
                            print(f"Error: {e}. Trying again...")
                        else:
                            print("Switching to text input...")
        
        return input("Please type your response: ").strip()

    def speak_or_print(self, text: str):
        """Use Google TTS to speak the text and print it."""
        print(text)
        self.speak_text(text)

    def run_session(self):
        """Run a complete medical questionnaire session with improved flow."""
        try:
            # Welcome message
            welcome_msg = "Welcome to the Medical Diagnosis System. Please describe your symptoms."
            self.speak_or_print(welcome_msg)
            
            # Get initial symptoms
            initial_symptoms = self.get_user_input("Please describe your symptoms:")
            if not initial_symptoms:
                print("No symptoms provided. Exiting.")
                return

            # Generate questions
            print("\nAnalyzing your symptoms and generating relevant questions...")
            questionnaire_data = self.questionnaire.generate_questions(initial_symptoms)
            questionnaire_data["initial_symptoms"] = initial_symptoms
            
            if not questionnaire_data:
                print("Failed to generate questions. Exiting.")
                return

            # Add answers list to store responses
            questionnaire_data["answers"] = []

            # Ask each question and get response with improved flow
            for i, question in enumerate(questionnaire_data["questions"], 1):
                print(f"\nQuestion {i} of {len(questionnaire_data['questions'])}:")
                self.speak_or_print(question)
                
                response = self.get_user_input("Your answer:")
                while not response:
                    print("I didn't catch that. Could you please respond again?")
                    response = self.get_user_input("Your answer:")
                
                questionnaire_data["answers"].append(response)
                time.sleep(0.5)  # Brief pause between questions

            # Generate and speak diagnosis
            print("\nAnalyzing your responses and generating diagnosis...")
            diagnosis = self.generate_diagnosis(questionnaire_data)
            
            # Add diagnosis to questionnaire data
            questionnaire_data["diagnosis"] = diagnosis
            
            # Save session data
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"medical_session_{timestamp}.json"
            with open(filename, 'w') as f:
                json.dump(questionnaire_data, f, indent=4)
            print(f"\nSession data saved to: {filename}")

            # Display diagnosis
            print("\nDiagnosis:")
            self.speak_or_print(diagnosis)

        except Exception as e:
            print(f"An error occurred during the session: {e}")
        finally:
            pygame.mixer.quit()

    def generate_diagnosis(self, questionnaire_data: dict) -> str:
        """Generate a diagnosis based on symptoms and answers."""
        symptoms = questionnaire_data["initial_symptoms"]
        qa_pairs = [f"Q: {q}\nA: {a}" for q, a in zip(questionnaire_data["questions"], 
                                                     questionnaire_data["answers"])]
        
        prompt = f"""Based on the following symptoms and answers, provide a possible diagnosis 
        and recommendations:
        
        Initial Symptoms: {symptoms}
        
        Detailed Responses:
        {'\n'.join(qa_pairs)}
        
        Please provide a comprehensive analysis."""

        try:
            completion = self.questionnaire.client.chat.completions.create(
                messages=[{"role": "user", "content": prompt}],
                model=self.questionnaire.model_name,
                temperature=0.3
            )
            return completion.choices[0].message.content
        except Exception as e:
            print(f"Error generating diagnosis: {e}")
            return "Unable to generate diagnosis due to an error."

def main():
    """Main function to run the medical diagnosis system."""
    # Set environment variables
    if "GROQ_API_KEY" not in os.environ:
        os.environ["GROQ_API_KEY"] = "your-groq-api-key"
    if "MODEL_PATH" not in os.environ:
        os.environ["MODEL_PATH"] = "mixtral-8x7b-32768"

    try:
        system = MedicalDiagnosisSystem()
        system.run_session()
    except Exception as e:
        print(f"An unexpected error occurred: {e}")

if __name__ == "__main__":
    main()

  