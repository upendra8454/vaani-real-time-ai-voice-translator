import io
import asyncio
import logging
import tempfile
import os
from typing import Optional

logger = logging.getLogger(__name__)


class SpeechEngine:
    WHISPER_LANG_MAP = {
        "en": "en", "hi": "hi", "ta": "ta", "te": "te",
        "bn": "bn", "mr": "mr", "gu": "gu", "kn": "kn",
        "ml": "ml", "pa": "pa", "or": "or", "ur": "ur",
        "as": "en", "mai": "hi", "sa": "hi"
    }
    GTTS_LANG_MAP = {
        "en": "en", "hi": "hi", "ta": "ta", "te": "te",
        "bn": "bn", "mr": "mr", "gu": "gu", "kn": "kn",
        "ml": "ml", "pa": "pa", "or": "or", "ur": "ur",
        "as": "bn", "mai": "hi", "sa": "hi"
    }

    def __init__(self):
        self._whisper_model = None
        self._whisper_loaded = False
        logger.info("SpeechEngine initialized")

    def _load_whisper(self):
        if self._whisper_loaded:
            return self._whisper_model
        try:
            import whisper
            logger.info("Loading Whisper base model...")
            self._whisper_model = whisper.load_model("base")
            self._whisper_loaded = True
            logger.info("Whisper loaded successfully")
            return self._whisper_model
        except Exception as e:
            logger.error(f"Failed to load Whisper: {e}")
            return None

    async def transcribe(self, audio_bytes: bytes, language: str = "en") -> str:
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, self._do_transcribe, audio_bytes, language)
        return result

    def _do_transcribe(self, audio_bytes: bytes, language: str) -> str:
        whisper_lang = self.WHISPER_LANG_MAP.get(language, "en")

        # Try Whisper
        model = self._load_whisper()
        if model:
            try:
                with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as f:
                    f.write(audio_bytes)
                    tmp_path = f.name
                result = model.transcribe(tmp_path, language=whisper_lang, fp16=False)
                os.unlink(tmp_path)
                return result["text"].strip()
            except Exception as e:
                logger.warning(f"Whisper transcription failed: {e}")

        # Fallback: SpeechRecognition
        try:
            import speech_recognition as sr
            recognizer = sr.Recognizer()
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
                f.write(audio_bytes)
                tmp_path = f.name
            with sr.AudioFile(tmp_path) as source:
                audio = recognizer.record(source)
            os.unlink(tmp_path)
            return recognizer.recognize_google(audio, language=f"{language}-IN" if language != "en" else "en-US")
        except Exception as e:
            logger.warning(f"SpeechRecognition fallback failed: {e}")

        return "[Could not transcribe audio]"

    async def synthesize(self, text: str, language: str, speed: float = 1.0) -> bytes:
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, self._do_synthesize, text, language, speed)
        return result

    def _do_synthesize(self, text: str, language: str, speed: float = 1.0) -> bytes:
        gtts_lang = self.GTTS_LANG_MAP.get(language, "en")

        # Try gTTS
        try:
            from gtts import gTTS
            tts = gTTS(text=text, lang=gtts_lang, slow=(speed < 0.8))
            buf = io.BytesIO()
            tts.write_to_fp(buf)
            buf.seek(0)
            return buf.read()
        except Exception as e:
            logger.warning(f"gTTS failed: {e}")

        # Fallback: pyttsx3
        try:
            import pyttsx3
            engine = pyttsx3.init()
            engine.setProperty("rate", int(150 * speed))
            with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f:
                tmp_path = f.name
            engine.save_to_file(text, tmp_path)
            engine.runAndWait()
            with open(tmp_path, "rb") as f:
                data = f.read()
            os.unlink(tmp_path)
            return data
        except Exception as e:
            logger.warning(f"pyttsx3 failed: {e}")

        return b""
