import React, { useState, useEffect, useRef } from 'react';
import { Star, MapPin, Navigation } from 'lucide-react';

const UNIVERSIDAD_EXTERNADO = {
  address: 'Universidad Externado de Colombia, Bogotá',
  lat: 4.6097,
  lng: -74.0817
};

const PassengerSection = ({ 
  user, 
  profile, 
  navigate, 
  supabase, 
  appState, 
  updateAppState, 
  loading, 
  setLoading 
}) => {
  const { tripConfig = {} } = appState;
  const [showDirectionChoice, setShowDirectionChoice] = useState(false);
  const [tripDirection, setTripDirection] = useState(null);
  const [tempAddress, setTempAddress] = useState('');
  const [isGoogleMapsLoaded, setIsGoogleMapsLoaded] = useState(false);
  const autocompleteRef = useRef(null);
  const inputRef = useRef(null);

  // Verificar si Google Maps está disponible
  useEffect(() => {
    const checkGoogleMaps = () => {
      if (window.google && window.google.maps && window.google.maps.places) {
        setIsGoogleMapsLoaded(true);
        initAutocomplete();
      } else {
        // Reintentar en 1 segundo
        setTimeout(checkGoogleMaps, 1000);
      }
    };
    checkGoogleMaps();
  }, [tripDirection]);

  const initAutocomplete = () => {
    if (!inputRef.current || !window.google || !tripDirection) return;

    try {
      // Limpiar autocomplete anterior
      if (autocompleteRef.current) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }

      // Crear nuevo autocomplete
      const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
        componentRestrictions: { country: 'co' },
        fields: ['formatted_address', 'geometry', 'name']
      });

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        
        if (!place.geometry) {
          console.error('No se encontraron detalles para el lugar seleccionado');
          return;
        }

        const address = place.formatted_address || place.name;
        const coordinates = {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng()
        };

        if (tripDirection === 'to_university') {
          updateTripConfig({
            pickup: address,
            pickupLat: coordinates.lat,
            pickupLng: coordinates.lng
          });
        } else {
          updateTripConfig({
            destination: address,
            dropoffLat: coordinates.lat,
            dropoffLng: coordinates.lng
          });
        }
      });

      autocompleteRef.current = autocomplete;
    } catch (error) {
      console.error('Error inicializando autocomplete:', error);
      setIsGoogleMapsLoaded(false);
    }
  };

  const updateTripConfig = (updates) => {
    updateAppState({
      tripConfig: { ...tripConfig, ...updates }
    });
  };

  const handleDirectionChoice = (direction) => {
    setTripDirection(direction);
    setShowDirectionChoice(false);
    
    if (direction === 'to_university') {
      // Cuando va HACIA la universidad, el destino es la universidad
      updateTripConfig({ 
        destination: UNIVERSIDAD_EXTERNADO.address,
        dropoffLat: UNIVERSIDAD_EXTERNADO.lat,
        dropoffLng: UNIVERSIDAD_EXTERNADO.lng,
        pickup: '',
        pickupLat: null,
        pickupLng: null
      });
    } else {
      // Cuando va DESDE la universidad, el punto de recogida es la universidad
      updateTripConfig({ 
        pickup: UNIVERSIDAD_EXTERNADO.address,
        pickupLat: UNIVERSIDAD_EXTERNADO.lat,
        pickupLng: UNIVERSIDAD_EXTERNADO.lng,
        destination: '',
        dropoffLat: null,
        dropoffLng: null
      });
    }
    setTempAddress('');
  };

  const handleManualAddressSubmit = () => {
    if (!tempAddress.trim()) {
      alert('Por favor ingresa una dirección');
      return;
    }

    // Coordenadas mockeadas para fallback
    const mockCoordinates = {
      lat: 4.6097 + (Math.random() - 0.5) * 0.1,
      lng: -74.0817 + (Math.random() - 0.5) * 0.1
    };

    if (tripDirection === 'to_university') {
      updateTripConfig({
        pickup: tempAddress,
        pickupLat: mockCoordinates.lat,
        pickupLng: mockCoordinates.lng
      });
    } else {
      updateTripConfig({
        destination: tempAddress,
        dropoffLat: mockCoordinates.lat,
        dropoffLng: mockCoordinates.lng
      });
    }
    
    setTempAddress('');
  };

  const createPassengerRequest = async () => {
    if (!tripConfig.pickup || !tripConfig.destination) {
      alert('Por favor completa todos los campos');
      return;
    }
    if (!tripConfig.pickupLat || !tripConfig.dropoffLat) {
      alert('Por favor selecciona direcciones válidas');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('searching_pool')
        .insert({
          user_id: user.id,
          tipo_de_usuario: 'passenger',
          pickup_address: tripConfig.pickup,
          dropoff_address: tripConfig.destination,
          pickup_lat: tripConfig.pickupLat,
          pickup_lng: tripConfig.pickupLng,
          dropoff_lat: tripConfig.dropoffLat,
          dropoff_lng: tripConfig.dropoffLng,
          max_detour_km: 5,
          status: 'searching'
        })
        .select()
        .single();

      if (error) {
        console.error('Error:', error);
        alert('Error al solicitar viaje: ' + error.message);
        setLoading(false);
        return;
      }

      updateAppState({ currentTripId: data.id });
      navigate('passengerMatching');
    } catch (error) {
      console.error('Error:', error);
      alert('Error al solicitar viaje');
    } finally {
      setLoading(false);
    }
  };

  if (showDirectionChoice) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-6">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-2xl w-full">
          <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">
            ¿Hacia dónde te diriges?
          </h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            <button
              onClick={() => handleDirectionChoice('to_university')}
              className="bg-white border-2 border-green-200 hover:border-green-700 hover:bg-green-50 p-6 rounded-xl transition-all duration-200 group"
            >
              <Navigation className="w-12 h-12 text-green-700 mx-auto mb-4 group-hover:scale-110 transition-transform" />
              <h3 className="text-xl font-bold text-gray-800 mb-2">Hacia la Universidad</h3>
              <p className="text-gray-600 text-sm">Voy desde mi casa/trabajo hacia el campus</p>
            </button>

            <button
              onClick={() => handleDirectionChoice('from_university')}
              className="bg-white border-2 border-green-200 hover:border-green-700 hover:bg-green-50 p-6 rounded-xl transition-all duration-200 group"
            >
              <MapPin className="w-12 h-12 text-green-700 mx-auto mb-4 group-hover:scale-110 transition-transform" />
              <h3 className="text-xl font-bold text-gray-800 mb-2">Desde la Universidad</h3>
              <p className="text-gray-600 text-sm">Salgo del campus hacia mi casa/trabajo</p>
            </button>
          </div>

          <button
            onClick={() => setShowDirectionChoice(false)}
            className="mt-6 w-full text-gray-600 hover:text-gray-800 py-2"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 fade-in">
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Buscar Viaje</h2>
        
        <div className="space-y-4">
          {!tripDirection && (
            <button
              onClick={() => setShowDirectionChoice(true)}
              className="w-full bg-green-700 text-white py-4 rounded-lg font-semibold hover:bg-green-800 transition shadow-lg"
            >
              📍 Seleccionar Dirección del Viaje
            </button>
          )}

          {tripDirection === 'to_university' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Punto de Recogida
              </label>
              <input
                ref={inputRef}
                type="text"
                placeholder="Escribe tu dirección..."
                value={tripConfig.pickup || tempAddress}
                onChange={(e) => {
                  const value = e.target.value;
                  setTempAddress(value);
                  if (isGoogleMapsLoaded) {
                    // Si Google Maps está cargado, dejar que autocomplete maneje todo
                    return;
                  }
                  // Solo actualizar si no hay Google Maps
                  if (!tripConfig.pickup) {
                    updateTripConfig({ pickup: value });
                  }
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
              />
              <p className="text-xs text-gray-500 mt-1">¿Dónde te recogemos?</p>
              
              {!isGoogleMapsLoaded && tempAddress && !tripConfig.pickupLat && (
                <button
                  onClick={handleManualAddressSubmit}
                  className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                >
                  Confirmar dirección
                </button>
              )}
              
              {tripConfig.pickup && tripConfig.pickupLat && (
                <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded">
                  <p className="text-sm text-green-700">✓ Recogida: {tripConfig.pickup}</p>
                </div>
              )}
            </div>
          )}

          {tripDirection === 'from_university' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Destino
              </label>
              <input
                ref={inputRef}
                type="text"
                placeholder="Escribe tu destino..."
                value={tripConfig.destination || tempAddress}
                onChange={(e) => {
                  const value = e.target.value;
                  setTempAddress(value);
                  if (isGoogleMapsLoaded) {
                    // Si Google Maps está cargado, dejar que autocomplete maneje todo
                    return;
                  }
                  // Solo actualizar si no hay Google Maps
                  if (!tripConfig.destination) {
                    updateTripConfig({ destination: value });
                  }
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
              />
              <p className="text-xs text-gray-500 mt-1">¿A dónde vas?</p>
              
              {!isGoogleMapsLoaded && tempAddress && !tripConfig.dropoffLat && (
                <button
                  onClick={handleManualAddressSubmit}
                  className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                >
                  Confirmar dirección
                </button>
              )}
              
              {tripConfig.destination && tripConfig.dropoffLat && (
                <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded">
                  <p className="text-sm text-green-700">✓ Destino: {tripConfig.destination}</p>
                </div>
              )}
            </div>
          )}

          {tripDirection && (
            <>
              {/* Mostrar resumen del viaje */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <h4 className="font-semibold text-gray-700 text-sm mb-2">📍 Resumen del viaje:</h4>
                <p className="text-xs text-gray-600">
                  <span className="font-medium">Desde:</span> {tripConfig.pickup || 'Por definir'}
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  <span className="font-medium">Hasta:</span> {tripConfig.destination || 'Por definir'}
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <div className="text-2xl">💰</div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-blue-900 text-sm">Precio Estimado</h4>
                    <p className="text-xs text-blue-700 mt-1">
                      Los precios varían según el conductor. Generalmente entre $3.000 - $8.000 por trayecto.
                    </p>
                  </div>
                </div>
              </div>

              {!isGoogleMapsLoaded && (
                <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3">
                  <p className="text-xs text-yellow-800">
                    ⚠️ Google Maps no está disponible. Usando modo manual.
                  </p>
                </div>
              )}

              <button
                onClick={createPassengerRequest}
                disabled={loading || !tripConfig.pickup || !tripConfig.destination || !tripConfig.pickupLat || !tripConfig.dropoffLat}
                className="w-full bg-green-700 text-white py-4 rounded-lg font-semibold hover:bg-green-800 transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105"
              >
                {loading ? 'Buscando conductor...' : '🔍 Buscar Conductor'}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow p-4 text-center hover:shadow-lg transition">
          <div className="text-3xl font-bold text-green-700">{profile?.total_trips || 0}</div>
          <div className="text-sm text-gray-600 mt-1">Viajes Totales</div>
        </div>
        <div className="bg-white rounded-xl shadow p-4 text-center hover:shadow-lg transition">
          <div className="text-3xl font-bold text-green-600">{profile?.completed_trips || 0}</div>
          <div className="text-sm text-gray-600 mt-1">Completados</div>
        </div>
        <div className="bg-white rounded-xl shadow p-4 text-center hover:shadow-lg transition">
          <div className="flex items-center justify-center space-x-1">
            <Star className="w-6 h-6 text-yellow-400 fill-current" />
            <div className="text-3xl font-bold text-gray-800">{profile?.rating || '5.0'}</div>
          </div>
          <div className="text-sm text-gray-600 mt-1">Calificación</div>
        </div>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
        <h3 className="font-semibold text-green-900 mb-2">💡 Tips para pasajeros</h3>
        <ul className="text-sm text-green-800 space-y-1">
          <li>• Sé puntual en el punto de encuentro</li>
          <li>• Respeta las normas del vehículo</li>
          <li>• Ten el dinero exacto preparado</li>
          <li>• Califica al conductor después del viaje</li>
        </ul>
      </div>
    </div>
  );
};

export default PassengerSection;