"""
Wheels Matchmaking API
Servicio de emparejamiento inteligente para conductores y pasajeros
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from dotenv import load_dotenv
from supabase import create_client, Client
from geopy.distance import geodesic
import pandas as pd
from datetime import datetime
import googlemaps

# Cargar variables de entorno
load_dotenv()

app = Flask(__name__)
CORS(app)

# Configuración de Supabase
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Configuración de Google Maps
GOOGLE_MAPS_API_KEY = os.getenv('GOOGLE_MAPS_API_KEY')
gmaps = googlemaps.Client(key=GOOGLE_MAPS_API_KEY)

# Constantes de configuración
MAX_DISTANCE_KM = float(os.getenv('MAX_DISTANCE_KM', 5))
MAX_DETOUR_KM = float(os.getenv('MAX_DETOUR_KM', 3))


def calculate_distance(lat1, lng1, lat2, lng2):
    """Calcula la distancia entre dos puntos usando fórmula Haversine"""
    try:
        return geodesic((lat1, lng1), (lat2, lng2)).kilometers
    except Exception as e:
        print(f"Error calculando distancia: {e}")
        return float('inf')


def calculate_distance_google(origin_lat, origin_lng, dest_lat, dest_lng):
    """Calcula distancia real usando Google Maps Distance Matrix API"""
    try:
        result = gmaps.distance_matrix(
            origins=[(origin_lat, origin_lng)],
            destinations=[(dest_lat, dest_lng)],
            mode="driving"
        )
        
        if result['rows'][0]['elements'][0]['status'] == 'OK':
            distance_meters = result['rows'][0]['elements'][0]['distance']['value']
            return distance_meters / 1000  # Convertir a kilómetros
        else:
            # Fallback a Haversine si Google Maps falla
            return calculate_distance(origin_lat, origin_lng, dest_lat, dest_lng)
    except Exception as e:
        print(f"Error con Google Maps API, usando Haversine: {e}")
        return calculate_distance(origin_lat, origin_lng, dest_lat, dest_lng)


def get_searching_users(user_type):
    """Obtiene usuarios que están buscando viaje"""
    try:
        response = supabase.table('searching_pool').select('*').eq('tipo_de_usuario', user_type).eq('status', 'searching').execute()
        return response.data
    except Exception as e:
        print(f"Error obteniendo usuarios: {e}")
        return []


def find_matches_for_driver(driver_data):
    """Encuentra pasajeros compatibles para un conductor"""
    passengers = get_searching_users('passenger')
    
    if not passengers:
        return []
    
    matches = []
    
    for passenger in passengers:
        # Verificar que ambos tengan coordenadas
        if not all([
            driver_data.get('pickup_lat'), driver_data.get('pickup_lng'),
            driver_data.get('dropoff_lat'), driver_data.get('dropoff_lng'),
            passenger.get('pickup_lat'), passenger.get('pickup_lng'),
            passenger.get('dropoff_lat'), passenger.get('dropoff_lng')
        ]):
            continue
        
        # Calcular distancias
        pickup_distance = calculate_distance(
            driver_data['pickup_lat'], driver_data['pickup_lng'],
            passenger['pickup_lat'], passenger['pickup_lng']
        )
        
        dropoff_distance = calculate_distance(
            driver_data['dropoff_lat'], driver_data['dropoff_lng'],
            passenger['dropoff_lat'], passenger['dropoff_lng']
        )
        
        # Verificar compatibilidad
        max_detour = passenger.get('max_detour_km', MAX_DETOUR_KM)
        
        if pickup_distance <= max_detour and dropoff_distance <= max_detour:
            matches.append({
                'passenger_id': passenger['id'],
                'passenger_user_id': passenger['user_id'],
                'pickup_address': passenger['pickup_address'],
                'dropoff_address': passenger['dropoff_address'],
                'pickup_lat': passenger['pickup_lat'],
                'pickup_lng': passenger['pickup_lng'],
                'dropoff_lat': passenger['dropoff_lat'],
                'dropoff_lng': passenger['dropoff_lng'],
                'pickup_distance_km': round(pickup_distance, 2),
                'dropoff_distance_km': round(dropoff_distance, 2),
                'compatibility_score': round(100 - (pickup_distance + dropoff_distance) * 10, 2)
            })
    
    # Ordenar por score de compatibilidad
    matches.sort(key=lambda x: x['compatibility_score'], reverse=True)
    
    return matches


def find_matches_for_passenger(passenger_data):
    """Encuentra conductores compatibles para un pasajero"""
    drivers = get_searching_users('driver')
    
    if not drivers:
        return []
    
    matches = []
    
    for driver in drivers:
        # Verificar que ambos tengan coordenadas
        if not all([
            driver.get('pickup_lat'), driver.get('pickup_lng'),
            driver.get('dropoff_lat'), driver.get('dropoff_lng'),
            passenger_data.get('pickup_lat'), passenger_data.get('pickup_lng'),
            passenger_data.get('dropoff_lat'), passenger_data.get('dropoff_lng')
        ]):
            continue
        
        # Calcular distancias
        pickup_distance = calculate_distance(
            driver['pickup_lat'], driver['pickup_lng'],
            passenger_data['pickup_lat'], passenger_data['pickup_lng']
        )
        
        dropoff_distance = calculate_distance(
            driver['dropoff_lat'], driver['dropoff_lng'],
            passenger_data['dropoff_lat'], passenger_data['dropoff_lng']
        )
        
        # Verificar compatibilidad
        max_detour = passenger_data.get('max_detour_km', MAX_DETOUR_KM)
        available_seats = driver.get('available_seats', 0)
        
        if pickup_distance <= max_detour and dropoff_distance <= max_detour and available_seats > 0:
            matches.append({
                'driver_id': driver['id'],
                'driver_user_id': driver['user_id'],
                'pickup_address': driver['pickup_address'],
                'dropoff_address': driver['dropoff_address'],
                'pickup_lat': driver['pickup_lat'],
                'pickup_lng': driver['pickup_lng'],
                'dropoff_lat': driver['dropoff_lat'],
                'dropoff_lng': driver['dropoff_lng'],
                'available_seats': available_seats,
                'price_per_seat': driver.get('price_per_seat', 0),
                'pickup_distance_km': round(pickup_distance, 2),
                'dropoff_distance_km': round(dropoff_distance, 2),
                'compatibility_score': round(100 - (pickup_distance + dropoff_distance) * 10, 2)
            })
    
    # Ordenar por score de compatibilidad
    matches.sort(key=lambda x: x['compatibility_score'], reverse=True)
    
    return matches


@app.route('/api/matchmaking', methods=['POST'])
def matchmaking():
    """Endpoint principal de emparejamiento"""
    try:
        data = request.json
        user_type = data.get('user_type')
        
        if not user_type:
            return jsonify({'error': 'user_type es requerido'}), 400
        
        if user_type == 'driver':
            matches = find_matches_for_driver(data)
        elif user_type == 'passenger':
            matches = find_matches_for_passenger(data)
        else:
            return jsonify({'error': 'user_type inválido'}), 400
        
        return jsonify({
            'success': True,
            'matches': matches,
            'count': len(matches)
        })
    
    except Exception as e:
        print(f"Error en matchmaking: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/matchmaking/status', methods=['GET'])
def status():
    """Endpoint para verificar el estado del servicio"""
    try:
        drivers = get_searching_users('driver')
        passengers = get_searching_users('passenger')
        
        return jsonify({
            'status': 'online',
            'active_drivers': len(drivers),
            'active_passengers': len(passengers),
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'healthy'}), 200


if __name__ == '__main__':
    port = int(os.getenv('MATCHMAKING_PORT', 5000))
    print(f"🚀 Matchmaking API iniciada en puerto {port}")
    app.run(host='0.0.0.0', port=port, debug=True)