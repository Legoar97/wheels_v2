import React, { useState, useEffect } from 'react';
import { X, MapPin, Navigation, Clock, DollarSign, Star, User, Calendar } from 'lucide-react';

const TripDetailModal = ({ tripId, isOpen, onClose, supabase, userType }) => {
  const [tripData, setTripData] = useState(null);
  const [passengers, setPassengers] = useState([]);
  const [driver, setDriver] = useState(null);
  const [ratings, setRatings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && tripId) {
      loadTripDetails();
    }
  }, [isOpen, tripId]);

  const loadTripDetails = async () => {
    setLoading(true);
    try {
      // Cargar datos básicos del viaje
      const { data: trip, error: tripError } = await supabase
        .from('successful_trips')
        .select('*')
        .eq('id', tripId)
        .single();

      if (tripError) throw tripError;
      setTripData(trip);

      // Cargar información del conductor
      const { data: driverProfile, error: driverError } = await supabase
        .from('profiles')
        .select('user_id, full_name, rating, total_trips')
        .eq('user_id', trip.driver_id)
        .single();

      if (!driverError) setDriver(driverProfile);

      // Cargar pasajeros del viaje
      const { data: acceptances, error: acceptError } = await supabase
        .from('driver_acceptances')
        .select(`
          *,
          passenger_profile:profiles!driver_acceptances_passenger_id_fkey(
            user_id,
            full_name,
            rating
          )
        `)
        .eq('driver_id', trip.driver_id);

      if (!acceptError && acceptances) {
        setPassengers(acceptances);
      }

      // Cargar calificaciones
      const { data: tripRatings, error: ratingsError } = await supabase
        .from('trip_ratings')
        .select(`
          *,
          rater:profiles!trip_ratings_rater_id_fkey(full_name),
          rated:profiles!trip_ratings_rated_id_fkey(full_name)
        `)
        .eq('trip_id', tripId);

      if (!ratingsError && tripRatings) {
        setRatings(tripRatings);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error cargando detalles del viaje:', error);
      setLoading(false);
    }
  };

  if (!isOpen) return null;

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

  const formatDuration = (minutes) => {
    if (!minutes) return 'N/A';
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}min`;
  };

  const renderStars = (rating) => {
    return (
      <div className="flex items-center space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${
              star <= rating
                ? 'text-yellow-400 fill-current'
                : 'text-gray-300'
            }`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-2">Detalles del Viaje</h2>
              <p className="text-green-100 text-sm">
                {tripData && formatDate(tripData.started_at)}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin w-12 h-12 border-4 border-green-200 border-t-green-700 rounded-full mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando detalles...</p>
          </div>
        ) : (
          <div className="overflow-y-auto max-h-[calc(90vh-120px)]">
            {/* Métricas Principales */}
            <div className="grid grid-cols-4 gap-4 p-6 bg-gray-50">
              <div className="text-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <DollarSign className="w-6 h-6 text-green-700" />
                </div>
                <div className="text-2xl font-bold text-gray-800">
                  ${(tripData?.total_earnings || 0).toLocaleString('es-CO')}
                </div>
                <div className="text-xs text-gray-600 mt-1">Ganancia</div>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Clock className="w-6 h-6 text-blue-700" />
                </div>
                <div className="text-2xl font-bold text-gray-800">
                  {formatDuration(tripData?.trip_duration_minutes)}
                </div>
                <div className="text-xs text-gray-600 mt-1">Duración</div>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <User className="w-6 h-6 text-purple-700" />
                </div>
                <div className="text-2xl font-bold text-gray-800">
                  {passengers.length}
                </div>
                <div className="text-xs text-gray-600 mt-1">Pasajeros</div>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Star className="w-6 h-6 text-yellow-600" />
                </div>
                <div className="text-2xl font-bold text-gray-800">
                  {tripData?.driver_rating || 'N/A'}
                </div>
                <div className="text-xs text-gray-600 mt-1">Rating</div>
              </div>
            </div>

            {/* Información del Conductor */}
            {driver && userType === 'passenger' && (
              <div className="p-6 border-b border-gray-200">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center">
                  <User className="w-5 h-5 mr-2 text-green-700" />
                  Conductor
                </h3>
                <div className="flex items-center space-x-4 bg-gray-50 rounded-xl p-4">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                    <span className="text-2xl font-bold text-green-700">
                      {driver.full_name[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-gray-800 text-lg">{driver.full_name}</p>
                    <div className="flex items-center space-x-4 mt-1">
                      <div className="flex items-center space-x-1">
                        <Star className="w-4 h-4 text-yellow-400 fill-current" />
                        <span className="text-sm font-semibold text-gray-700">
                          {driver.rating}
                        </span>
                      </div>
                      <span className="text-sm text-gray-600">
                        {driver.total_trips} viajes
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Lista de Pasajeros */}
            {passengers.length > 0 && userType === 'driver' && (
              <div className="p-6 border-b border-gray-200">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center">
                  <User className="w-5 h-5 mr-2 text-green-700" />
                  Pasajeros ({passengers.length})
                </h3>
                <div className="space-y-3">
                  {passengers.map((passenger, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between bg-gray-50 rounded-xl p-4"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-lg font-bold text-blue-700">
                            {(passenger.passenger_profile?.full_name || 'P')[0].toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-800">
                            {passenger.passenger_profile?.full_name || 'Pasajero'}
                          </p>
                          <div className="flex items-center space-x-2 text-sm text-gray-600">
                            <MapPin className="w-3 h-3" />
                            <span className="text-xs">
                              {passenger.trip_info?.pickup?.substring(0, 30)}...
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-green-700">$5.000</div>
                        {passenger.passenger_profile?.rating && (
                          <div className="flex items-center space-x-1 text-sm text-gray-600 mt-1">
                            <Star className="w-3 h-3 text-yellow-400 fill-current" />
                            <span>{passenger.passenger_profile.rating}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Cronología del Viaje */}
            <div className="p-6 border-b border-gray-200">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center">
                <Clock className="w-5 h-5 mr-2 text-green-700" />
                Cronología
              </h3>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800">Viaje Iniciado</p>
                    <p className="text-xs text-gray-600">
                      {tripData && formatDate(tripData.started_at)}
                    </p>
                  </div>
                </div>

                {passengers.map((passenger, idx) => (
                  passenger.picked_up_at && (
                    <div key={`pickup-${idx}`} className="flex items-start space-x-3">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-800">
                          Recogida: {passenger.passenger_profile?.full_name}
                        </p>
                        <p className="text-xs text-gray-600">
                          {formatDate(passenger.picked_up_at)}
                        </p>
                      </div>
                    </div>
                  )
                ))}

                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-green-600 rounded-full mt-2"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800">Viaje Completado</p>
                    <p className="text-xs text-gray-600">
                      {tripData && formatDate(tripData.completed_at)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Calificaciones */}
            {ratings.length > 0 && (
              <div className="p-6">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center">
                  <Star className="w-5 h-5 mr-2 text-yellow-500" />
                  Calificaciones
                </h3>
                <div className="space-y-3">
                  {ratings.map((rating, idx) => (
                    <div key={idx} className="bg-gray-50 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-sm font-medium text-gray-800">
                            {rating.rater?.full_name || 'Usuario'}
                            <span className="text-gray-600"> calificó a </span>
                            {rating.rated?.full_name || 'Usuario'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {rating.rater_type === 'driver' ? '👨‍✈️ Conductor' : '🎒 Pasajero'}
                          </p>
                        </div>
                        {renderStars(rating.rating)}
                      </div>
                      {rating.comment && (
                        <p className="text-sm text-gray-700 mt-2 italic">
                          "{rating.comment}"
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full bg-green-700 text-white py-3 rounded-lg font-semibold hover:bg-green-800 transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default TripDetailModal;