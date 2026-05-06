#!/bin/bash
# Vaani - Quick Start Script

echo "🎙️  Vaani — Real-Time AI Speech Translation"
echo "============================================"

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 not found. Please install Python 3.9+"
    exit 1
fi

cd "$(dirname "$0")"

# Create venv if needed
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

source venv/bin/activate 2>/dev/null || source venv/Scripts/activate 2>/dev/null

echo "📥 Installing dependencies..."
pip install -r backend/requirements.txt -q

echo ""
echo "✅ Setup complete!"
echo "🚀 Starting Vaani server on http://localhost:8000"
echo "   Press Ctrl+C to stop"
echo ""

cd backend
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
