@echo off
title Vibe MyBooks
echo.
echo  ╔══════════════════════════════════════╗
echo  ║         Vibe MyBooks Launcher           ║
echo  ╚══════════════════════════════════════╝
echo.

:: Check if Docker is running
docker info >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Starting Docker Desktop...
    start "" "%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
    echo Waiting for Docker to start...
    :waitloop
    timeout /t 5 /nobreak >nul
    docker info >nul 2>&1
    if %ERRORLEVEL% NEQ 0 goto waitloop
    echo Docker is ready.
)

:: Start containers
echo Starting Vibe MyBooks...
cd /d "%~dp0"
docker compose -f docker-compose.prod.yml up -d

:: Wait for health check
echo Waiting for app to be ready...
:healthloop
timeout /t 3 /nobreak >nul
curl -s http://localhost:3001/health >nul 2>&1
if %ERRORLEVEL% NEQ 0 goto healthloop

echo.
echo  Vibe MyBooks is running!
echo  Opening browser...
echo.
start http://localhost:3001

echo  ─────────────────────────────────────
echo  Press any key to STOP Vibe MyBooks
echo  (or just close this window to keep it running)
echo  ─────────────────────────────────────
pause >nul

:: Stop containers
echo Stopping Vibe MyBooks...
docker compose down
echo Stopped.
timeout /t 3
