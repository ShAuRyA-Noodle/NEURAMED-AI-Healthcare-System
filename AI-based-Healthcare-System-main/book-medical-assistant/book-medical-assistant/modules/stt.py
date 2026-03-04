import speech_recognition as sr
import queue
import threading
import pyaudio
import numpy as np
from typing import Optional, Callable

class SpeechToText:
    def __init__(self, callback: Optional[Callable[[str], None]] = None):
        """
        Initialize speech-to-text converter
        
        Args:
            callback: Optional function to call when text is recognized
        """
        self.recognizer = sr.Recognizer()
        self.recognizer.dynamic_energy_threshold = False
        self.recognizer.energy_threshold = 300
        
        # Audio settings
        self.CHUNK = 1024
        self.FORMAT = pyaudio.paFloat32
        self.CHANNELS = 1
        self.RATE = 16000
        
        self.audio_queue = queue.Queue()
        self.is_listening = False
        self.callback = callback
        
    def audio_callback(self, in_data, frame_count, time_info, status):
        """Callback for audio stream"""
        self.audio_queue.put(in_data)
        return (None, pyaudio.paContinue)
    
    def process_audio(self):
        """Process audio chunks from queue"""
        while self.is_listening:
            # Collect ~1 second of audio data
            audio_data = b''
            for _ in range(int(self.RATE / self.CHUNK)):
                try:
                    audio_data += self.audio_queue.get()
                except queue.Empty:
                    continue
            
            # Convert to numpy array
            audio_np = np.frombuffer(audio_data, dtype=np.float32)
            
            # Create AudioData object
            audio = sr.AudioData(
                audio_np.tobytes(), 
                sample_rate=self.RATE,
                sample_width=4  # Float32 = 4 bytes
            )
            
            # Perform recognition
            try:
                text = self.recognizer.recognize_google(audio)
                if text and self.callback:
                    self.callback(text)
                elif text:
                    print(f"Recognized: {text}")
            except sr.UnknownValueError:
                pass
            except sr.RequestError as e:
                print(f"Recognition error: {e}")
    
    def start(self):
        """Start speech recognition"""
        self.is_listening = True
        
        # Initialize PyAudio
        self.audio = pyaudio.PyAudio()
        self.stream = self.audio.open(
            format=self.FORMAT,
            channels=self.CHANNELS,
            rate=self.RATE,
            input=True,
            frames_per_buffer=self.CHUNK,
            stream_callback=self.audio_callback
        )
        
        # Start processing thread
        self.process_thread = threading.Thread(target=self.process_audio)
        self.process_thread.start()
        print("Started listening...")
    
    def stop(self):
        """Stop speech recognition"""
        self.is_listening = False
        if hasattr(self, 'stream'):
            self.stream.stop_stream()
            self.stream.close()
        if hasattr(self, 'audio'):
            self.audio.terminate()
        if hasattr(self, 'process_thread'):
            self.process_thread.join()
        print("Stopped listening.")

if __name__ == "__main__":
    # Example usage
    def print_callback(text: str):
        print(f"Callback received: {text}")
    
    stt = SpeechToText(callback=print_callback)
    try:
        stt.start()
        print("Speaking something will be transcribed to text...")
        input("Press Enter to stop...\n")
    finally:
        stt.stop()