import React, { useState, useEffect } from 'react';
import { MapPin, Navigation, Clock, User, Star, CheckCircle, Users, RefreshCw } from 'lucide-react';

const DriverMatchingScreen = ({ user, navigate, supabase, appState, updateAppState }) => {
  const [passengers, setPassengers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { acceptedPassengers = [], currentTripId } = appState;

  useEffect(() => {
    loadPassengers();
    // Recargar cada 5 segundos
    const interval = setInterval(loadPassengers, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadPassengers = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Primero, obtener todos los pasajeros buscando viaje
      const { data: passengerRequests, error: fetchError } = await supabase
        .from('searching_pool')
        .select('*')
        .eq('tipo_de_usuario', 'passenger')
        .eq('status', 'searching');

      if (fetchError) {
        console.error('Error fetching passengers:', fetchError);
        setError(fetchError.message);
        setPassengers([]);
        return;
      }

      // Si hay pasajeros, obtener su información de perfiles
      if (passengerRequests && passengerRequests.length > 0) {
        const passengerIds = passengerRequests.map(p => p.user_id);
        
        const { data: profiles, error: profileError } = await supabase
          .from('profiles')
          .select('user_id, full_name, email, rating')
          .in('user_id', passengerIds);

        if (profileError) {
          console.error('Error fetching profiles:', profileError);
        }

        // Combinar la información
        const passengersWithProfiles = passengerRequests.map(passenger => {
          const profile = profiles?.find(p => p.user_id === passenger.user_id) || {};
          return {
            ...passenger,
            profile: {
              full_name: profile.full_name || 'Usuario',
              email: profile.email || '',
              rating: profile.rating || 5.0
            }
          };
        });

        setPassengers(passengersWithProfiles);
      } else {
        setPassengers([]);
      }
    } catch (error) {
      console.error('Error in loadPassengers:', error);
      setError('Error al cargar pasajeros');
      setPassengers([]);
    } finally {
      setLoading(false);
    }
  };

  const acceptPassenger = async (passenger) => {
    try {
      // Actualizar estado del pasajero a "matched" inmediatamente
      const { error: updateError } = await supabase
        .from('searching_pool')
        .update({ status: 'matched' })
        .eq('id', passenger.id);

      if (updateError) {
        console.error('Error updating passenger status:', updateError);
        alert('Error al actualizar estado del pasajero');
        return;
      }

      // Crear registro en driver_acceptances
      const { error: acceptError } = await supabase
        .from('driver_acceptances')
        .insert({
          driver_id: user.id,
          passenger_email: passenger.profile.email,
          trip_info: {
            pickup: passenger.pickup_address,
            dropoff: passenger.dropoff_address,
            passenger_id: passenger.user_id,
            passenger_name: passenger.profile.full_name,
            searching_pool_id: passenger.id
          }
        });

      if (acceptError) {
        console.error('Error creating acceptance record:', acceptError);
        // Revertir el cambio de estado si falla
        await supabase
          .from('searching_pool')
          .update({ status: 'searching' })
          .eq('id', passenger.id);
        alert('Error al aceptar pasajero');
        return;
      }
      
      // Actualizar estado local
      const newAccepted = [...acceptedPassengers, passenger];
      updateAppState({ acceptedPassengers: newAccepted });
      
      // Remover de la lista
      setPassengers(passengers.filter(p => p.id !== passenger.id));
      
      alert(`✅ ${passenger.profile.full_name} aceptado correctamente`);
    } catch (error) {
      console.error('Error:', error);
      alert('Error al aceptar pasajero');
    }
  };

  const startTrip = async () => {
    if (acceptedPassengers.length === 0) {
      alert('Debes aceptar al menos un pasajero para iniciar el viaje');
      return;
    }

    try {
      // Actualizar el estado del conductor a "in_progress"
      const { error: driverError } = await supabase
        .from('searching_pool')
        .update({ status: 'in_progress' })
        .eq('id', currentTripId);

      if (driverError) {
        console.error('Error updating driver status:', driverError);
        alert('Error al actualizar estado del conductor');
        return;
      }

      // Actualizar el estado de todos los pasajeros aceptados a "in_progress"
      const passengerIds = acceptedPassengers.map(p => p.id);
      const { error: passengerError } = await supabase
        .from('searching_pool')
        .update({ status: 'in_progress' })
        .in('id', passengerIds);

      if (passengerError) {
        console.error('Error updating passenger status:', passengerError);
        alert('Error al actualizar estado de pasajeros');
        return;
      }

      // Crear registro del viaje en successful_trips
      const { data: tripData, error: tripError } = await supabase
        .from('successful_trips')
        .insert({
          driver_id: user.id,
          status: 'started',
          total_passengers: acceptedPassengers.length,
          total_earnings: acceptedPassengers.length * 5000
        })
        .select()
        .single();

      if (tripError) {
        console.error('Error creating trip record:', tripError);
        // Continuar de todos modos
      }

      alert('✅ Viaje iniciado correctamente');
      navigate('liveTrip');
    } catch (error) {
      console.error('Error:', error);
      alert('Error al iniciar viaje');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('dashboard')}
            className="text-green-700 hover:underline flex items-center space-x-2 mb-4"
          >
            <span>← Volver al Dashboard</span>
          </button>
          <h1 className="text-3xl font-bold text-gray-800">Pasajeros Disponibles</h1>
          <p className="text-gray-600 mt-2">Selecciona los pasajeros que deseas recoger en tu ruta</p>
        </div>

        {/* Estado de error si existe */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-700">⚠️ {error}</p>
          </div>
        )}

        {/* Lista de Pasajeros */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800">Pasajeros Encontrados</h2>
            <div className="flex items-center space-x-3">
              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                {passengers.length} disponibles
              </span>
              <button
                onClick={loadPassengers}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
                title="Actualizar"
              >
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
              <p className="text-gray-600 mb-2">No hay pasajeros buscando viaje en este momento</p>
              <p className="text-sm text-gray-500">La búsqueda se actualiza automáticamente cada 5 segundos</p>
              <button
                onClick={loadPassengers}
                className="mt-4 text-green-700 hover:underline flex items-center space-x-2 mx-auto"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Actualizar manualmente</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {passengers.map((passenger) => (
                <div 
                  key={passenger.id} 
                  className="border border-gray-200 rounded-xl p-4 hover:border-green-300 transition-all duration-200 hover:shadow-md"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {/* Información del pasajero */}
                      <div className="flex items-center space-x-3 mb-3">
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-green-700" />
                        </div>
                        <div>
                          <span className="font-semibold text-gray-800">
                            {passenger.profile.full_name}
                          </span>
                          <div className="flex items-center space-x-1 mt-1">
                            <Star className="w-4 h-4 text-yellow-400 fill-current" />
                            <span className="text-sm text-gray-600">{passenger.profile.rating}</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Ubicaciones */}
                      <div className="space-y-2 text-sm text-gray-600 ml-13">
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

                    {/* Botón de aceptar */}
                    <button
                      onClick={() => acceptPassenger(passenger)}
                      className="ml-4 bg-green-700 text-white px-6 py-2 rounded-lg hover:bg-green-800 transition font-semibold whitespace-nowrap"
                    >
                      Aceptar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pasajeros Aceptados */}
        {acceptedPassengers.length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-green-900 mb-3 flex items-center space-x-2">
              <CheckCircle className="w-5 h-5" />
              <span>Pasajeros Aceptados ({acceptedPassengers.length})</span>
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

            <div className="bg-white rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Ganancia estimada:</span>
                <span className="font-bold text-green-700 text-lg">
                  ${(acceptedPassengers.length * 5000).toLocaleString('es-CO')}
                </span>
              </div>
            </div>

            <button
              onClick={startTrip}
              className="w-full bg-green-700 text-white py-4 rounded-lg font-semibold hover:bg-green-800 transition shadow-lg transform hover:scale-105"
            >
              🚗 Iniciar Viaje con {acceptedPassengers.length} pasajero{acceptedPassengers.length > 1 ? 's' : ''}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DriverMatchingScreen;