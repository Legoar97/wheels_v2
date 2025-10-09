import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Search } from 'lucide-react';

// Componente PlaceInput mejorado con autocompletado de Google
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
    // Verificar si Google Maps está cargado
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
      // Limpiar autocomplete anterior
      if (autocompleteRef.current) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }

      // Crear nuevo autocomplete
      const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
        componentRestrictions: { country: 'co' },
        fields: ['formatted_address', 'geometry', 'name', 'place_id']
      });

      // Listener para cuando se seleccione un lugar
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        
        if (!place.geometry) {
          console.error('No se encontraron detalles para el lugar seleccionado');
          return;
        }

        const selectedPlace = {
          address: place.formatted_address || place.name,
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
          placeId: place.place_id
        };

        setInputValue(selectedPlace.address);
        
        // Llamar callback con los datos del lugar
        if (onPlaceSelected) {
          onPlaceSelected(selectedPlace);
        }
      });

      autocompleteRef.current = autocomplete;
    } catch (error) {
      console.error('Error inicializando autocomplete:', error);
      setIsLoaded(false);
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
          {isLoaded ? (
            <MapPin className="h-5 w-5 text-green-600" />
          ) : (
            <Search className="h-5 w-5 text-gray-400 animate-pulse" />
          )}
        </div>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={placeholder}
          disabled={disabled || !isLoaded}
          className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition disabled:bg-gray-100 disabled:cursor-not-allowed"
        />
        {!isLoaded && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            <span className="text-xs text-gray-500">Cargando...</span>
          </div>
        )}
      </div>
      {!isLoaded && (
        <p className="mt-1 text-xs text-yellow-600">
          ⏳ Google Maps está cargando...
        </p>
      )}
    </div>
  );
};

// Hook para usar Google Maps con el mapa
export const useGoogleMapsWithMarkers = (mapRef) => {
  const [map, setMap] = useState(null);
  const [directionsService, setDirectionsService] = useState(null);
  const [directionsRenderer, setDirectionsRenderer] = useState(null);
  const markersRef = useRef([]);

  useEffect(() => {
    if (!mapRef.current || !window.google) return;

    // Crear el mapa
    const mapInstance = new window.google.maps.Map(mapRef.current, {
      center: { lat: 4.6097, lng: -74.0817 }, // Universidad Externado
      zoom: 12,
      mapTypeControl: false,
      fullscreenControl: false,
      streetViewControl: false
    });

    // Crear servicios de direcciones
    const dirService = new window.google.maps.DirectionsService();
    const dirRenderer = new window.google.maps.DirectionsRenderer({
      map: mapInstance,
      polylineOptions: {
        strokeColor: '#15803d',
        strokeWeight: 5,
        strokeOpacity: 0.8
      }
    });

    setMap(mapInstance);
    setDirectionsService(dirService);
    setDirectionsRenderer(dirRenderer);
  }, [mapRef]);

  const addMarker = (position, title, icon = null) => {
    if (!map) return;

    const marker = new window.google.maps.Marker({
      position,
      map,
      title,
      icon: icon || undefined,
      animation: window.google.maps.Animation.DROP
    });

    markersRef.current.push(marker);
    return marker;
  };

  const clearMarkers = () => {
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];
  };

  const calculateRoute = (origin, destination, callback) => {
    if (!directionsService || !directionsRenderer) return;

    directionsService.route(
      {
        origin,
        destination,
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === 'OK') {
          directionsRenderer.setDirections(result);
          if (callback) callback(result);
        } else {
          console.error('Error calculando ruta:', status);
        }
      }
    );
  };

  const clearRoute = () => {
    if (directionsRenderer) {
      directionsRenderer.setDirections({ routes: [] });
    }
  };

  return {
    map,
    addMarker,
    clearMarkers,
    calculateRoute,
    clearRoute,
    isLoaded: !!map
  };
};

export default PlaceInput;