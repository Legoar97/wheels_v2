@echo off
echo ================================================
echo     WHEELS - Iniciando Servidor de Desarrollo
echo ================================================
echo.

REM Iniciar backend en una nueva ventana
echo Iniciando Backend APIs...
start "Wheels Backend - Matchmaking API" cmd /k "cd backend && python matchmaking_api.py"
timeout /t 2 /nobreak >nul
start "Wheels Backend - Optimization API" cmd /k "cd backend && python pickup_optimization_api.py"
timeout /t 2 /nobreak >nul

REM Iniciar frontend
echo Iniciando Frontend...
timeout /t 3 /nobreak >nul
cd frontend
start "Wheels Frontend" cmd /k "npm run dev"

echo.
echo ================================================
echo ✓ Servidores iniciados!
echo ================================================
echo.
echo Frontend:           http://localhost:3000
echo Matchmaking API:    http://localhost:5000
echo Optimization API:   http://localhost:5001
echo.
echo Para detener los servidores, cierra todas las ventanas
echo.