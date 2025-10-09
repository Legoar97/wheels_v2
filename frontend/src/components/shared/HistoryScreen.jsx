import React, { useState, useEffect } from 'react';
import { Car, Clock, MapPin, Navigation, Star } from 'lucide-react';

const HistoryScreen = ({ user, profile, navigate, supabase }) => {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, completed, cancelled

  useEffect(() => {
    loadTrips();
  }, [user.id]);

  const loadTrips = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('successful_trips')
        .select('*')
        .eq('driver_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Error loading trips:', error);
      } else {
        setTrips(data || []);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Hoy';
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return `Hace ${diffDays} días`;
    if (diffDays < 30) return `Hace ${Math.ceil(diffDays / 7)} semanas`;
    return date.toLocaleDateString('es-CO');
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
          <h1 className="text-3xl font-bold text-gray-800">Historial de Viajes</h1>
          <p className="text-gray-600 mt-2">Revisa todos tus viajes anteriores</p>
        </div>

        {/* Estadísticas Resumen */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Resumen General</h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-green-50 rounded-xl p-4">
              <div className="text-3xl font-bold text-green-700">{profile?.total_trips || 0}</div>
              <div className="text-sm text-gray-600 mt-1">Total de Viajes</div>
            </div>
            <div className="bg-green-50 rounded-xl p-4">
              <div className="text-3xl font-bold text-green-600">{profile?.completed_trips || 0}</div>
              <div className="text-sm text-gray-600 mt-1">Completados</div>
            </div>
            <div className="bg-red-50 rounded-xl p-4">
              <div className="text-3xl font-bold text-red-600">{profile?.cancelled_trips || 0}</div>
              <div className="text-sm text-gray-600 mt-1">Cancelados</div>
            </div>
            <div className="bg-yellow-50 rounded-xl p-4">
              <div className="flex items-center justify-center space-x-1">
                <Star className="w-6 h-6 text-yellow-400 fill-current" />
                <div className="text-3xl font-bold text-gray-800">{profile?.rating || '5.0'}</div>
              </div>
              <div className="text-sm text-gray-600 mt-1">Calificación</div>
            </div>
          </div>

          {/* Ganancias totales (solo para conductores) */}
          {profile?.user_type === 'driver' && trips.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Ganancias totales estimadas:</span>
                <span className="text-2xl font-bold text-green-700">
                  ${(trips.reduce((sum, trip) => sum + (trip.total_earnings || 0), 0)).toLocaleString('es-CO')}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-xl shadow p-4 mb-6">
          <div className="flex items-center space-x-2 overflow-x-auto">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg font-medium transition whitespace-nowrap ${
                filter === 'all' 
                  ? 'bg-green-700 text-white' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setFilter('completed')}
              className={`px-4 py-2 rounded-lg font-medium transition whitespace-nowrap ${
                filter === 'completed' 
                  ? 'bg-green-700 text-white' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Completados
            </button>
            <button
              onClick={() => setFilter('cancelled')}
              className={`px-4 py-2 rounded-lg font-medium transition whitespace-nowrap ${
                filter === 'cancelled' 
                  ? 'bg-green-700 text-white' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Cancelados
            </button>
          </div>
        </div>

        {/* Lista de Viajes */}
        <div className="space-y-4">
          {loading ? (
            <div className="bg-white rounded-xl shadow p-8 text-center">
              <div className="animate-spin w-12 h-12 border-4 border-green-200 border-t-green-700 rounded-full mx-auto mb-4"></div>
              <p className="text-gray-600">Cargando historial...</p>
            </div>
          ) : trips.length === 0 ? (
            <div className="bg-white rounded-xl shadow p-12 text-center">
              <Clock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-800 mb-2">No hay viajes registrados</h3>
              <p className="text-gray-600 mb-6">Comienza a usar Wheels para ver tu historial aquí</p>
              <button
                onClick={() => navigate('dashboard')}
                className="bg-green-700 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-800 transition"
              >
                Buscar Viaje
              </button>
            </div>
          ) : (
            trips.map((trip, idx) => (
              <div 
                key={trip.id} 
                className="bg-white rounded-xl shadow hover:shadow-lg transition p-4 border border-gray-100"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                      <Car className="w-6 h-6 text-green-700" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800">Viaje #{trips.length - idx}</h3>
                      <p className="text-sm text-gray-500">{formatDate(trip.created_at)}</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                    Completado
                  </span>
                </div>

                <div className="space-y-2 text-sm text-gray-600 mb-3">
                  <div className="flex items-start space-x-2">
                    <MapPin className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Origen: Punto de inicio</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <Navigation className="w-4 h-4 text-green-700 mt-0.5 flex-shrink-0" />
                    <span>Destino: Universidad Externado</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                    {trip.total_passengers && (
                      <span>👥 {trip.total_passengers} pasajeros</span>
                    )}
                    {trip.total_distance_km && (
                      <span>📍 {trip.total_distance_km} km</span>
                    )}
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-1">
                      <Star className="w-4 h-4 text-yellow-400 fill-current" />
                      <span className="text-sm font-semibold text-gray-800">
                        {trip.driver_rating || '5.0'}
                      </span>
                    </div>
                    {trip.total_earnings && (
                      <span className="text-green-700 font-semibold text-sm">
                        +${trip.total_earnings.toLocaleString('es-CO')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Mensaje motivacional */}
        {trips.length > 0 && (
          <div className="mt-8 bg-gradient-to-r from-green-50 to-green-100 border border-green-200 rounded-xl p-6 text-center">
            <h3 className="text-lg font-bold text-green-900 mb-2">
              🎉 ¡Excelente trabajo!
            </h3>
            <p className="text-green-800">
              Has completado {profile?.completed_trips || 0} viajes. 
              Sigue contribuyendo a una movilidad más sostenible.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoryScreen;