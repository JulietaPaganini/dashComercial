import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Mail, Lock, ArrowRight, AlertCircle, Loader2, UserPlus } from 'lucide-react';

const LoginScreen = () => {
    const { login, signUp } = useAuth();
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        setIsLoading(true);

        try {
            if (isLogin) {
                await login(email, password);
            } else {
                const { user } = await signUp(email, password);
                if (user) {
                    setMessage('Cuenta creada con éxito. ¡Ya puedes ingresar!');
                    setIsLogin(true); // Switch back to login
                }
            }
        } catch (err) {
            console.error(err);
            // Show actual error from Supabase for debugging
            const msg = err.message === 'Invalid login credentials'
                ? 'Credenciales incorrectas. ¿El usuario existe en Supabase?'
                : err.message || 'Error de conexión';
            setError(msg);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">

                {/* Header */}
                <div className="bg-white p-8 pb-6 text-center">
                    <div className="flex justify-center mb-6">
                        <img
                            src="/ocme_logo.png"
                            alt="OCME Logo"
                            className="h-20 w-auto object-contain"
                        />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">Panel de Ventas</h2>
                    <p className="text-gray-500 mt-2 text-sm">
                        {isLogin ? 'Ingresa con tu cuenta de Supabase.' : 'Registra un nuevo usuario para este proyecto.'}
                    </p>
                </div>

                {/* Form */}
                <div className="p-8 pt-0">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {error && (
                            <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg flex items-center gap-2 border border-red-100 animate-fade-in">
                                <AlertCircle size={16} />
                                {error}
                            </div>
                        )}
                        {message && (
                            <div className="bg-green-50 text-green-700 text-sm p-3 rounded-lg flex items-center gap-2 border border-green-100 animate-fade-in">
                                <AlertCircle size={16} />
                                {message}
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5 ml-1">Email</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Mail className="text-gray-400" size={18} />
                                </div>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="pl-10 w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                                    placeholder="admin@ejemplo.com"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5 ml-1">Contraseña</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Lock className="text-gray-400" size={18} />
                                </div>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="pl-10 w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                                    placeholder="••••••••"
                                    required
                                    minLength={6}
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full flex justify-center items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg shadow-lg shadow-blue-200 transition-all transform active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed mt-4"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 size={20} className="animate-spin" />
                                    Processed...
                                </>
                            ) : (
                                <>
                                    {isLogin ? 'Iniciar Sesión' : 'Registrarse'}
                                    <ArrowRight size={18} />
                                </>
                            )}
                        </button>
                    </form>
                </div>

                <div className="bg-gray-50 px-8 py-4 text-center border-t border-gray-100 flex justify-center">
                    {/* Public Sign Up disabled for security. Use Supabase Dashboard to invite users. */}
                    <p className="text-xs text-gray-400">Acceso restringido a personal autorizado.</p>
                    {/* 
                    <button
                        onClick={() => { setError(''); setIsLogin(!isLogin); }}
                        className="text-sm text-blue-600 font-bold hover:underline"
                    >
                        {isLogin ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia Sesión'}
                    </button> 
                    */}
                </div>
            </div>
        </div>
    );
};

export default LoginScreen;
