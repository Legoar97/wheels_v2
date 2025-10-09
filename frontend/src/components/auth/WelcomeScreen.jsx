import React from 'react';
import { Car } from 'lucide-react';

const WelcomeScreen = ({ navigate }) => {
  return (
    <div className="min-h-screen bg-gradient-externado flex flex-col items-center justify-center p-6 text-white">
      <div className="text-center space-y-6 max-w-md fade-in">
        {/* Logo animado */}
        <div className="mb-8">
          <Car className="w-24 h-24 mx-auto animate-pulse-slow" />
        </div>

        {/* Título y descripción */}
        <div className="space-y-3">
          <h1 className="text-5xl font-bold tracking-tight">Wheels</h1>
          <p className="text-xl opacity-90 font-medium">
            Carpooling Universidad Externado
          </p>
          <p className="text-sm opacity-75 max-w-sm mx-auto">
            Conecta con compañeros para compartir viajes de forma segura, económica y sostenible
          </p>
        </div>

        {/* Botones de acción */}
        <div className="space-y-3 pt-8">
          <button
            onClick={() => navigate('auth')}
            className="w-full bg-white text-green-700 py-4 rounded-xl font-semibold hover:bg-gray-100 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            Iniciar Sesión
          </button>
          
          <button
            onClick={() => navigate('register')}
            className="w-full border-2 border-white py-4 rounded-xl font-semibold hover:bg-white hover:text-green-700 transition-all duration-300"
          >
            Crear Cuenta
          </button>
        </div>

        {/* Features */}
        <div className="grid grid-cols-3 gap-4 pt-12 text-xs">
          <div className="space-y-2">
            <div className="text-3xl">🚗</div>
            <div className="opacity-90">Seguro</div>
          </div>
          <div className="space-y-2">
            <div className="text-3xl">💰</div>
            <div className="opacity-90">Económico</div>
          </div>
          <div className="space-y-2">
            <div className="text-3xl">🌱</div>
            <div className="opacity-90">Sostenible</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;