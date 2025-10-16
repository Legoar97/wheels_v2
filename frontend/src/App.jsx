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
      
      // ⬅️ CAMBIO: Decidir a dónde navegar según si tiene user_type
      if (profileData && !profileData.user_type) {
        // Primera vez: necesita configurar su tipo preferido
        navigate('userType');
      } else {
        // Ya tiene perfil: ir directo a selección de rol de sesión
        navigate('sessionRoleSelection');
      }
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
      return data; // ⬅️ NUEVO: Retornar los datos
    }
    
    return null;
  };

  const navigate = (screen) => {
    setCurrentScreen(screen);
  };

  const updateAppState = (updates) => {
    setAppState(prev => ({ ...prev, ...updates }));
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