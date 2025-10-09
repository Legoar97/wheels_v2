import React, { useState, useEffect } from 'react';
import { Navigation, MapPin, Clock, CheckCircle } from 'lucide-react';

const LiveTripScreen = ({ user, profile, navigate, supabase, appState }) => {
  const [currentStop, setCurrentStop] = useState(0);
  const [eta, setEta] = useState(15);
  const { acceptedPassengers } = appState;
  const isDriver = profile?.user_type === 'driver';

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
    try {
      // Registrar viaje exitoso
      const { error } = await supabase
        .from('successful_trips')
        .insert({
          driver_id: user.id,
          status: 'completed',
          total_passengers: acceptedPassengers.length,
          total_earnings: acceptedPassengers.length * 5000
        });

      if (error) {
        console.error('Error finishing trip:', error);
      }

      // Actualizar perfil
      await supabase
        .from('profiles')
        .update({ 
          total_trips: (profile.total_trips || 0) + 1,
          completed_trips: (profile.completed_trips || 0) + 1
        })
        .eq('user_id', user.id);

      alert('¡Viaje finalizado exitosamente! 🎉');
      navigate('dashboard');
    } catch (error) {
      console.error('Error:', error);
      alert('Error al finalizar viaje');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header con gradiente */}
      <div className="bg-gradient-to-br from-green-600 to-green-800 h-64 flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-1/4 right-1/4 w-32 h-32 bg-white rounded-full blur-3xl"></div>
        </div>
        <div className="text-white text-center z-10">
          <Navigation className="w-16 h-16 mx-auto mb-4 animate-pulse" />
          <h2 className="text-2xl font-bold">Viaje en Curso</h2>
          <p className="text-sm opacity-90 mt-2">
            {isDriver ? 'Siguiendo la ruta optimizada' : 'Tu conductor está en camino'}
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6 -mt-8">
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
                          {idx < currentStop ? 'Completado' : idx === currentStop ? 'Próxima parada' : `Parada ${idx + 1}`}
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
          <div className="space-y-3">
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
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
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