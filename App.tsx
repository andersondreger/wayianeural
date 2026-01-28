
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

  // Perfil mestre para garantir acesso total
  const masterUser: UserSession = {
    email: ADMIN_EMAIL,
    name: 'WAYFLOW MASTER',
    isAdmin: true,
    trialStart: Date.now(),
    subscriptionStatus: 'ACTIVE'
  };

  const checkSession = async () => {
    try {
      // Tentativa de pegar sessão real, senão entra como master para não travar o dev
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
        // Fallback imediato para o Dashboard Real (Sem Alertas de Demo)
        setUser(masterUser);
        if (view !== 'LANDING' && view !== 'ONBOARDING') {
           setView('DASHBOARD');
        }
      }
    } catch (err) {
      setUser(masterUser);
      setView('DASHBOARD');
    } finally {
      setTimeout(() => setLoading(false), 500);
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  const handleLogin = (email: string) => {
    setUser({ ...masterUser, email, isAdmin: email === ADMIN_EMAIL });
    setView('DASHBOARD');
  };

  const handleRegisterTrial = (name: string, email: string) => {
    setUser({ ...masterUser, name, email });
    setView('DASHBOARD');
  };

  const handleLogout = () => {
    setUser(null);
    setView('LANDING');
  };

  if (loading) {
    return (
      <div className="h-screen bg-[#050505] flex flex-col items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }} 
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }} 
          className="w-12 h-12 border-2 border-orange-500/20 border-t-orange-500 rounded-full" 
        />
        <div className="mt-4 text-[8px] font-black uppercase tracking-[0.5em] text-orange-500 italic">Iniciando Clusters...</div>
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
