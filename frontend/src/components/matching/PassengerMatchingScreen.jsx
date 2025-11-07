import React, { useState, useEffect } from 'react';
import { CheckCircle, Clock } from 'lucide-react';

const PassengerMatchingScreen = ({ user, navigate, supabase, appState, updateAppState }) => {
  const [searchStatus, setSearchStatus] = useState('searching');
  const [matchFound, setMatchFound] = useState(false);
  const [myRequestId, setMyRequestId] = useState(appState.currentTripId); // Usar el ID del appState
  const [driverInfo, setDriverInfo] = useState(null);
  const [driversFound, setDriversFound] = useState([]); // Almacenar conductores encontrados

  useEffect(() => {
    // Si no tenemos un ID de solicitud, navegar al dashboard
    if (!myRequestId) {
      console.error('No hay ID de solicitud de pasajero, volviendo al dashboard.');
      navigate('dashboard');
      return;
    }
    
    console.log('Iniciando pantalla de matching para request ID:', myRequestId);
    
    // Iniciar búsqueda de conductores
    findDrivers();

    // Iniciar polling de estado
    const statusInterval = setInterval(() => {
      checkMyRequestStatus();
    }, 3000); // Verificar cada 3 segundos

    // Iniciar búsqueda periódica de conductores
    const findInterval = setInterval(() => {
      if (!matchFound) { // Solo buscar si aún no hay match
        findDrivers();
      }
    }, 10000); // Buscar nuevos conductores cada 10 segundos

    return () => {
      clearInterval(statusInterval);
      clearInterval(findInterval);
    };
  }, [myRequestId, matchFound]);

  // Función para buscar conductores llamando al backend
  const findDrivers = async () => {
    if (!myRequestId || !appState.tripConfig) return;

    setSearchStatus('searching');
    try {
      // --- CONEXIÓN AL BACKEND ---
      const passengerData = {
        user_id: user.id,
        user_type: 'passenger',
        ...appState.tripConfig,
        pickup_lat: appState.tripConfig.pickupLat,
        pickup_lng: appState.tripConfig.pickupLng,
        dropoff_lat: appState.tripConfig.dropoffLat,
        dropoff_lng: appState.tripConfig.dropoffLng,
        pickup_address: appState.tripConfig.pickup,
        dropoff_address: appState.tripConfig.destination,
      };

      console.log('Enviando datos de pasajero al backend:', passengerData);

      const response = await fetch('/api/match/api/matchmaking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(passengerData),
      });

      if (!response.ok) {
        throw new Error(`Error del servidor: ${response.statusText}`);
      }

      const data = await response.json();
      // --- FIN CONEXIÓN AL BACKEND ---

      if (data.success && data.matches) {
        console.log('Conductores encontrados:', data.matches);
        setDriversFound(data.matches);
        setSearchStatus('analyzing'); // Actualizar estado visual
      } else {
        setDriversFound([]);
        setSearchStatus('searching');
      }
    } catch (error) {
      console.error('Error en findDrivers:', error);
      setSearchStatus('searching');
    }
  };

  // Función para verificar el estado de mi solicitud (polling)
  const checkMyRequestStatus = async () => {
    if (!myRequestId) return;
    
    try {
      const { data: poolData, error: poolError } = await supabase
        .from('searching_pool')
        .select('id, status, matched_driver_id')
        .eq('id', myRequestId)
        .single();

      if (poolError || !poolData) {
        console.error('❌ Error al buscar en pool o no se encontró:', poolError);
        return;
      }
      
      // 1. MÁXIMA PRIORIDAD: Detectar si el viaje ya se completó
      if (poolData.status === 'completed') {
        console.log('✅ VIAJE COMPLETADO - Redirigiendo a calificaciones...');
        await redirectToRatings(myRequestId);
        return;
      }

      // 2. DETECTAR SI EL VIAJE ESTÁ EN PROGRESO
      if (poolData.status === 'in_progress') {
        console.log('🚗 VIAJE EN PROGRESO - Navegando a pantalla de viaje en vivo...');
        navigate('passengerLiveTrip');
        return;
      }

      // 3. DETECTAR MATCH (si es la primera vez)
      if (poolData.status === 'matched' && poolData.matched_driver_id) {
        if (!matchFound) {
          console.log('✅ Match encontrado por primera vez!');
          setMatchFound(true);
          setSearchStatus('matched');
          loadDriverInfo(myRequestId, poolData.matched_driver_id);
          // Guardar el driverId en el appState para la pantalla de calificación
          updateAppState({ driverId: poolData.matched_driver_id });
        }
        return;
      }

      // 4. Detectar si el viaje fue cancelado
      if (poolData.status === 'cancelled') {
        console.log('❌ Viaje cancelado');
        alert('El viaje fue cancelado');
        navigate('dashboard');
      }

    } catch (error) {
      console.error('Error en verificación periódica:', error);
    }
  };

  const loadDriverInfo = async (requestId, driverUserId) => {
    try {
      console.log('Cargando info del conductor:', driverUserId);
      
      // Obtener info del conductor desde profiles
      const { data: driverProfile, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, rating, total_trips, user_type')
        .eq('user_id', driverUserId)
        .single();

      if (driverProfile && !profileError) {
        setDriverInfo({
          id: driverUserId,
          name: driverProfile.full_name || 'Conductor',
          rating: driverProfile.rating || 5.0,
          totalTrips: driverProfile.total_trips || 0,
          acceptedAt: new Date().toLocaleString('es-CO') // Usamos la hora actual
        });
        console.log('Info del conductor cargada:', driverProfile);
      } else {
        console.error('Error cargando perfil del conductor:', profileError);
        setDriverInfo({
          id: driverUserId,
          name: 'Conductor',
          rating: 5.0,
          totalTrips: 0,
          acceptedAt: new Date().toLocaleString('es-CO')
        });
      }
    } catch (error) {
      console.error('Error inesperado en loadDriverInfo:', error);
    }
  };

  const redirectToRatings = async (requestId) => {
    try {
      console.log('=== REDIRIGIENDO A CALIFICACIONES ===');
      console.log('Request ID:', requestId);
      
      const { data: acceptance, error: acceptanceError } = await supabase
        .from('driver_acceptances')
        .select('driver_id')
        .eq('searching_pool_id', requestId)
        .single();
      
      if (acceptanceError || !acceptance) {
        console.error('❌ Error buscando acceptance:', acceptanceError);
        alert('Error al cargar información del viaje. Volviendo al dashboard.');
        navigate('dashboard');
        return;
      }
      
      console.log('✅ Acceptance encontrado, driver_id:', acceptance.driver_id);
      
      const { data: trip, error: tripError } = await supabase
        .from('successful_trips')
        .select('id')
        .eq('driver_id', acceptance.driver_id)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(1)
        .single();
      
      if (tripError || !trip) {
        console.error('❌ Error buscando trip:', tripError);
        alert('Error al cargar viaje. Volviendo al dashboard.');
        navigate('dashboard');
        return;
      }
      
      console.log('✅ Trip encontrado para calificaciones:', trip.id);
      updateAppState({ 
        currentTripId: trip.id,
        driverId: acceptance.driver_id, // Guardamos el driverId para la pantalla de calificación
        acceptedPassengers: [] 
      });
      console.log('🎯 Navegando a tripCompleted...');
      navigate('tripCompleted');

    } catch (error) {
      console.error('❌ Error en redirectToRatings:', error);
      alert('Error inesperado. Volviendo al dashboard.');
      navigate('dashboard');
    }
  };

  const cancelSearch = async () => {
    try {
      if (myRequestId) {
        await supabase
          .from('searching_pool')
          .delete()
          .eq('id', myRequestId);
      }
      updateAppState({ currentTripId: null, tripConfig: {} }); // Limpiar estado
      navigate('dashboard');
    } catch (error) {
      console.error('Error canceling search:', error);
      navigate('dashboard');
    }
  };

  // ... El JSX de renderizado sigue igual ...
  if (matchFound) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center scale-in">
            <CheckCircle className="w-20 h-20 text-green-600 mx-auto mb-4 animate-bounce" />
            <h2 className="text-3xl font-bold text-gray-800 mb-2">¡Conductor Encontrado!</h2>
            <p className="text-gray-600 mb-6">
              Un conductor ha aceptado tu solicitud de viaje
            </p>

            {driverInfo && (
              <div className="bg-blue-50 rounded-xl p-4 mb-6 text-left">
                <h3 className="font-semibold text-blue-900 mb-3">Tu Conductor:</h3>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex-1">
                    <p className="font-bold text-blue-900 text-lg">{driverInfo.name}</p>
                    <div className="flex items-center space-x-3 mt-1">
                      <div className="flex items-center space-x-1">
                        <span className="text-yellow-500">⭐</span>
                        <span className="text-sm font-semibold text-blue-700">{driverInfo.rating.toFixed(1)}</span>
                      </div>
                      <span className="text-xs text-blue-600">
                        {driverInfo.totalTrips} viajes
                      </span>
                    </div>
                  </div>
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                    <span className="text-3xl">🚗</span>
                  </div>
                </div>
                <div className="pt-3 border-t border-blue-200">
                  <p className="text-xs text-blue-600">
                    Aceptado: {driverInfo.acceptedAt}
                  </p>
                </div>
              </div>
            )}
            
            <div className="bg-green-50 rounded-xl p-4 mb-6 text-left">
              <h3 className="font-semibold text-green-900 mb-2">Próximos pasos:</h3>
              <ul className="text-sm text-green-800 space-y-2">
                <li>✓ El conductor está preparando la ruta</li>
                <li>✓ Recibirás una actualización cuando inicie el viaje</li>
                <li>✓ Prepárate en el punto de recogida acordado</li>
              </ul>
            </div>

            <div className="bg-blue-50 rounded-xl p-4 mb-6 text-left">
              <h4 className="font-semibold text-blue-900 text-sm mb-2">💡 Información importante:</h4>
              <ul className="text-xs text-blue-700 space-y-1">
                <li>• Mantén tu teléfono cerca para recibir actualizaciones</li>
                <li>• Ten el dinero exacto preparado</li>
                <li>• Sé puntual en el punto de encuentro</li>
              </ul>
            </div>

            <button
              onClick={() => navigate('dashboard')}
              className="w-full bg-green-700 text-white py-3 rounded-lg font-semibold hover:bg-green-800 transition"
            >
              Volver al Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="relative mb-6">
            <div className="animate-spin w-16 h-16 border-4 border-green-200 border-t-green-700 rounded-full mx-auto"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 bg-green-100 rounded-full animate-pulse"></div>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-gray-800 mb-2">Buscando Conductor</h2>
          <p className="text-gray-600 mb-6">Estamos encontrando el mejor viaje para ti...</p>
          
          <div className="space-y-3 text-left bg-gray-50 rounded-xl p-4 mb-6">
            <div className={`flex items-center space-x-3 text-sm transition-all ${
              searchStatus === 'searching' ? 'animate-pulse' : ''
            }`}>
              <CheckCircle className={`w-5 h-5 flex-shrink-0 ${
                searchStatus !== 'searching' ? 'text-green-600' : 'text-gray-400'
              }`} />
              <span className={searchStatus !== 'searching' ? 'text-gray-700' : 'text-gray-600'}>
                Enviando solicitud
              </span>
            </div>

            <div className={`flex items-center space-x-3 text-sm transition-all ${
              searchStatus === 'analyzing' ? 'animate-pulse' : ''
            }`}>
              <CheckCircle className={`w-5 h-5 flex-shrink-0 ${
                searchStatus === 'analyzing' || searchStatus === 'matched' ? 'text-green-600' : 'text-gray-400'
              }`} />
              <span className={searchStatus === 'analyzing' || searchStatus === 'matched' ? 'text-gray-700' : 'text-gray-600'}>
                {driversFound.length > 0 ? `${driversFound.length} conductores notificados` : 'Buscando conductores...'}
              </span>
            </div>

            <div className={`flex items-center space-x-3 text-sm`}>
              <div className={`w-5 h-5 border-2 rounded-full flex-shrink-0 ${
                searchStatus === 'matched' ? 'border-green-600 bg-green-600' : 'border-gray-300'
              }`}></div>
              <span className={searchStatus === 'matched' ? 'text-gray-700' : 'text-gray-600'}>
                Esperando aceptación
              </span>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
            <div className="flex items-start space-x-3">
              <div className="text-2xl">💡</div>
              <div className="flex-1">
                <h4 className="font-semibold text-blue-900 text-sm mb-1">¿Sabías qué?</h4>
                <p className="text-xs text-blue-700">
                  En promedio, encontramos un conductor en menos de 2 minutos durante horas pico.
                </p>
              </div>
            </div>
          </div>

          {myRequestId && (
            <div className="text-xs text-gray-500 mb-4 font-mono">
              ID: {myRequestId.slice(0, 8)}...
            </div>
          )}

          <button
            onClick={cancelSearch}
            className="text-gray-600 hover:text-gray-800 hover:underline text-sm transition"
          >
            Cancelar búsqueda
          </button>
        </div>

        <div className="mt-6 bg-white rounded-xl shadow p-4">
          <h3 className="font-semibold text-gray-800 mb-2 text-sm flex items-center space-x-2">
            <Clock className="w-4 h-4" />
            <span>Mientras esperas:</span>
          </h3>
          <ul className="text-xs text-gray-600 space-y-1">
            <li>✓ Mantén tu teléfono cerca para recibir notificaciones</li>
            <li>✓ Prepara el dinero exacto si vas a pagar en efectivo</li>
            <li>✓ Revisa que estés en el punto de recogida correcto</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default PassengerMatchingScreen;