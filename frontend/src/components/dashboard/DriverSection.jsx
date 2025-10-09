import React, { useState, useRef, useEffect } from 'react';
import { Star, MapPin, Navigation, Car, DollarSign, Users } from 'lucide-react';

const UNIVERSIDAD_EXTERNADO = {
  address: 'Calle 12 #1-17 Este, Bogotá',
  lat: 4.595724443192084,
  lng: -74.06888964035532
};

// Componente PlaceInput simplificado (sin mapa)
const PlaceInput = ({ 
  label,
  placeholder = 'Escribe una dirección...',
  value,
  onPlaceSelected,
  disabled = false 
}) => {
  const [inputValue, setInputValue] = useState(value || '');
  const [isLoaded, setIsLoaded] = useState(false);
  const inputRef = useRef(null);
  const autocompleteRef = useRef(null);

  useEffect(() => {
    const checkGoogleMaps = () => {
      if (window.google && window.google.maps && window.google.maps.places) {
        setIsLoaded(true);
        initAutocomplete();
      } else {
        setTimeout(checkGoogleMaps, 500);
      }
    };
    checkGoogleMaps();
  }, []);

  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  const initAutocomplete = () => {
    if (!inputRef.current || !window.google) return;

    try {
      if (autocompleteRef.current) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }

      const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
        componentRestrictions: { country: 'co' },
        fields: ['formatted_address', 'geometry', 'name', 'place_id']
      });

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        
        if (!place.geometry) {
          alert('Por favor selecciona una dirección de la lista');
          return;
        }

        const selectedPlace = {
          address: place.formatted_address || place.name,
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
          placeId: place.place_id
        };

        setInputValue(selectedPlace.address);
        
        if (onPlaceSelected) {
          onPlaceSelected(selectedPlace);
        }
      });

      autocompleteRef.current = autocomplete;
    } catch (error) {
      console.error('Error inicializando autocomplete:', error);
    }
  };

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
      )}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <MapPin className={`h-5 w-5 ${isLoaded ? 'text-green-600' : 'text-gray-400 animate-pulse'}`} />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={placeholder}
          disabled={disabled || !isLoaded}
          className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition disabled:bg-gray-100"
        />
      </div>
    </div>
  );
};

