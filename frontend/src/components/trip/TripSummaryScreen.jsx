import React, { useState, useEffect } from 'react';
import { CheckCircle, Star, MapPin, Navigation, Clock, DollarSign, Users, TrendingUp } from 'lucide-react';

const TripSummaryScreen = ({ user, profile, navigate, supabase, tripId }) => {
  const [tripData, setTripData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [passengers, setPassengers] = useState([]);
  const [earnings, setEarnings] = useState(0);

  useEffect(() => {
    loadTripSummary();
  }, [tripId]);

  const loadTripSummary = async () => {
    try {
      // Cargar datos del viaje
      const { data: trip, error: tripError } = await supabase
        .from('successful_trips')
        .select('*')
        .eq('id', tripId)
        .single();

      if (tripError) throw tripError;
      setTripData(trip);

      // Cargar información de pasajeros
      const { data: acceptances, error: acceptError } = await supabase
        .from('driver_acceptances')
        .select(`
          *,
          profiles!driver_acceptances_passenger_id_fkey(full_name, rating)
        `)
        .eq('driver_id', user.id);

      if (!acceptError && acceptances) {
        setPassengers(acceptances);
        setEarnings(trip.total_earnings || acceptances.length * 5000);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error cargando resumen:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-green-200 border-t-green-700 rounded-full"></div>
      </div>
    );
  }

  const formatDuration = (minutes) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}min`;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('es-CO', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header con gradiente */}
      <div className="bg-gradient-to-br from-green-600 to-green-800 pt-8 pb-24 px-6">
        <div className="max-w-4xl mx-auto text-center text-white">
          <CheckCircle className="w-20 h-20 mx-auto mb-4 animate-bounce" />
          <h1 className="text-3xl font-bold mb-2">¡Viaje Completado!</h1>
          <p className="text-green-100 text-lg">Excelente trabajo</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 -mt-16">
        {/* Tarjeta de Ganancias */}
        <div className="bg-white rounded-2xl shadow-2xl p-8 mb-6">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
              <DollarSign className="w-8 h-8 text-green-700" />
            </div>
            <h2 className="text-gray-600 text-sm font-medium mb-2">Total Ganado</h2>
            <div className="text-5xl font-bold text-green-700 mb-2">
              ${earnings.toLocaleString('es-CO')}
            </div>
            <p className="text-gray-500 text-sm">
              {passengers.length} pasajero{passengers.length !== 1 ? 's' : ''} × $5.000
            </p>
          </div>

          {/* Métricas del viaje */}
          <div className="grid grid-cols-3 gap-4 pt-6 border-t border-gray-200">
            <div className="text-center">
              <Clock className="w-6 h-6 text-blue-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-gray-800">
                {formatDuration(tripData?.trip_duration_minutes || 0)}
              </div>
              <div className="text-xs text-gray-600 mt-1">Duración</div>
            </div>
            <div className="text-center">
              <Users className="w-6 h-6 text-green-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-gray-800">
                {passengers.length}
              </div>
              <div className="text-xs text-gray-600 mt-1">Pasajeros</div>
            </div>
            <div className="text-center">
              <TrendingUp className="w-6 h-6 text-purple-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-gray-800">
                ${(earnings / (tripData?.trip_duration_minutes || 1) * 60).toFixed(0)}
              </div>
              <div className="text-xs text-gray-600 mt-1">COP/hora</div>
            </div>
          </div>
        </div>

        {/* Detalles del Viaje */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
            <Navigation className="w-5 h-5 mr-2 text-green-700" />
            Detalles del Viaje
          </h3>
          
          <div className="space-y-4">
            <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
              <Clock className="w-5 h-5 text-gray-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-gray-600">Inicio</p>
                <p className="font-medium text-gray-800">
                  {formatDate(tripData?.started_at)}
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-gray-600">Finalización</p>
                <p className="font-medium text-gray-800">
                  {formatDate(tripData?.completed_at)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Lista de Pasajeros */}
        {passengers.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
              <Users className="w-5 h-5 mr-2 text-green-700" />
              Pasajeros del Viaje
            </h3>
            
            <div className="space-y-3">
              {passengers.map((passenger, idx) => (
                <div 
                  key={idx} 
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:border-green-300 transition"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                      <span className="text-xl font-bold text-green-700">
                        {(passenger.profiles?.full_name || 'P')[0].toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800">
                        {passenger.profiles?.full_name || 'Pasajero'}
                      </p>
                      <div className="flex items-center space-x-1 text-sm text-gray-600">
                        <MapPin className="w-3 h-3" />
                        <span className="text-xs">
                          {passenger.trip_info?.pickup?.substring(0, 30)}...
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-green-700">$5.000</div>
                    {passenger.profiles?.rating && (
                      <div className="flex items-center space-x-1 text-sm text-gray-600">
                        <Star className="w-3 h-3 text-yellow-400 fill-current" />
                        <span>{passenger.profiles.rating}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Estadísticas Personales */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-200 rounded-2xl p-6 mb-6">
          <h3 className="text-lg font-bold text-green-900 mb-4">
            📊 Tu Progreso en Wheels
          </h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-green-700">
                {profile?.completed_trips || 0}
              </div>
              <div className="text-sm text-gray-600 mt-1">Viajes Totales</div>
            </div>
            <div className="bg-white rounded-xl p-4 text-center">
              <div className="flex items-center justify-center space-x-1">
                <Star className="w-6 h-6 text-yellow-400 fill-current" />
                <span className="text-3xl font-bold text-gray-800">
                  {profile?.rating || '5.0'}
                </span>
              </div>
              <div className="text-sm text-gray-600 mt-1">Calificación</div>
            </div>
          </div>

          {profile?.completed_trips >= 10 && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
              <span className="text-2xl mr-2">🏆</span>
              <span className="text-sm font-semibold text-yellow-900">
                ¡Conductor Experimentado!
              </span>
            </div>
          )}
        </div>

        {/* Consejos y Motivación */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 mb-6">
          <h3 className="font-bold text-blue-900 mb-3">💡 Consejos para mejorar</h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li className="flex items-start space-x-2">
              <span className="text-blue-600">•</span>
              <span>Mantén tu auto limpio para obtener mejores calificaciones</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="text-blue-600">•</span>
              <span>Sé puntual en los puntos de recogida</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="text-blue-600">•</span>
              <span>Una buena conversación mejora la experiencia del pasajero</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="text-blue-600">•</span>
              <span>Comparte música que sea del agrado de todos</span>
            </li>
          </ul>
        </div>

        {/* Botones de Acción */}
        <div className="space-y-3 pb-8">
          <button
            onClick={() => navigate('dashboard')}
            className="w-full bg-green-700 text-white py-4 rounded-xl font-semibold hover:bg-green-800 transition shadow-lg"
          >
            Volver al Dashboard
          </button>
          
          <button
            onClick={() => navigate('history')}
            className="w-full bg-white text-green-700 border-2 border-green-700 py-4 rounded-xl font-semibold hover:bg-green-50 transition"
          >
            Ver Historial Completo
          </button>
        </div>

        {/* Footer motivacional */}
        <div className="text-center pb-8">
          <p className="text-gray-600 text-sm">
            ¡Gracias por contribuir a una movilidad más sostenible! 🌱
          </p>
        </div>
      </div>
    </div>
  );
};

export default TripSummaryScreen;