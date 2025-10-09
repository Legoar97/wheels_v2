@echo off
echo ================================================
echo     WHEELS - Setup para Windows
echo     Sistema de Carpooling Universitario
echo ================================================
echo.

REM Verificar Node.js
echo [1/5] Verificando Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js no esta instalado
    echo Por favor instala Node.js desde https://nodejs.org/
    pause
    exit /b 1
)
echo ✓ Node.js instalado
echo.

REM Verificar Python
echo [2/5] Verificando Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Python no esta instalado
    echo Por favor instala Python desde https://www.python.org/
    pause
    exit /b 1
)
echo ✓ Python instalado
echo.

REM Instalar dependencias del frontend
echo [3/5] Instalando dependencias del frontend...
cd frontend
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Fallo la instalacion de dependencias del frontend
    pause
    exit /b 1
)
cd ..
echo ✓ Dependencias del frontend instaladas
echo.

REM Instalar dependencias del backend
echo [4/5] Instalando dependencias del backend...
cd backend
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo ERROR: Fallo la instalacion de dependencias del backend
    pause
    exit /b 1
)
cd ..
echo ✓ Dependencias del backend instaladas
echo.

REM Verificar archivos .env
echo [5/5] Verificando archivos de configuracion...
if not exist "frontend\.env" (
    echo WARNING: frontend/.env no existe
    echo Por favor crea el archivo frontend/.env con tus credenciales
)
if not exist "backend\.env" (
    echo WARNING: backend/.env no existe
    echo Por favor crea el archivo backend/.env con tus credenciales
)
echo.

echo ================================================
echo ✓ Setup completado exitosamente!
echo ================================================
echo.
echo Para iniciar la aplicacion, ejecuta:
echo   scripts\start-dev.bat
echo.
pause