/**
 * StateRecoveryService.js
 * Servicio para recuperar el estado de viajes activos.
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
    try {
      console.log('💾 CACHE: Guardando estado de pasajero:', data);
      localStorage.setItem(PASSENGER_STATE_KEY, JSON.stringify({
        ...data,
        timestamp: new Date().toISOString(),
      }));
    } catch (error) {
      console.error('Error guardando estado de pasajero:', error);
    }
  }

  static saveDriverState(data) {
    try {
      console.log('💾 CACHE: Guardando estado de conductor:', data);
      localStorage.setItem(DRIVER_STATE_KEY, JSON.stringify({
        ...data,
        timestamp: new Date().toISOString(),
      }));
    } catch (error) {
      console.error('Error guardando estado de conductor:', error);
    }
  }

  // ========================================
  // RECUPERAR ESTADO
  // ========================================

  static async recoverPassengerState(supabase, userId) {
    try {
      console.log('🔄 Recuperando estado del PASAJERO...');
      const cached = localStorage.getItem(PASSENGER_STATE_KEY);
      
      if (cached) {
        try {
          const cachedData = JSON.parse(cached);
          const cacheAge = Date.now() - new Date(cachedData.timestamp).getTime();
          
          // Validar caché (24 horas para viajes programados)
          if (cacheAge < 24 * 60 * 60 * 1000) {
            console.log('📦 Pasajero: Estado en caché encontrado y válido.');
            // Validar en BD que el viaje sigue activo
            const dbState = await this.getPassengerStateFromDB(supabase, userId, true);
            if (dbState && dbState.currentTripId === cachedData.currentTripId) {
              console.log('✅ Pasajero: Estado validado en BD. Usando caché.');
              return cachedData;
            }
          }
        } catch (parseError) {
          console.error('Error parseando caché de pasajero:', parseError);
          this.clearPassengerState();
        }
      }
      
      console.log('Pasajero: Sin caché o inválido. Buscando en BD...');
      return await this.getPassengerStateFromDB(supabase, userId, false);
    } catch (error) {
      console.error('Error en recoverPassengerState:', error);
      return null;
    }
  }

  static async recoverDriverState(supabase, userId) {
    try {
      console.log('🔄 Recuperando estado del CONDUCTOR...');
      const cached = localStorage.getItem(DRIVER_STATE_KEY);
      
      if (cached) {
        try {
          const cachedData = JSON.parse(cached);
          const cacheAge = Date.now() - new Date(cachedData.timestamp).getTime();
          
          // 24 horas para viajes programados
          if (cacheAge < 24 * 60 * 60 * 1000) {
            console.log('📦 Conductor: Estado en caché encontrado y válido.');
            const dbState = await this.getDriverStateFromDB(supabase, userId, true);
            if (dbState && dbState.currentTripId === cachedData.currentTripId) {
              console.log('✅ Conductor: Estado validado en BD. Usando caché.');
              return cachedData;
            }
          }
        } catch (parseError) {
          console.error('Error parseando caché de conductor:', parseError);
          this.clearDriverState();
        }
      }
      
      console.log('Conductor: Sin caché o inválido. Buscando en BD...');
      return await this.getDriverStateFromDB(supabase, userId, false);
    } catch (error) {
      console.error('Error en recoverDriverState:', error);
      return null;
    }
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
      console.log('🔍 BD: Buscando viaje de pasajero...');
      
      // Incluir viajes programados
      const { data: activeTrip, error } = await supabase
        .from('searching_pool')
        .select('*')
        .eq('user_id', userId)
        .eq('tipo_de_usuario', 'passenger')
        .in('status', ['searching', 'matched', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error en query BD pasajero:', error);
        if (!silent) this.clearPassengerState();
        return null;
      }

      if (!activeTrip) {
        console.log('ℹ️ No hay viaje activo para pasajero');
        if (!silent) this.clearPassengerState();
        return null;
      }
      
      console.log('✅ BD: Pasajero tiene viaje activo:', activeTrip);

      // Determinar pantalla según estado
      let screen;
      if (activeTrip.status === 'in_progress') {
        screen = 'passengerLiveTrip';
      } else if (activeTrip.status === 'matched') {
        screen = 'passengerMatching';
      } else {
        screen = 'passengerMatching';
      }

      const stateData = {
        currentTripId: activeTrip.id,
        status: activeTrip.status,
        driverId: activeTrip.matched_driver_id,
        screen: screen,
        sessionRole: 'passenger',
        isScheduled: activeTrip.is_scheduled || false,
        scheduledDateTime: activeTrip.scheduled_datetime
      };

      if (!silent) {
        this.savePassengerState(stateData);
      }
      return stateData;

    } catch (error) {
      console.error('❌ Error getPassengerStateFromDB:', error);
      return null;
    }
  }

  /**
   * Busca un viaje de conductor activo en la BD
   * @param {boolean} silent - Si es true, no guarda en caché (solo valida)
   */
  static async getDriverStateFromDB(supabase, userId, silent = false) {
    try {
      console.log('🔍 BD: Buscando viaje de conductor...');
      
      // Incluir viajes programados
      const { data: activeTrip, error } = await supabase
        .from('searching_pool')
        .select('*')
        .eq('user_id', userId)
        .eq('tipo_de_usuario', 'driver')
        .in('status', ['searching', 'matched', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error en query BD conductor:', error);
        if (!silent) this.clearDriverState();
        return null;
      }

      if (!activeTrip) {
        console.log('ℹ️ No hay viaje activo para conductor');
        if (!silent) this.clearDriverState();
        return null;
      }
      
      console.log('✅ BD: Conductor tiene viaje activo:', activeTrip);

      // Determinar pantalla
      let screen;
      if (activeTrip.status === 'in_progress') {
        screen = 'liveTrip';
      } else {
        screen = 'driverMatching';
      }
      
      // Cargar pasajeros aceptados
      let acceptedPassengersData = [];
      try {
        const { data: acceptances, error: acceptError } = await supabase
          .from('driver_acceptances')
          .select(`
            *,
            passenger_profile:profiles!driver_acceptances_passenger_id_fkey(
              user_id,
              full_name,
              email,
              rating
            )
          `)
          .eq('driver_id', userId);

        if (!acceptError && acceptances) {
          acceptedPassengersData = acceptances.map(a => ({
            id: a.searching_pool_id,
            user_id: a.passenger_id,
            pickup_address: a.trip_info?.pickup || '',
            dropoff_address: a.trip_info?.dropoff || '',
            pickup_lat: a.trip_info?.pickup_lat,
            pickup_lng: a.trip_info?.pickup_lng,
            dropoff_lat: a.trip_info?.dropoff_lat,
            dropoff_lng: a.trip_info?.dropoff_lng,
            profile: a.passenger_profile
          }));
        }
      } catch (acceptError) {
        console.error('Error cargando pasajeros aceptados:', acceptError);
      }

      const stateData = {
        currentTripId: activeTrip.id,
        status: activeTrip.status,
        screen: screen,
        sessionRole: 'driver',
        acceptedPassengers: acceptedPassengersData,
        tripConfig: {
          destination: activeTrip.dropoff_address || '',
          pickup: activeTrip.pickup_address || '',
          pickupLat: activeTrip.pickup_lat,
          pickupLng: activeTrip.pickup_lng,
          dropoffLat: activeTrip.dropoff_lat,
          dropoffLng: activeTrip.dropoff_lng,
          availableSeats: activeTrip.available_seats || 3,
          pricePerSeat: activeTrip.price_per_seat || 5000,
        },
        isScheduled: activeTrip.is_scheduled || false,
        scheduledDateTime: activeTrip.scheduled_datetime
      };
      
      if (!silent) {
        this.saveDriverState(stateData);
      }
      return stateData;

    } catch (error) {
      console.error('❌ Error getDriverStateFromDB:', error);
      return null;
    }
  }

  // ========================================
  // LIMPIAR ESTADO
  // ========================================

  static clearPassengerState() {
    try {
      localStorage.removeItem(PASSENGER_STATE_KEY);
      console.log('🗑️ CACHE: Estado de pasajero limpiado');
    } catch (error) {
      console.error('Error limpiando estado de pasajero:', error);
    }
  }

  static clearDriverState() {
    try {
      localStorage.removeItem(DRIVER_STATE_KEY);
      console.log('🗑️ CACHE: Estado de conductor limpiado');
    } catch (error) {
      console.error('Error limpiando estado de conductor:', error);
    }
  }

  static clearAllStates() {
    this.clearPassengerState();
    this.clearDriverState();
  }
}

export default StateRecoveryService;