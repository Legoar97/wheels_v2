#!/bin/bash

echo "================================================"
echo "     WHEELS - Setup para Linux/Mac"
echo "     Sistema de Carpooling Universitario"
echo "================================================"
echo ""

# Colores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Función para imprimir con color
print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# [1/5] Verificar Node.js
echo "[1/5] Verificando Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    print_success "Node.js $NODE_VERSION instalado"
else
    print_error "Node.js no está instalado"
    echo "Por favor instala Node.js desde https://nodejs.org/"
    exit 1
fi
echo ""

# [2/5] Verificar Python
echo "[2/5] Verificando Python..."
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version)
    print_success "Python $PYTHON_VERSION instalado"
else
    print_error "Python no está instalado"
    echo "Por favor instala Python desde https://www.python.org/"
    exit 1
fi
echo ""

# [3/5] Instalar dependencias del frontend
echo "[3/5] Instalando dependencias del frontend..."
cd frontend
if npm install; then
    print_success "Dependencias del frontend instaladas"
else
    print_error "Falló la instalación de dependencias del frontend"
    exit 1
fi
cd ..
echo ""

# [4/5] Instalar dependencias del backend
echo "[4/5] Instalando dependencias del backend..."
cd backend
if python3 -m pip install -r requirements.txt; then
    print_success "Dependencias del backend instaladas"
else
    print_error "Falló la instalación de dependencias del backend"
    exit 1
fi
cd ..
echo ""

# [5/5] Verificar archivos .env
echo "[5/5] Verificando archivos de configuración..."
if [ ! -f "frontend/.env" ]; then
    print_warning "frontend/.env no existe"
    echo "Por favor crea el archivo frontend/.env con tus credenciales"
    echo "Puedes usar frontend/.env.example como plantilla"
fi

if [ ! -f "backend/.env" ]; then
    print_warning "backend/.env no existe"
    echo "Por favor crea el archivo backend/.env con tus credenciales"
    echo "Puedes usar backend/.env.example como plantilla"
fi
echo ""

echo "================================================"
print_success "Setup completado exitosamente!"
echo "================================================"
echo ""
echo "Para iniciar la aplicación, ejecuta:"
echo "  ./scripts/start-dev.sh"
echo ""
echo "O manualmente:"
echo "  Terminal 1: cd frontend && npm run dev"
echo "  Terminal 2: cd backend && python3 matchmaking_api.py"
echo "  Terminal 3: cd backend && python3 pickup_optimization_api.py"
echo ""