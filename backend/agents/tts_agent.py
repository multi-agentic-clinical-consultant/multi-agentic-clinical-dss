import os
from gtts import gTTS
from dotenv import load_dotenv

load_dotenv()

class TTSAgent:
    def __init__(self):
        self.elevenlabs_key = os.getenv("ELEVENLABS_API_KEY")

    def speak(self, text, filename="response.mp3"):
        if self.elevenlabs_key:
            try:
                print("TTSAgent: Generating realistic voice via ElevenLabs...")
                from elevenlabs import ElevenLabs
                client = ElevenLabs(api_key=self.elevenlabs_key)
                
                audio = client.text_to_speech.convert(
                    voice_id="JBFqnCBsd6RMkjVDRZzb", # Default voice ID
                    output_format="mp3_44100_128",
                    text=text,
                    model_id="eleven_multilingual_v2",
                )
                
                with open(filename, "wb") as f:
                    for chunk in audio:
                        f.write(chunk)
                return filename
                
            except Exception as e:
                print(f"ElevenLabs error ({e}). Falling back to gTTS...")
                return self._fallback_gtts(text, filename)
        else:
            print("TTSAgent: No ElevenLabs API Key. Using gTTS...")
            return self._fallback_gtts(text, filename)

    def _fallback_gtts(self, text, filename):
        tts = gTTS(text=text, lang='en')
        tts.save(filename)
        return filename