const DriverSection = ({ 
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

  // Valores por defecto
  const config = {
    availableSeats: tripConfig.availableSeats || 2,
    pricePerSeat: tripConfig.pricePerSeat || 5000,
    ...tripConfig
  };

  const updateTripConfig = (updates) => {
    updateAppState({
      tripConfig: { ...config, ...updates }
    });
  };

  const handleDirectionChoice = (direction) => {
    setTripDirection(direction);
    setShowDirectionChoice(false);
    
    if (direction === 'to_university') {
      updateTripConfig({ 
        destination: UNIVERSIDAD_EXTERNADO.address,
        dropoffLat: UNIVERSIDAD_EXTERNADO.lat,
        dropoffLng: UNIVERSIDAD_EXTERNADO.lng,
        pickup: '',
        pickupLat: null,
        pickupLng: null
      });
    } else {
      updateTripConfig({ 
        pickup: UNIVERSIDAD_EXTERNADO.address,
        pickupLat: UNIVERSIDAD_EXTERNADO.lat,
        pickupLng: UNIVERSIDAD_EXTERNADO.lng,
        destination: '',
        dropoffLat: null,
        dropoffLng: null
      });
    }
  };

  const handlePlaceSelected = (place, type) => {
    if (type === 'pickup') {
      updateTripConfig({
        pickup: place.address,
        pickupLat: place.lat,
        pickupLng: place.lng
      });
    } else {
      updateTripConfig({
        destination: place.address,
        dropoffLat: place.lat,
        dropoffLng: place.lng
      });
    }
  };

  const createDriverTrip = async () => {
    if (!config.pickup || !config.destination) {
      alert('Por favor completa todos los campos');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('searching_pool')
        .insert({
          user_id: user.id,
          tipo_de_usuario: 'driver',
          pickup_address: config.pickup,
          dropoff_address: config.destination,
          pickup_lat: config.pickupLat,
          pickup_lng: config.pickupLng,
          dropoff_lat: config.dropoffLat,
          dropoff_lng: config.dropoffLng,
          available_seats: config.availableSeats,
          price_per_seat: config.pricePerSeat,
          max_detour_km: 5,
          status: 'searching'
        })
        .select()
        .single();

      if (error) {
        alert('Error al crear viaje: ' + error.message);
        setLoading(false);
        return;
      }

      updateAppState({ currentTripId: data.id });
      navigate('driverMatching');
    } catch (error) {
      alert('Error al crear viaje');
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
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Ofrecer Viaje</h2>
        
        <div className="space-y-4">
          {!tripDirection ? (
            <button
              onClick={() => setShowDirectionChoice(true)}
              className="w-full bg-green-700 text-white py-4 rounded-lg font-semibold hover:bg-green-800 transition shadow-lg flex items-center justify-center space-x-3"
            >
              <Car className="w-6 h-6" />
              <span>Configurar Viaje</span>
            </button>
          ) : (
            <>
              {tripDirection === 'to_university' && (
                <PlaceInput
                  label="📍 Punto de Inicio"
                  placeholder="¿Desde dónde sales?"
                  value={config.pickup}
                  onPlaceSelected={(place) => handlePlaceSelected(place, 'pickup')}
                />
              )}

              {tripDirection === 'from_university' && (
                <PlaceInput
                  label="📍 Destino Final"
                  placeholder="¿A dónde vas?"
                  value={config.destination}
                  onPlaceSelected={(place) => handlePlaceSelected(place, 'destination')}
                />
              )}

              {/* Resumen del viaje */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="font-semibold text-gray-700 text-sm mb-3">Tu ruta:</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Desde:</span>
                    <span className="font-medium text-gray-800 text-right max-w-[60%]">
                      {config.pickup || '---'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Hasta:</span>
                    <span className="font-medium text-gray-800 text-right max-w-[60%]">
                      {config.destination || '---'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Configuración del viaje */}
              {config.pickup && config.destination && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-2">
                        <Users className="w-4 h-4" />
                        <span>Asientos</span>
                      </label>
                      <select
                        value={config.availableSeats}
                        onChange={(e) => updateTripConfig({ availableSeats: parseInt(e.target.value) })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      >
                        <option value="1">1 asiento</option>
                        <option value="2">2 asientos</option>
                        <option value="3">3 asientos</option>
                        <option value="4">4 asientos</option>
                      </select>
                    </div>

                    <div>
                      <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-2">
                        <DollarSign className="w-4 h-4" />
                        <span>Precio</span>
                      </label>
                      <select
                        value={config.pricePerSeat}
                        onChange={(e) => updateTripConfig({ pricePerSeat: parseInt(e.target.value) })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      >
                        <option value="3000">$3.000</option>
                        <option value="4000">$4.000</option>
                        <option value="5000">$5.000</option>
                        <option value="6000">$6.000</option>
                        <option value="7000">$7.000</option>
                        <option value="8000">$8.000</option>
                      </select>
                    </div>
                  </div>

                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h4 className="font-semibold text-green-900 text-sm mb-2">💰 Ganancia Potencial</h4>
                    <div className="flex items-baseline space-x-2">
                      <span className="text-2xl font-bold text-green-700">
                        ${(config.availableSeats * config.pricePerSeat).toLocaleString('es-CO')}
                      </span>
                      <span className="text-sm text-green-600">
                        ({config.availableSeats} × ${config.pricePerSeat.toLocaleString('es-CO')})
                      </span>
                    </div>
                  </div>
                </>
              )}

              {config.pickup && config.destination && (
                <button
                  onClick={createDriverTrip}
                  disabled={loading}
                  className="w-full bg-green-700 text-white py-4 rounded-lg font-semibold hover:bg-green-800 transition shadow-lg disabled:opacity-50"
                >
                  {loading ? 'Buscando pasajeros...' : '🔍 Buscar Pasajeros'}
                </button>
              )}

              <button
                onClick={() => {
                  setTripDirection(null);
                  updateTripConfig({
                    pickup: '',
                    pickupLat: null,
                    pickupLng: null,
                    destination: '',
                    dropoffLat: null,
                    dropoffLng: null
                  });
                }}
                className="w-full text-gray-600 hover:text-gray-800 text-sm"
              >
                Cambiar ruta
              </button>
            </>
          )}
        </div>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow p-4 text-center">
          <div className="text-3xl font-bold text-green-700">{profile?.total_trips || 0}</div>
          <div className="text-sm text-gray-600 mt-1">Viajes</div>
        </div>
        <div className="bg-white rounded-xl shadow p-4 text-center">
          <div className="text-3xl font-bold text-green-600">{profile?.completed_trips || 0}</div>
          <div className="text-sm text-gray-600 mt-1">Completados</div>
        </div>
        <div className="bg-white rounded-xl shadow p-4 text-center">
          <Star className="w-6 h-6 text-yellow-400 fill-current mx-auto" />
          <div className="text-2xl font-bold text-gray-800">{profile?.rating || '5.0'}</div>
        </div>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
        <h3 className="font-semibold text-green-900 mb-2">💡 Tips para conductores</h3>
        <ul className="text-sm text-green-800 space-y-1">
          <li>• Confirma el punto de encuentro con los pasajeros</li>
          <li>• Mantén tu auto limpio y en buen estado</li>
          <li>• Sé puntual para mejorar tu calificación</li>
          <li>• Comunícate con los pasajeros si hay cambios</li>
        </ul>
      </div>
    </div>
  );
};

export default DriverSection;