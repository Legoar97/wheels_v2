import React, { useState, useEffect } from 'react';
import { Car, Clock, MapPin, Navigation, Star, TrendingUp, Eye, Filter } from 'lucide-react';
import TripDetailModal from '../trip/TripDetailModal';

const HistoryScreen = ({ user, profile, navigate, supabase }) => {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, completed, cancelled
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [stats, setStats] = useState({
    totalEarnings: 0,
    totalDuration: 0,
    averageRating: 0,
    totalPassengers: 0
  });

  useEffect(() => {
    loadTrips();
  }, [user.id, filter]);

  const loadTrips = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('successful_trips')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      // Filtrar por conductor o pasajero según el tipo de usuario
      if (profile?.user_type === 'driver') {
        query = query.eq('driver_id', user.id);
      } else {
        // Para pasajeros, buscar en driver_acceptances
        const { data: acceptances } = await supabase
          .from('driver_acceptances')
          .select('searching_pool_id')
          .eq('passenger_id', user.id);
        
        if (acceptances && acceptances.length > 0) {
          // Obtener los trips correspondientes
          const tripIds = acceptances.map(a => a.searching_pool_id);
          query = query.in('id', tripIds);
        }
      }

      // Aplicar filtro de estado
      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error loading trips:', error);
      } else {
        setTrips(data || []);
        calculateStats(data || []);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (tripsData) => {
    const stats = tripsData.reduce((acc, trip) => {
      return {
        totalEarnings: acc.totalEarnings + (trip.total_earnings || 0),
        totalDuration: acc.totalDuration + (trip.trip_duration_minutes || 0),
        totalPassengers: acc.totalPassengers + (trip.total_passengers || 0),
        ratingSum: acc.ratingSum + (trip.driver_rating || 0),
        ratingCount: acc.ratingCount + (trip.driver_rating ? 1 : 0)
      };
    }, { totalEarnings: 0, totalDuration: 0, totalPassengers: 0, ratingSum: 0, ratingCount: 0 });

    setStats({
      totalEarnings: stats.totalEarnings,
      totalDuration: stats.totalDuration,
      totalPassengers: stats.totalPassengers,
      averageRating: stats.ratingCount > 0 ? (stats.ratingSum / stats.ratingCount).toFixed(1) : 0
    });
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

  const formatDuration = (minutes) => {
    if (!minutes) return 'N/A';
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}min`;
  };

  const openTripDetail = (trip) => {
    setSelectedTrip(trip);
    setShowDetailModal(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('dashboard')}
            className="text-green-700 hover:underline flex items-center space-x-2 mb-4"
          >
            <span>← Volver al Dashboard</span>
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Historial de Viajes</h1>
              <p className="text-gray-600 mt-2">Revisa todos tus viajes anteriores</p>
            </div>
            <div className="flex items-center space-x-2">
              <Filter className="w-5 h-5 text-gray-600" />
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              >
                <option value="all">Todos</option>
                <option value="completed">Completados</option>
                <option value="cancelled">Cancelados</option>
              </select>
            </div>
          </div>
        </div>

        {/* Estadísticas Mejoradas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Total de Viajes */}
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl shadow-lg p-6 text-white">
            <div className="flex items-center justify-between mb-2">
              <Car className="w-8 h-8 opacity-80" />
              <TrendingUp className="w-5 h-5 opacity-60" />
            </div>
            <div className="text-4xl font-bold mb-1">{profile?.total_trips || 0}</div>
            <div className="text-sm opacity-90">Viajes Totales</div>
            <div className="mt-3 pt-3 border-t border-white/20 text-xs opacity-75">
              {profile?.completed_trips || 0} completados
            </div>
          </div>

          {/* Ganancias Totales (solo conductores) */}
          {profile?.user_type === 'driver' && (
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-lg p-6 text-white">
              <div className="flex items-center justify-between mb-2">
                <span className="text-3xl">💰</span>
                <TrendingUp className="w-5 h-5 opacity-60" />
              </div>
              <div className="text-4xl font-bold mb-1">
                ${(stats.totalEarnings / 1000).toFixed(0)}K
              </div>
              <div className="text-sm opacity-90">Ganancia Total</div>
              <div className="mt-3 pt-3 border-t border-white/20 text-xs opacity-75">
                ${stats.totalEarnings.toLocaleString('es-CO')} COP
              </div>
            </div>
          )}

          {/* Tiempo Total */}
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl shadow-lg p-6 text-white">
            <div className="flex items-center justify-between mb-2">
              <Clock className="w-8 h-8 opacity-80" />
              <TrendingUp className="w-5 h-5 opacity-60" />
            </div>
            <div className="text-4xl font-bold mb-1">
              {Math.round(stats.totalDuration / 60)}h
            </div>
            <div className="text-sm opacity-90">Tiempo Total</div>
            <div className="mt-3 pt-3 border-t border-white/20 text-xs opacity-75">
              {formatDuration(stats.totalDuration)}
            </div>
          </div>

          {/* Rating Promedio */}
          <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-2xl shadow-lg p-6 text-white">
            <div className="flex items-center justify-between mb-2">
              <Star className="w-8 h-8 opacity-80 fill-current" />
              <TrendingUp className="w-5 h-5 opacity-60" />
            </div>
            <div className="text-4xl font-bold mb-1">
              {profile?.rating || stats.averageRating || '5.0'}
            </div>
            <div className="text-sm opacity-90">Calificación</div>
            <div className="mt-3 pt-3 border-t border-white/20 text-xs opacity-75">
              {stats.totalPassengers} pasajeros llevados
            </div>
          </div>
        </div>

        {/* Gráfico de Progreso */}
        {trips.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Progreso Mensual</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-green-50 rounded-xl">
                <div className="text-2xl font-bold text-green-700">
                  {trips.filter(t => {
                    const date = new Date(t.created_at);
                    const now = new Date();
                    return date.getMonth() === now.getMonth();
                  }).length}
                </div>
                <div className="text-xs text-gray-600 mt-1">Este mes</div>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-xl">
                <div className="text-2xl font-bold text-blue-700">
                  {trips.filter(t => {
                    const date = new Date(t.created_at);
                    const now = new Date();
                    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
                    return date >= weekAgo;
                  }).length}
                </div>
                <div className="text-xs text-gray-600 mt-1">Esta semana</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-xl">
                <div className="text-2xl font-bold text-purple-700">
                  {profile?.user_type === 'driver' 
                    ? `$${(stats.totalEarnings / (profile?.completed_trips || 1)).toFixed(0)}`
                    : formatDuration(stats.totalDuration / (profile?.completed_trips || 1))
                  }
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  {profile?.user_type === 'driver' ? 'Promedio/viaje' : 'Duración promedio'}
                </div>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-xl">
                <div className="text-2xl font-bold text-yellow-700">
                  {((profile?.completed_trips || 0) / Math.max((profile?.total_trips || 1), 1) * 100).toFixed(0)}%
                </div>
                <div className="text-xs text-gray-600 mt-1">Tasa de finalización</div>
              </div>
            </div>
          </div>
        )}

        {/* Lista de Viajes */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-800">
              Viajes Recientes ({trips.length})
            </h2>
          </div>

          <div className="divide-y divide-gray-200">
            {loading ? (
              <div className="p-12 text-center">
                <div className="animate-spin w-12 h-12 border-4 border-green-200 border-t-green-700 rounded-full mx-auto mb-4"></div>
                <p className="text-gray-600">Cargando historial...</p>
              </div>
            ) : trips.length === 0 ? (
              <div className="p-12 text-center">
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
                  className="p-6 hover:bg-gray-50 transition cursor-pointer"
                  onClick={() => openTripDetail(trip)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4 flex-1">
                      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <Car className="w-6 h-6 text-green-700" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="font-semibold text-gray-800">
                            Viaje #{trips.length - idx}
                          </h3>
                          <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                            {trip.status === 'completed' ? 'Completado' : 'Cancelado'}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600">
                          <div className="flex items-center space-x-2">
                            <Clock className="w-4 h-4 flex-shrink-0" />
                            <span>{formatDate(trip.created_at)}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span>👥 {trip.total_passengers || 0} pasajeros</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span>⏱️ {formatDuration(trip.trip_duration_minutes)}</span>
                          </div>
                          {trip.driver_rating && (
                            <div className="flex items-center space-x-1">
                              <Star className="w-4 h-4 text-yellow-400 fill-current" />
                              <span className="font-semibold">{trip.driver_rating}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4 ml-4">
                      {trip.total_earnings && profile?.user_type === 'driver' && (
                        <div className="text-right">
                          <div className="text-green-700 font-bold text-lg">
                            +${trip.total_earnings.toLocaleString('es-CO')}
                          </div>
                          <div className="text-xs text-gray-500">Ganancia</div>
                        </div>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openTripDetail(trip);
                        }}
                        className="p-2 hover:bg-gray-200 rounded-lg transition"
                      >
                        <Eye className="w-5 h-5 text-gray-600" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Mensaje motivacional */}
        {trips.length > 0 && (
          <div className="mt-8 bg-gradient-to-r from-green-50 to-green-100 border-2 border-green-200 rounded-2xl p-6 text-center">
            <h3 className="text-lg font-bold text-green-900 mb-2">
              🎉 ¡Excelente trabajo!
            </h3>
            <p className="text-green-800">
              Has completado {profile?.completed_trips || 0} viajes. 
              Sigue contribuyendo a una movilidad más sostenible.
            </p>
            {(profile?.completed_trips || 0) >= 50 && (
              <div className="mt-4 inline-block px-4 py-2 bg-yellow-400 text-yellow-900 rounded-full font-semibold">
                🏆 Conductor/Pasajero Elite
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal de Detalles */}
      {showDetailModal && selectedTrip && (
        <TripDetailModal
          tripId={selectedTrip.id}
          isOpen={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedTrip(null);
          }}
          supabase={supabase}
          userType={profile?.user_type}
        />
      )}
    </div>
  );
};

export default HistoryScreen;