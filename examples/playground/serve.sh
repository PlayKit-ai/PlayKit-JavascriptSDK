#!/bin/bash

echo "Starting PlayKit SDK Playground..."
echo ""
echo "Open your browser to: http://localhost:8000/examples/playground/"
echo "Press Ctrl+C to stop the server"
echo ""

cd ../..

# Try Python 3 first, then Python 2
if command -v python3 &> /dev/null; then
    python3 -m http.server 8000
elif command -v python &> /dev/null; then
    python -m http.server 8000
else
    echo "Python not found. Please install Python or use another HTTP server."
    exit 1
fi
