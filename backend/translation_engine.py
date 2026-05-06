import asyncio
import logging
from typing import Optional, Dict
from functools import lru_cache

try:
    import deep_translator
except ImportError:
    deep_translator = None



logger = logging.getLogger(__name__)


class TranslationEngine:
    LANGUAGES: Dict[str, Dict] = {
        "en": {"name": "English", "native": "English", "gtts_code": "en", "whisper_code": "en"},
        "hi": {"name": "Hindi", "native": "हिन्दी", "gtts_code": "hi", "whisper_code": "hi"},
        "ta": {"name": "Tamil", "native": "தமிழ்", "gtts_code": "ta", "whisper_code": "ta"},
        "te": {"name": "Telugu", "native": "తెలుగు", "gtts_code": "te", "whisper_code": "te"},
        "bn": {"name": "Bengali", "native": "বাংলা", "gtts_code": "bn", "whisper_code": "bn"},
        "mr": {"name": "Marathi", "native": "मराठी", "gtts_code": "mr", "whisper_code": "mr"},
        "gu": {"name": "Gujarati", "native": "ગુજરાતી", "gtts_code": "gu", "whisper_code": "gu"},
        "kn": {"name": "Kannada", "native": "ಕನ್ನಡ", "gtts_code": "kn", "whisper_code": "kn"},
        "ml": {"name": "Malayalam", "native": "മലയാളം", "gtts_code": "ml", "whisper_code": "ml"},
        "pa": {"name": "Punjabi", "native": "ਪੰਜਾਬੀ", "gtts_code": "pa", "whisper_code": "pa"},
        "or": {"name": "Odia", "native": "ଓଡ଼ିଆ", "gtts_code": "or", "whisper_code": "or"},
        "ur": {"name": "Urdu", "native": "اردو", "gtts_code": "ur", "whisper_code": "ur"},
        "as": {"name": "Assamese", "native": "অসমীয়া", "gtts_code": "as", "whisper_code": "en"},
        "mai": {"name": "Maithili", "native": "मैथिली", "gtts_code": "hi", "whisper_code": "hi"},
        "sa": {"name": "Sanskrit", "native": "संस्कृतम्", "gtts_code": "sa", "whisper_code": "hi"},
    }

    def __init__(self):
        self._google_translate = None
        self._init_google()

    def _init_google(self):
        try:
            import deep_translator
            self._google_translate = deep_translator.GoogleTranslator
            logger.info("Google Translate initialized via deep_translator")
        except ImportError:
            logger.warning("deep_translator not available")

    def _map_lang_code(self, code: str) -> str:
        """Map our internal code to Google Translate code"""
        mapping = {
            "or": "or",
            "mai": "hi",  # fallback
            "sa": "sa",
        }
        return mapping.get(code, code)

    async def translate_text(self, text: str, source_lang: str, target_lang: str) -> str:
        if not text.strip():
            return text
        if source_lang == target_lang:
            return text

        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, self._do_translate, text, source_lang, target_lang)
        return result

    def _do_translate(self, text: str, source_lang: str, target_lang: str) -> str:
        src = self._map_lang_code(source_lang)
        tgt = self._map_lang_code(target_lang)

        # Try deep_translator (Google Translate)
        if self._google_translate:
            try:
                translator = self._google_translate(source=src, target=tgt)
                result = translator.translate(text)
                if result:
                    return result
            except Exception as e:
                logger.warning(f"deep_translator failed: {e}")

        # Last resort: return original with note
        return f"[Translation unavailable] {text}"

    def get_language_info(self, code: str) -> Optional[Dict]:
        return self.LANGUAGES.get(code)
