
import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { supabase } from './lib/supabase';

import { LandingPage } from './views/LandingPage';
import { Dashboard } from './views/Dashboard';
import { OnboardingPage } from './views/OnboardingPage';
import { ThankYouPage } from './views/ThankYouPage';

import { ViewState, UserSession } from './types';

const ADMIN_EMAIL = 'dregerr.anderson@gmail.com';
const CHECKOUT_LINK = "https://pay.kiwify.com.br/ufaPS6M"; 

export default function App() {
  const [view, setView] = useState<ViewState>('LANDING');
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);

  // Usuário Operacional Padrão
  const activeUser: UserSession = {
    email: 'operador@wayiaflow.com.br',
    name: 'WAYFLOW OPERATOR',
    isAdmin: true,
    trialStart: Date.now(),
    subscriptionStatus: 'ACTIVE'
  };

  const checkSession = async () => {
    try {
      // Priorizamos sempre entrar no Dashboard para uso da Evolution API
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        setUser({
          email: session.user.email || '',
          name: session.user.email?.split('@')[0].toUpperCase(),
          isAdmin: session.user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase(),
          trialStart: Date.now(),
          subscriptionStatus: 'ACTIVE'
        });
        setView('DASHBOARD');
      } else {
        // Se não houver sessão, usamos o usuário operacional para não travar o cliente
        setUser(activeUser);
        if (view === 'LANDING' || view === 'ONBOARDING') {
           // Mantém a view atual
        } else {
           setView('DASHBOARD');
        }
      }
    } catch (err) {
      setUser(activeUser);
      setView('DASHBOARD');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  const handleLogin = (email: string) => {
    setUser({ ...activeUser, email, isAdmin: email === ADMIN_EMAIL });
    setView('DASHBOARD');
  };

  const handleRegisterTrial = (name: string, email: string) => {
    setUser({ ...activeUser, name, email });
    setView('DASHBOARD');
  };

  const handleLogout = () => {
    setUser(null);
    setView('LANDING');
  };

  if (loading) {
    return (
      <div className="h-screen bg-[#050505] flex flex-col items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }} className="w-16 h-16 border-2 border-orange-500/20 border-t-orange-500 rounded-full" />
        <div className="mt-6 text-[8px] font-black uppercase tracking-[0.5em] text-orange-500 italic">Sincronizando Engine...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <AnimatePresence mode="wait">
        {view === 'LANDING' && <LandingPage onStart={() => setView('ONBOARDING')} />}
        {view === 'ONBOARDING' && (
          <OnboardingPage 
            onRegisterTrial={handleRegisterTrial} 
            onLogin={handleLogin}
            onCheckout={() => window.open(CHECKOUT_LINK, '_blank')}
            onBack={() => setView('LANDING')} 
          />
        )}
        {view === 'DASHBOARD' && user && <Dashboard user={user} onLogout={handleLogout} onCheckout={() => {}} />}
      </AnimatePresence>
    </div>
  );
}
