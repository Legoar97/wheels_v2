import React, { useState, useEffect } from 'react';
import { CheckCircle } from 'lucide-react';

const PassengerMatchingScreen = ({ user, navigate, supabase }) => {
  const [searchStatus, setSearchStatus] = useState('searching');
  const [matchFound, setMatchFound] = useState(false);

  useEffect(() => {
    // Simular búsqueda y suscribirse a cambios en driver_acceptances
    const checkForMatch = async () => {
      // Suscribirse a la tabla driver_acceptances
      const subscription = supabase
        .channel('driver_acceptances_channel')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'driver_acceptances',
            filter: `passenger_email=eq.${user.email}`
          },
          (payload) => {
            console.log('Match found!', payload);
            setMatchFound(true);
            setSearchStatus('matched');
          }
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    };

    checkForMatch();

    // Simular progreso de búsqueda
    const statusTimer = setTimeout(() => {
      setSearchStatus('analyzing');
    }, 2000);

    const statusTimer2 = setTimeout(() => {
      setSearchStatus('optimizing');
    }, 4000);

    return () => {
      clearTimeout(statusTimer);
      clearTimeout(statusTimer2);
    };
  }, [user.email, supabase]);

  const cancelSearch = async () => {
    try {
      // Cancelar la búsqueda actualizando el estado en searching_pool
      await supabase
        .from('searching_pool')
        .update({ status: 'cancelled' })
        .eq('user_id', user.id)
        .eq('status', 'searching');
      
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
            <h2 className="text-3xl font-bold text-gray-800 mb-2">¡Match Encontrado!</h2>
            <p className="text-gray-600 mb-6">
              Un conductor ha aceptado tu solicitud de viaje
            </p>
            
            <div className="bg-green-50 rounded-xl p-4 mb-6 text-left">
              <h3 className="font-semibold text-green-900 mb-2">Próximos pasos:</h3>
              <ul className="text-sm text-green-800 space-y-2">
                <li>✓ El conductor está preparando la ruta</li>
                <li>✓ Recibirás una notificación cuando inicie el viaje</li>
                <li>✓ Prepárate en el punto de recogida acordado</li>
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
                searchStatus === 'optimizing' ? 'text-green-600' : 
                searchStatus === 'analyzing' ? 'text-green-600' : 'text-gray-400'
              }`} />
              <span className={searchStatus === 'analyzing' || searchStatus === 'optimizing' ? 'text-gray-700' : 'text-gray-600'}>
                Verificando disponibilidad
              </span>
            </div>

            <div className={`flex items-center space-x-3 text-sm ${
              searchStatus === 'optimizing' ? 'animate-pulse' : ''
            }`}>
              <div className={`w-5 h-5 border-2 rounded-full flex-shrink-0 ${
                searchStatus === 'optimizing' ? 'border-green-700 animate-spin' : 'border-gray-300'
              }`}></div>
              <span className={searchStatus === 'optimizing' ? 'text-gray-700' : 'text-gray-600'}>
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

          <button
            onClick={cancelSearch}
            className="text-gray-600 hover:text-gray-800 hover:underline text-sm transition"
          >
            Cancelar búsqueda
          </button>
        </div>

        {/* Consejos mientras espera */}
        <div className="mt-6 bg-white rounded-xl shadow p-4">
          <h3 className="font-semibold text-gray-800 mb-2 text-sm">Mientras esperas:</h3>
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