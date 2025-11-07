import React, { useState, useEffect } from 'react';
import { MapPin, Navigation, User, Star, CheckCircle, Users, RefreshCw, AlertCircle } from 'lucide-react';

const DriverMatchingScreen = ({ user, profile, navigate, supabase, appState, updateAppState }) => {
  const [passengers, setPassengers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [accepting, setAccepting] = useState(null);
  const [isStartingTrip, setIsStartingTrip] = useState(false);
  const { acceptedPassengers = [], currentTripId, tripConfig } = appState; // <-- Añadir tripConfig

  useEffect(() => {
    loadPassengers();
    const interval = setInterval(loadPassengers, 10000); // 10 segundos
    return () => clearInterval(interval);
  }, [currentTripId, tripConfig]); // Recargar si la config del viaje cambia

  const loadPassengers = async () => {
    if (!currentTripId || !tripConfig) {
      setError("No se encontró la configuración del viaje del conductor.");
      setLoading(false);
      return;
    }
    
    // No se necesita el setLoading(true) aquí para evitar parpadeos
    setError(null);
    
    try {
      // --- CONEXIÓN AL BACKEND ---
      // Preparamos los datos del conductor para enviar a la API de matchmaking
      const driverData = {
        user_id: user.id,
        user_type: 'driver',
        ...tripConfig,
        // Asegurarse de que los nombres coincidan con la API (user_type en lugar de tipo_de_usuario)
        pickup_lat: tripConfig.pickupLat,
        pickup_lng: tripConfig.pickupLng,
        dropoff_lat: tripConfig.dropoffLat,
        dropoff_lng: tripConfig.dropoffLng,
        pickup_address: tripConfig.pickup,
        dropoff_address: tripConfig.destination,
      };

      console.log("Enviando datos del conductor al backend:", driverData);

      // Llamamos a nuestra API de matchmaking usando el proxy /api/match
      const response = await fetch('/api/match/api/matchmaking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(driverData),
      });

      if (!response.ok) {
        throw new Error(`Error del servidor: ${response.statusText}`);
      }

      const data = await response.json();
      // --- FIN CONEXIÓN AL BACKEND ---

      if (data.success && data.matches) {
        console.log("Matches recibidos:", data.matches);
        // Cargar perfiles de los pasajeros encontrados
        const passengerUserIds = data.matches.map(p => p.passenger_user_id);
        
        if (passengerUserIds.length > 0) {
          const { data: profiles, error: profileError } = await supabase
            .from('profiles')
            .select('user_id, full_name, email, rating')
            .in('user_id', passengerUserIds);

          if (profileError) {
            console.error('Error fetching profiles:', profileError);
          }

          // Combinar matches de la API con perfiles de Supabase
          const passengersWithProfiles = data.matches.map(match => {
            const profile = profiles?.find(p => p.user_id === match.passenger_user_id) || {};
            return {
              ...match,
              // Renombrar campos para que coincidan con la lógica de aceptación
              id: match.passenger_id, // Este es el ID de searching_pool del pasajero
              user_id: match.passenger_user_id,
              profile: {
                full_name: profile.full_name || 'Usuario',
                email: profile.email || '',
                rating: profile.rating || 5.0
              }
            };
          });

          // Filtrar pasajeros que ya fueron aceptados
          const acceptedIds = new Set(acceptedPassengers.map(p => p.id));
          const availablePassengers = passengersWithProfiles.filter(p => !acceptedIds.has(p.id));

          setPassengers(availablePassengers);
        } else {
          setPassengers([]);
        }
      } else {
        setPassengers([]);
      }
    } catch (error) {
      console.error('Error in loadPassengers:', error);
      setError('Error al cargar pasajeros: ' + error.message);
      setPassengers([]);
    } finally {
      setLoading(false);
    }
  };


  const acceptPassenger = async (passenger) => {
    if (accepting === passenger.id) return;
    setAccepting(passenger.id);
    
    try {
      console.log('=== INICIANDO ACEPTACIÓN DE PASAJERO ===');
      console.log('Pasajero ID (searching_pool):', passenger.id);
      console.log('Pasajero User ID:', passenger.user_id);
      console.log('Conductor ID:', user.id);

      const { error: updatePassengerError } = await supabase
        .from('searching_pool')
        .update({ status: 'matched', matched_driver_id: user.id })
        .eq('id', passenger.id) // passenger.id es el searching_pool_id del pasajero
        .eq('status', 'searching')
        .is('matched_driver_id', null);

      if (updatePassengerError) throw updatePassengerError;
      console.log('✅ Pasajero actualizado a "matched"');

      const totalSeats = appState.tripConfig?.availableSeats || 3;
      const seatsUsed = acceptedPassengers.length + 1;
      
      if (seatsUsed >= totalSeats) {
        console.log('🚫 Ya no hay más cupos, actualizando conductor a "matched"');
        await supabase.from('searching_pool').update({ status: 'matched' }).eq('id', currentTripId);
      }

      const { error: acceptError } = await supabase
        .from('driver_acceptances')
        .insert({
          driver_id: user.id,
          passenger_id: passenger.user_id, // ID de auth.users del pasajero
          passenger_email: passenger.profile.email,
          searching_pool_id: passenger.id, // ID de searching_pool del pasajero
          trip_info: {
             pickup: passenger.pickup_address,
             dropoff: passenger.dropoff_address,
             passenger_name: passenger.profile.full_name,
             pickup_lat: passenger.pickup_lat,
             pickup_lng: passenger.pickup_lng,
             dropoff_lat: passenger.dropoff_lat,
             dropoff_lng: passenger.dropoff_lng
          }
        });

      if (acceptError) {
        console.error('❌ Error creando acceptance, revirtiendo cambios...', acceptError);
        await supabase.from('searching_pool').update({ status: 'searching', matched_driver_id: null }).eq('id', passenger.id);
        throw acceptError;
      }
      console.log('✅ Registro en driver_acceptances creado');

      // Añadimos el pasajero completo (con perfil) a acceptedPassengers
      const newAccepted = [...acceptedPassengers, passenger];
      updateAppState({ acceptedPassengers: newAccepted });
      
      setPassengers(passengers.filter(p => p.id !== passenger.id));
      
      console.log('✅ ACEPTACIÓN COMPLETADA EXITOSAMENTE');
      
    } catch (error) {
      console.error('❌ Error en el proceso de aceptación:', error);
      alert('Error al aceptar pasajero: ' + error.message);
    } finally {
      setAccepting(null);
    }
  };

  const startTrip = async () => {
    if (acceptedPassengers.length === 0) {
      alert('Debes aceptar al menos un pasajero para iniciar el viaje');
      return;
    }

    if (isStartingTrip) return; 

    const totalSeats = appState.tripConfig?.availableSeats || 3;
    const seatsUsed = acceptedPassengers.length;
    const seatsEmpty = totalSeats - seatsUsed;

    if (seatsEmpty > 0) {
      // Usamos un modal custom en lugar de window.confirm
      // Por ahora, usamos window.confirm como placeholder
      const confirmStart = window.confirm(`Tienes ${seatsEmpty} cupo(s) vacío(s).\n\n¿Seguro que quieres iniciar el viaje ahora?`);
      if (!confirmStart) return;
    }

    setIsStartingTrip(true); 
    try {
      console.log('=== INICIANDO VIAJE ===');

      await supabase.from('searching_pool').update({ status: 'in_progress' }).eq('id', currentTripId);
      console.log('✅ Conductor -> in_progress');

      const passengerPoolIds = acceptedPassengers.map(p => p.id); // Usamos el ID de searching_pool
      await supabase.from('searching_pool').update({ status: 'in_progress' }).in('id', passengerPoolIds);
      console.log('✅ Pasajeros -> in_progress');

      const { data: tripData, error: tripError } = await supabase
        .from('successful_trips')
        .insert({
          driver_id: user.id,
          status: 'in_progress',
          total_passengers: acceptedPassengers.length,
          total_earnings: acceptedPassengers.length * (tripConfig.pricePerSeat || 5000), // Usar precio real
          started_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (tripError) throw tripError;

      console.log('✅ Trip record created:', tripData.id);
      // Guardamos el ID del viaje de la tabla 'successful_trips'
      updateAppState({ 
        currentTripId: tripData.id, // Sobrescribimos el ID de searching_pool por el de successful_trips
        tripStarted: true 
      });

      console.log('✅ VIAJE INICIADO CORRECTAMENTE');
      navigate('liveTrip'); 

    } catch (error) {
      console.error('❌ Error inesperado al iniciar viaje:', error);
      alert('Error inesperado al iniciar viaje: ' + error.message);
    } finally {
      setIsStartingTrip(false); 
    }
  };

  // El resto del JSX sigue igual...
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <button onClick={() => navigate('dashboard')} className="text-green-700 hover:underline flex items-center space-x-2 mb-4">
            <span>← Volver al Dashboard</span>
          </button>
          <h1 className="text-3xl font-bold text-gray-800">Pasajeros Disponibles</h1>
          <p className="text-gray-600 mt-2">Selecciona los pasajeros que deseas recoger</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-700 font-medium">Error</p>
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800">Pasajeros Encontrados</h2>
            <div className="flex items-center space-x-3">
              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                {passengers.length} disponibles
              </span>
              <button onClick={loadPassengers} disabled={loading} className="p-2 hover:bg-gray-100 rounded-lg transition disabled:opacity-50">
                <RefreshCw className={`w-5 h-5 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {loading && passengers.length === 0 ? (
            <div className="text-center py-12">
              <div className="animate-spin w-12 h-12 border-4 border-green-200 border-t-green-700 rounded-full mx-auto mb-4"></div>
              <p className="text-gray-600">Buscando pasajeros...</p>
            </div>
          ) : passengers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">No hay pasajeros disponibles por ahora</p>
              <p className="text-sm text-gray-500">La búsqueda se actualiza automáticamente</p>
            </div>
          ) : (
            <div className="space-y-4">
              {passengers.map((passenger) => (
                <div key={passenger.id} className="border border-gray-200 rounded-xl p-4 hover:border-green-300 transition">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                       <div className="flex items-center space-x-3 mb-3">
                         <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                           <User className="w-5 h-5 text-green-700" />
                         </div>
                         <div>
                           <span className="font-semibold text-gray-800">{passenger.profile.full_name}</span>
                           <div className="flex items-center space-x-1 mt-1">
                             <Star className="w-4 h-4 text-yellow-400 fill-current" />
                             <span className="text-sm text-gray-600">{passenger.profile.rating}</span>
                           </div>
                         </div>
                       </div>
                       <div className="space-y-2 text-sm text-gray-600 md:ml-13">
                         <div className="flex items-start space-x-2">
                           <MapPin className="w-4 h-4 mt-0.5 text-green-600 flex-shrink-0" />
                           <div>
                             <span className="font-medium">Recogida:</span>
                             <p className="text-gray-700">{passenger.pickup_address}</p>
                           </div>
                         </div>
                         <div className="flex items-start space-x-2">
                           <Navigation className="w-4 h-4 mt-0.5 text-green-700 flex-shrink-0" />
                           <div>
                             <span className="font-medium">Destino:</span>
                             <p className="text-gray-700">{passenger.dropoff_address}</p>
                           </div>
                         </div>
                       </div>
                    </div>
                    <button
                      onClick={() => acceptPassenger(passenger)}
                      disabled={accepting === passenger.id}
                      className="ml-4 bg-green-700 text-white px-6 py-2 rounded-lg hover:bg-green-800 transition font-semibold disabled:opacity-50 flex items-center space-x-2"
                    >
                      {accepting === passenger.id ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>Aceptando...</span>
                        </>
                      ) : (
                        <span>Aceptar</span>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {acceptedPassengers.length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-green-900 mb-3 flex items-center space-x-2">
              <CheckCircle className="w-5 h-5" />
              <span>Pasajeros Aceptados ({acceptedPassengers.length}/{appState.tripConfig?.availableSeats || 3})</span>
            </h3>
            
            <div className="space-y-2 mb-4">
              {acceptedPassengers.map((p, idx) => (
                <div key={idx} className="flex items-center space-x-2 text-sm text-green-800 bg-white rounded-lg p-3">
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium">{p.profile?.full_name || 'Pasajero'}</p>
                    <p className="text-xs text-green-600">{p.pickup_address}</p>
                  </div>
                </div>
              ))}
            </div>

            {acceptedPassengers.length < (appState.tripConfig?.availableSeats || 3) && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-blue-800 text-center">
                  ℹ️ Tienes {(appState.tripConfig?.availableSeats || 3) - acceptedPassengers.length} cupo(s) disponible(s).
                </p>
              </div>
            )}

            <div className="bg-white rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Ganancia estimada:</span>
                <span className="font-bold text-green-700 text-lg">
                  ${(acceptedPassengers.length * (tripConfig.pricePerSeat || 5000)).toLocaleString('es-CO')}
                </span>
              </div>
            </div>
            
            <button
              onClick={startTrip}
              disabled={isStartingTrip}
              className="w-full bg-green-700 text-white py-4 rounded-lg font-semibold hover:bg-green-800 transition shadow-lg disabled:opacity-75 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {isStartingTrip ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Iniciando Viaje...</span>
                </>
              ) : (
                <span>
                  Iniciar Viaje con {acceptedPassengers.length} pasajero{acceptedPassengers.length !== 1 ? 's' : ''}
                </span>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DriverMatchingScreen;