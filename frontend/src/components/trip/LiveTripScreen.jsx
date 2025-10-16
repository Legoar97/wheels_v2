import React, { useState, useEffect } from 'react';
import { Navigation, MapPin, Clock, CheckCircle, ArrowLeft, AlertCircle } from 'lucide-react';
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
  const [finishing, setFinishing] = useState(false);
  const { acceptedPassengers = [] } = appState;
  const isDriver = profile?.user_type === 'driver';

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries,
  });

  useEffect(() => {
    if (isLoaded && isDriver && acceptedPassengers.length > 0) {
      calculateRoute();
    }
  }, [isLoaded, acceptedPassengers]);

  const calculateRoute = () => {
    if (!window.google || acceptedPassengers.length === 0) return;

    const directionsService = new window.google.maps.DirectionsService();
    const firstPassenger = acceptedPassengers[0];
    
    directionsService.route(
      {
        origin: { lat: firstPassenger.pickup_lat, lng: firstPassenger.pickup_lng },
        destination: { lat: firstPassenger.dropoff_lat, lng: firstPassenger.dropoff_lng },
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === window.google.maps.DirectionsStatus.OK) {
          setDirections(result);
          const route = result.routes[0];
          if (route && route.legs[0]) {
            const durationMinutes = Math.ceil(route.legs[0].duration.value / 60);
            setEta(durationMinutes);
          }
        }
      }
    );
  };

  useEffect(() => {
    const etaInterval = setInterval(() => {
      setEta(prev => Math.max(0, prev - 1));
    }, 60000);

    return () => clearInterval(etaInterval);
  }, []);

  const completeStop = () => {
    if (currentStop < acceptedPassengers.length - 1) {
      setCurrentStop(currentStop + 1);
    }
  };

  const finishTrip = async () => {
    if (finishing) return;
    
    const confirmFinish = window.confirm(
      `¿Estás seguro de finalizar el viaje?\n\nPasajeros: ${acceptedPassengers.length}\nGanancia: $${(acceptedPassengers.length * 5000).toLocaleString('es-CO')}`
    );
    
    if (!confirmFinish) return;
    
    setFinishing(true);
    console.log('=== FINALIZANDO VIAJE ===');
    
    try {
      // PASO 1: Buscar el viaje activo en successful_trips
      const { data: trips, error: fetchError } = await supabase
        .from('successful_trips')
        .select('*')
        .eq('driver_id', user.id)
        .eq('status', 'in_progress')
        .order('created_at', { ascending: false })
        .limit(1);

      console.log('Viajes encontrados:', trips);

      let tripId = null;
      
      if (trips && trips.length > 0) {
        tripId = trips[0].id;
        console.log('✅ Viaje encontrado:', tripId);

        // Actualizar a completado
        const { error: updateError } = await supabase
          .from('successful_trips')
          .update({ 
            status: 'completed',
            completed_at: new Date().toISOString()
          })
          .eq('id', tripId);

        if (updateError) {
          console.error('❌ Error actualizando viaje:', updateError);
          throw new Error('Error al actualizar viaje');
        }
        console.log('✅ Viaje actualizado a completed');
      } else {
        console.warn('⚠️ No se encontró viaje en successful_trips, creando uno...');
        
        // Crear el viaje si no existe
        const { data: newTrip, error: createError } = await supabase
          .from('successful_trips')
          .insert({
            driver_id: user.id,
            status: 'completed',
            total_passengers: acceptedPassengers.length,
            total_earnings: acceptedPassengers.length * 5000,
            started_at: new Date().toISOString(),
            completed_at: new Date().toISOString()
          })
          .select()
          .single();
        
        if (createError) {
          console.error('❌ Error creando viaje:', createError);
          throw new Error('Error al crear registro del viaje');
        }
        
        tripId = newTrip.id;
        console.log('✅ Viaje creado:', tripId);
      }

      // Actualizar el currentTripId en el appState para que TripCompletedScreen lo use
      updateAppState({ currentTripId: tripId });

      // PASO 2: Actualizar perfil del conductor
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
          console.error('⚠️ Error actualizando perfil:', profileError);
        } else {
          console.log('✅ Perfil del conductor actualizado');
        }
      }

      // PASO 3: Actualizar estados en searching_pool
      // Actualizar conductor
      const { error: driverPoolError } = await supabase
        .from('searching_pool')
        .update({ status: 'completed' })
        .eq('user_id', user.id)
        .eq('tipo_de_usuario', 'driver')
        .eq('status', 'in_progress');

      if (driverPoolError) {
        console.error('⚠️ Error actualizando conductor en pool:', driverPoolError);
      } else {
        console.log('✅ Conductor marcado como completed');
      }

      // Actualizar pasajeros
      const passengerIds = acceptedPassengers.map(p => p.user_id);
      if (passengerIds.length > 0) {
        const { error: passengersPoolError } = await supabase
          .from('searching_pool')
          .update({ status: 'completed' })
          .in('user_id', passengerIds)
          .eq('tipo_de_usuario', 'passenger');

        if (passengersPoolError) {
          console.error('⚠️ Error actualizando pasajeros en pool:', passengersPoolError);
        } else {
          console.log('✅ Pasajeros marcados como completed');
        }
      }

      // PASO 4: Actualizar perfiles de pasajeros
      for (const passenger of acceptedPassengers) {
        const { data: passengerProfile } = await supabase
          .from('profiles')
          .select('total_trips, completed_trips')
          .eq('user_id', passenger.user_id)
          .single();

        if (passengerProfile) {
          await supabase
            .from('profiles')
            .update({
              total_trips: (passengerProfile.total_trips || 0) + 1,
              completed_trips: (passengerProfile.completed_trips || 0) + 1
            })
            .eq('user_id', passenger.user_id);
        }
      }
      console.log('✅ Perfiles de pasajeros actualizados');

      console.log('✅✅✅ VIAJE FINALIZADO EXITOSAMENTE ✅✅✅');
      
      // NO limpiar estado todavía - lo necesitamos para la pantalla de calificaciones
      // La pantalla TripCompletedScreen lo limpiará después de calificar
      
      // Navegar a pantalla de resumen y calificaciones
      navigate('tripCompleted');
      
    } catch (error) {
      console.error('❌ Error finalizando viaje:', error);
      alert('Error al finalizar el viaje: ' + error.message);
      setFinishing(false);
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

        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
            <div>
              <h3 className="text-lg font-bold text-gray-800">ETA: {eta} minutos</h3>
              <p className="text-sm text-gray-600">Distancia: {(eta * 0.3).toFixed(1)} km</p>
            </div>
            <div className="bg-green-100 text-green-800 px-4 py-2 rounded-full text-sm font-semibold flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></div>
              <span>En camino</span>
            </div>
          </div>

          {isDriver && acceptedPassengers.length > 0 ? (
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-800 mb-3">Ruta de recogida:</h4>
              
              {acceptedPassengers.map((passenger, idx) => (
                <div 
                  key={idx} 
                  className={`border-l-4 pl-4 transition ${
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
                        {passenger.profile?.full_name || 'Pasajero'}
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
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="border-l-4 border-green-600 pl-4 bg-green-50">
                <h4 className="font-semibold text-gray-800 mb-1">Tu conductor viene en camino</h4>
                <p className="text-sm text-gray-600">Mantente en el punto de recogida</p>
              </div>
            </div>
          )}
        </div>

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

        {isDriver && (
          <div className="space-y-3 pb-6">
            <button
              onClick={finishTrip}
              disabled={finishing}
              className="w-full bg-green-700 text-white py-4 rounded-lg font-semibold hover:bg-green-800 transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {finishing ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Finalizando...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  <span>Finalizar Viaje</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveTripScreen;