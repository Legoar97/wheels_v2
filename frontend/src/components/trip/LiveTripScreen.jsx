import React, { useState, useEffect } from 'react';
import { Navigation, MapPin, Clock, CheckCircle, ArrowLeft } from 'lucide-react';
import { GoogleMap, DirectionsRenderer, useLoadScript } from '@react-google-maps/api';

const libraries = ['places', 'directions'];

const mapContainerStyle = {
  width: '100%',
  height: '350px',
  borderRadius: '1rem'
};

const center = {
  lat: 4.595724443192084,
  lng: -74.06888964035532
};

const LiveTripScreen = ({ user, profile, navigate, supabase, appState, updateAppState }) => {
  const [currentStop, setCurrentStop] = useState(0);
  const [eta, setEta] = useState(15);
  const [directions, setDirections] = useState(null);
  const { acceptedPassengers = [] } = appState;
  const isDriver = profile?.user_type === 'driver';

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries,
  });

  // Calcular ruta cuando carga el componente
  useEffect(() => {
    if (isLoaded && isDriver && acceptedPassengers.length > 0) {
      calculateRoute();
    }
  }, [isLoaded, acceptedPassengers]);

  const calculateRoute = () => {
    if (!window.google || acceptedPassengers.length === 0) return;

    const directionsService = new window.google.maps.DirectionsService();
    
    // Usar el primer pasajero como referencia
    const firstPassenger = acceptedPassengers[0];
    
    directionsService.route(
      {
        origin: {
          lat: firstPassenger.pickup_lat,
          lng: firstPassenger.pickup_lng
        },
        destination: {
          lat: firstPassenger.dropoff_lat,
          lng: firstPassenger.dropoff_lng
        },
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === window.google.maps.DirectionsStatus.OK) {
          setDirections(result);
          
          // Actualizar ETA basado en la ruta
          const route = result.routes[0];
          if (route && route.legs[0]) {
            const durationMinutes = Math.ceil(route.legs[0].duration.value / 60);
            setEta(durationMinutes);
          }
        } else {
          console.error('Error calculando ruta:', status);
        }
      }
    );
  };

  // Simular actualización de ETA
  useEffect(() => {
    const etaInterval = setInterval(() => {
      setEta(prev => Math.max(0, prev - 1));
    }, 60000); // Cada minuto

    return () => clearInterval(etaInterval);
  }, []);

  const completeStop = () => {
    if (currentStop < acceptedPassengers.length - 1) {
      setCurrentStop(currentStop + 1);
    }
  };

  const finishTrip = async () => {
    console.log('=== FINALIZANDO VIAJE ===');
    
    try {
      // Buscar el viaje en successful_trips
      const { data: trips, error: fetchError } = await supabase
        .from('successful_trips')
        .select('*')
        .eq('driver_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);

      console.log('Viajes encontrados:', trips);

      if (fetchError) {
        console.error('Error buscando viaje:', fetchError);
        alert('Error al buscar viaje');
        return;
      }

      if (trips && trips.length > 0) {
        const trip = trips[0];
        console.log('Actualizando viaje:', trip.id);

        // Actualizar el viaje a completado
        const { error: updateError } = await supabase
          .from('successful_trips')
          .update({ 
            status: 'completed',
            completed_at: new Date().toISOString()
          })
          .eq('id', trip.id);

        if (updateError) {
          console.error('Error actualizando viaje:', updateError);
        } else {
          console.log('✅ Viaje actualizado a completed');
        }
      }

      // Actualizar perfil del conductor
      const { data: currentProfile, error: profileFetchError } = await supabase
        .from('profiles')
        .select('total_trips, completed_trips')
        .eq('user_id', user.id)
        .single();

      if (currentProfile && !profileFetchError) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ 
            total_trips: (currentProfile.total_trips || 0) + 1,
            completed_trips: (currentProfile.completed_trips || 0) + 1
          })
          .eq('user_id', user.id);

        if (profileError) {
          console.error('Error actualizando perfil:', profileError);
        } else {
          console.log('✅ Perfil actualizado');
        }
      }

      // Actualizar estados en searching_pool
      const { error: poolError } = await supabase
        .from('searching_pool')
        .update({ status: 'completed' })
        .eq('matched_driver_id', user.id)
        .eq('status', 'in_progress');

      if (poolError) {
        console.error('Error actualizando searching_pool:', poolError);
      }

      console.log('✅ VIAJE FINALIZADO EXITOSAMENTE');
      alert('¡Viaje finalizado exitosamente! 🎉');
      
      // Limpiar estado
      updateAppState({ 
        tripStarted: false,
        acceptedPassengers: [],
        currentTripId: null
      });
      
      navigate('dashboard');
    } catch (error) {
      console.error('Error:', error);
      alert('Error al finalizar viaje: ' + error.message);
    }
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-green-200 border-t-green-700 rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header con gradiente */}
      <div className="bg-gradient-to-br from-green-600 to-green-800 pt-6 pb-20 px-6">
        <button
          onClick={() => navigate('dashboard')}
          className="flex items-center space-x-2 text-white mb-4 hover:opacity-80"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Volver</span>
        </button>
        
        <div className="text-white text-center">
          <Navigation className="w-16 h-16 mx-auto mb-4 animate-pulse" />
          <h2 className="text-2xl font-bold">Viaje en Curso</h2>
          <p className="text-sm opacity-90 mt-2">
            {isDriver ? 'Siguiendo la ruta optimizada' : 'Tu conductor está en camino'}
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 -mt-12">
        {/* Mapa con ruta */}
        {isDriver && directions && (
          <div className="bg-white rounded-2xl shadow-xl mb-6 overflow-hidden">
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={center}
              zoom={13}
              options={{ disableDefaultUI: false, zoomControl: true }}
            >
              <DirectionsRenderer
                directions={directions}
                options={{
                  polylineOptions: {
                    strokeColor: '#15803d',
                    strokeWeight: 5,
                    strokeOpacity: 0.8
                  }
                }}
              />
            </GoogleMap>
          </div>
        )}

        {/* Card principal del viaje */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          {/* Estado y ETA */}
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
            <div>
              <h3 className="text-lg font-bold text-gray-800">ETA: {eta} minutos</h3>
              <p className="text-sm text-gray-600">Distancia restante: {(eta * 0.3).toFixed(1)} km</p>
            </div>
            <div className="bg-green-100 text-green-800 px-4 py-2 rounded-full text-sm font-semibold flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></div>
              <span>En camino</span>
            </div>
          </div>

          {/* Información del viaje */}
          {isDriver && acceptedPassengers.length > 0 ? (
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-800 mb-3">Ruta de recogida:</h4>
              
              {acceptedPassengers.map((passenger, idx) => (
                <div 
                  key={idx} 
                  className={`border-l-4 pl-4 transition-all ${
                    idx === currentStop 
                      ? 'border-green-600 bg-green-50' 
                      : idx < currentStop 
                      ? 'border-gray-300 opacity-50' 
                      : 'border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        {idx < currentStop ? (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        ) : (
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs font-bold ${
                            idx === currentStop ? 'border-green-600 text-green-600' : 'border-gray-300 text-gray-400'
                          }`}>
                            {idx + 1}
                          </div>
                        )}
                        <h4 className="font-semibold text-gray-800">
                          {idx < currentStop ? 'Recogido ✓' : idx === currentStop ? 'Próxima parada' : `Parada ${idx + 1}`}
                        </h4>
                      </div>
                      <p className="text-sm text-gray-600 ml-7">{passenger.pickup_address}</p>
                      <p className="text-xs text-gray-500 mt-1 ml-7">
                        {idx === currentStop ? `Llegando en ${Math.ceil(eta / (acceptedPassengers.length - currentStop))} min` : ''}
                      </p>
                    </div>
                    
                    {idx === currentStop && (
                      <button
                        onClick={completeStop}
                        className="ml-4 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-700 transition"
                      >
                        Recogido ✓
                      </button>
                    )}
                  </div>
                </div>
              ))}

              <div className="border-l-4 border-green-700 pl-4 mt-4 bg-green-50">
                <div className="flex items-center space-x-2 mb-1">
                  <MapPin className="w-5 h-5 text-green-700" />
                  <h4 className="font-semibold text-green-900">Destino Final</h4>
                </div>
                <p className="text-sm text-green-800 ml-7">Universidad Externado</p>
                <p className="text-xs text-green-600 mt-1 ml-7">En {eta} minutos</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="border-l-4 border-green-600 pl-4 bg-green-50">
                <h4 className="font-semibold text-gray-800 mb-1">Tu conductor viene en camino</h4>
                <p className="text-sm text-gray-600">Mantente en el punto de recogida acordado</p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 text-sm mb-2">Información del viaje</h4>
                <div className="space-y-1 text-sm text-blue-800">
                  <p>• Tiempo estimado: {eta} minutos</p>
                  <p>• Estado: En camino al punto de recogida</p>
                  <p>• Próxima actualización en tiempo real</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Estadísticas del viaje */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow p-4 text-center">
            <Clock className="w-8 h-8 text-green-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-800">{eta}</div>
            <div className="text-xs text-gray-600">Minutos</div>
          </div>
          <div className="bg-white rounded-xl shadow p-4 text-center">
            <Navigation className="w-8 h-8 text-green-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-800">{(eta * 0.3).toFixed(1)}</div>
            <div className="text-xs text-gray-600">Kilómetros</div>
          </div>
          <div className="bg-white rounded-xl shadow p-4 text-center">
            <MapPin className="w-8 h-8 text-green-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-800">
              {isDriver ? acceptedPassengers.length : 1}
            </div>
            <div className="text-xs text-gray-600">Pasajeros</div>
          </div>
        </div>

        {/* Botones de acción */}
        {isDriver && (
          <div className="space-y-3 pb-6">
            <button
              onClick={finishTrip}
              className="w-full bg-green-700 text-white py-4 rounded-lg font-semibold hover:bg-green-800 transition shadow-lg transform hover:scale-105"
            >
              ✓ Finalizar Viaje
            </button>
            <button
              onClick={() => navigate('dashboard')}
              className="w-full border-2 border-gray-300 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-50 transition"
            >
              Cancelar Viaje
            </button>
          </div>
        )}

        {!isDriver && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
            <h4 className="font-semibold text-yellow-900 mb-2">⚠️ Recuerda:</h4>
            <ul className="text-sm text-yellow-800 space-y-1">
              <li>• Mantente en el punto de recogida acordado</li>
              <li>• Ten el dinero exacto preparado</li>
              <li>• Respeta las normas del conductor</li>
              <li>• Califica tu experiencia al finalizar</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveTripScreen;