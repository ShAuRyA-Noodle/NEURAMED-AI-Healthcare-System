import streamlit as st
import time
import threading
from tts import TextToSpeech
from stt import SpeechToText
import openai  # Or whatever LLM client you're using

# Set page configuration
st.set_page_config(
    page_title="AI Healthcare Assistant",
    page_icon="🏥",
    layout="wide"
)

# Initialize session state variables
if 'conversation_history' not in st.session_state:
    st.session_state.conversation_history = []
if 'is_listening' not in st.session_state:
    st.session_state.is_listening = False
if 'diagnosis_in_progress' not in st.session_state:
    st.session_state.diagnosis_in_progress = False

# Create sidebar for configuration
st.sidebar.title("Settings")
api_key = st.sidebar.text_input("API Key (for LLM)", type="password")
enable_voice = st.sidebar.checkbox("Enable Voice Interaction", value=True)
voice_speed = st.sidebar.slider("Speech Speed", min_value=0.5, max_value=1.5, value=1.0, step=0.1)

# LLM function to get diagnosis
def get_diagnosis(prompt):
    # Replace this with your actual LLM integration
    try:
        # Example with OpenAI
        openai.api_key = api_key
        response = openai.ChatCompletion.create(
            model="gpt-4",  # or your preferred model
            messages=[
                {"role": "system", "content": "You are a healthcare assistant. Provide a preliminary diagnosis based on symptoms. Always remind users to consult with a medical professional."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=500,
            temperature=0.3
        )
        return response.choices[0].message.content
    except Exception as e:
        return f"Error getting diagnosis: {str(e)}"

# Callback for STT
def on_speech_detected(text):
    if st.session_state.is_listening:
        st.session_state.conversation_history.append({"role": "user", "content": text})
        st.session_state.diagnosis_in_progress = True
        st.rerun()

# Main app layout
st.title("🏥 AI Healthcare Diagnosis Assistant")
st.markdown("Describe your symptoms to receive an AI-powered diagnosis suggestion.")

# Display conversation history
for message in st.session_state.conversation_history:
    if message["role"] == "user":
        st.info(f"You: {message['content']}")
    else:
        st.success(f"AI: {message['content']}")

# Text input
user_input = st.text_input("Type your symptoms here:", key="text_input", 
                         disabled=st.session_state.is_listening)

# Process text input
if user_input:
    st.session_state.conversation_history.append({"role": "user", "content": user_input})
    st.session_state.diagnosis_in_progress = True
    st.rerun()

# Voice input controls
col1, col2 = st.columns(2)
with col1:
    if enable_voice:
        if st.button("🎤 Start Listening" if not st.session_state.is_listening else "⏹️ Stop Listening"):
            st.session_state.is_listening = not st.session_state.is_listening
            if st.session_state.is_listening:
                # Initialize and start STT in a separate thread
                stt = SpeechToText(callback=on_speech_detected)
                
                def start_listening():
                    stt.start()
                    while st.session_state.is_listening:
                        time.sleep(0.1)
                    stt.stop()
                
                threading.Thread(target=start_listening, daemon=True).start()
            st.rerun()

with col2:
    if st.button("🗑️ Clear Conversation"):
        st.session_state.conversation_history = []
        st.rerun()

# Process diagnosis if needed
if st.session_state.diagnosis_in_progress:
    with st.spinner("Getting diagnosis..."):
        # Get the last user message
        last_message = next((msg["content"] for msg in reversed(st.session_state.conversation_history) 
                          if msg["role"] == "user"), None)
        
        if last_message:
            # Get diagnosis from LLM
            diagnosis = get_diagnosis(last_message)
            
            # Add to conversation history
            st.session_state.conversation_history.append({"role": "assistant", "content": diagnosis})
            
            # Text to speech if enabled
            if enable_voice:
                tts = TextToSpeech()
                tts.start()
                tts.say(diagnosis)
                # Note: In a production app, you'd want to manage the TTS lifecycle better
            
            st.session_state.diagnosis_in_progress = False
            st.rerun()

# Add footer with disclaimer
st.markdown("---")
st.caption("""
**Disclaimer**: This application provides preliminary information only and is not a substitute 
for professional medical advice, diagnosis, or treatment. Always seek the advice of your 
physician or other qualified health provider with any questions you may have regarding a 
medical condition.
""")