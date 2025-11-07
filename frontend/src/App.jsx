import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Importar componentes
import WelcomeScreen from './components/auth/WelcomeScreen';
import AuthScreen from './components/auth/AuthScreen';
import RegisterScreen from './components/auth/RegisterScreen';
import UserTypeScreen from './components/profile/UserTypeScreen';
import SessionRoleSelection from './components/profile/SessionRoleSelection';
import MainAppScreen from './components/dashboard/MainAppScreen';
import DriverMatchingScreen from './components/matching/DriverMatchingScreen';
import PassengerMatchingScreen from './components/matching/PassengerMatchingScreen';
import LiveTripScreen from './components/trip/LiveTripScreen';
import PassengerLiveTripScreen from './components/trip/PassengerLiveTripScreen';
import HistoryScreen from './components/shared/HistoryScreen';
import TripCompletedScreen from './components/trip/TripCompletedScreen';

// Configuración de Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

const App = () => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [currentScreen, setCurrentScreen] = useState('welcome');
  const [loading, setLoading] = useState(false);

  // Estado global de la aplicación
  const [appState, setAppState] = useState({
    sessionRole: null,
    tripConfig: {
      destination: '',
      pickup: '',
      pickupLat: null,
      pickupLng: null,
      dropoffLat: null,
      dropoffLng: null,
      availableSeats: 3,
      pricePerSeat: 5000,
      maxDetour: 5
    },
    matchedUsers: [],
    acceptedPassengers: [],
    tripStarted: false,
    currentTripId: null
  });

  // Guardar estado en localStorage cuando cambie
  useEffect(() => {
    if (appState.currentTripId) {
      localStorage.setItem('wheelsAppState', JSON.stringify(appState));
    }
  }, [appState]);

  // Verificar sesión al cargar
  useEffect(() => {
    checkSession();

    // Suscribirse a cambios de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          setUser(session.user);
          await loadProfile(session.user.id);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setProfile(null);
          updateAppState({ sessionRole: null });
          localStorage.removeItem('wheelsAppState'); // Limpiar al cerrar sesión
          navigate('welcome');
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const checkSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      setUser(session.user);
      const profileData = await loadProfile(session.user.id);
      
      // Intentar recuperar viaje activo
      await checkActiveTrip(session.user.id);

      // Si no hay viaje activo, decidir a dónde navegar
      if (profileData && !profileData.user_type) {
        navigate('userType');
      } else {
        // Solo navegar a sessionRoleSelection si no hay viaje activo
        const savedState = localStorage.getItem('wheelsAppState');
        if (!savedState) {
          navigate('sessionRoleSelection');
        }
      }
    }
  };

  const checkActiveTrip = async (userId) => {
    try {
      // Intentar recuperar estado del localStorage
      const savedState = localStorage.getItem('wheelsAppState');
      
      if (savedState) {
        const parsedState = JSON.parse(savedState);
        
        // Verificar si el viaje sigue activo en la BD
        const { data: trip, error } = await supabase
          .from('searching_pool')
          .select('*')
          .eq('id', parsedState.currentTripId)
          .single();

        if (!error && trip) {
          // El viaje existe, verificar su estado
          if (trip.status === 'searching') {
            // Viaje buscando match
            setAppState(parsedState);
            navigate(trip.tipo_de_usuario === 'driver' ? 'driverMatching' : 'passengerMatching');
            return true;
          } else if (trip.status === 'matched') {
            // Viaje con match encontrado
            setAppState(parsedState);
            navigate(trip.tipo_de_usuario === 'driver' ? 'liveTrip' : 'passengerLiveTrip');
            return true;
          } else if (trip.status === 'in_progress') {
            // Viaje en progreso
            setAppState(parsedState);
            navigate(trip.tipo_de_usuario === 'driver' ? 'liveTrip' : 'passengerLiveTrip');
            return true;
          } else {
            // Viaje completado o cancelado, limpiar
            localStorage.removeItem('wheelsAppState');
          }
        } else {
          // El viaje no existe en la BD, limpiar
          localStorage.removeItem('wheelsAppState');
        }
      }

      // Si no hay estado guardado, buscar viaje activo directamente en BD
      const { data: activeTrip } = await supabase
        .from('searching_pool')
        .select('*')
        .eq('user_id', userId)
        .in('status', ['searching', 'matched', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (activeTrip) {
        // Hay un viaje activo, restaurar estado
        const restoredState = {
          ...appState,
          currentTripId: activeTrip.id,
          sessionRole: activeTrip.tipo_de_usuario,
          tripConfig: {
            destination: activeTrip.dropoff_address,
            pickup: activeTrip.pickup_address,
            pickupLat: activeTrip.pickup_lat,
            pickupLng: activeTrip.pickup_lng,
            dropoffLat: activeTrip.dropoff_lat,
            dropoffLng: activeTrip.dropoff_lng,
            availableSeats: activeTrip.available_seats || 3,
            pricePerSeat: activeTrip.price_per_seat || 5000,
            maxDetour: activeTrip.max_detour_km || 5
          }
        };
        
        setAppState(restoredState);
        localStorage.setItem('wheelsAppState', JSON.stringify(restoredState));

        // Ir a la pantalla correspondiente
        if (activeTrip.status === 'searching') {
          navigate(activeTrip.tipo_de_usuario === 'driver' ? 'driverMatching' : 'passengerMatching');
        } else if (activeTrip.status === 'matched' || activeTrip.status === 'in_progress') {
          navigate(activeTrip.tipo_de_usuario === 'driver' ? 'liveTrip' : 'passengerLiveTrip');
        }
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error recuperando estado:', error);
      localStorage.removeItem('wheelsAppState');
      return false;
    }
  };

  const loadProfile = async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (data) {
      setProfile(data);
      return data;
    }
    
    return null;
  };

  const navigate = (screen) => {
    setCurrentScreen(screen);
  };

  const updateAppState = (updates) => {
    setAppState(prev => {
      const newState = { ...prev, ...updates };
      
      // Si se está limpiando el viaje, limpiar localStorage
      if (updates.currentTripId === null) {
        localStorage.removeItem('wheelsAppState');
      }
      // Si se está actualizando el currentTripId, guardar en localStorage
      else if (updates.currentTripId) {
        localStorage.setItem('wheelsAppState', JSON.stringify(newState));
      }
      
      return newState;
    });
  };

  // Props comunes para todos los componentes
  const commonProps = {
    user,
    setUser,
    profile,
    setProfile,
    navigate,
    loading,
    setLoading,
    appState,
    updateAppState,
    supabase
  };

  // Renderizado condicional de pantallas
  const renderScreen = () => {
    if (!user) {
      switch (currentScreen) {
        case 'welcome':
          return <WelcomeScreen {...commonProps} />;
        case 'auth':
          return <AuthScreen {...commonProps} />;
        case 'register':
          return <RegisterScreen {...commonProps} />;
        default:
          return <WelcomeScreen {...commonProps} />;
      }
    }

    switch (currentScreen) {
      case 'userType':
        return <UserTypeScreen {...commonProps} />;
      case 'sessionRoleSelection':
        return <SessionRoleSelection {...commonProps} />;
      case 'dashboard':
        return <MainAppScreen {...commonProps} />;
      case 'driverMatching':
        return <DriverMatchingScreen {...commonProps} />;
      case 'passengerMatching':
        return <PassengerMatchingScreen {...commonProps} />;
      case 'liveTrip':
        return <LiveTripScreen {...commonProps} />;
      case 'passengerLiveTrip':
        return <PassengerLiveTripScreen {...commonProps} />;
      case 'tripCompleted':
        return <TripCompletedScreen {...commonProps} />;
      case 'history':
        return <HistoryScreen {...commonProps} />;
      default:
        return <MainAppScreen {...commonProps} />;
    }
  };

  return (
    <div className="font-sans antialiased">
      {renderScreen()}
    </div>
  );
};

export default App;