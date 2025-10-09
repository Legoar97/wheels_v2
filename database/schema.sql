-- WHEELS Database Schema
-- Sistema de Carpooling Universidad Externado
-- PostgreSQL + Supabase

-- =============================================
-- Tabla: profiles
-- Descripción: Información de usuarios del sistema
-- =============================================
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255),
    user_type VARCHAR(20) CHECK (user_type IN ('driver', 'passenger')),
    phone_number VARCHAR(20),
    profile_picture_url TEXT,
    
    -- Métricas de usuario
    total_trips INTEGER DEFAULT 0,
    completed_trips INTEGER DEFAULT 0,
    cancelled_trips INTEGER DEFAULT 0,
    rating DECIMAL(3,2) DEFAULT 5.0,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@(uexternado\.edu\.co|est\.uexternado\.edu\.co)$')
);

-- Índices para profiles
CREATE INDEX idx_profiles_user_id ON profiles(user_id);
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_user_type ON profiles(user_type);

-- =============================================
-- Tabla: searching_pool
-- Descripción: Pool de búsqueda activa de viajes
-- =============================================
CREATE TABLE IF NOT EXISTS searching_pool (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    tipo_de_usuario VARCHAR(20) NOT NULL CHECK (tipo_de_usuario IN ('driver', 'passenger')),
    
    -- Ubicaciones
    pickup_address TEXT NOT NULL,
    dropoff_address TEXT NOT NULL,
    pickup_lat DECIMAL(10, 8),
    pickup_lng DECIMAL(11, 8),
    dropoff_lat DECIMAL(10, 8),
    dropoff_lng DECIMAL(11, 8),
    
    -- Configuración de viaje
    available_seats INTEGER CHECK (available_seats > 0 AND available_seats <= 4),
    price_per_seat INTEGER CHECK (price_per_seat >= 0),
    max_detour_km DECIMAL(5, 2) DEFAULT 5.0,
    requested_time TIME,
    
    -- Estado
    status VARCHAR(20) DEFAULT 'searching' CHECK (status IN ('searching', 'matched', 'completed', 'cancelled')),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para searching_pool
CREATE INDEX idx_searching_pool_user_id ON searching_pool(user_id);
CREATE INDEX idx_searching_pool_tipo ON searching_pool(tipo_de_usuario);
CREATE INDEX idx_searching_pool_status ON searching_pool(status);
CREATE INDEX idx_searching_pool_coords ON searching_pool(pickup_lat, pickup_lng, dropoff_lat, dropoff_lng);

-- =============================================
-- Tabla: confirmed_trips
-- Descripción: Viajes confirmados entre conductor y pasajeros
-- =============================================
CREATE TABLE IF NOT EXISTS confirmed_trips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Información del viaje
    pickup_address TEXT NOT NULL,
    dropoff_address TEXT NOT NULL,
    pickup_lat DECIMAL(10, 8),
    pickup_lng DECIMAL(11, 8),
    dropoff_lat DECIMAL(10, 8),
    dropoff_lng DECIMAL(11, 8),
    
    -- Detalles
    total_passengers INTEGER DEFAULT 0,
    price_per_seat INTEGER,
    total_price INTEGER,
    
    -- Estado
    status VARCHAR(20) DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'in_progress', 'completed', 'cancelled')),
    
    -- Timestamps
    scheduled_time TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para confirmed_trips
CREATE INDEX idx_confirmed_trips_driver ON confirmed_trips(driver_id);
CREATE INDEX idx_confirmed_trips_status ON confirmed_trips(status);
CREATE INDEX idx_confirmed_trips_scheduled ON confirmed_trips(scheduled_time);

-- =============================================
-- Tabla: driver_acceptances
-- Descripción: Registro de pasajeros aceptados por conductores
-- =============================================
CREATE TABLE IF NOT EXISTS driver_acceptances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    passenger_email VARCHAR(255) NOT NULL,
    trip_id UUID REFERENCES confirmed_trips(id) ON DELETE CASCADE,
    
    -- Información del viaje (JSON flexible)
    trip_info JSONB,
    
    -- Estado
    acceptance_status VARCHAR(20) DEFAULT 'accepted' CHECK (acceptance_status IN ('accepted', 'confirmed', 'completed', 'cancelled')),
    
    -- Timestamps
    accepted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para driver_acceptances
CREATE INDEX idx_driver_acceptances_driver ON driver_acceptances(driver_id);
CREATE INDEX idx_driver_acceptances_passenger ON driver_acceptances(passenger_email);
CREATE INDEX idx_driver_acceptances_trip ON driver_acceptances(trip_id);
CREATE INDEX idx_driver_acceptances_trip_info ON driver_acceptances USING GIN (trip_info);

