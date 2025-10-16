import React, { useState, useEffect } from 'react';
import { Navigation, MapPin, Clock, CheckCircle, ArrowLeft, Star, User } from 'lucide-react';

const PassengerLiveTripScreen = ({ user, profile, navigate, supabase }) => {
  const [tripStatus, setTripStatus] = useState('waiting'); // waiting, driver_coming, picked_up, completed
  const [driverInfo, setDriverInfo] = useState(null);
  const [tripInfo, setTripInfo] = useState(null);
  const [eta, setEta] = useState(null);
  const [showRating, setShowRating] = useState(false);
  const [rating, setRating] = useState(0);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);

  useEffect(() => {
    loadTripInfo();
    
    // Suscripción en tiempo real al estado del viaje
    const subscription = supabase
      .channel('trip_updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'searching_pool',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Estado del viaje actualizado:', payload);
          handleTripUpdate(payload.new);
        }
      )
      .subscribe();

    // Polling cada 5 segundos como respaldo
    const interval = setInterval(loadTripInfo, 5000);

    return () => {
      subscription.unsubscribe();
      clearInterval(interval);
    };
  }, [user.id]);

  const loadTripInfo = async () => {
    try {
      // Obtener mi solicitud de viaje
      const { data: myTrip, error: tripError } = await supabase
        .from('searching_pool')
        .select('*')
        .eq('user_id', user.id)
        .eq('tipo_de_usuario', 'passenger')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (tripError || !myTrip) {
        console.error('Error cargando viaje:', tripError);
        return;
      }

      setTripInfo(myTrip);

      // Determinar el estado basado en el status
      if (myTrip.status === 'matched') {
        setTripStatus('waiting');
      } else if (myTrip.status === 'in_progress') {
        // Verificar si ya fui recogido
        const { data: acceptance } = await supabase
          .from('driver_acceptances')
          .select('picked_up_at')
          .eq('searching_pool_id', myTrip.id)
          .single();

        if (acceptance?.picked_up_at) {
          setTripStatus('picked_up');
        } else {
          setTripStatus('driver_coming');
        }
      } else if (myTrip.status === 'completed') {
        setTripStatus('completed');
        setShowRating(true);
      }

      // Cargar info del conductor
      if (myTrip.matched_driver_id) {
        const { data: driverProfile } = await supabase
          .from('profiles')
          .select('full_name, rating, total_trips')
          .eq('user_id', myTrip.matched_driver_id)
          .single();

        if (driverProfile) {
          setDriverInfo(driverProfile);
        }
      }
    } catch (error) {
      console.error('Error en loadTripInfo:', error);
    }
  };

  const handleTripUpdate = (newData) => {
    if (newData.status === 'in_progress' && tripStatus === 'waiting') {
      setTripStatus('driver_coming');
    } else if (newData.status === 'completed') {
      setTripStatus('completed');
      setShowRating(true);
    }
  };

  const submitRating = async () => {
    if (rating === 0) {
      alert('Por favor selecciona una calificación');
      return;
    }

    try {
      // Guardar calificación
      const { error } = await supabase
        .from('trip_ratings')
        .insert({
          trip_id: tripInfo.id,
          rater_id: user.id,
          rated_id: tripInfo.matched_driver_id,
          rating: rating,
          rater_type: 'passenger',
          rated_type: 'driver'
        });

      if (error) throw error;

      // Actualizar rating promedio del conductor
      const { data: allRatings } = await supabase
        .from('trip_ratings')
        .select('rating')
        .eq('rated_id', tripInfo.matched_driver_id)
        .eq('rated_type', 'driver');

      if (allRatings && allRatings.length > 0) {
        const avgRating = allRatings.reduce((sum, r) => sum + r.rating, 0) / allRatings.length;
        
        await supabase
          .from('profiles')
          .update({ rating: avgRating.toFixed(1) })
          .eq('user_id', tripInfo.matched_driver_id);
      }

      setRatingSubmitted(true);
      setTimeout(() => navigate('dashboard'), 2000);
    } catch (error) {
      console.error('Error guardando calificación:', error);
      alert('Error al guardar calificación');
    }
  };

  // Pantalla de calificación
  if (showRating && !ratingSubmitted) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
          <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 text-center mb-2">
            ¡Viaje Completado!
          </h2>
          <p className="text-gray-600 text-center mb-6">
            ¿Cómo fue tu experiencia con el conductor?
          </p>

          {driverInfo && (
            <div className="bg-gray-50 rounded-xl p-4 mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <User className="w-6 h-6 text-green-700" />
                </div>
                <div>
                  <p className="font-semibold text-gray-800">{driverInfo.full_name}</p>
                  <div className="flex items-center space-x-1">
                    <Star className="w-4 h-4 text-yellow-400 fill-current" />
                    <span className="text-sm text-gray-600">{driverInfo.rating}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="mb-6">
            <p className="text-center text-gray-700 font-medium mb-3">Califica tu viaje:</p>
            <div className="flex justify-center space-x-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  className="transform transition hover:scale-110"
                >
                  <Star
                    className={`w-10 h-10 ${
                      star <= rating
                        ? 'text-yellow-400 fill-current'
                        : 'text-gray-300'
                    }`}
                  />
                </button>
              ))}
            </div>
            {rating > 0 && (
              <p className="text-center text-sm text-gray-600 mt-2">
                {rating === 5 && '¡Excelente!'}
                {rating === 4 && 'Muy bien'}
                {rating === 3 && 'Bien'}
                {rating === 2 && 'Regular'}
                {rating === 1 && 'Necesita mejorar'}
              </p>
            )}
          </div>

          <button
            onClick={submitRating}
            disabled={rating === 0}
            className="w-full bg-green-700 text-white py-3 rounded-lg font-semibold hover:bg-green-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Enviar Calificación
          </button>

          <button
            onClick={() => navigate('dashboard')}
            className="w-full text-gray-600 hover:text-gray-800 text-sm mt-3"
          >
            Omitir por ahora
          </button>
        </div>
      </div>
    );
  }

  if (ratingSubmitted) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4 animate-bounce" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            ¡Gracias por tu Calificación!
          </h2>
          <p className="text-gray-600">Redirigiendo al dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className={`pt-6 pb-20 px-6 transition-colors ${
        tripStatus === 'picked_up' 
          ? 'bg-gradient-to-br from-blue-600 to-blue-800'
          : 'bg-gradient-to-br from-green-600 to-green-800'
      }`}>
        <button
          onClick={() => navigate('dashboard')}
          className="flex items-center space-x-2 text-white mb-4 hover:opacity-80"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Volver</span>
        </button>
        
        <div className="text-white text-center">
          {tripStatus === 'waiting' && (
            <>
              <Clock className="w-16 h-16 mx-auto mb-4 animate-pulse" />
              <h2 className="text-2xl font-bold">Esperando al Conductor</h2>
              <p className="text-sm opacity-90 mt-2">El conductor está preparando el viaje</p>
            </>
          )}
          
          {tripStatus === 'driver_coming' && (
            <>
              <Navigation className="w-16 h-16 mx-auto mb-4 animate-bounce" />
              <h2 className="text-2xl font-bold">El Conductor Va Hacia Ti</h2>
              <p className="text-sm opacity-90 mt-2">Prepárate en el punto de recogida</p>
            </>
          )}
          
          {tripStatus === 'picked_up' && (
            <>
              <CheckCircle className="w-16 h-16 mx-auto mb-4" />
              <h2 className="text-2xl font-bold">¡Disfruta el Viaje!</h2>
              <p className="text-sm opacity-90 mt-2">Ya estás a bordo</p>
            </>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 -mt-12">
        {/* Info del Conductor */}
        {driverInfo && (
          <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
            <h3 className="font-semibold text-gray-800 mb-4">Tu Conductor</h3>
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <User className="w-8 h-8 text-green-700" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-gray-800 text-lg">{driverInfo.full_name}</p>
                <div className="flex items-center space-x-3 mt-1">
                  <div className="flex items-center space-x-1">
                    <Star className="w-4 h-4 text-yellow-400 fill-current" />
                    <span className="text-sm font-semibold">{driverInfo.rating}</span>
                  </div>
                  <span className="text-sm text-gray-600">
                    {driverInfo.total_trips} viajes
                  </span>
                </div>
              </div>
              <div className={`px-3 py-1 rounded-full text-sm font-semibold ${
                tripStatus === 'picked_up' 
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-green-100 text-green-800'
              }`}>
                {tripStatus === 'picked_up' ? 'A bordo' : 'En camino'}
              </div>
            </div>
          </div>
        )}

        {/* Información del Viaje */}
        {tripInfo && (
          <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
            <h3 className="font-semibold text-gray-800 mb-4">Detalles del Viaje</h3>
            
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <MapPin className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-gray-600">Recogida</p>
                  <p className="font-medium text-gray-800">{tripInfo.pickup_address}</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <Navigation className="w-5 h-5 text-green-700 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-gray-600">Destino</p>
                  <p className="font-medium text-gray-800">{tripInfo.dropoff_address}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Estado del Viaje */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h3 className="font-semibold text-gray-800 mb-4">Estado del Viaje</h3>
          
          <div className="space-y-3">
            <div className={`flex items-center space-x-3 p-3 rounded-lg ${
              tripStatus === 'waiting' ? 'bg-yellow-50 border border-yellow-200' : 'bg-green-50 border border-green-200'
            }`}>
              <CheckCircle className={`w-5 h-5 ${
                tripStatus === 'waiting' ? 'text-yellow-600' : 'text-green-600'
              }`} />
              <span className="text-sm font-medium">Conductor asignado</span>
            </div>
            
            <div className={`flex items-center space-x-3 p-3 rounded-lg ${
              tripStatus === 'driver_coming' ? 'bg-yellow-50 border border-yellow-200' : 
              tripStatus === 'picked_up' ? 'bg-green-50 border border-green-200' : 
              'bg-gray-50 border border-gray-200'
            }`}>
              <CheckCircle className={`w-5 h-5 ${
                tripStatus === 'driver_coming' || tripStatus === 'picked_up' ? 'text-green-600' : 'text-gray-400'
              }`} />
              <span className="text-sm font-medium">
                {tripStatus === 'driver_coming' ? 'Conductor en camino...' : 
                 tripStatus === 'picked_up' ? 'Conductor llegó' : 
                 'Esperando conductor'}
              </span>
            </div>
            
            <div className={`flex items-center space-x-3 p-3 rounded-lg ${
              tripStatus === 'picked_up' ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50 border border-gray-200'
            }`}>
              <CheckCircle className={`w-5 h-5 ${
                tripStatus === 'picked_up' ? 'text-blue-600' : 'text-gray-400'
              }`} />
              <span className="text-sm font-medium">
                {tripStatus === 'picked_up' ? 'A bordo - Disfrutando el viaje' : 'Recogida pendiente'}
              </span>
            </div>
          </div>
        </div>

        {/* Tips */}
        <div className={`mt-6 rounded-xl p-4 ${
          tripStatus === 'picked_up' 
            ? 'bg-blue-50 border border-blue-200'
            : 'bg-green-50 border border-green-200'
        }`}>
          <h3 className={`font-semibold mb-2 ${
            tripStatus === 'picked_up' ? 'text-blue-900' : 'text-green-900'
          }`}>
            💡 {tripStatus === 'picked_up' ? 'Durante el viaje' : 'Mientras esperas'}
          </h3>
          <ul className={`text-sm space-y-1 ${
            tripStatus === 'picked_up' ? 'text-blue-800' : 'text-green-800'
          }`}>
            {tripStatus === 'picked_up' ? (
              <>
                <li>• Usa el cinturón de seguridad</li>
                <li>• Respeta al conductor y otros pasajeros</li>
                <li>• Mantén el vehículo limpio</li>
              </>
            ) : (
              <>
                <li>• Mantén tu teléfono cerca</li>
                <li>• Espera en el punto de recogida</li>
                <li>• Ten el dinero exacto preparado</li>
              </>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default PassengerLiveTripScreen;