@echo off
echo 🎙️  Vaani — Real-Time AI Speech Translation
echo ============================================

if not exist venv (
    echo 📦 Creating virtual environment...
    python -m venv venv
)

call venv\Scripts\activate

echo 📥 Installing dependencies...
pip install -r backend\requirements.txt -q

echo.
echo ✅ Setup complete!
echo 🚀 Starting Vaani on http://localhost:8000
echo    Press Ctrl+C to stop
echo.

cd backend
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
