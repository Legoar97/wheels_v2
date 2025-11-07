import React, { useState, useEffect } from 'react';
import { Star, CheckCircle, DollarSign, Users, ThumbsUp } from 'lucide-react';

const TripCompletedScreen = ({ user, profile, navigate, supabase, appState, updateAppState }) => {
  const [ratings, setRatings] = useState({});
  const [comments, setComments] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [tripDetails, setTripDetails] = useState(null);
  const [error, setError] = useState(null);
  const [peopleToRate, setPeopleToRate] = useState([]); // ⬅️ NUEVO: Lista dinámica
  
  const { acceptedPassengers = [], currentTripId, driverId } = appState; // ⬅️ AGREGAR driverId
  const isDriver = appState.sessionRole === 'driver';

  useEffect(() => {
    console.log('=== TripCompletedScreen cargado ===');
    console.log('currentTripId:', currentTripId);
    console.log('isDriver:', isDriver);
    console.log('driverId:', driverId);
    console.log('acceptedPassengers:', acceptedPassengers);
    
    if (currentTripId) {
      loadTripDetails();
    } else {
      console.error('❌ No hay currentTripId');
      setError('No se encontró información del viaje');
    }
  }, []);

  const loadTripDetails = async () => {
    try {
      console.log('Cargando detalles del trip:', currentTripId);
      const { data: trip, error } = await supabase
        .from('successful_trips')
        .select('*')
        .eq('id', currentTripId)
        .single();
      
      if (error) {
        console.error('Error cargando trip:', error);
      } else if (trip) {
        console.log('✅ Trip cargado:', trip);
        setTripDetails(trip);

        // ⬅️ NUEVO: Cargar la lista de personas a calificar según el rol
        if (isDriver) {
          // Conductor califica a sus pasajeros
          console.log('👨‍✈️ Conductor: Preparando lista de pasajeros a calificar');
          if (acceptedPassengers.length > 0) {
            const passengerList = acceptedPassengers.map(p => ({
              userId: p.user_id,
              name: p.profile?.full_name || 'Pasajero'
            }));
            setPeopleToRate(passengerList);
            console.log('✅ Pasajeros a calificar:', passengerList);
          }
        } else {
          // Pasajero califica al conductor
          console.log('🎒 Pasajero: Preparando conductor a calificar');
          
          // Intentar obtener info del conductor desde driverId en appState
          let driverUserId = driverId || trip.driver_id;
          
          const { data: driverProfile } = await supabase
            .from('profiles')
            .select('user_id, full_name')
            .eq('user_id', driverUserId)
            .single();
          
          if (driverProfile) {
            setPeopleToRate([{
              userId: driverProfile.user_id,
              name: driverProfile.full_name || 'Conductor'
            }]);
            console.log('✅ Conductor a calificar:', driverProfile);
          } else {
            console.error('❌ No se pudo cargar info del conductor');
            setPeopleToRate([{
              userId: driverUserId,
              name: 'Tu Conductor'
            }]);
          }
        }
      }
    } catch (error) {
      console.error('Error en loadTripDetails:', error);
    }
  };

  const RatingStars = ({ userId, userName }) => {
    const currentRating = ratings[userId] || 0;

    return (
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <span className="text-lg">{isDriver ? '👤' : '🚗'}</span>
            </div>
            <div>
              <h4 className="font-semibold text-gray-800">{userName}</h4>
              <p className="text-xs text-gray-500">
                {currentRating === 0 ? 'Sin calificar' : `${currentRating} estrella${currentRating !== 1 ? 's' : ''}`}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center space-x-2 mb-3">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => setRatings({ ...ratings, [userId]: star })}
              className="transition-transform hover:scale-110"
            >
              <Star
                className={`w-10 h-10 ${
                  star <= currentRating
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'text-gray-300'
                }`}
              />
            </button>
          ))}
        </div>

        <textarea
          value={comments[userId] || ''}
          onChange={(e) => setComments({ ...comments, [userId]: e.target.value })}
          placeholder="Comentario opcional..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
          rows="2"
        />
      </div>
    );
  };

  const submitRatings = async () => {
    console.log('=== INICIANDO ENVÍO DE CALIFICACIONES ===');
    
    // Validar que haya al menos una calificación
    const ratingsArray = Object.entries(ratings);
    console.log('Calificaciones a enviar:', ratingsArray);
    
    if (ratingsArray.length === 0) {
      alert('Por favor califica al menos a una persona');
      return;
    }

    // Validar que todas las calificaciones sean > 0
    const hasInvalidRatings = ratingsArray.some(([_, rating]) => rating === 0);
    if (hasInvalidRatings) {
      alert('Por favor completa todas las calificaciones que iniciaste');
      return;
    }

    // Validar currentTripId
    if (!currentTripId) {
      console.error('❌ No hay currentTripId');
      alert('Error: No se encontró el ID del viaje');
      return;
    }

    setSubmitting(true);
    setError(null);
    
    try {
      // Insertar todas las calificaciones
      const ratingsToInsert = ratingsArray.map(([userId, rating]) => ({
        trip_id: currentTripId,
        rater_id: user.id,
        rated_user_id: userId,
        rating: rating,
        comment: comments[userId] || null
      }));

      console.log('Insertando calificaciones:', ratingsToInsert);

      const { data, error: insertError } = await supabase
        .from('trip_ratings')
        .insert(ratingsToInsert)
        .select();

      if (insertError) {
        console.error('❌ Error insertando calificaciones:', insertError);
        throw insertError;
      }

      console.log('✅ Calificaciones insertadas:', data);
      
      // Pequeño delay para que el trigger actualice los ratings
      await new Promise(resolve => setTimeout(resolve, 500));
      
      console.log('✅ Limpiando estado y navegando al dashboard');
      
      // Limpiar estado de la app
      updateAppState({ 
        tripStarted: false,
        acceptedPassengers: [],
        currentTripId: null,
        driverId: null, // ⬅️ NUEVO: Limpiar también driverId
        tripConfig: {}
      });
      
      alert('¡Gracias por tu calificación! 🌟');
      navigate('dashboard');

    } catch (error) {
      console.error('❌ Error en submitRatings:', error);
      setError('Error al enviar calificaciones: ' + error.message);
      alert('Error al enviar calificaciones: ' + error.message);
      setSubmitting(false);
    }
  };

  const skipRatings = () => {
    const confirm = window.confirm('¿Seguro que quieres omitir las calificaciones? Ayudan a mejorar la experiencia de todos.');
    if (confirm) {
      console.log('Usuario omitió calificaciones, limpiando estado...');
      // Limpiar estado de la app
      updateAppState({ 
        tripStarted: false,
        acceptedPassengers: [],
        currentTripId: null,
        driverId: null, // ⬅️ NUEVO
        tripConfig: {}
      });
      navigate('dashboard');
    }
  };

  if (error && !tripDetails) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md">
          <h2 className="text-xl font-bold text-red-800 mb-2">Error</h2>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => {
              updateAppState({ 
                tripStarted: false,
                acceptedPassengers: [],
                currentTripId: null,
                driverId: null,
                tripConfig: {}
              });
              navigate('dashboard');
            }}
            className="w-full bg-red-600 text-white py-2 rounded-lg hover:bg-red-700"
          >
            Volver al Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header de éxito */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
            <CheckCircle className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            ¡Viaje Completado!
          </h1>
          <p className="text-gray-600">
            {isDriver ? 'Excelente trabajo, conductor' : 'Esperamos que hayas disfrutado el viaje'}
          </p>
        </div>

        {/* Resumen del viaje */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center space-x-2">
            <ThumbsUp className="w-5 h-5 text-green-600" />
            <span>Resumen del Viaje</span>
          </h2>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <Users className="w-5 h-5 text-green-600" />
                <span className="text-sm text-gray-600">Pasajeros</span>
              </div>
              <p className="text-2xl font-bold text-green-700">
                {isDriver ? acceptedPassengers.length : 1}
              </p>
            </div>

            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <DollarSign className="w-5 h-5 text-blue-600" />
                <span className="text-sm text-gray-600">
                  {isDriver ? 'Ganancia' : 'Costo'}
                </span>
              </div>
              <p className="text-2xl font-bold text-blue-700">
                ${((isDriver ? acceptedPassengers.length : 1) * 5000).toLocaleString('es-CO')}
              </p>
            </div>
          </div>

          {isDriver && acceptedPassengers.length > 0 && (
            <div className="border-t border-gray-200 pt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Pasajeros en este viaje:</h3>
              <div className="space-y-2">
                {acceptedPassengers.map((p, idx) => (
                  <div key={idx} className="flex items-center space-x-2 text-sm text-gray-600 bg-gray-50 rounded-lg p-2">
                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <span className="font-medium">{p.profile?.full_name || 'Pasajero'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sistema de Calificaciones */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-gray-800 mb-2 flex items-center space-x-2">
              <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
              <span>Califica tu Experiencia</span>
            </h2>
            <p className="text-sm text-gray-600">
              Tu opinión ayuda a mejorar la comunidad
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* ⬅️ NUEVO: Renderizar dinámicamente según peopleToRate */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              {isDriver ? 'Califica a tus pasajeros:' : 'Califica a tu conductor:'}
            </h3>
            {peopleToRate.length > 0 ? (
              peopleToRate.map((person) => (
                <RatingStars
                  key={person.userId}
                  userId={person.userId}
                  userName={person.name}
                />
              ))
            ) : (
              <div className="text-center py-4">
                <div className="animate-spin w-8 h-8 border-4 border-green-200 border-t-green-700 rounded-full mx-auto mb-2"></div>
                <p className="text-sm text-gray-500">Cargando información...</p>
              </div>
            )}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
            <p className="text-xs text-blue-800">
              💡 Las calificaciones son anónimas y ayudan a mantener una comunidad segura y confiable.
            </p>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="space-y-3">
          <button
            onClick={submitRatings}
            disabled={submitting || Object.keys(ratings).length === 0}
            className="w-full bg-green-600 text-white py-4 rounded-xl font-semibold hover:bg-green-700 transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {submitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Enviando...</span>
              </>
            ) : (
              <>
                <Star className="w-5 h-5" />
                <span>Enviar Calificaciones</span>
              </>
            )}
          </button>

          <button
            onClick={skipRatings}
            disabled={submitting}
            className="w-full bg-gray-100 text-gray-700 py-3 rounded-xl font-medium hover:bg-gray-200 transition"
          >
            Omitir por ahora
          </button>
        </div>

        {/* Mensaje motivacional */}
        <div className="text-center mt-6">
          <p className="text-sm text-gray-500">
            {isDriver 
              ? '¡Gracias por hacer parte de nuestra comunidad de conductores!' 
              : '¡Gracias por viajar con nosotros!'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default TripCompletedScreen;