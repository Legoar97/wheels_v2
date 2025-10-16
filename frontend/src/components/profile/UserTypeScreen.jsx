import React from 'react';
import { Car, Users } from 'lucide-react';

const UserTypeScreen = ({ user, profile, setProfile, navigate, supabase }) => {
  const updateUserType = async (type) => {
    console.log('💾 Guardando tipo de usuario:', type);
    const { error } = await supabase
      .from('profiles')
      .update({ user_type: type })
      .eq('user_id', user.id);

    if (!error) {
      console.log('✅ Tipo guardado, navegando a sessionRoleSelection');
      setProfile({ ...profile, user_type: type });
      navigate('sessionRoleSelection');
    } else {
      console.error('❌ Error updating user type:', error);
      alert('Error al actualizar el tipo de usuario');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto pt-12">
        <div className="text-center mb-8 fade-in">
          <h2 className="text-3xl font-bold text-gray-800 mb-2">¿Cómo vas a usar Wheels?</h2>
          <p className="text-gray-600">Selecciona tu rol principal</p>
        </div>
        
        <div className="grid md:grid-cols-2 gap-6">
          <button
            onClick={() => updateUserType('driver')}
            className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 group transform hover:scale-105"
          >
            <Car className="w-16 h-16 text-green-700 mx-auto mb-4 group-hover:scale-110 transition-transform duration-300" />
            <h3 className="text-2xl font-bold text-gray-800 mb-2">Conductor</h3>
            <p className="text-gray-600">Ofrece viajes y comparte gastos</p>
            <ul className="mt-4 text-sm text-gray-500 space-y-2 text-left">
              <li>✓ Gana dinero compartiendo tu auto</li>
              <li>✓ Comparte gastos de gasolina</li>
              <li>✓ Conoce nuevos compañeros</li>
            </ul>
            <div className="mt-4 text-green-700 font-semibold">Seleccionar →</div>
          </button>
          
          <button
            onClick={() => updateUserType('passenger')}
            className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 group transform hover:scale-105"
          >
            <Users className="w-16 h-16 text-green-600 mx-auto mb-4 group-hover:scale-110 transition-transform duration-300" />
            <h3 className="text-2xl font-bold text-gray-800 mb-2">Pasajero</h3>
            <p className="text-gray-600">Encuentra viajes compartidos</p>
            <ul className="mt-4 text-sm text-gray-500 space-y-2 text-left">
              <li>✓ Viaja de forma económica</li>
              <li>✓ Contribuye al medio ambiente</li>
              <li>✓ Llega seguro a tu destino</li>
            </ul>
            <div className="mt-4 text-green-600 font-semibold">Seleccionar →</div>
          </button>
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            Podrás cambiar esto más tarde en tu perfil
          </p>
        </div>
      </div>
    </div>
  );
};

export default UserTypeScreen;