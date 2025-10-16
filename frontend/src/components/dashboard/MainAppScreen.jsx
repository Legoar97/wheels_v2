import React, { useState, useEffect } from 'react';
import { Car, Menu, User, Clock, LogOut } from 'lucide-react';
import { GoogleMap, DirectionsRenderer, useLoadScript } from '@react-google-maps/api';
import DriverSection from './DriverSection';
import PassengerSection from './PassengerSection';

const libraries = ['places', 'directions'];

const mapContainerStyle = {
  width: '100%',
  height: '400px',
  borderRadius: '1rem'
};

// Coordenadas CORRECTAS de la Universidad Externado
const center = {
  lat: 4.595724443192084,
  lng: -74.06888964035532
};

const mapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  styles: [
    {
      featureType: 'poi',
      elementType: 'labels',
      stylers: [{ visibility: 'off' }]
    }
  ]
};

const MainAppScreen = ({ user, profile, navigate, supabase, appState, updateAppState, loading, setLoading }) => {
  const [showMenu, setShowMenu] = useState(false);
  const [directions, setDirections] = useState(null);
  
  // ⬅️ VERIFICACIÓN CRÍTICA
  console.log('🎭 MainAppScreen renderizado');
  console.log('📊 appState completo:', appState);
  console.log('🎯 sessionRole:', appState.sessionRole);
  
  // ⬅️ SI NO HAY sessionRole, REDIRIGIR A SELECCIÓN
  useEffect(() => {
    if (!appState.sessionRole) {
      console.log('❌ No hay sessionRole, redirigiendo a selección...');
      navigate('sessionRoleSelection');
    }
  }, [appState.sessionRole]);
  
  const isDriver = appState.sessionRole === 'driver';
  
  console.log('🎭 isDriver:', isDriver);

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries,
  });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    // ⬅️ LIMPIAR sessionRole al cerrar sesión
    updateAppState({ sessionRole: null });
    navigate('welcome');
  };

  // Calcular ruta cuando cambien las coordenadas
  useEffect(() => {
    if (isLoaded && appState.tripConfig.pickupLat && appState.tripConfig.dropoffLat) {
      const directionsService = new google.maps.DirectionsService();

      directionsService.route(
        {
          origin: {
            lat: appState.tripConfig.pickupLat,
            lng: appState.tripConfig.pickupLng
          },
          destination: {
            lat: appState.tripConfig.dropoffLat,
            lng: appState.tripConfig.dropoffLng
          },
          travelMode: google.maps.TravelMode.DRIVING,
        },
        (result, status) => {
          if (status === google.maps.DirectionsStatus.OK) {
            setDirections(result);
            
            // Extraer información de la ruta
            const route = result.routes[0];
            if (route && route.legs[0]) {
              const distance = route.legs[0].distance.text;
              const duration = route.legs[0].duration.text;
              
              updateAppState({
                tripConfig: {
                  ...appState.tripConfig,
                  estimatedDistance: distance,
                  estimatedDuration: duration
                }
              });
            }
          } else {
            console.error('Error calculating route:', status);
          }
        }
      );
    }
  }, [isLoaded, appState.tripConfig.pickupLat, appState.tripConfig.dropoffLat]);

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-green-200 border-t-green-700 rounded-full"></div>
      </div>
    );
  }

  // ⬅️ SI NO HAY sessionRole, MOSTRAR LOADING
  if (!appState.sessionRole) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-green-200 border-t-green-700 rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Car className="w-8 h-8 text-green-700" />
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Wheels</h1>
              <p className="text-xs text-gray-500">{isDriver ? 'Modo Conductor' : 'Modo Pasajero'}</p>
            </div>
          </div>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Menu desplegable */}
      {showMenu && (
        <div className="absolute top-16 right-6 bg-white rounded-xl shadow-xl p-4 z-20 min-w-[250px] slide-in-right">
          <div className="space-y-2">
            <div className="px-4 py-2 border-b border-gray-200">
              <p className="font-semibold text-gray-800">{profile?.full_name}</p>
              <p className="text-sm text-gray-600">{user?.email}</p>
              <span className="inline-block mt-1 px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                {isDriver ? '🚗 Conductor' : '🎒 Pasajero'}
              </span>
            </div>
            
            {/* ⬅️ NUEVO: Botón para cambiar rol */}
            <button
              onClick={() => {
                setShowMenu(false);
                updateAppState({ sessionRole: null }); // Limpiar rol
                navigate('sessionRoleSelection');
              }}
              className="w-full flex items-center space-x-3 px-4 py-3 hover:bg-gray-100 rounded-lg transition"
            >
              <User className="w-5 h-5" />
              <span>Cambiar Rol</span>
            </button>
            
            <button
              onClick={() => {
                setShowMenu(false);
                navigate('history');
              }}
              className="w-full flex items-center space-x-3 px-4 py-3 hover:bg-gray-100 rounded-lg transition"
            >
              <Clock className="w-5 h-5" />
              <span>Historial de Viajes</span>
            </button>
            <button
              onClick={handleLogout}
              className="w-full flex items-center space-x-3 px-4 py-3 hover:bg-red-50 text-red-600 rounded-lg transition"
            >
              <LogOut className="w-5 h-5" />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </div>
      )}

      {/* Contenido Principal */}
      <div className="max-w-6xl mx-auto p-6">
        {/* Mapa de Google Maps con Ruta */}
        <div className="bg-white rounded-2xl shadow-lg mb-6 overflow-hidden">
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={center}
            zoom={14}
            options={mapOptions}
          >
            {directions && (
              <DirectionsRenderer
                directions={directions}
                options={{
                  polylineOptions: {
                    strokeColor: '#15803d',
                    strokeWeight: 5,
                    strokeOpacity: 0.8
                  },
                  suppressMarkers: false
                }}
              />
            )}
          </GoogleMap>
          
          {/* Información de la ruta si existe */}
          {appState.tripConfig.estimatedDistance && (
            <div className="bg-gray-50 px-4 py-3 border-t">
              <div className="flex justify-around text-sm">
                <div className="text-center">
                  <span className="text-gray-600">Distancia:</span>
                  <p className="font-semibold text-green-700">{appState.tripConfig.estimatedDistance}</p>
                </div>
                <div className="text-center">
                  <span className="text-gray-600">Tiempo estimado:</span>
                  <p className="font-semibold text-green-700">{appState.tripConfig.estimatedDuration}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sección específica por rol */}
        {isDriver ? (
          <DriverSection 
            user={user}
            profile={profile}
            navigate={navigate}
            supabase={supabase}
            appState={appState}
            updateAppState={updateAppState}
            loading={loading}
            setLoading={setLoading}
          />
        ) : (
          <PassengerSection 
            user={user}
            profile={profile}
            navigate={navigate}
            supabase={supabase}
            appState={appState}
            updateAppState={updateAppState}
            loading={loading}
            setLoading={setLoading}
          />
        )}
      </div>
    </div>
  );
};

export default MainAppScreen;