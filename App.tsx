
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

  const masterUser: UserSession = {
    email: ADMIN_EMAIL,
    name: 'WAYFLOW MASTER',
    isAdmin: true,
    trialStart: Date.now(),
    subscriptionStatus: 'ACTIVE'
  };

  const checkSession = async () => {
    try {
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
        // Fallback imediato para dashboard se já estiver navegando
        setUser(masterUser);
        if (view !== 'LANDING') {
           setView('DASHBOARD');
        }
      }
    } catch (err) {
      setUser(masterUser);
    } finally {
      // Tempo mínimo para garantir que o DOM esteja pronto
      setTimeout(() => setLoading(false), 300);
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
          transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }} 
          className="w-10 h-10 border-2 border-orange-500/10 border-t-orange-500 rounded-full" 
        />
        <div className="mt-8 text-[8px] font-black uppercase tracking-[0.8em] text-orange-500 italic animate-pulse">Sincronizando Clusters...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white overflow-x-hidden selection:bg-orange-500/30">
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
        {view === 'DASHBOARD' && user && (
          <Dashboard 
            user={user} 
            onLogout={handleLogout} 
            onCheckout={() => window.open(CHECKOUT_LINK, '_blank')} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}
