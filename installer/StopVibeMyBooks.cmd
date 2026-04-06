@echo off
title Stop Vibe MyBooks
echo Stopping Vibe MyBooks...
cd /d "%~dp0"
docker compose -f docker-compose.prod.yml down
echo.
echo Vibe MyBooks has been stopped.
timeout /t 3
