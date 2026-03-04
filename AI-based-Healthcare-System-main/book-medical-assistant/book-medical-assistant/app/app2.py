import streamlit as st
import os
import time
import tempfile
import sys
from pathlib import Path
import numpy as np
import queue
from streamlit_webrtc import webrtc_streamer, WebRtcMode, RTCConfiguration

# Add the parent directory to path so we can import your modules
sys.path.append(str(Path(__file__).parent))

# Import your existing modules
try:
    from stt import speech_to_text  # Your speech to text function
    from tts import text_to_speech  # Your text to speech function
    from main import process_query  # Your LLM query processing function
except ImportError:
    # Placeholders in case the actual modules aren't available
    def speech_to_text(audio_file):
        """Convert speech to text - replace with your actual function"""
        return "This is a placeholder for the STT function"
    
    def text_to_speech(text):
        """Convert text to speech - replace with your actual function"""
        # Return a dummy audio file path
        return "placeholder.mp3"
    
    def process_query(text_query):
        """Process query through LLM - replace with your actual function"""
        return "This is a placeholder response from the LLM"

# Set page config
st.set_page_config(
    page_title="Healthcare Voice Assistant",
    page_icon="🏥",
    layout="wide"
)

# App title and description
st.title("🏥 Healthcare Voice Assistant")
st.markdown("""
This application allows patients to ask health-related questions verbally and receive spoken responses 
with diagnostic information or follow-up questions.
""")

# Initialize session state variables
if 'conversation_history' not in st.session_state:
    st.session_state.conversation_history = []
if 'audio_response_path' not in st.session_state:
    st.session_state.audio_response_path = None
if 'audio_recording' not in st.session_state:
    st.session_state.audio_recording = []
if 'recording_status' not in st.session_state:
    st.session_state.recording_status = False
if 'should_process_audio' not in st.session_state:
    st.session_state.should_process_audio = False

# Function to display conversation history
def display_conversation():
    for i, (role, message) in enumerate(st.session_state.conversation_history):
        if role == "user":
            st.markdown(f"**You:** {message}")
        else:
            st.markdown(f"**Assistant:** {message}")
            
            # If there's an audio response for this message
            if st.session_state.audio_response_path and i == len(st.session_state.conversation_history) - 1:
                st.audio(st.session_state.audio_response_path)

# Function to process audio input
def process_audio_input(audio_file):
    # Save the audio file temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp_file:
        tmp_file.write(audio_file.getvalue())
        audio_path = tmp_file.name
    
    # Convert speech to text
    with st.spinner("Transcribing your question..."):
        text_query = speech_to_text(audio_path)
    
    # Add user's query to conversation history
    st.session_state.conversation_history.append(("user", text_query))
    
    # Process the query with the LLM
    with st.spinner("Analyzing your question..."):
        response = process_query(text_query)
    
    # Convert response to speech
    with st.spinner("Generating voice response..."):
        audio_path = text_to_speech(response)
        st.session_state.audio_response_path = audio_path
    
    # Add assistant's response to conversation history
    st.session_state.conversation_history.append(("assistant", response))
    
    # Clean up temp file
    os.unlink(audio_path)

# Function to process recorded audio
def process_recorded_audio(audio_data):
    # Save the audio data temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp_file:
        # Save the numpy array as a WAV file
        import scipy.io.wavfile as wavfile
        wavfile.write(tmp_file.name, 16000, audio_data.astype(np.int16))
        audio_path = tmp_file.name
    
    # Process the audio file
    with open(audio_path, "rb") as audio_file:
        process_audio_input(audio_file)
    
    # Clean up temp file
    os.unlink(audio_path)

# Create two columns for the main interface
col1, col2 = st.columns([3, 1])

with col1:
    # Display conversation history
    display_conversation()

with col2:
    # Audio recording widget
    st.write("### Ask your question")
    audio_file = st.file_uploader("Upload audio", type=["wav", "mp3"])
    
    # If audio is uploaded, process it
    if audio_file is not None:
        process_audio_input(audio_file)
        # Reset the file uploader
        st.experimental_rerun()
    
    # Or record directly using streamlit-webrtc
    st.write("Or record your question:")
    
    # Audio frames queue
    audio_frames_queue = queue.Queue()
    
    def audio_frame_callback(frame):
        """Callback to capture audio frames"""
        if st.session_state.recording_status:
            sound = frame.to_ndarray().reshape(-1)
            audio_frames_queue.put(sound)
        return frame
    
    # WebRTC configuration
    rtc_configuration = RTCConfiguration(
        {"iceServers": [{"urls": ["stun:stun.l.google.com:19302"]}]}
    )
    
    # WebRTC streamer for audio recording
    webrtc_ctx = webrtc_streamer(
        key="audio-recorder",
        mode=WebRtcMode.SENDONLY,
        rtc_configuration=rtc_configuration,
        media_stream_constraints={"video": False, "audio": True},
        audio_frame_callback=audio_frame_callback,
        async_processing=True,
    )
    
    # Recording control buttons
    col_rec1, col_rec2 = st.columns(2)
    
    with col_rec1:
        if webrtc_ctx.state.playing:
            if st.button("Start Recording"):
                st.session_state.recording_status = True
                st.session_state.audio_recording = []
                st.info("Recording... Speak now!")
                
    with col_rec2:
        if webrtc_ctx.state.playing:
            if st.button("Stop Recording"):
                st.session_state.recording_status = False
                st.success("Recording stopped")
                
                # Process the recorded audio
                collected_frames = []
                while not audio_frames_queue.empty():
                    collected_frames.append(audio_frames_queue.get())
                
                if collected_frames:
                    # Concatenate all audio frames
                    audio_data = np.concatenate(collected_frames, axis=0)
                    st.session_state.audio_recording = audio_data
                    st.session_state.should_process_audio = True
                    st.experimental_rerun()
    
    # Process recorded audio if needed
    if st.session_state.should_process_audio and len(st.session_state.audio_recording) > 0:
        process_recorded_audio(st.session_state.audio_recording)
        st.session_state.audio_recording = []
        st.session_state.should_process_audio = False
        st.experimental_rerun()

# Clear conversation button
if st.button("Clear Conversation"):
    st.session_state.conversation_history = []
    st.session_state.audio_response_path = None
    st.experimental_rerun()

# Sidebar with additional information
with st.sidebar:
    st.header("About")
    st.markdown("""
    This healthcare voice assistant uses:
    
    - Speech-to-Text: Captures and transcribes your questions
    - AI Language Model: Analyzes your health questions
    - Text-to-Speech: Converts responses to natural speech
    
    **Note:** This assistant is for informational purposes only and is not a substitute for professional medical advice.
    """)
    
    # Optional: Add example questions
    st.header("Example Questions")
    example_questions = [
        "What are the symptoms of the flu?",
        "How can I reduce my blood pressure naturally?",
        "What should I do for a persistent headache?",
        "Can you explain what diabetes is?"
    ]
    
    for question in example_questions:
        if st.button(question):
            # Add the example question to conversation
            st.session_state.conversation_history.append(("user", question))
            
            # Process the query with the LLM
            response = process_query(question)
            
            # Convert response to speech
            audio_path = text_to_speech(response)
            st.session_state.audio_response_path = audio_path
            
            # Add assistant's response to conversation history
            st.session_state.conversation_history.append(("assistant", response))
            
            # Rerun to update the UI
            st.experimental_rerun()

# Add a footer
st.markdown("---")
st.markdown("*This is a prototype healthcare voice assistant. Always consult with a healthcare professional for medical advice.*")