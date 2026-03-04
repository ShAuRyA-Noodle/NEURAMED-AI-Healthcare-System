# # import threading
# # import queue
# # import time
# # import os
# # from gtts import gTTS
# # import pygame
# # import tempfile

# # class TextToSpeech:
# #     def __init__(self):
# #         """Initialize the TTS system with Google TTS."""
# #         self.audio_queue = queue.Queue()
# #         self.is_running = False
# #         self.play_thread = None
# #         self.temp_dir = tempfile.mkdtemp()  # Create a dedicated temp directory
        
# #         try:
# #             pygame.mixer.init()
# #             print("TTS system initialized successfully!")
# #             self.initialized = True
# #         except Exception as e:
# #             print(f"Error initializing audio system: {str(e)}")
# #             self.initialized = False

# #     def say(self, text: str):
# #         """Generate and queue audio for given text."""
# #         if not text:
# #             print("No text provided for TTS.")
# #             return
        
# #         if not self.initialized:
# #             print("TTS system not initialized. Cannot generate speech.")
# #             return

# #         try:
# #             # Create a temporary file in our dedicated directory
# #             temp_file_path = os.path.join(self.temp_dir, f'tts_{time.time()}.mp3')
            
# #             # Generate audio using Google TTS
# #             tts = gTTS(text=text, lang='en', slow=False)
# #             tts.save(temp_file_path)
            
# #             # Add file path to queue for playing
# #             self.audio_queue.put(temp_file_path)
# #         except Exception as e:
# #             print(f"Error generating speech: {str(e)}")

# #     def _play_audio_queue(self):
# #         """Process and play audio from the queue."""
# #         while self.is_running:
# #             try:
# #                 # Get audio file path from queue with timeout
# #                 audio_file = self.audio_queue.get(timeout=1.0)
                
# #                 if not os.path.exists(audio_file):
# #                     print(f"Audio file not found: {audio_file}")
# #                     continue

# #                 try:
# #                     # Load and play the audio file
# #                     pygame.mixer.music.load(audio_file)
# #                     pygame.mixer.music.play()
                    
# #                     # Wait for audio to finish
# #                     while pygame.mixer.music.get_busy():
# #                         if not self.is_running:
# #                             pygame.mixer.music.stop()
# #                             break
# #                         time.sleep(0.1)
                    
# #                 except Exception as e:
# #                     print(f"Error playing audio: {str(e)}")
# #                 finally:
# #                     # Clean up temp file after playing
# #                     try:
# #                         if os.path.exists(audio_file):
# #                             os.remove(audio_file)
# #                     except Exception as e:
# #                         print(f"Error cleaning up temp file: {str(e)}")
                        
# #             except queue.Empty:
# #                 continue
# #             except Exception as e:
# #                 print(f"Error in audio playback: {str(e)}")

# #     def start(self):
# #         """Start the TTS system."""
# #         if self.is_running:
# #             return
        
# #         self.is_running = True
# #         self.play_thread = threading.Thread(target=self._play_audio_queue)
# #         self.play_thread.daemon = True
# #         self.play_thread.start()

# #     def stop(self):
# #         """Stop the TTS system and clean up resources."""
# #         self.is_running = False
        
# #         # Stop any playing audio
# #         if pygame.mixer.get_init() and pygame.mixer.music.get_busy():
# #             pygame.mixer.music.stop()
        
# #         if self.play_thread and self.play_thread.is_alive():
# #             self.play_thread.join()
        
# #         # Clean up temp directory
# #         try:
# #             for file in os.listdir(self.temp_dir):
# #                 os.remove(os.path.join(self.temp_dir, file))
# #             os.rmdir(self.temp_dir)
# #         except Exception as e:
# #             print(f"Error cleaning up temp directory: {str(e)}")
        
# #         pygame.mixer.quit()

# #     def __del__(self):
# #         """Cleanup when the object is destroyed."""
# #         try:
# #             self.stop()
# #         except Exception as e:
# #             print(f"Error during cleanup: {str(e)}")

# # if __name__ == "__main__":
# #     # Test the TTS system
# #     tts = TextToSpeech()
# #     tts.start()
    
# #     # Test with various types of text
# #     test_texts = [
# #         "Hello! This is a test of the text to speech system.",
# #         "This is another test of the speech synthesis.",
# #         "The weather is beautiful today!"
# #     ]
    
# #     for text in test_texts:
# #         print(f"\nGenerating speech for: {text}")
# #         tts.say(text)
# #         time.sleep(5)  # Wait for audio to finish
    
# #     tts.stop()



import threading
import queue
import time
import os
from gtts import gTTS
import pygame
import tempfile
import atexit

