import os
import io
import asyncio
import logging
import tempfile
import traceback
from typing import Optional

try:
    from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, UploadFile, File, Form  # type: ignore[import]
    from fastapi.middleware.cors import CORSMiddleware  # type: ignore[import]
    from fastapi.staticfiles import StaticFiles  # type: ignore[import]
    from fastapi.responses import FileResponse, JSONResponse, StreamingResponse  # type: ignore[import]
except ImportError as e:
    raise ImportError(
        "FastAPI is required to run this application. Install it with `pip install fastapi`."
    ) from e
from pydantic import BaseModel  # type: ignore[import]

from translation_engine import TranslationEngine
from speech_engine import SpeechEngine

try:
    import uvicorn  # type: ignore[import]
except ImportError as e:
    raise ImportError(
        "uvicorn is required to run this application. Install it with `pip install uvicorn`."
    ) from e

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Vaani - Real-Time AI Speech Translation", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount frontend static files
frontend_path = os.path.join(os.path.dirname(__file__), "..", "frontend")
static_path = os.path.join(frontend_path, "static")
if os.path.exists(static_path):
    app.mount("/static", StaticFiles(directory=static_path), name="static")

# Initialize engines
translation_engine = TranslationEngine()
speech_engine = SpeechEngine()


class TextTranslationRequest(BaseModel):
    text: str
    source_lang: str
    target_lang: str


class TTSRequest(BaseModel):
    text: str
    language: str
    voice_speed: Optional[float] = 1.0


@app.get("/")
async def root():
    index_path = os.path.join(frontend_path, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "Vaani API running. Frontend not found."}


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "supported_languages": list(translation_engine.LANGUAGES.keys()),
        "engines": {
            "translation": "Helsinki-NLP / Google Translate fallback",
            "stt": "OpenAI Whisper",
            "tts": "gTTS / pyttsx3"
        }
    }


@app.get("/languages")
async def get_languages():
    return {
        "languages": translation_engine.LANGUAGES,
        "default": "en"
    }


@app.post("/translate/text")
async def translate_text(req: TextTranslationRequest):
    try:
        result = await translation_engine.translate_text(req.text, req.source_lang, req.target_lang)
        return {"translated_text": result, "source_lang": req.source_lang, "target_lang": req.target_lang}
    except Exception as e:
        logger.error(f"Translation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/translate/speech-to-text")
async def speech_to_text(
    audio: UploadFile = File(...),
    source_lang: str = Form("en")
):
    try:
        audio_bytes = await audio.read()
        transcript = await speech_engine.transcribe(audio_bytes, source_lang)
        return {"transcript": transcript, "language": source_lang}
    except Exception as e:
        logger.error(f"STT error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/translate/text-to-speech")
async def text_to_speech(req: TTSRequest):
    try:
        audio_bytes = await speech_engine.synthesize(req.text, req.language, req.voice_speed)
        return StreamingResponse(
            io.BytesIO(audio_bytes),
            media_type="audio/mpeg",
            headers={"Content-Disposition": "attachment; filename=speech.mp3"}
        )
    except Exception as e:
        logger.error(f"TTS error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/translate/speech-to-speech")
async def speech_to_speech(
    audio: UploadFile = File(...),
    source_lang: str = Form("en"),
    target_lang: str = Form("hi")
):
    try:
        audio_bytes = await audio.read()
        # STT
        transcript = await speech_engine.transcribe(audio_bytes, source_lang)
        # Translate
        translated = await translation_engine.translate_text(transcript, source_lang, target_lang)
        # TTS
        output_audio = await speech_engine.synthesize(translated, target_lang)
        return JSONResponse({
            "transcript": transcript,
            "translated_text": translated,
            "source_lang": source_lang,
            "target_lang": target_lang,
            "audio_available": True
        })
    except Exception as e:
        logger.error(f"S2S error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.websocket("/ws/translate")
async def websocket_translate(websocket: WebSocket):
    await websocket.accept()
    logger.info("WebSocket connection established")
    try:
        while True:
            data = await websocket.receive_json()
            mode = data.get("mode", "text")

            if mode == "text":
                text = data.get("text", "")
                source_lang = data.get("source_lang", "en")
                target_lang = data.get("target_lang", "hi")
                result = await translation_engine.translate_text(text, source_lang, target_lang)
                await websocket.send_json({
                    "type": "translation",
                    "original": text,
                    "translated": result,
                    "source_lang": source_lang,
                    "target_lang": target_lang
                })

            elif mode == "ping":
                await websocket.send_json({"type": "pong"})

    except WebSocketDisconnect:
        pass

if __name__ == "__main__":
    try:
        import uvicorn  # type: ignore[import]
        uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
    except ImportError as e:
        raise ImportError(
            "uvicorn is required to run this application. Install it with `pip install uvicorn`."
        ) from e
