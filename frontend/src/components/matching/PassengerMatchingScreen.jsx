import React, { useState, useEffect } from 'react';
import { CheckCircle, Clock } from 'lucide-react';

const PassengerMatchingScreen = ({ user, navigate, supabase, updateAppState }) => {
  const [searchStatus, setSearchStatus] = useState('searching');
  const [matchFound, setMatchFound] = useState(false);
  const [myRequestId, setMyRequestId] = useState(null);
  const [driverInfo, setDriverInfo] = useState(null);

  useEffect(() => {
    // Obtener el ID de mi solicitud MÁS RECIENTE Y ACTIVA
    const getMyRequest = async () => {
      try {
        const { data, error } = await supabase
          .from('searching_pool')
          .select('id, status, matched_driver_id, created_at')
          .eq('user_id', user.id)
          .eq('tipo_de_usuario', 'passenger')
          .in('status', ['searching', 'matched', 'in_progress', 'completed']) // Solo estados activos
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(); // Usar maybeSingle en vez de single
        
        if (error) {
          console.error('Error buscando solicitud:', error);
          return;
        }
        
        if (data) {
          console.log('✅ Mi solicitud encontrada:', data);
          console.log('   ID:', data.id);
          console.log('   Status:', data.status);
          console.log('   Driver:', data.matched_driver_id);
          console.log('   Creado:', data.created_at);
          
          setMyRequestId(data.id);
          
          // IMPORTANTE: Verificar en driver_acceptances como fuente de verdad
          const { data: acceptance } = await supabase
            .from('driver_acceptances')
            .select('id, driver_id, created_at')
            .eq('searching_pool_id', data.id)
            .maybeSingle();

          // Si existe un registro en driver_acceptances, el match es real
          if (acceptance) {
            console.log('✅ Match confirmado en driver_acceptances al cargar');
            setMatchFound(true);
            setSearchStatus('matched');
            loadDriverInfo(data.id);
          } 
          // Si no hay acceptance pero el estado indica matched, algo está inconsistente
          else if (data.status === 'matched' || data.status === 'in_progress') {
            console.warn('⚠️ Estado matched/in_progress pero sin registro en driver_acceptances');
            // Si está in_progress, navegar directamente
            if (data.status === 'in_progress') {
              console.log('🚗 Viaje ya en progreso, navegando a pantalla de viaje en vivo...');
              navigate('passengerLiveTrip');
              return;
            }
            // Seguir buscando, el conductor podría estar en proceso de aceptar
          }
          // Si el estado es completed, redirigir a calificaciones
          else if (data.status === 'completed') {
            console.log('✅ Viaje ya completado, cargando datos para calificaciones...');
            await redirectToRatings(data.id);
          }
        } else {
          console.error('No se encontró solicitud activa');
        }
      } catch (error) {
        console.error('Error getting my request:', error);
      }
    };
    
    getMyRequest();
  }, [user.id, supabase]);

  const loadDriverInfo = async (requestId) => {
    try {
      // Buscar en driver_acceptances usando searching_pool_id
      const { data: acceptance, error } = await supabase
        .from('driver_acceptances')
        .select(`
          driver_id,
          passenger_id,
          trip_info,
          created_at
        `)
        .eq('searching_pool_id', requestId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (acceptance && !error) {
        console.log('Información de aceptación cargada:', acceptance);
        
        // Obtener info del conductor desde profiles
        const { data: driverProfile, error: profileError } = await supabase
          .from('profiles')
          .select('full_name, rating, total_trips, user_type')
          .eq('user_id', acceptance.driver_id)
          .single();

        if (driverProfile && !profileError) {
          setDriverInfo({
            id: acceptance.driver_id,
            name: driverProfile.full_name || 'Conductor',
            rating: driverProfile.rating || 5.0,
            totalTrips: driverProfile.total_trips || 0,
            acceptedAt: new Date(acceptance.created_at).toLocaleString('es-CO')
          });
          console.log('Info del conductor cargada:', driverProfile);
        } else {
          console.error('Error cargando perfil del conductor:', profileError);
          // Fallback con info mínima
          setDriverInfo({
            id: acceptance.driver_id,
            name: 'Conductor',
            rating: 5.0,
            totalTrips: 0,
            acceptedAt: new Date(acceptance.created_at).toLocaleString('es-CO')
          });
        }
      } else {
        console.error('Error cargando acceptance:', error);
      }
    } catch (error) {
      console.error('Error inesperado en loadDriverInfo:', error);
    }
  };

  const redirectToRatings = async (requestId) => {
    try {
      console.log('=== REDIRIGIENDO A CALIFICACIONES ===');
      console.log('Request ID:', requestId);
      
      // Cargar información del viaje para las calificaciones
      const { data: acceptance, error: acceptanceError } = await supabase
        .from('driver_acceptances')
        .select('driver_id')
        .eq('searching_pool_id', requestId)
        .single();
      
      if (acceptanceError) {
        console.error('❌ Error buscando acceptance:', acceptanceError);
        alert('Error al cargar información del viaje. Volviendo al dashboard.');
        navigate('dashboard');
        return;
      }
      
      if (acceptance) {
        console.log('✅ Acceptance encontrado, driver_id:', acceptance.driver_id);
        
        // Buscar el trip_id en successful_trips
        const { data: trip, error: tripError } = await supabase
          .from('successful_trips')
          .select('id')
          .eq('driver_id', acceptance.driver_id)
          .eq('status', 'completed')
          .order('completed_at', { ascending: false })
          .limit(1)
          .single();
        
        if (tripError) {
          console.error('❌ Error buscando trip:', tripError);
          alert('Error al cargar viaje. Volviendo al dashboard.');
          navigate('dashboard');
          return;
        }
        
        if (trip) {
          console.log('✅ Trip encontrado para calificaciones:', trip.id);
          // Actualizar appState con la info necesaria
          updateAppState({ 
            currentTripId: trip.id,
            acceptedPassengers: [] // Pasajero no necesita esta info
          });
          console.log('🎯 Navegando a tripCompleted...');
          navigate('tripCompleted');
        } else {
          console.error('❌ No se encontró el trip completado');
          alert('Viaje completado. Volviendo al dashboard.');
          navigate('dashboard');
        }
      } else {
        console.error('❌ No se encontró acceptance');
        alert('Error: No se encontró información del viaje.');
        navigate('dashboard');
      }
    } catch (error) {
      console.error('❌ Error en redirectToRatings:', error);
      alert('Error inesperado. Volviendo al dashboard.');
      navigate('dashboard');
    }
  };

  useEffect(() => {
    if (!myRequestId) return;

    console.log('Iniciando verificación periódica para request:', myRequestId);

    const checkStatusInterval = setInterval(async () => {
      try {
        console.log('🔄 Verificando con ID:', myRequestId);

        const { data: poolData, error: poolError } = await supabase
          .from('searching_pool')
          .select('id, status, matched_driver_id')
          .eq('id', myRequestId)
          .single();

        if (poolError || !poolData) {
          console.error('❌ Error al buscar en pool o no se encontró:', poolError);
          return;
        }

        console.log('📊 Estado actual:', poolData);

        // 1. MÁXIMA PRIORIDAD: Detectar si el viaje ya se completó
        if (poolData.status === 'completed') {
          console.log('✅ VIAJE COMPLETADO - Redirigiendo a calificaciones...');
          clearInterval(checkStatusInterval); // Detener el polling
          await redirectToRatings(myRequestId);
          return;
        }

        // 2. DETECTAR SI EL VIAJE ESTÁ EN PROGRESO Y NAVEGAR ⬅️ CAMBIO PRINCIPAL
        if (poolData.status === 'in_progress') {
          console.log('🚗 VIAJE EN PROGRESO - Navegando a pantalla de viaje en vivo...');
          clearInterval(checkStatusInterval); // Detener el polling
          navigate('passengerLiveTrip'); // ⬅️ NAVEGAR A LA PANTALLA DEL PASAJERO
          return;
        }

        // 3. DETECTAR MATCH (si es la primera vez)
        if (poolData.status === 'matched') {
          // Si el match aún no se ha mostrado en la UI, hazlo ahora
          if (!matchFound) {
            console.log('✅ Match encontrado por primera vez!');
            setMatchFound(true);
            setSearchStatus('matched');
            loadDriverInfo(myRequestId);
          }
          console.log('⏳ Match confirmado, esperando inicio de viaje...');
          return; // Continuar verificando en el siguiente intervalo
        }

        // 4. Detectar si el viaje fue cancelado
        if (poolData.status === 'cancelled') {
          console.log('❌ Viaje cancelado');
          clearInterval(checkStatusInterval);
          alert('El viaje fue cancelado');
          navigate('dashboard');
        }
        
      } catch (error) {
        console.error('Error en verificación periódica:', error);
      }
    }, 2000); // Verificar cada 2 segundos

    // Función de limpieza para detener el intervalo cuando el componente se desmonte
    return () => {
      clearInterval(checkStatusInterval);
    };
  }, [myRequestId, matchFound]); 

  const cancelSearch = async () => {
    try {
      if (myRequestId) {
        // Eliminar la solicitud
        await supabase
          .from('searching_pool')
          .delete()
          .eq('id', myRequestId);
      }
      
      navigate('dashboard');
    } catch (error) {
      console.error('Error canceling search:', error);
      navigate('dashboard');
    }
  };

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

            {/* Información del conductor si está disponible */}
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
          {/* Spinner de carga */}
          <div className="relative mb-6">
            <div className="animate-spin w-16 h-16 border-4 border-green-200 border-t-green-700 rounded-full mx-auto"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 bg-green-100 rounded-full animate-pulse"></div>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-gray-800 mb-2">Buscando Conductor</h2>
          <p className="text-gray-600 mb-6">Estamos encontrando el mejor viaje para ti...</p>
          
          {/* Estados de búsqueda */}
          <div className="space-y-3 text-left bg-gray-50 rounded-xl p-4 mb-6">
            <div className={`flex items-center space-x-3 text-sm transition-all ${
              searchStatus === 'searching' ? 'animate-pulse' : ''
            }`}>
              <CheckCircle className={`w-5 h-5 flex-shrink-0 ${
                searchStatus !== 'searching' ? 'text-green-600' : 'text-gray-400'
              }`} />
              <span className={searchStatus !== 'searching' ? 'text-gray-700' : 'text-gray-600'}>
                Analizando rutas compatibles
              </span>
            </div>

            <div className={`flex items-center space-x-3 text-sm transition-all ${
              searchStatus === 'analyzing' ? 'animate-pulse' : ''
            }`}>
              <CheckCircle className={`w-5 h-5 flex-shrink-0 ${
                searchStatus === 'optimizing' || searchStatus === 'matched' ? 'text-green-600' : 
                searchStatus === 'analyzing' ? 'text-green-600' : 'text-gray-400'
              }`} />
              <span className={searchStatus === 'analyzing' || searchStatus === 'optimizing' || searchStatus === 'matched' ? 'text-gray-700' : 'text-gray-600'}>
                Verificando disponibilidad
              </span>
            </div>

            <div className={`flex items-center space-x-3 text-sm ${
              searchStatus === 'optimizing' ? 'animate-pulse' : ''
            }`}>
              <div className={`w-5 h-5 border-2 rounded-full flex-shrink-0 ${
                searchStatus === 'matched' ? 'border-green-600 bg-green-600' :
                searchStatus === 'optimizing' ? 'border-green-700 animate-spin' : 'border-gray-300'
              }`}></div>
              <span className={searchStatus === 'optimizing' || searchStatus === 'matched' ? 'text-gray-700' : 'text-gray-600'}>
                Optimizando emparejamiento
              </span>
            </div>
          </div>

          {/* Información adicional */}
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

        {/* Consejos mientras espera */}
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