class TextToSpeech:
    def __init__(self):
        """Initialize the TTS system with Google TTS."""
        self.audio_queue = queue.Queue()
        self.is_running = False
        self.play_thread = None
        self.temp_dir = tempfile.mkdtemp()  # Create a dedicated temp directory
        self.current_audio_file = None
        self.cleanup_lock = threading.Lock()
        
        # Register cleanup on program exit
        atexit.register(self.cleanup_resources)
        
        try:
            pygame.mixer.init()
            print("TTS system initialized successfully!")
            self.initialized = True
        except Exception as e:
            print(f"Error initializing audio system: {str(e)}")
            self.initialized = False

    def cleanup_resources(self):
        """Clean up resources safely."""
        self.stop()
        try:
            # Wait a bit to ensure files are released
            time.sleep(0.5)
            with self.cleanup_lock:
                if os.path.exists(self.temp_dir):
                    for file in os.listdir(self.temp_dir):
                        try:
                            file_path = os.path.join(self.temp_dir, file)
                            if os.path.exists(file_path):
                                os.remove(file_path)
                        except Exception as e:
                            print(f"Failed to remove file {file}: {e}")
                    os.rmdir(self.temp_dir)
        except Exception as e:
            print(f"Error during final cleanup: {e}")

    def say(self, text: str):
        """Generate and queue audio for given text."""
        if not text:
            print("No text provided for TTS.")
            return
        
        if not self.initialized:
            print("TTS system not initialized. Cannot generate speech.")
            return

        try:
            # Create a temporary file in our dedicated directory
            temp_file_path = os.path.join(self.temp_dir, f'tts_{time.time()}.mp3')
            
            # Generate audio using Google TTS
            tts = gTTS(text=text, lang='en', slow=False)
            tts.save(temp_file_path)
            
            # Add file path to queue for playing
            self.audio_queue.put(temp_file_path)
        except Exception as e:
            print(f"Error generating speech: {str(e)}")

    def _play_audio_queue(self):
        """Process and play audio from the queue."""
        while self.is_running:
            try:
                # Get audio file path from queue with timeout
                audio_file = self.audio_queue.get(timeout=1.0)
                
                if not os.path.exists(audio_file):
                    print(f"Audio file not found: {audio_file}")
                    continue

                try:
                    with self.cleanup_lock:
                        self.current_audio_file = audio_file
                        pygame.mixer.music.load(audio_file)
                    
                    pygame.mixer.music.play()
                    
                    # Wait for audio to finish
                    while pygame.mixer.music.get_busy():
                        if not self.is_running:
                            pygame.mixer.music.stop()
                            break
                        time.sleep(0.1)
                    
                    # Wait a brief moment to ensure the file is released
                    time.sleep(0.1)
                    
                except Exception as e:
                    print(f"Error playing audio: {str(e)}")
                finally:
                    # Clean up temp file after playing
                    try:
                        with self.cleanup_lock:
                            if self.current_audio_file == audio_file:
                                self.current_audio_file = None
                            # Wait a moment before trying to delete
                            time.sleep(0.1)
                            if os.path.exists(audio_file):
                                pygame.mixer.music.unload()
                                time.sleep(0.1)  # Give system time to release the file
                                os.remove(audio_file)
                    except Exception as e:
                        print(f"Error cleaning up temp file: {str(e)}")
                        
            except queue.Empty:
                continue
            except Exception as e:
                print(f"Error in audio playback: {str(e)}")

    def start(self):
        """Start the TTS system."""
        if self.is_running:
            return
        
        self.is_running = True
        self.play_thread = threading.Thread(target=self._play_audio_queue)
        self.play_thread.daemon = True
        self.play_thread.start()

    def stop(self):
        """Stop the TTS system and clean up resources."""
        if not self.is_running:
            return
            
        self.is_running = False
        
        # Stop any playing audio
        if pygame.mixer.get_init() and pygame.mixer.music.get_busy():
            pygame.mixer.music.stop()
        
        if self.play_thread and self.play_thread.is_alive():
            self.play_thread.join(timeout=2.0)  # Wait up to 2 seconds for thread to finish
        
        pygame.mixer.music.unload()
        pygame.mixer.quit()

    def __del__(self):
        """Cleanup when the object is destroyed."""
        self.cleanup_resources()

if __name__ == "__main__":
    # Test the TTS system
    tts = TextToSpeech()
    tts.start()
    
    # Test with various types of text
    test_texts = [
        "Hello! This is a test of the text to speech system.",
        "This is another test of the speech synthesis.",
        "The weather is beautiful today!"
    ]
    
    for text in test_texts:
        print(f"\nGenerating speech for: {text}")
        tts.say(text)
        time.sleep(5)  # Wait for audio to finish
    
    tts.stop()


