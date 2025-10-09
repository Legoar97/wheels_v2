import React, { useState } from 'react';
import { Car } from 'lucide-react';

const AuthScreen = ({ navigate, setUser, setProfile, loading, setLoading, supabase }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const loadProfile = async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (data) {
      setProfile(data);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (!email.includes('@uexternado.edu.co') && !email.includes('@est.uexternado.edu.co')) {
      setError('Por favor usa tu correo institucional @uexternado.edu.co');
      return;
    }

    setLoading(true);
    setError('');

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    setUser(data.user);
    await loadProfile(data.user.id);
    
    // Verificar si el usuario tiene tipo configurado
    const { data: profileData } = await supabase
      .from('profiles')
      .select('user_type')
      .eq('user_id', data.user.id)
      .single();

    if (!profileData || !profileData.user_type) {
      navigate('userType');
    } else {
      navigate('dashboard');
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-md mx-auto pt-12">
        <div className="bg-white rounded-2xl shadow-xl p-8 space-y-6">
          <div className="text-center">
            <Car className="w-16 h-16 mx-auto text-green-700 mb-4" />
            <h2 className="text-3xl font-bold text-gray-800">Bienvenido</h2>
            <p className="text-gray-600 mt-2">Inicia sesión con tu correo institucional</p>
          </div>
          
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Correo Electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu.nombre@uexternado.edu.co"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                required
              />
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-700 text-white py-4 rounded-lg font-semibold hover:bg-green-800 transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
            </button>
          </form>
          
          <div className="text-center space-y-2">
            <button
              onClick={() => navigate('register')}
              className="text-green-700 hover:underline text-sm mr-4"
            >
              Crear cuenta
            </button>
            <button
              onClick={() => navigate('welcome')}
              className="text-gray-600 hover:underline text-sm"
            >
              Volver
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;