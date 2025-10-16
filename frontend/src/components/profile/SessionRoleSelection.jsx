import React from 'react';
import { Car, Users, Sparkles } from 'lucide-react';

const SessionRoleSelection = ({ user, profile, navigate, updateAppState }) => {
  const handleRoleSelection = (role) => {
    console.log('🎯 Rol seleccionado:', role);
    updateAppState({ sessionRole: role });
    console.log('✅ AppState actualizado, navegando a dashboard...');
    navigate('dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-6">
      <div className="max-w-2xl mx-auto pt-12">
        <div className="text-center mb-8 fade-in">
          <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-4xl font-bold text-gray-800 mb-3">
            ¡Hola, {profile?.full_name?.split(' ')[0] || 'Usuario'}! 👋
          </h2>
          <p className="text-xl text-gray-600 mb-2">¿Qué vas a ser hoy?</p>
          <p className="text-sm text-gray-500">
            Puedes cambiar entre conductor y pasajero cuando quieras
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 gap-6">
          <button
            onClick={() => handleRoleSelection('driver')}
            className="bg-white p-8 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 group transform hover:scale-105 border-2 border-transparent hover:border-green-500"
          >
            <div className="relative">
              <Car className="w-20 h-20 text-green-700 mx-auto mb-4 group-hover:scale-110 transition-transform duration-300" />
              {profile?.user_type === 'driver' && (
                <div className="absolute top-0 right-0 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                  Tu favorito ⭐
                </div>
              )}
            </div>
            <h3 className="text-2xl font-bold text-gray-800 mb-2">Conductor</h3>
            <p className="text-gray-600 mb-4">Ofrece viajes y comparte gastos</p>
            <div className="bg-green-50 rounded-lg p-3 text-left">
              <ul className="text-sm text-green-800 space-y-2">
                <li className="flex items-center space-x-2">
                  <span className="text-green-600">💰</span>
                  <span>Gana dinero compartiendo</span>
                </li>
                <li className="flex items-center space-x-2">
                  <span className="text-green-600">⛽</span>
                  <span>Comparte gastos de gasolina</span>
                </li>
                <li className="flex items-center space-x-2">
                  <span className="text-green-600">🤝</span>
                  <span>Conoce nuevas personas</span>
                </li>
              </ul>
            </div>
            <div className="mt-4 text-green-700 font-semibold text-lg group-hover:translate-x-2 transition-transform">
              Ser Conductor hoy →
            </div>
          </button>
          
          <button
            onClick={() => handleRoleSelection('passenger')}
            className="bg-white p-8 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 group transform hover:scale-105 border-2 border-transparent hover:border-blue-500"
          >
            <div className="relative">
              <Users className="w-20 h-20 text-blue-600 mx-auto mb-4 group-hover:scale-110 transition-transform duration-300" />
              {profile?.user_type === 'passenger' && (
                <div className="absolute top-0 right-0 bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                  Tu favorito ⭐
                </div>
              )}
            </div>
            <h3 className="text-2xl font-bold text-gray-800 mb-2">Pasajero</h3>
            <p className="text-gray-600 mb-4">Encuentra viajes compartidos</p>
            <div className="bg-blue-50 rounded-lg p-3 text-left">
              <ul className="text-sm text-blue-800 space-y-2">
                <li className="flex items-center space-x-2">
                  <span className="text-blue-600">💵</span>
                  <span>Viaja económicamente</span>
                </li>
                <li className="flex items-center space-x-2">
                  <span className="text-blue-600">🌱</span>
                  <span>Cuida el medio ambiente</span>
                </li>
                <li className="flex items-center space-x-2">
                  <span className="text-blue-600">🛡️</span>
                  <span>Viaja seguro y cómodo</span>
                </li>
              </ul>
            </div>
            <div className="mt-4 text-blue-600 font-semibold text-lg group-hover:translate-x-2 transition-transform">
              Ser Pasajero hoy →
            </div>
          </button>
        </div>

        <div className="mt-8 bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-start space-x-3">
            <div className="text-2xl">💡</div>
            <div className="flex-1">
              <h4 className="font-semibold text-gray-800 mb-1">Rol flexible</h4>
              <p className="text-sm text-gray-600">
                Tu elección es solo para esta sesión. La próxima vez que inicies sesión, 
                podrás elegir nuevamente según tus necesidades del día.
              </p>
            </div>
          </div>
        </div>

        {/* Estadísticas personales - MEJORADAS */}
        {profile && (profile.total_trips > 0) && (
          <div className="mt-6 bg-white rounded-xl shadow-lg p-6">
            <h3 className="font-bold text-lg mb-4 text-gray-800">📊 Tu Historia en Wheels</h3>
            
            {/* Como Conductor */}
            {profile.driver_trips > 0 && (
              <div className="mb-4 p-4 bg-green-50 rounded-lg">
                <h4 className="font-semibold text-green-900 mb-2 flex items-center">
                  <Car className="w-4 h-4 mr-2" />
                  Como Conductor
                </h4>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <div className="text-2xl font-bold text-green-700">{profile.driver_trips || 0}</div>
                    <div className="text-xs text-green-600">Viajes</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">{profile.driver_completed_trips || 0}</div>
                    <div className="text-xs text-green-600">Completados</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-800">⭐ {profile.driver_rating?.toFixed(1) || '5.0'}</div>
                    <div className="text-xs text-green-600">Rating</div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Como Pasajero */}
            {profile.passenger_trips > 0 && (
              <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-2 flex items-center">
                  <Users className="w-4 h-4 mr-2" />
                  Como Pasajero
                </h4>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <div className="text-2xl font-bold text-blue-700">{profile.passenger_trips || 0}</div>
                    <div className="text-xs text-blue-600">Viajes</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-blue-600">{profile.passenger_completed_trips || 0}</div>
                    <div className="text-xs text-blue-600">Completados</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-blue-800">⭐ {profile.passenger_rating?.toFixed(1) || '5.0'}</div>
                    <div className="text-xs text-blue-600">Rating</div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Total General */}
            <div className="mt-4 pt-4 border-t border-gray-200 text-center">
              <p className="text-sm text-gray-600">
                Total: <span className="font-bold text-gray-800">{profile.total_trips || 0}</span> viajes realizados
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SessionRoleSelection;