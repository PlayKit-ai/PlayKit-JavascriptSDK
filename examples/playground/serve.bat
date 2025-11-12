@echo off
echo Starting PlayKit SDK Playground...
echo.
echo Open your browser to: http://localhost:8000/examples/playground/
echo Press Ctrl+C to stop the server
echo.

cd ..\..
python -m http.server 8000