-- =============================================
-- Tabla: start_of_trip
-- Descripción: Registro de inicio de viajes
-- =============================================
CREATE TABLE IF NOT EXISTS start_of_trip (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    trip_id UUID REFERENCES confirmed_trips(id) ON DELETE CASCADE,
    
    -- Ubicación de inicio
    start_lat DECIMAL(10, 8),
    start_lng DECIMAL(11, 8),
    
    -- Estado
    status VARCHAR(20) DEFAULT 'started' CHECK (status IN ('started', 'in_progress', 'completed')),
    
    -- Timestamps
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para start_of_trip
CREATE INDEX idx_start_of_trip_driver ON start_of_trip(driver_id);
CREATE INDEX idx_start_of_trip_trip ON start_of_trip(trip_id);
CREATE INDEX idx_start_of_trip_status ON start_of_trip(status);

-- =============================================
-- Tabla: successful_trips
-- Descripción: Registro de viajes completados exitosamente
-- =============================================
CREATE TABLE IF NOT EXISTS successful_trips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    trip_id UUID REFERENCES confirmed_trips(id) ON DELETE CASCADE,
    
    -- Detalles del viaje completado
    total_distance_km DECIMAL(8, 2),
    total_duration_minutes INTEGER,
    total_passengers INTEGER,
    total_earnings INTEGER,
    
    -- Calificaciones
    driver_rating DECIMAL(3, 2),
    passenger_ratings JSONB,
    
    -- Información adicional
    trip_summary JSONB,
    
    -- Timestamps
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para successful_trips
CREATE INDEX idx_successful_trips_driver ON successful_trips(driver_id);
CREATE INDEX idx_successful_trips_trip ON successful_trips(trip_id);
CREATE INDEX idx_successful_trips_completed ON successful_trips(completed_at);

-- =============================================
-- Triggers para actualizar updated_at
-- =============================================

-- Función para actualizar timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_searching_pool_updated_at BEFORE UPDATE ON searching_pool
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_confirmed_trips_updated_at BEFORE UPDATE ON confirmed_trips
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- Row Level Security (RLS) Policies
-- =============================================

-- Habilitar RLS en todas las tablas
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE searching_pool ENABLE ROW LEVEL SECURITY;
ALTER TABLE confirmed_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_acceptances ENABLE ROW LEVEL SECURITY;
ALTER TABLE start_of_trip ENABLE ROW LEVEL SECURITY;
ALTER TABLE successful_trips ENABLE ROW LEVEL SECURITY;

-- Políticas para profiles
CREATE POLICY "Los usuarios pueden ver su propio perfil"
    ON profiles FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden actualizar su propio perfil"
    ON profiles FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden insertar su propio perfil"
    ON profiles FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Políticas para searching_pool
CREATE POLICY "Los usuarios pueden ver sus propias búsquedas"
    ON searching_pool FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden ver búsquedas de otros para matchmaking"
    ON searching_pool FOR SELECT
    USING (true);

CREATE POLICY "Los usuarios pueden insertar sus búsquedas"
    ON searching_pool FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden actualizar sus búsquedas"
    ON searching_pool FOR UPDATE
    USING (auth.uid() = user_id);

-- Políticas para confirmed_trips
CREATE POLICY "Los conductores pueden ver sus viajes"
    ON confirmed_trips FOR SELECT
    USING (auth.uid() = driver_id);

CREATE POLICY "Los conductores pueden crear viajes"
    ON confirmed_trips FOR INSERT
    WITH CHECK (auth.uid() = driver_id);

CREATE POLICY "Los conductores pueden actualizar sus viajes"
    ON confirmed_trips FOR UPDATE
    USING (auth.uid() = driver_id);

-- Políticas para driver_acceptances
CREATE POLICY "Los conductores pueden ver sus aceptaciones"
    ON driver_acceptances FOR SELECT
    USING (auth.uid() = driver_id);

CREATE POLICY "Los conductores pueden insertar aceptaciones"
    ON driver_acceptances FOR INSERT
    WITH CHECK (auth.uid() = driver_id);

-- Políticas para start_of_trip
CREATE POLICY "Los conductores pueden ver sus inicios de viaje"
    ON start_of_trip FOR SELECT
    USING (auth.uid() = driver_id);

CREATE POLICY "Los conductores pueden registrar inicio de viaje"
    ON start_of_trip FOR INSERT
    WITH CHECK (auth.uid() = driver_id);

-- Políticas para successful_trips
CREATE POLICY "Los usuarios pueden ver sus viajes exitosos"
    ON successful_trips FOR SELECT
    USING (auth.uid() = driver_id);

CREATE POLICY "Los conductores pueden registrar viajes exitosos"
    ON successful_trips FOR INSERT
    WITH CHECK (auth.uid() = driver_id);