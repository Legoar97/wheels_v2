import React, { useState, useEffect } from 'react';
import { CheckCircle, Clock } from 'lucide-react';

const PassengerMatchingScreen = ({ user, navigate, supabase }) => {
  const [searchStatus, setSearchStatus] = useState('searching');
  const [matchFound, setMatchFound] = useState(false);
  const [myRequestId, setMyRequestId] = useState(null);
  const [driverInfo, setDriverInfo] = useState(null);

  useEffect(() => {
    // Obtener el ID de mi solicitud
    const getMyRequest = async () => {
      try {
        const { data, error } = await supabase
          .from('searching_pool')
          .select('id, status, matched_driver_id')
          .eq('user_id', user.id)
          .eq('tipo_de_usuario', 'passenger')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        
        if (data) {
          console.log('Mi solicitud encontrada:', data);
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
            // Seguir buscando, el conductor podría estar en proceso de aceptar
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

  useEffect(() => {
    if (!myRequestId || matchFound) return;

    console.log('Iniciando verificación periódica para request:', myRequestId);

    // Verificar driver_acceptances como fuente de verdad principal
    const checkAcceptance = setInterval(async () => {
      try {
        // PRIORIDAD 1: Verificar si existe un registro en driver_acceptances
        const { data: acceptance, error: acceptanceError } = await supabase
          .from('driver_acceptances')
          .select(`
            id,
            driver_id,
            created_at
          `)
          .eq('searching_pool_id', myRequestId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(); // Usar maybeSingle() en vez de single() para evitar errores si no existe

        if (acceptance && !acceptanceError) {
          console.log('✅ Aceptación encontrada en driver_acceptances:', acceptance);
          setMatchFound(true);
          setSearchStatus('matched');
          loadDriverInfo(myRequestId);
          clearInterval(checkAcceptance);
          return; // Salir temprano si encontramos el match
        }

        // PRIORIDAD 2: Como respaldo, verificar el estado en searching_pool
        // Esto es útil si hay un delay entre la inserción en ambas tablas
        const { data: poolData, error: poolError } = await supabase
          .from('searching_pool')
          .select('status, matched_driver_id')
          .eq('id', myRequestId)
          .single();
        
        if (poolData && !poolError) {
          console.log('Estado actual en searching_pool:', poolData.status);
          
          // Solo si hay un matched_driver_id, significa que el conductor inició el proceso
          if ((poolData.status === 'matched' || poolData.status === 'in_progress') && poolData.matched_driver_id) {
            console.log('⏳ Match detectado en searching_pool, esperando confirmación en driver_acceptances...');
            // No marcamos como encontrado aún, esperamos a que aparezca en driver_acceptances
          } else if (poolData.status === 'searching') {
            console.log('🔍 Todavía buscando conductor...');
          } else if (poolData.status === 'cancelled') {
            console.log('❌ Viaje cancelado');
            clearInterval(checkAcceptance);
            alert('El viaje fue cancelado');
            navigate('dashboard');
          }
        }
      } catch (error) {
        console.error('Error en verificación:', error);
      }
    }, 2000); // Verificar cada 2 segundos

    // Simular progreso visual solo si no hay match
    const progressTimeout1 = setTimeout(() => {
      if (!matchFound) setSearchStatus('analyzing');
    }, 3000);
    
    const progressTimeout2 = setTimeout(() => {
      if (!matchFound) setSearchStatus('optimizing');
    }, 6000);

    return () => {
      clearInterval(checkAcceptance);
      clearTimeout(progressTimeout1);
      clearTimeout(progressTimeout2);
    };
  }, [myRequestId, matchFound, user.email, supabase, navigate]);

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
                <li>✓ Recibirás una notificación cuando inicie el viaje</li>
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