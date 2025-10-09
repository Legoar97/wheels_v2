"""
Wheels Pickup Optimization API
Servicio de optimización de rutas para recogida de múltiples pasajeros
Implementa algoritmo del vecino más cercano (Nearest Neighbor)
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from dotenv import load_dotenv
from geopy.distance import geodesic
import googlemaps
from typing import List, Dict, Tuple

# Cargar variables de entorno
load_dotenv()

app = Flask(__name__)
CORS(app)

# Configuración de Google Maps
GOOGLE_MAPS_API_KEY = os.getenv('GOOGLE_MAPS_API_KEY')
gmaps = googlemaps.Client(key=GOOGLE_MAPS_API_KEY)


def calculate_distance(point1: Tuple[float, float], point2: Tuple[float, float]) -> float:
    """Calcula la distancia entre dos puntos usando Haversine"""
    try:
        return geodesic(point1, point2).kilometers
    except Exception as e:
        print(f"Error calculando distancia: {e}")
        return float('inf')


def nearest_neighbor_optimization(start_point: Dict, passengers: List[Dict]) -> List[Dict]:
    """
    Algoritmo del vecino más cercano para optimizar orden de recogida
    
    Args:
        start_point: Punto de inicio del conductor {'lat': float, 'lng': float}
        passengers: Lista de pasajeros con sus ubicaciones de recogida
        
    Returns:
        Lista de pasajeros ordenada según ruta optimizada
    """
    if not passengers:
        return []
    
    optimized_route = []
    remaining_passengers = passengers.copy()
    current_point = (start_point['lat'], start_point['lng'])
    
    # Algoritmo del vecino más cercano
    while remaining_passengers:
        nearest_passenger = None
        min_distance = float('inf')
        
        # Encontrar el pasajero más cercano
        for passenger in remaining_passengers:
            passenger_point = (passenger['pickup_lat'], passenger['pickup_lng'])
            distance = calculate_distance(current_point, passenger_point)
            
            if distance < min_distance:
                min_distance = distance
                nearest_passenger = passenger
        
        if nearest_passenger:
            # Agregar distancia al pasajero
            nearest_passenger['distance_from_previous'] = round(min_distance, 2)
            optimized_route.append(nearest_passenger)
            
            # Actualizar punto actual
            current_point = (nearest_passenger['pickup_lat'], nearest_passenger['pickup_lng'])
            
            # Remover de la lista de pendientes
            remaining_passengers.remove(nearest_passenger)
    
    # Agregar orden de recogida
    for idx, passenger in enumerate(optimized_route):
        passenger['pickup_order'] = idx + 1
    
    return optimized_route


def calculate_total_route_distance(start_point: Dict, optimized_route: List[Dict], destination: Dict) -> float:
    """Calcula la distancia total de la ruta optimizada"""
    total_distance = 0.0
    current_point = (start_point['lat'], start_point['lng'])
    
    # Distancia a cada punto de recogida
    for passenger in optimized_route:
        passenger_point = (passenger['pickup_lat'], passenger['pickup_lng'])
        total_distance += calculate_distance(current_point, passenger_point)
        current_point = passenger_point
    
    # Distancia al destino final
    dest_point = (destination['lat'], destination['lng'])
    total_distance += calculate_distance(current_point, dest_point)
    
    return round(total_distance, 2)


def calculate_eta(distance_km: float, avg_speed_kmh: float = 40) -> int:
    """Calcula el tiempo estimado de llegada en minutos"""
    hours = distance_km / avg_speed_kmh
    minutes = int(hours * 60)
    return minutes


def get_google_directions(waypoints: List[Tuple[float, float]]) -> Dict:
    """Obtiene direcciones optimizadas usando Google Maps Directions API"""
    try:
        if len(waypoints) < 2:
            return None
        
        origin = waypoints[0]
        destination = waypoints[-1]
        intermediate_waypoints = waypoints[1:-1] if len(waypoints) > 2 else None
        
        directions = gmaps.directions(
            origin=origin,
            destination=destination,
            waypoints=intermediate_waypoints,
            optimize_waypoints=True,
            mode="driving"
        )
        
        if directions:
            route = directions[0]
            return {
                'distance_meters': route['legs'][0]['distance']['value'],
                'distance_km': round(route['legs'][0]['distance']['value'] / 1000, 2),
                'duration_seconds': route['legs'][0]['duration']['value'],
                'duration_minutes': round(route['legs'][0]['duration']['value'] / 60),
                'polyline': route['overview_polyline']['points']
            }
        
        return None
    
    except Exception as e:
        print(f"Error obteniendo direcciones de Google Maps: {e}")
        return None


@app.route('/api/optimize-route', methods=['POST'])
def optimize_route():
    """
    Endpoint principal para optimización de rutas
    
    Request body:
    {
        "start_point": {"lat": float, "lng": float},
        "destination": {"lat": float, "lng": float},
        "passengers": [
            {
                "id": str,
                "pickup_lat": float,
                "pickup_lng": float,
                "pickup_address": str,
                "name": str (opcional)
            }
        ],
        "use_google_maps": bool (opcional, default: false)
    }
    """
    try:
        data = request.json
        
        # Validar datos requeridos
        if not all(key in data for key in ['start_point', 'destination', 'passengers']):
            return jsonify({'error': 'Faltan campos requeridos'}), 400
        
        start_point = data['start_point']
        destination = data['destination']
        passengers = data['passengers']
        use_google_maps = data.get('use_google_maps', False)
        
        # Validar que hay pasajeros
        if not passengers:
            return jsonify({
                'success': True,
                'optimized_route': [],
                'total_distance_km': 0,
                'estimated_time_minutes': 0,
                'message': 'No hay pasajeros para optimizar'
            })
        
        # Optimizar usando algoritmo del vecino más cercano
        optimized_route = nearest_neighbor_optimization(start_point, passengers)
        
        # Calcular distancia total
        total_distance = calculate_total_route_distance(start_point, optimized_route, destination)
        
        # Calcular ETA
        estimated_time = calculate_eta(total_distance)
        
        response_data = {
            'success': True,
            'optimized_route': optimized_route,
            'total_distance_km': total_distance,
            'estimated_time_minutes': estimated_time,
            'number_of_passengers': len(optimized_route),
            'optimization_method': 'nearest_neighbor'
        }
        
        # Si se solicita, usar Google Maps para direcciones detalladas
        if use_google_maps and GOOGLE_MAPS_API_KEY:
            waypoints = [
                (start_point['lat'], start_point['lng'])
            ]
            
            for passenger in optimized_route:
                waypoints.append((passenger['pickup_lat'], passenger['pickup_lng']))
            
            waypoints.append((destination['lat'], destination['lng']))
            
            google_directions = get_google_directions(waypoints)
            
            if google_directions:
                response_data['google_maps_data'] = google_directions
                response_data['optimization_method'] = 'nearest_neighbor + google_maps'
        
        return jsonify(response_data)
    
    except Exception as e:
        print(f"Error en optimización de ruta: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/optimize-route/calculate-detour', methods=['POST'])
def calculate_detour():
    """
    Calcula la desviación adicional al agregar un nuevo pasajero
    
    Request body:
    {
        "original_route": {"lat": float, "lng": float},
        "destination": {"lat": float, "lng": float},
        "new_passenger": {"pickup_lat": float, "pickup_lng": float}
    }
    """
    try:
        data = request.json
        
        original_route = data['original_route']
        destination = data['destination']
        new_passenger = data['new_passenger']
        
        # Distancia original (directa)
        original_distance = calculate_distance(
            (original_route['lat'], original_route['lng']),
            (destination['lat'], destination['lng'])
        )
        
        # Distancia con el nuevo pasajero
        distance_to_passenger = calculate_distance(
            (original_route['lat'], original_route['lng']),
            (new_passenger['pickup_lat'], new_passenger['pickup_lng'])
        )
        
        distance_passenger_to_dest = calculate_distance(
            (new_passenger['pickup_lat'], new_passenger['pickup_lng']),
            (destination['lat'], destination['lng'])
        )
        
        new_total_distance = distance_to_passenger + distance_passenger_to_dest
        detour_km = new_total_distance - original_distance
        
        return jsonify({
            'success': True,
            'original_distance_km': round(original_distance, 2),
            'new_distance_km': round(new_total_distance, 2),
            'detour_km': round(detour_km, 2),
            'detour_percentage': round((detour_km / original_distance) * 100, 2) if original_distance > 0 else 0
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/optimize-route/status', methods=['GET'])
def status():
    """Endpoint para verificar el estado del servicio"""
    return jsonify({
        'status': 'online',
        'service': 'pickup_optimization',
        'google_maps_enabled': bool(GOOGLE_MAPS_API_KEY),
        'algorithms': ['nearest_neighbor']
    })


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'healthy'}), 200


if __name__ == '__main__':
    port = int(os.getenv('OPTIMIZATION_PORT', 5001))
    print(f"🚀 Pickup Optimization API iniciada en puerto {port}")
    app.run(host='0.0.0.0', port=port, debug=True)