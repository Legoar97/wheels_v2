import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import StateRecoveryService from './services/StateRecoveryService';

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
  const [isRecoveringState, setIsRecoveringState] = useState(true);
  const [recoveryError, setRecoveryError] = useState(null);

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
    currentTripId: null,
    driverId: null
  });

  // Guardar estado en localStorage cuando cambie
  useEffect(() => {
    if (appState.currentTripId && appState.sessionRole) {
      console.log('💾 Guardando estado en localStorage...');
      try {
        if (appState.sessionRole === 'driver') {
          StateRecoveryService.saveDriverState({
            currentTripId: appState.currentTripId,
            sessionRole: appState.sessionRole,
            tripConfig: appState.tripConfig,
            acceptedPassengers: appState.acceptedPassengers,
            tripStarted: appState.tripStarted
          });
        } else if (appState.sessionRole === 'passenger') {
          StateRecoveryService.savePassengerState({
            currentTripId: appState.currentTripId,
            sessionRole: appState.sessionRole,
            driverId: appState.driverId
          });
        }
      } catch (error) {
        console.error('Error guardando estado:', error);
      }
    }
  }, [appState.currentTripId, appState.sessionRole, appState.acceptedPassengers, appState.tripStarted]);

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
          handleSignOut();
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const checkSession = async () => {
    setIsRecoveringState(true);
    setRecoveryError(null);
    
    try {
      // Timeout de 10 segundos
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 10000)
      );

      const sessionPromise = supabase.auth.getSession();
      
      const { data: { session } } = await Promise.race([sessionPromise, timeoutPromise]);
      
      if (session) {
        setUser(session.user);
        const profileData = await loadProfile(session.user.id);
        
        if (profileData) {
          // Intentar recuperar estado de viaje activo con timeout
          const recoverPromise = recoverActiveTrip(session.user.id, profileData);
          const recovered = await Promise.race([
            recoverPromise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('Recovery timeout')), 8000))
          ]).catch(error => {
            console.error('Error o timeout recuperando viaje:', error);
            return false;
          });
          
          if (!recovered) {
            // No hay viaje activo, decidir navegación normal
            if (!profileData.user_type) {
              navigate('userType');
            } else {
              navigate('sessionRoleSelection');
            }
          }
        }
      } else {
        navigate('welcome');
      }
    } catch (error) {
      console.error('❌ Error en checkSession:', error);
      setRecoveryError(error.message);
      // Si hay error, ir a welcome
      navigate('welcome');
    } finally {
      setIsRecoveringState(false);
    }
  };

  // Recuperar viaje activo
  const recoverActiveTrip = async (userId, profileData) => {
    try {
      console.log('🔍 Buscando viajes activos...');
      
      // Buscar viajes como conductor
      const driverState = await StateRecoveryService.recoverDriverState(supabase, userId);
      if (driverState) {
        console.log('✅ Viaje de conductor recuperado:', driverState);
        
        // Restaurar estado completo
        updateAppState({
          sessionRole: 'driver',
          currentTripId: driverState.currentTripId,
          tripConfig: driverState.tripConfig || appState.tripConfig,
          acceptedPassengers: driverState.acceptedPassengers || [],
          tripStarted: driverState.status === 'in_progress'
        });
        
        // Navegar a la pantalla correcta
        navigate(driverState.screen);
        return true;
      }

      // Buscar viajes como pasajero
      const passengerState = await StateRecoveryService.recoverPassengerState(supabase, userId);
      if (passengerState) {
        console.log('✅ Viaje de pasajero recuperado:', passengerState);
        
        // Restaurar estado
        updateAppState({
          sessionRole: 'passenger',
          currentTripId: passengerState.currentTripId,
          driverId: passengerState.driverId
        });
        
        // Navegar a la pantalla correcta
        navigate(passengerState.screen);
        return true;
      }

      console.log('ℹ️ No se encontraron viajes activos');
      return false;

    } catch (error) {
      console.error('❌ Error recuperando estado:', error);
      return false;
    }
  };

  const loadProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (error) throw error;
      
      if (data) {
        setProfile(data);
        return data;
      }
      
      return null;
    } catch (error) {
      console.error('Error cargando perfil:', error);
      return null;
    }
  };

  const navigate = (screen) => {
    console.log('🧭 Navegando a:', screen);
    setCurrentScreen(screen);
  };

  const updateAppState = (updates) => {
    setAppState(prev => {
      const newState = { ...prev, ...updates };
      console.log('📊 Estado actualizado:', newState);
      
      // Si se limpia el viaje, limpiar localStorage
      if (updates.currentTripId === null) {
        console.log('🗑️ Limpiando estado guardado...');
        try {
          StateRecoveryService.clearAllStates();
        } catch (error) {
          console.error('Error limpiando estado:', error);
        }
      }
      
      return newState;
    });
  };

  const handleSignOut = () => {
    console.log('👋 Cerrando sesión...');
    setUser(null);
    setProfile(null);
    updateAppState({ 
      sessionRole: null,
      currentTripId: null,
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
      acceptedPassengers: [],
      tripStarted: false,
      driverId: null
    });
    StateRecoveryService.clearAllStates();
    navigate('welcome');
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

  // Mostrar pantalla de carga mientras se recupera el estado
  if (isRecoveringState) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-green-200 border-t-green-700 rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600 mb-2">Verificando viajes activos...</p>
          {recoveryError && (
            <div className="mt-4">
              <p className="text-red-600 text-sm mb-2">⚠️ {recoveryError}</p>
              <button
                onClick={() => {
                  setIsRecoveringState(false);
                  navigate('welcome');
                }}
                className="text-green-700 hover:underline text-sm"
              >
                Continuar sin recuperar estado
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

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