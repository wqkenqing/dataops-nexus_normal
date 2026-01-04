import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { User, Lock, ArrowRight, Loader2, Gauge, ShieldCheck, Activity } from 'lucide-react';
import LanguageSwitcher from './LanguageSwitcher';
import { useNavigate } from 'react-router-dom';

const LoginPage: React.FC = () => {
    const { login } = useAuth();
    const { t } = useTranslation();
    const navigate = useNavigate();

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!username || !password) return;

        setIsSubmitting(true);
        try {
            await login(username);
            navigate('/');
        } catch (error) {
            console.error("Login failed", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-white flex">
            {/* Left Side - Visuals */}
            <div className="hidden lg:flex lg:w-1/2 bg-slate-900 relative overflow-hidden flex-col justify-between p-12 text-white">
                {/* Background Decor */}
                <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-indigo-600/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-purple-600/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4"></div>
                <div className="absolute top-1/2 left-1/2 w-full h-full bg-[radial-gradient(rgba(255,255,255,0.03)_1px,transparent_1px)] [background-size:24px_24px] -translate-x-1/2 -translate-y-1/2 opacity-50"></div>

                {/* Content */}
                <div className="relative z-10 animate-in fade-in slide-in-from-left-8 duration-700">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-10 h-10 bg-indigo-500 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/30">
                            <Gauge className="text-white" size={24} />
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight">DataOps Nexus</h1>
                    </div>
                </div>

                <div className="relative z-10 space-y-8 max-w-lg mb-12 animate-in fade-in slide-in-from-left-8 duration-700 delay-100">
                    <div className="space-y-4">
                        <div className="flex items-start gap-4 p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
                            <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-300">
                                <ShieldCheck size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg mb-1">{t('login.feature1Title')}</h3>
                                <p className="text-slate-400 leading-relaxed text-sm">
                                    {t('login.feature1Desc')}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4 p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
                            <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-300">
                                <Activity size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg mb-1">{t('login.feature2Title')}</h3>
                                <p className="text-slate-400 leading-relaxed text-sm">
                                    {t('login.feature2Desc')}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="relative z-10 text-xs text-slate-500 animate-in fade-in duration-700 delay-200">
                    {t('login.copyright')}
                </div>
            </div>

            {/* Right Side - Form */}
            <div className="w-full lg:w-1/2 flex flex-col items-center justify-center p-8 bg-gray-50 lg:bg-white relative">
                <div className="absolute top-6 right-8">
                    <LanguageSwitcher />
                </div>

                <div className="w-full max-w-md space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="text-center lg:text-left">
                        <div className="lg:hidden flex justify-center mb-6">
                            <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
                                <Gauge className="text-white" size={28} />
                            </div>
                        </div>
                        <h2 className="text-3xl font-bold text-gray-900 tracking-tight">{t('login.title')}</h2>
                        <p className="mt-2 text-gray-500">{t('login.subtitle')}</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5 ml-1">
                                    {t('login.usernameLabel')}
                                </label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <User className="h-5 w-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                                    </div>
                                    <input
                                        type="text"
                                        required
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-sm"
                                        placeholder="admin"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5 ml-1">
                                    {t('login.passwordLabel')}
                                </label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Lock className="h-5 w-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                                    </div>
                                    <input
                                        type="password"
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-sm"
                                        placeholder="••••••••"
                                    />
                                </div>
                                <div className="flex justify-end mt-1">
                                    <a href="#" className="text-xs font-medium text-indigo-600 hover:text-indigo-500">
                                        {t('login.forgotPassword')}
                                    </a>
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="animate-spin" size={18} />
                                    {t('login.signingIn')}
                                </>
                            ) : (
                                <>
                                    {t('login.signInButton')}
                                    <ArrowRight size={18} />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-200"></div>
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="px-2 bg-gray-50 lg:bg-white text-gray-400 font-medium">DataOps Nexus Platform</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
