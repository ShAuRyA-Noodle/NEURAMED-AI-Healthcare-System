import os
from groq import Groq
import json
from typing import Dict, Optional
import datetime

class MedicalQuestionnaire:
    def __init__(self, api_key="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", model_name="mixtral-8x7b-32768"):
        """Initialize the LLM question generator."""
        self.model_name = model_name
        print(f"Using API key: {api_key}")
        self.api_key = api_key
        if not self.api_key:
            raise ValueError("Groq API key must be provided")
            
        self.client = Groq(api_key=self.api_key)

    def generate_questions(self, symptoms: str) -> dict:
        """Generate questions using Groq LLM based on symptoms."""
        prompt = f"""Given the following symptoms, generate exactly 15 specific follow-up questions 
        that would help in diagnosing the condition. The questions should be detailed and relevant 
        to the symptoms described.

        Symptoms: {symptoms}

        Please format your response as a JSON object with this exact structure:
        {{
            "initial_symptoms": "the symptoms described",
            "questions": [
                "question 1",
                "question 2",
                ...
                "question 15"
            ]
        }}
        
        Ensure the response is properly formatted JSON and contains exactly 15 questions."""

        try:
            completion = self.client.chat.completions.create(
                messages=[{"role": "user", "content": prompt}],
                model=self.model_name,
                temperature=0.3,  # Lower temperature for more consistent responses
                max_tokens=2000
            )
            response = json.loads(completion.choices[0].message.content)
            
            # Validate response structure
            if not isinstance(response, dict) or 'questions' not in response:
                raise ValueError("Invalid response format from API")
            if len(response['questions']) != 15:
                raise ValueError("Did not receive exactly 15 questions")
                
            return response
        except Exception as e:
            print(f"Error generating questions: {e}")
            return None

    def save_to_json(self, data: Dict, filename: Optional[str] = None):
        """Save the questionnaire data to a JSON file."""
        if filename is None:
            timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"medical_questionnaire_{timestamp}.json"
            
        try:
            with open(filename, 'w') as f:
                json.dump(data, f, indent=4)
            print(f"\nQuestionnaire saved to {filename}")
        except Exception as e:
            print(f"Error saving JSON file: {e}")

    def run_questionnaire(self) -> Optional[Dict]:
        """Run the questionnaire process."""
        try:
            # Get initial symptoms through text input
            print("\nPlease describe your symptoms in detail:")
            initial_symptoms = input()
            
            print(f"\nGenerating questions based on your symptoms...")
            
            # Generate questions using Groq
            questionnaire = self.generate_questions(initial_symptoms)
            
            if questionnaire:
                self.save_to_json(questionnaire)
                return questionnaire
            return None
            
        except Exception as e:
            print(f"Error during questionnaire generation: {e}")
            return None

def main():
    """Main function to run the questionnaire generator."""
    try:
        # Initialize with the provided API key
        system = MedicalQuestionnaire()
        result = system.run_questionnaire()
        
        if result:
            print("\nQuestionnaire generation complete!")
            print("\nGenerated Questions:")
            for i, question in enumerate(result['questions'], 1):
                print(f"\n{i}. {question}")
        else:
            print("An error occurred during questionnaire generation.")
            
    except Exception as e:
        print(f"An unexpected error occurred: {e}")

if __name__ == "__main__":
    main()