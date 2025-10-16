// StateRecoveryService.js
// Servicio para mantener y recuperar el estado de viajes activos

class StateRecoveryService {
  
  // ========================================
  // GUARDAR ESTADO
  // ========================================
  
  static savePassengerState(data) {
    localStorage.setItem('passenger_active_trip', JSON.stringify({
      requestId: data.requestId,
      status: data.status,
      driverId: data.driverId || null,
      timestamp: new Date().toISOString(),
      screen: data.screen // 'matching', 'matched', 'liveTrip'
    }));
  }

  static saveDriverState(data) {
    localStorage.setItem('driver_active_trip', JSON.stringify({
      acceptanceId: data.acceptanceId,
      passengerId: data.passengerId,
      searchingPoolId: data.searchingPoolId,
      status: data.status,
      timestamp: new Date().toISOString(),
      screen: data.screen // 'searching', 'accepted', 'liveTrip'
    }));
  }

  // ========================================
  // RECUPERAR ESTADO
  // ========================================

  static async recoverPassengerState(supabase, userId) {
    console.log('🔄 Recuperando estado del pasajero...');

    // 1. Intentar recuperar desde localStorage (más rápido)
    const cached = localStorage.getItem('passenger_active_trip');
    if (cached) {
      const cachedData = JSON.parse(cached);
      console.log('📦 Estado en caché encontrado:', cachedData);

      // Validar que no sea muy antiguo (más de 2 horas)
      const cacheAge = Date.now() - new Date(cachedData.timestamp).getTime();
      if (cacheAge < 2 * 60 * 60 * 1000) { // 2 horas
        // Verificar en la BD que el viaje sigue activo
        const dbState = await this.validatePassengerStateInDB(
          supabase, 
          cachedData.requestId
        );
        
        if (dbState) {
          console.log('✅ Estado validado en BD');
          return { ...cachedData, ...dbState, fromCache: true };
        }
      }
      
      // Si el caché es inválido, limpiarlo
      console.log('⚠️ Caché inválido, limpiando...');
      this.clearPassengerState();
    }

    // 2. Si no hay caché válido, buscar en la BD
    return await this.getPassengerStateFromDB(supabase, userId);
  }

  static async recoverDriverState(supabase, userId) {
    console.log('🔄 Recuperando estado del conductor...');

    // 1. Intentar recuperar desde localStorage
    const cached = localStorage.getItem('driver_active_trip');
    if (cached) {
      const cachedData = JSON.parse(cached);
      console.log('📦 Estado en caché encontrado:', cachedData);

      // Validar que no sea muy antiguo
      const cacheAge = Date.now() - new Date(cachedData.timestamp).getTime();
      if (cacheAge < 2 * 60 * 60 * 1000) {
        const dbState = await this.validateDriverStateInDB(
          supabase, 
          cachedData.acceptanceId || cachedData.searchingPoolId
        );
        
        if (dbState) {
          console.log('✅ Estado validado en BD');
          return { ...cachedData, ...dbState, fromCache: true };
        }
      }
      
      this.clearDriverState();
    }

    // 2. Buscar en la BD
    return await this.getDriverStateFromDB(supabase, userId);
  }

  // ========================================
  // VALIDACIÓN EN BASE DE DATOS
  // ========================================

  static async validatePassengerStateInDB(supabase, requestId) {
    try {
      const { data, error } = await supabase
        .from('searching_pool')
        .select('id, status, matched_driver_id')
        .eq('id', requestId)
        .single();

      if (error || !data) return null;

      // Solo considerar estados activos
      const activeStatuses = ['searching', 'matched', 'in_progress'];
      if (!activeStatuses.includes(data.status)) {
        return null;
      }

      return {
        requestId: data.id,
        status: data.status,
        driverId: data.matched_driver_id
      };
    } catch (error) {
      console.error('Error validando estado:', error);
      return null;
    }
  }

