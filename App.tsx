
import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Zap } from 'lucide-react';

// Importação de Views
import { LandingPage } from './views/LandingPage';
import { LoginPage } from './views/LoginPage';
import { Dashboard } from './views/Dashboard';
import { OnboardingPage } from './views/OnboardingPage';

// Importação de Tipos
import { ViewState, UserSession, SubscriptionStatus, SystemMessage } from './types';

const ADMIN_EMAIL = 'dregerr.anderson@gmail.com';

export default function App() {
  const [view, setView] = useState<ViewState>('LANDING');
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);

  // Inicialização e Recuperação de Sessão
  useEffect(() => {
    const saved = localStorage.getItem('wayflow_v3_core');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed?.email) {
          setUser(parsed);
          setView('DASHBOARD');
        }
      } catch (e) {
        localStorage.removeItem('wayflow_v3_core');
      }
    }
    const timer = setTimeout(() => setLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  const handleLogin = (email: string, name?: string, phone?: string) => {
    const isAdmin = email.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim();
    
    // Simulação de Mensagens do Sistema para Usuário Comum
    const messages: SystemMessage[] = !isAdmin ? [
      { id: '1', text: 'Sincronização com cluster n8n concluída com sucesso.', type: 'info', timestamp: Date.now() }
    ] : [];

    const newUser: UserSession = {
      email: email.toLowerCase().trim(),
      name: name || email.split('@')[0].toUpperCase(),
      phone: phone || '',
      isAdmin,
      trialStart: Date.now(),
      subscriptionStatus: isAdmin ? 'ACTIVE' : 'TRIALING',
      messages
    };
    
    setUser(newUser);
    localStorage.setItem('wayflow_v3_core', JSON.stringify(newUser));
    setView('DASHBOARD');
  };

  const handleRegisterTrial = (name: string, email: string, phone: string) => {
    const isAdmin = email.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim();
    const newUser: UserSession = {
      email: email.toLowerCase().trim(),
      name: name.toUpperCase(),
      phone: phone,
      isAdmin,
      trialStart: Date.now(),
      subscriptionStatus: isAdmin ? 'ACTIVE' : 'TRIALING',
      messages: [{ id: 'trial-msg', text: 'Seu período de teste de 15 dias começou. Aproveite a Engine!', type: 'info', timestamp: Date.now() }]
    };
    setUser(newUser);
    localStorage.setItem('wayflow_v3_core', JSON.stringify(newUser));
    setView('DASHBOARD');
  };

  const handleCheckoutMock = () => {
    alert("Iniciando Handshake Seguro com Stripe Gateway...\nValor: R$ 89,00/mês");
    // Futura integração: window.location.href = stripeCheckoutUrl;
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('wayflow_v3_core');
    setView('LANDING');
  };

  if (loading) {
    return (
      <div className="h-screen bg-[#050505] flex flex-col items-center justify-center overflow-hidden">
        <div className="relative">
          <motion.div 
            animate={{ rotate: 360 }} 
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            className="w-20 h-20 border-2 border-orange-500/5 border-t-orange-500 rounded-full"
          />
          <div className="absolute inset-0 flex items-center justify-center">
             <img 
                src="https://qonrpzlkjhdmswjfxvtu.supabase.co/storage/v1/object/public/WayIAFlow/logo.png" 
                alt="WayFlow" 
                className="w-8 h-8 object-contain animate-pulse"
              />
          </div>
        </div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-12 flex flex-col items-center">
          <div className="text-[11px] font-black uppercase tracking-[1em] text-orange-500/50">WayFlow Neural</div>
          <div className="text-[8px] font-bold uppercase tracking-[0.4em] text-gray-800 mt-4 italic animate-pulse tracking-tighter">Sincronizando Clusters...</div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-orange-500/30 overflow-hidden font-sans">
      <AnimatePresence mode="wait">
        {view === 'LANDING' && (
          <motion.div key="land" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <LandingPage onStart={() => setView('ONBOARDING')} />
          </motion.div>
        )}
        {view === 'ONBOARDING' && (
          <motion.div key="onboard" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <OnboardingPage 
              onRegisterTrial={handleRegisterTrial} 
              onLogin={handleLogin}
              onCheckout={handleCheckoutMock}
              onBack={() => setView('LANDING')} 
            />
          </motion.div>
        )}
        {view === 'LOGIN' && (
          <motion.div key="log" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}>
            <LoginPage onLogin={handleLogin} onBack={() => setView('LANDING')} />
          </motion.div>
        )}
        {view === 'DASHBOARD' && user && (
          <motion.div key="dash" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.02 }}>
            <Dashboard user={user} onLogout={handleLogout} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
