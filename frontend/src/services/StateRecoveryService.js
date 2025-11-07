/**
 * StateRecoveryService.js
 * * MODIFICADO: Este servicio ahora es la única fuente de verdad para
 * recuperar el estado de un viaje activo al cargar la app.
 * Utiliza localStorage como caché, pero la BD (Supabase) es la fuente de verdad.
 */

// Claves para localStorage
const DRIVER_STATE_KEY = 'wheels_driver_active_trip';
const PASSENGER_STATE_KEY = 'wheels_passenger_active_trip';

class StateRecoveryService {
  
  // ========================================
  // GUARDAR ESTADO (Cache)
  // ========================================
  
  static savePassengerState(data) {
    console.log('CACHE: Guardando estado de pasajero:', data);
    localStorage.setItem(PASSENGER_STATE_KEY, JSON.stringify({
      ...data,
      timestamp: new Date().toISOString(),
    }));
  }

  static saveDriverState(data) {
    console.log('CACHE: Guardando estado de conductor:', data);
    localStorage.setItem(DRIVER_STATE_KEY, JSON.stringify({
      ...data,
      timestamp: new Date().toISOString(),
    }));
  }

  // ========================================
  // RECUPERAR ESTADO
  // ========================================

  static async recoverPassengerState(supabase, userId) {
    console.log('🔄 Recuperando estado del PASAJERO...');
    const cached = localStorage.getItem(PASSENGER_STATE_KEY);
    
    if (cached) {
      const cachedData = JSON.parse(cached);
      const cacheAge = Date.now() - new Date(cachedData.timestamp).getTime();
      
      // Validar caché (2 horas)
      if (cacheAge < 2 * 60 * 60 * 1000) {
        console.log('📦 Pasajero: Estado en caché encontrado y válido.');
        // Validar en BD que el viaje sigue activo
        const dbState = await this.getPassengerStateFromDB(supabase, userId, true);
        if (dbState && dbState.currentTripId === cachedData.currentTripId) {
          console.log('✅ Pasajero: Estado validado en BD. Usando caché.');
          return cachedData;
        }
      }
    }
    
    console.log('Pasajero: Sin caché o inválido. Buscando en BD...');
    return await this.getPassengerStateFromDB(supabase, userId, false);
  }

  static async recoverDriverState(supabase, userId) {
    console.log('🔄 Recuperando estado del CONDUCTOR...');
    const cached = localStorage.getItem(DRIVER_STATE_KEY);
    
    if (cached) {
      const cachedData = JSON.parse(cached);
      const cacheAge = Date.now() - new Date(cachedData.timestamp).getTime();
      
      if (cacheAge < 2 * 60 * 60 * 1000) {
        console.log('📦 Conductor: Estado en caché encontrado y válido.');
        const dbState = await this.getDriverStateFromDB(supabase, userId, true);
        if (dbState && dbState.currentTripId === cachedData.currentTripId) {
          console.log('✅ Conductor: Estado validado en BD. Usando caché.');
          return cachedData;
        }
      }
    }
    
    console.log('Conductor: Sin caché o inválido. Buscando en BD...');
    return await this.getDriverStateFromDB(supabase, userId, false);
  }

  // ========================================
  // OBTENER ESTADO DESDE BD (Fuente de Verdad)
  // ========================================

  /**
   * Busca un viaje de pasajero activo en la BD
   * @param {boolean} silent - Si es true, no guarda en caché (solo valida)
   */
  static async getPassengerStateFromDB(supabase, userId, silent = false) {
    try {
      const { data: activeTrip, error } = await supabase
        .from('searching_pool')
        .select('id, status, matched_driver_id')
        .eq('user_id', userId)
        .eq('tipo_de_usuario', 'passenger')
        .in('status', ['searching', 'matched', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!activeTrip || error) {
        if (!silent) this.clearPassengerState();
        return null;
      }
      
      console.log('✅ BD: Pasajero tiene viaje activo:', activeTrip.status);

      let screen;
      if (activeTrip.status === 'in_progress') {
        screen = 'passengerLiveTrip';
      } else {
        // 'searching' y 'matched' van a la misma pantalla
        screen = 'passengerMatching'; 
      }

      const stateData = {
        currentTripId: activeTrip.id,
        status: activeTrip.status,
        driverId: activeTrip.matched_driver_id,
        screen: screen
      };

      if (!silent) {
        this.savePassengerState(stateData);
      }
      return stateData;

    } catch (error) {
      console.error('Error getPassengerStateFromDB:', error);
      return null;
    }
  }

  /**
   * Busca un viaje de conductor activo en la BD
   * @param {boolean} silent - Si es true, no guarda en caché (solo valida)
   */
  static async getDriverStateFromDB(supabase, userId, silent = false) {
    try {
      const { data: activeTrip, error } = await supabase
        .from('searching_pool')
        .select('id, status, available_seats, price_per_seat, pickup_address, dropoff_address, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng')
        .eq('user_id', userId)
        .eq('tipo_de_usuario', 'driver')
        .in('status', ['searching', 'matched', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!activeTrip || error) {
        if (!silent) this.clearDriverState();
        return null;
      }
      
      console.log('✅ BD: Conductor tiene viaje activo:', activeTrip.status);

      let screen;
      if (activeTrip.status === 'in_progress') {
        screen = 'liveTrip';
      } else {
        // 'searching' y 'matched' van a la pantalla de matching
        screen = 'driverMatching'; 
      }
      
      // Restaurar la configuración del viaje y los pasajeros aceptados
      const { data: acceptedPassengers } = await supabase
        .from('driver_acceptances')
        .select(`
          searching_pool_id,
          passenger_id,
          trip_info,
          passenger_request:searching_pool!driver_acceptances_searching_pool_id_fkey (
            id,
            user_id,
            pickup_address,
            dropoff_address,
            pickup_lat,
            pickup_lng,
            profile:profiles!searching_pool_user_id_fkey (
              full_name,
              email,
              rating
            )
          )
        `)
        .eq('driver_id', userId)
        .eq('driver_pool_id', activeTrip.id); // Asumiendo que hay una FK al pool del driver

      const acceptedPassengersData = acceptedPassengers ? acceptedPassengers.map(p => ({
        ...p.passenger_request,
        ...p.passenger_request.profile
      })) : [];

      const stateData = {
        currentTripId: activeTrip.id,
        status: activeTrip.status,
        screen: screen,
        acceptedPassengers: acceptedPassengersData,
        tripConfig: {
          destination: activeTrip.dropoff_address,
          pickup: activeTrip.pickup_address,
          pickupLat: activeTrip.pickup_lat,
          pickupLng: activeTrip.pickup_lng,
          dropoffLat: activeTrip.dropoff_lat,
          dropoffLng: activeTrip.dropoff_lng,
          availableSeats: activeTrip.available_seats,
          pricePerSeat: activeTrip.price_per_seat,
        }
      };
      
      if (!silent) {
        this.saveDriverState(stateData);
      }
      return stateData;

    } catch (error) {
      console.error('Error getDriverStateFromDB:', error);
      return null;
    }
  }


  // ========================================
  // LIMPIAR ESTADO
  // ========================================

  static clearPassengerState() {
    localStorage.removeItem(PASSENGER_STATE_KEY);
    console.log('CACHE: 🗑️ Estado de pasajero limpiado');
  }

  static clearDriverState() {
    localStorage.removeItem(DRIVER_STATE_KEY);
    console.log('CACHE: 🗑️ Estado de conductor limpiado');
  }

  static clearAllStates() {
    this.clearPassengerState();
    this.clearDriverState();
  }
}

export default StateRecoveryService;