  static async validateDriverStateInDB(supabase, acceptanceId) {
    try {
      const { data, error } = await supabase
        .from('driver_acceptances')
        .select('id, searching_pool_id, passenger_id, trip_info')
        .eq('id', acceptanceId)
        .single();

      if (error || !data) return null;

      // Verificar que el viaje siga activo
      const { data: poolData } = await supabase
        .from('searching_pool')
        .select('status')
        .eq('id', data.searching_pool_id)
        .single();

      if (!poolData || poolData.status === 'completed' || poolData.status === 'cancelled') {
        return null;
      }

      return {
        acceptanceId: data.id,
        searchingPoolId: data.searching_pool_id,
        passengerId: data.passenger_id,
        status: poolData.status
      };
    } catch (error) {
      console.error('Error validando estado del conductor:', error);
      return null;
    }
  }

  // ========================================
  // OBTENER ESTADO DESDE BD (sin caché)
  // ========================================

  static async getPassengerStateFromDB(supabase, userId) {
    console.log('🔍 Buscando viaje activo en BD para pasajero...');
    
    try {
      // Buscar solicitud más reciente que no esté completada/cancelada
      const { data: request, error } = await supabase
        .from('searching_pool')
        .select('id, status, matched_driver_id, created_at')
        .eq('user_id', userId)
        .eq('tipo_de_usuario', 'passenger')
        .in('status', ['searching', 'matched', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!request || error) {
        console.log('❌ No hay viaje activo en BD');
        return null;
      }

      console.log('✅ Viaje activo encontrado:', request);

      // Determinar la pantalla correcta según el estado
      let screen = 'matching';
      if (request.status === 'in_progress') {
        screen = 'liveTrip';
      } else if (request.status === 'matched' && request.matched_driver_id) {
        // Verificar si hay acceptance
        const { data: acceptance } = await supabase
          .from('driver_acceptances')
          .select('id, driver_id')
          .eq('searching_pool_id', request.id)
          .maybeSingle();
        
        screen = acceptance ? 'matched' : 'matching';
      }

      const stateData = {
        requestId: request.id,
        status: request.status,
        driverId: request.matched_driver_id,
        screen: screen
      };

      // Guardar en caché
      this.savePassengerState(stateData);

      return stateData;
    } catch (error) {
      console.error('Error obteniendo estado desde BD:', error);
      return null;
    }
  }

  static async getDriverStateFromDB(supabase, userId) {
    console.log('🔍 Buscando viaje activo en BD para conductor...');
    
    try {
      // Buscar aceptación más reciente
      const { data: acceptance, error } = await supabase
        .from('driver_acceptances')
        .select(`
          id,
          searching_pool_id,
          passenger_id,
          created_at,
          searching_pool:searching_pool_id (
            status,
            user_id
          )
        `)
        .eq('driver_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!acceptance || error) {
        console.log('❌ No hay viaje activo en BD');
        return null;
      }

      const poolStatus = acceptance.searching_pool?.status;
      
      // Solo considerar viajes activos
      if (!poolStatus || ['completed', 'cancelled'].includes(poolStatus)) {
        console.log('❌ El viaje ya no está activo');
        return null;
      }

      console.log('✅ Viaje activo encontrado:', acceptance);

      // Determinar pantalla
      let screen = 'accepted';
      if (poolStatus === 'in_progress') {
        screen = 'liveTrip';
      }

      const stateData = {
        acceptanceId: acceptance.id,
        searchingPoolId: acceptance.searching_pool_id,
        passengerId: acceptance.passenger_id,
        status: poolStatus,
        screen: screen
      };

      // Guardar en caché
      this.saveDriverState(stateData);

      return stateData;
    } catch (error) {
      console.error('Error obteniendo estado desde BD:', error);
      return null;
    }
  }

  // ========================================
  // LIMPIAR ESTADO
  // ========================================

  static clearPassengerState() {
    localStorage.removeItem('passenger_active_trip');
    console.log('🗑️ Estado de pasajero limpiado');
  }

  static clearDriverState() {
    localStorage.removeItem('driver_active_trip');
    console.log('🗑️ Estado de conductor limpiado');
  }

  static clearAllStates() {
    this.clearPassengerState();
    this.clearDriverState();
  }
}

export default StateRecoveryService;