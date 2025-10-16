import React, { useState } from 'react';
import { Star, Car, CheckCircle } from 'lucide-react';

const RateTripScreen = ({ user, navigate, supabase, appState }) => {
  const { lastCompletedTrip } = appState;
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRateDriver = async () => {
    if (rating === 0) {
      alert("Por favor selecciona una calificación.");
      return;
    }
    
    setIsSubmitting(true);

    try {
      const { error } = await supabase.rpc('add_rating_and_update_profile', {
        p_trip_id: lastCompletedTrip.id,
        p_rater_id: user.id,
        p_ratee_id: lastCompletedTrip.driver_id,
        p_rating: rating,
      });

      if (error) throw error;

      console.log(`✅ Conductor calificado con ${rating} estrellas`);
      alert("¡Gracias por tu calificación!");
      navigate('dashboard');
      
    } catch (error) {
      console.error("Error al calificar al conductor:", error);
      alert("Hubo un error al guardar tu calificación: " + error.message);
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    const confirm = window.confirm("¿Estás seguro de que deseas omitir la calificación?");
    if (confirm) {
      navigate('dashboard');
    }
  };

  if (!lastCompletedTrip) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
        <div className="animate-spin w-12 h-12 border-4 border-green-200 border-t-green-700 rounded-full mb-4"></div>
        <p className="text-gray-600">Cargando información del viaje...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="mb-6">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Car className="w-10 h-10 text-green-700" />
          </div>
          <h2 className="text-3xl font-bold text-gray-800 mb-2">¿Cómo fue tu viaje?</h2>
          <p className="text-gray-600">
            Tu opinión nos ayuda a mejorar. Por favor, califica a tu conductor.
          </p>
        </div>

        <div 
          className="flex justify-center space-x-2 mb-8"
          onMouseLeave={() => setHoverRating(0)}
        >
          {[1, 2, 3, 4, 5].map(star => (
            <button
              key={star}
              disabled={isSubmitting}
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoverRating(star)}
              className="transition-transform hover:scale-110 disabled:cursor-not-allowed focus:outline-none"
            >
              <Star
                className={`w-10 h-10 transition-colors ${
                  star <= (hoverRating || rating)
                    ? 'text-yellow-400 fill-current'
                    : 'text-gray-300'
                }`}
              />
            </button>
          ))}
        </div>

        {rating > 0 && (
          <div className="mb-6 text-sm text-gray-600">
            {rating === 5 && "¡Excelente! 🎉"}
            {rating === 4 && "Muy bueno 👍"}
            {rating === 3 && "Bueno 😊"}
            {rating === 2 && "Regular 😐"}
            {rating === 1 && "Necesita mejorar 😕"}
          </div>
        )}

        <button
          onClick={handleRateDriver}
          disabled={isSubmitting || rating === 0}
          className="w-full bg-green-700 text-white py-4 rounded-lg font-semibold hover:bg-green-800 transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
        >
          {isSubmitting ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Enviando...</span>
            </>
          ) : (
            <>
              <CheckCircle className="w-5 h-5" />
              <span>Enviar Calificación</span>
            </>
          )}
        </button>

        <button 
          onClick={handleSkip}
          disabled={isSubmitting}
          className="mt-4 text-sm text-gray-600 hover:text-gray-800 hover:underline transition disabled:opacity-50"
        >
          Omitir por ahora
        </button>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            💡 Tu calificación es anónima y ayuda a mantener la calidad del servicio
          </p>
        </div>
      </div>
    </div>
  );
};

export default RateTripScreen;