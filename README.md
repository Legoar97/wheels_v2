# 🚗 Wheels - Sistema de Carpooling Universitario

Sistema de carpooling inteligente para la Universidad Externado de Colombia que facilita el emparejamiento entre conductores y pasajeros mediante algoritmos de optimización de rutas.

![Wheels Logo](https://via.placeholder.com/800x200/15803d/ffffff?text=Wheels+Carpooling)

## 📋 Tabla de Contenidos

- [Características](#características)
- [Tecnologías](#tecnologías)
- [Requisitos Previos](#requisitos-previos)
- [Instalación](#instalación)
- [Configuración](#configuración)
- [Uso](#uso)
- [Arquitectura](#arquitectura)
- [API Documentation](#api-documentation)
- [Contribuir](#contribuir)
- [Licencia](#licencia)

## ✨ Características

### Para Conductores
- 🚘 Oferta de viajes con configuración de asientos y tarifa
- 🎯 Emparejamiento inteligente con pasajeros compatibles
- 🗺️ Optimización automática de rutas de recogida
- 💰 Gestión de ganancias por viaje
- ⭐ Sistema de calificaciones

### Para Pasajeros
- 🔍 Búsqueda de viajes disponibles
- 📍 Selección de punto de recogida y destino
- ⏱️ Visualización de ETA en tiempo real
- 💳 Información transparente de precios
- ⭐ Calificación de conductores

### Características Generales
- 🔐 Autenticación institucional (@uexternado.edu.co)
- 🌐 Mapas interactivos con Google Maps
- 📊 Historial completo de viajes
- 📈 Estadísticas personalizadas
- 🔔 Notificaciones en tiempo real
- 📱 Diseño responsive mobile-first

## 🛠️ Tecnologías

### Frontend
- **React 18** - Framework de UI
- **Vite** - Build tool y dev server
- **Tailwind CSS** - Framework de estilos
- **Framer Motion** - Animaciones
- **Supabase Client** - Cliente de base de datos y auth
- **Lucide React** - Iconos

### Backend
- **Python 3.11+** - Lenguaje de programación
- **Flask** - Framework web
- **Supabase** - BaaS (Base de datos + Auth)
- **PostgreSQL** - Base de datos relacional
- **Pandas** - Procesamiento de datos
- **GeoPy** - Cálculos geoespaciales
- **Google Maps API** - Mapas y direcciones

## 📦 Requisitos Previos

Antes de comenzar, asegúrate de tener instalado:

- **Node.js** 18.x o superior - [Descargar](https://nodejs.org/)
- **Python** 3.11 o superior - [Descargar](https://www.python.org/)
- **npm** o **yarn** - Incluido con Node.js
- **pip** - Incluido con Python
- **Git** - [Descargar](https://git-scm.com/)

## 🚀 Instalación

### 1. Clonar el repositorio

```bash
git clone https://github.com/tu-usuario/wheels.git
cd wheels
```

### 2. Ejecutar script de setup

#### En Windows:
```bash
scripts\setup.bat
```

#### En Linux/Mac:
```bash
chmod +x scripts/setup.sh
./scripts/setup.sh
```

### 3. Configuración manual (alternativa)

Si prefieres configurar manualmente:

```bash
# Instalar dependencias del frontend
cd frontend
npm install
cd ..

# Instalar dependencias del backend
cd backend
pip install -r requirements.txt
cd ..
```

## ⚙️ Configuración

### 1. Variables de Entorno - Frontend

Crea un archivo `frontend/.env`:

```env
VITE_SUPABASE_URL=tu_supabase_url
VITE_SUPABASE_ANON_KEY=tu_supabase_anon_key
VITE_GOOGLE_MAPS_API_KEY=tu_google_maps_api_key
VITE_MATCHMAKING_API_URL=http://localhost:5000
VITE_OPTIMIZATION_API_URL=http://localhost:5001
```

### 2. Variables de Entorno - Backend

Crea un archivo `backend/.env`:

```env
SUPABASE_URL=tu_supabase_url
SUPABASE_KEY=tu_supabase_service_role_key
GOOGLE_MAPS_API_KEY=tu_google_maps_api_key
MATCHMAKING_PORT=5000
OPTIMIZATION_PORT=5001
MAX_DISTANCE_KM=5
MAX_DETOUR_KM=3
```

### 3. Configurar Base de Datos en Supabase

1. Crea una cuenta en [Supabase](https://supabase.com)
2. Crea un nuevo proyecto
3. Ejecuta el script `database/schema.sql` en el SQL Editor de Supabase
4. Copia las credenciales (URL y Keys) a los archivos `.env`

### 4. Obtener API Key de Google Maps

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Habilita las siguientes APIs:
   - Maps JavaScript API
   - Places API
   - Distance Matrix API
   - Directions API
4. Crea credenciales (API Key)
5. Copia la API Key a los archivos `.env`

## 🎮 Uso

### Iniciar en Modo Desarrollo

#### Opción 1: Script automático (Recomendado)

**Windows:**
```bash
scripts\start-dev.bat
```

**Linux/Mac:**
```bash
chmod +x scripts/start-dev.sh
./scripts/start-dev.sh
```

#### Opción 2: Manual

Abre 3 terminales diferentes:

**Terminal 1 - Frontend:**
```bash
cd frontend
npm run dev
```

**Terminal 2 - Matchmaking API:**
```bash
cd backend
python matchmaking_api.py
```

**Terminal 3 - Optimization API:**
```bash
cd backend
python pickup_optimization_api.py
```

### Acceder a la Aplicación

- **Frontend:** http://localhost:3000
- **Matchmaking API:** http://localhost:5000
- **Optimization API:** http://localhost:5001

### Crear Primera Cuenta

1. Abre http://localhost:3000
2. Click en "Registrarse"
3. Usa tu correo institucional: `nombre@uexternado.edu.co`
4. Verifica tu correo (revisa spam/junk)
5. Inicia sesión
6. Selecciona tu rol (Conductor o Pasajero)

## 🏗️ Arquitectura

```
┌─────────────────┐
│   React App         │                  │
         ▼                  ▼
┌─────────────────┐  ┌─────────────────┐
│  Matchmaking    │  │  Optimization   │
│  API (Flask)    │  │  API (Flask)    │
│  Puerto 5000    │  │  Puerto 5001    │
└────────┬────────┘  └────────┬────────┘
         │                    │
         └──────────┬─────────┘
                    │
                    ▼
         ┌──────────────────┐
         │    Supabase      │
         │  (PostgreSQL +   │
         │   Auth + RT)     │
         └──────────────────┘
```

### Flujo de Datos

1. **Usuario se registra/inicia sesión** → Supabase Auth
2. **Usuario crea solicitud de viaje** → Supabase DB (searching_pool)
3. **Sistema busca matches** → Matchmaking API
4. **Conductor acepta pasajeros** → Supabase DB (driver_acceptances)
5. **Sistema optimiza ruta** → Optimization API
6. **Viaje inicia** → Supabase DB (start_of_trip)
7. **Viaje finaliza** → Supabase DB (successful_trips)

## 📡 API Documentation

### Matchmaking API (Puerto 5000)

#### POST /api/matchmaking
Encuentra matches compatibles para conductores o pasajeros.

**Request:**
```json
{
  "user_type": "driver",
  "pickup_lat": 4.6486,
  "pickup_lng": -74.0991,
  "dropoff_lat": 4.6097,
  "dropoff_lng": -74.0817,
  "available_seats": 3,
  "price_per_seat": 5000
}
```

**Response:**
```json
{
  "success": true,
  "matches": [
    {
      "passenger_id": "uuid",
      "pickup_address": "Calle 100 #15-20",
      "compatibility_score": 95.5
    }
  ],
  "count": 1
}
```

#### GET /api/matchmaking/status
Verifica el estado del servicio y usuarios activos.

**Response:**
```json
{
  "status": "online",
  "active_drivers": 5,
  "active_passengers": 12,
  "timestamp": "2025-01-15T10:30:00Z"
}
```

### Optimization API (Puerto 5001)

#### POST /api/optimize-route
Optimiza el orden de recogida de pasajeros.

**Request:**
```json
{
  "start_point": {"lat": 4.6486, "lng": -74.0991},
  "destination": {"lat": 4.6097, "lng": -74.0817},
  "passengers": [
    {
      "id": "1",
      "pickup_lat": 4.6550,
      "pickup_lng": -74.1010,
      "pickup_address": "Calle 127 #52-30"
    }
  ],
  "use_google_maps": true
}
```

**Response:**
```json
{
  "success": true,
  "optimized_route": [
    {
      "id": "1",
      "pickup_order": 1,
      "distance_from_previous": 2.3
    }
  ],
  "total_distance_km": 8.5,
  "estimated_time_minutes": 25
}
```

#### POST /api/optimize-route/calculate-detour
Calcula la desviación al agregar un nuevo pasajero.

**Response:**
```json
{
  "success": true,
  "original_distance_km": 5.2,
  "new_distance_km": 7.8,
  "detour_km": 2.6,
  "detour_percentage": 50.0
}
```

## 📁 Estructura del Proyecto

```
wheels/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── auth/
│   │   │   │   ├── WelcomeScreen.jsx
│   │   │   │   ├── AuthScreen.jsx
│   │   │   │   └── RegisterScreen.jsx
│   │   │   ├── dashboard/
│   │   │   │   ├── MainAppScreen.jsx
│   │   │   │   ├── DriverSection.jsx
│   │   │   │   └── PassengerSection.jsx
│   │   │   ├── matching/
│   │   │   │   ├── MatchmakingScreen.jsx
│   │   │   │   └── DriverMatchingScreen.jsx
│   │   │   ├── trip/
│   │   │   │   └── LiveTripScreen.jsx
│   │   │   └── shared/
│   │   │       ├── Header.jsx
│   │   │       └── HistoryScreen.jsx
│   │   ├── services/
│   │   │   ├── supabaseClient.js
│   │   │   ├── authService.js
│   │   │   └── tripService.js
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── .env
│   ├── package.json
│   └── vite.config.js
├── backend/
│   ├── matchmaking_api.py
│   ├── pickup_optimization_api.py
│   ├── requirements.txt
│   └── .env
├── database/
│   └── schema.sql
├── scripts/
│   ├── setup.bat
│   ├── setup.sh
│   ├── start-dev.bat
│   └── start-dev.sh
└── README.md
```

## 🧪 Testing

### Probar APIs manualmente

**Matchmaking API:**
```bash
curl -X POST http://localhost:5000/api/matchmaking \
  -H "Content-Type: application/json" \
  -d '{
    "user_type": "driver",
    "pickup_lat": 4.6486,
    "pickup_lng": -74.0991,
    "dropoff_lat": 4.6097,
    "dropoff_lng": -74.0817
  }'
```

**Optimization API:**
```bash
curl http://localhost:5001/api/optimize-route/status
```

## 🐛 Troubleshooting

### Frontend no inicia

**Error:** `Module not found`
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### Backend no inicia

**Error:** `ModuleNotFoundError`
```bash
cd backend
pip install -r requirements.txt --force-reinstall
```

### Error de conexión con Supabase

1. Verifica que las URLs y keys en `.env` sean correctas
2. Verifica que el proyecto de Supabase esté activo
3. Revisa que las políticas RLS estén configuradas correctamente

### Google Maps no carga

1. Verifica que la API Key sea válida
2. Asegúrate de haber habilitado todas las APIs necesarias
3. Verifica que la billing esté configurada en Google Cloud

### Puerto ya en uso

**Error:** `Address already in use`

**Windows:**
```bash
# Ver qué proceso usa el puerto
netstat -ano | findstr :3000
# Matar el proceso
taskkill /PID <PID> /F
```

**Linux/Mac:**
```bash
# Ver qué proceso usa el puerto
lsof -i :3000
# Matar el proceso
kill -9 <PID>
```

## 📊 Base de Datos

### Tablas Principales

1. **profiles** - Información de usuarios
2. **searching_pool** - Pool de búsqueda activa
3. **confirmed_trips** - Viajes confirmados
4. **driver_acceptances** - Aceptaciones de conductores
5. **start_of_trip** - Inicios de viaje
6. **successful_trips** - Viajes completados

### Ejecutar Schema

En Supabase SQL Editor:
```sql
-- Copiar y pegar el contenido de database/schema.sql
```

## 🔐 Seguridad

- ✅ Row Level Security (RLS) habilitado en todas las tablas
- ✅ Autenticación JWT con Supabase Auth
- ✅ Validación de correo institucional
- ✅ Variables de entorno para secretos
- ✅ CORS configurado correctamente
- ✅ Políticas de privacidad por usuario

## 🚀 Deployment

### Frontend (Vercel/Netlify)

1. Conecta tu repositorio
2. Configura build command: `cd frontend && npm run build`
3. Configura output directory: `frontend/dist`
4. Agrega variables de entorno

### Backend (Railway/Render)

1. Crea dos servicios (uno para cada API)
2. Configura start commands:
   - Matchmaking: `python matchmaking_api.py`
   - Optimization: `python pickup_optimization_api.py`
3. Agrega variables de entorno
4. Actualiza URLs en frontend `.env`

## 📝 Tareas Futuras

- [ ] Implementar chat en tiempo real entre usuarios
- [ ] Sistema de pagos integrado
- [ ] Notificaciones push móviles
- [ ] App móvil nativa (React Native)
- [ ] Dashboard administrativo
- [ ] Analytics y reportes
- [ ] Sistema de verificación de identidad
- [ ] Integración con calendario universitario

## 🤝 Contribuir

Las contribuciones son bienvenidas! Para contribuir:

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para más detalles.

## 👥 Autores

- **Universidad Externado de Colombia** - Desarrollo inicial

## 📧 Contacto

Para soporte o preguntas:
- Email: soporte@wheels.uexternado.edu.co
- Web: https://wheels.uexternado.edu.co

## 🙏 Agradecimientos

- Universidad Externado de Colombia
- Comunidad de desarrolladores
- Usuarios beta testers

---

Hecho con ❤️ para la comunidad de Universidad Externado 🎓 │  ← Frontend (Puerto 3000)
│   (Vite + React)│
└────────┬────────┘
         │
         ├──────────────────┐
         │                  │