// PlaceInput.jsx
import React from 'react';

export default function PlaceInput({
  placeholder = 'Escribe una dirección…',
  initialValue = '',
  onPlaceSelected,
  className = '',
}) {
  const [query, setQuery] = React.useState(initialValue);
  const [preds, setPreds] = React.useState([]);
  const [isOpen, setIsOpen] = React.useState(false);
  const [isReady, setIsReady] = React.useState(false);
  const svcRef = React.useRef(null);
  const placesRef = React.useRef(null);
  const tokenRef = React.useRef(null);
  const debounceRef = React.useRef(null);
  const containerRef = React.useRef(null);

  // Inicializa servicios al cargar la API
  React.useEffect(() => {
    if (window.google?.maps?.places) {
      svcRef.current = new google.maps.places.AutocompleteService();
      placesRef.current = new google.maps.places.PlacesService(document.createElement('div'));
      tokenRef.current = new google.maps.places.AutocompleteSessionToken();
      setIsReady(true);
    }
  }, []);

  // Cierra el dropdown si clicas fuera
  React.useEffect(() => {
    const handler = (e) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  // Buscar predicciones con “debounce”
  const fetchPredictions = React.useCallback(
    (text) => {
      if (!svcRef.current || !text) {
        setPreds([]);
        return;
      }
      svcRef.current.getPlacePredictions(
        { input: text, sessionToken: tokenRef.current },
        (res = []) => setPreds(res)
      );
    },
    []
  );

  const onChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setIsOpen(true);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchPredictions(val), 180);
  };

  const selectPrediction = (p) => {
    if (!placesRef.current) return;

    placesRef.current.getDetails(
      {
        placeId: p.place_id,
        // Pide SOLO lo que necesitas para evitar nulls
        fields: ['formatted_address', 'geometry', 'name'],
        sessionToken: tokenRef.current,
      },
      (place, status) => {
        if (status !== google.maps.places.PlacesServiceStatus.OK || !place?.geometry) {
          // Si no hay geometry, no podemos geocodificar
          return;
        }

        const formatted = place.formatted_address ?? p.description ?? place.name ?? '';
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();

        setQuery(formatted);
        setPreds([]);
        setIsOpen(false);

        // Nueva sesión para futuras búsquedas
        tokenRef.current = new google.maps.places.AutocompleteSessionToken();

        onPlaceSelected?.({
          formatted_address: formatted,
          lat,
          lng,
        });
      }
    );
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <input
        value={query}
        onChange={onChange}
        onFocus={() => query && preds.length > 0 && setIsOpen(true)}
        placeholder={placeholder}
        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
        disabled={!isReady}
      />
      {isOpen && preds.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full max-h-72 overflow-auto bg-white border border-gray-200 rounded-lg shadow-lg">
          {preds.map((p) => (
            <li
              key={p.place_id}
              onClick={() => selectPrediction(p)}
              className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
            >
              {p.description}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
