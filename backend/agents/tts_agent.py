from gtts import gTTS

class TTSAgent:
    def speak(self, text, filename="response.mp3"):
        tts = gTTS(text=text, lang='en')
        tts.save(filename)
        return filename
