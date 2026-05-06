FROM python:3.11-slim

WORKDIR /app

# System deps for audio
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libsndfile1 \
    espeak \
    portaudio19-dev \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/
COPY frontend/ ./frontend/

WORKDIR /app/backend

EXPOSE 8000

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
