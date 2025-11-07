#!/bin/bash
# start-wheels.sh
# Script para iniciar todo el sistema Wheels

echo "🚀 Iniciando Sistema Wheels Carpooling..."
echo "==========================================="

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Función para verificar si un puerto está en uso
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null ; then
        return 0
    else
        return 1
    fi
}

# Verificar dependencias
echo -e "${YELLOW}📋 Verificando dependencias...${NC}"

# Verificar Python
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 no está instalado${NC}"
    exit 1
fi

# Verificar Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js no está instalado${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Todas las dependencias encontradas${NC}\n"

# Verificar puertos disponibles
echo -e "${YELLOW}🔍 Verificando puertos...${NC}"

if check_port 5000; then
    echo -e "${RED}❌ Puerto 5000 (Matchmaking API) ya está en uso${NC}"
    echo "   Por favor, detén el servicio que lo está usando o cambia el puerto"
    exit 1
fi

if check_port 5001; then
    echo -e "${RED}❌ Puerto 5001 (Optimization API) ya está en uso${NC}"
    echo "   Por favor, detén el servicio que lo está usando o cambia el puerto"
    exit 1
fi

if check_port 5173; then
    echo -e "${YELLOW}⚠️  Puerto 5173 (Frontend) ya está en uso${NC}"
    echo "   Se usará otro puerto disponible para el frontend"
fi

echo -e "${GREEN}✅ Puertos verificados${NC}\n"

# Crear directorio de logs si no existe
mkdir -p logs

# Función para iniciar servicio
start_service() {
    local name=$1
    local dir=$2
    local command=$3
    local log_file="logs/${name}.log"
    
    echo -e "${YELLOW}▶️  Iniciando ${name}...${NC}"
    cd $dir
    
    # Instalar dependencias si es necesario
    if [[ $name == *"Backend"* ]]; then
        if [ ! -d "venv" ]; then
            echo "   Creando entorno virtual..."
            python3 -m venv venv
        fi
        source venv/bin/activate
        
        if [ ! -f ".deps_installed" ]; then
            echo "   Instalando dependencias Python..."
            pip install -r requirements.txt --quiet
            touch .deps_installed
        fi
    elif [[ $name == "Frontend" ]]; then
        if [ ! -d "node_modules" ]; then
            echo "   Instalando dependencias Node.js..."
            npm install --silent
        fi
    fi
    
    # Iniciar el servicio
    nohup $command > "../$log_file" 2>&1 &
    local pid=$!
    
    sleep 2
    
    if ps -p $pid > /dev/null; then
        echo -e "${GREEN}✅ ${name} iniciado (PID: $pid)${NC}"
        echo $pid > "../logs/${name}.pid"
    else
        echo -e "${RED}❌ Error al iniciar ${name}${NC}"
        echo "   Ver log en: $log_file"
        return 1
    fi
    
    cd ..
}

# Iniciar Backend - Matchmaking API
start_service "Backend-Matchmaking" "backend" "python3 matchmaking_api.py"

# Iniciar Backend - Optimization API
start_service "Backend-Optimization" "backend" "python3 pickup_optimization_api.py"

# Esperar un poco para que los backends estén listos
sleep 3

# Verificar que los backends estén respondiendo
echo -e "\n${YELLOW}🔍 Verificando servicios backend...${NC}"

# Verificar Matchmaking API
if curl -s http://localhost:5000/health > /dev/null; then
    echo -e "${GREEN}✅ Matchmaking API respondiendo${NC}"
else
    echo -e "${RED}⚠️  Matchmaking API no responde (puede tardar unos segundos más)${NC}"
fi

# Verificar Optimization API
if curl -s http://localhost:5001/health > /dev/null; then
    echo -e "${GREEN}✅ Optimization API respondiendo${NC}"
else
    echo -e "${RED}⚠️  Optimization API no responde (puede tardar unos segundos más)${NC}"
fi

# Iniciar Frontend
echo -e "\n${YELLOW}▶️  Iniciando Frontend...${NC}"
cd frontend
npm run dev &
FRONTEND_PID=$!
echo $FRONTEND_PID > ../logs/Frontend.pid
cd ..

# Mostrar resumen
echo -e "\n${GREEN}==========================================="
echo -e "🎉 Sistema Wheels iniciado exitosamente!"
echo -e "==========================================="
echo -e "${NC}"
echo "📍 URLs de acceso:"
echo "   • Frontend: http://localhost:5173"
echo "   • Matchmaking API: http://localhost:5000"
echo "   • Optimization API: http://localhost:5001"
echo ""
echo "📁 Logs disponibles en:"
echo "   • logs/Backend-Matchmaking.log"
echo "   • logs/Backend-Optimization.log"
echo ""
echo "🛑 Para detener todos los servicios, ejecuta:"
echo "   ./stop-wheels.sh"
echo ""
echo -e "${YELLOW}⏳ El frontend tardará unos segundos en compilar...${NC}"
echo -e "${GREEN}✨ ¡Disfruta usando Wheels!${NC}"