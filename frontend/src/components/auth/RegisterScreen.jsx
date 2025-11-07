import React, { useState } from 'react';
import { Car, CheckCircle, ExternalLink } from 'lucide-react';

const RegisterScreen = ({ navigate, loading, setLoading, supabase }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();

    if (!email.includes('@uexternado.edu.co') && !email.includes('@est.uexternado.edu.co')) {
      setError('Por favor usa tu correo institucional @uexternado.edu.co');
      return;
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    if (!acceptedTerms) {
      setError('Debes aceptar los Términos y Condiciones y las Políticas de Privacidad');
      return;
    }

    setLoading(true);
    setError('');

    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name
        }
      }
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    // Crear perfil
    if (data.user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          user_id: data.user.id,
          email: email,
          full_name: name
        });

      if (profileError) {
        console.error('Error creating profile:', profileError);
      }
    }

    setSuccess(true);
    setLoading(false);
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center scale-in">
          <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">¡Cuenta Creada!</h2>
          <p className="text-gray-600 mb-6">
            Hemos enviado un correo de confirmación a <strong>{email}</strong>. 
            Por favor verifica tu correo antes de iniciar sesión.
          </p>
          <button
            onClick={() => navigate('auth')}
            className="w-full bg-green-700 text-white py-3 rounded-lg font-semibold hover:bg-green-800 transition"
          >
            Ir a Iniciar Sesión
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-md mx-auto pt-12">
        <div className="bg-white rounded-2xl shadow-xl p-8 space-y-6">
          <div className="text-center">
            <Car className="w-16 h-16 mx-auto text-green-700 mb-4" />
            <h2 className="text-3xl font-bold text-gray-800">Registro</h2>
            <p className="text-gray-600 mt-2">Crea tu cuenta Wheels</p>
          </div>
          
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nombre Completo
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Juan Pérez"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                required
              />
            </div>

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
                placeholder="Mínimo 6 caracteres"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                required
              />
            </div>

            {/* Checkbox de Términos y Condiciones */}
            <div className="space-y-3">
              <div className="flex items-start space-x-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <input
                  type="checkbox"
                  id="acceptTerms"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-1 w-4 h-4 text-green-700 border-gray-300 rounded focus:ring-green-500 cursor-pointer"
                  required
                />
                <label htmlFor="acceptTerms" className="text-sm text-gray-700 cursor-pointer">
                  Acepto los{' '}
                  <a
                    href="https://www.uber.com/legal/es/document/?name=general-terms-of-use&country=colombia&lang=es"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-green-700 font-semibold hover:underline inline-flex items-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Términos y Condiciones
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                  {' '}y las{' '}
                  <a
                    href="https://www.uber.com/global/es/privacy-notice-riders-order-recipients"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-green-700 font-semibold hover:underline inline-flex items-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Políticas de Privacidad
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                </label>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-800">
                  Al crear una cuenta, aceptas que usaremos tu información de acuerdo a nuestras políticas de privacidad y términos de servicio.
                </p>
              </div>
            </div>
            
            <button
              type="submit"
              disabled={loading || !acceptedTerms}
              className="w-full bg-green-700 text-white py-4 rounded-lg font-semibold hover:bg-green-800 transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creando cuenta...' : 'Registrarse'}
            </button>
          </form>
          
          <div className="text-center space-y-2">
            <button
              onClick={() => navigate('auth')}
              className="text-green-700 hover:underline text-sm mr-4"
            >
              Ya tengo cuenta
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

export default RegisterScreen;