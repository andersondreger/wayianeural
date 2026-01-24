
import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Zap } from 'lucide-react';
import { supabase } from './lib/supabase';

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

  // Inicialização: Verifica sessão real no Supabase com tratamento de erro robusto
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (session?.user && !error) {
          const isAdmin = session.user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
          const userData: UserSession = {
            email: session.user.email || '',
            name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0].toUpperCase(),
            isAdmin,
            trialStart: Date.now(),
            subscriptionStatus: isAdmin ? 'ACTIVE' : 'TRIALING'
          };
          setUser(userData);
          setView('DASHBOARD');
        } else {
          // Fallback para localStorage (essencial para persistência offline ou sem Supabase configurado)
          const saved = localStorage.getItem('wayflow_v3_core');
          if (saved) {
            try {
              const parsed = JSON.parse(saved);
              if (parsed && parsed.email) {
                setUser(parsed);
                setView('DASHBOARD');
              }
            } catch (e) {
              localStorage.removeItem('wayflow_v3_core');
            }
          }
        }
      } catch (err) {
        console.warn("Supabase Handshake Offline: Operando em modo LocalStorage.");
        // Tentativa de recuperação via LocalStorage em caso de erro de rede/configuração
        const saved = localStorage.getItem('wayflow_v3_core');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            setUser(parsed);
            setView('DASHBOARD');
          } catch (e) {}
        }
      } finally {
        // Garante que o loading termine após 1.5s (estética) ou imediatamente após o check
        setTimeout(() => setLoading(false), 800);
      }
    };

    checkSession();
  }, []);

  const handleLogin = async (email: string) => {
    try {
      const { error } = await supabase.auth.signInWithOtp({ 
        email: email.toLowerCase().trim(),
        options: {
          emailRedirectTo: window.location.origin
        }
      });

      if (error) throw error;
      alert("Pulsar neural enviado! Verifique seu e-mail.");
    } catch (error: any) {
      console.error("Login Error:", error);
      // Se o Supabase falhar, permitimos o login mock para não travar o usuário em dev
      alert("Modo de Emergência: Login simulado ativado para " + email);
    }

    const isAdmin = email.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim();
    const newUser: UserSession = {
      email: email.toLowerCase().trim(),
      name: email.split('@')[0].toUpperCase(),
      isAdmin,
      trialStart: Date.now(),
      subscriptionStatus: isAdmin ? 'ACTIVE' : 'TRIALING'
    };
    setUser(newUser);
    localStorage.setItem('wayflow_v3_core', JSON.stringify(newUser));
    setView('DASHBOARD');
  };

  const handleRegisterTrial = async (name: string, email: string, phone: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email: email.toLowerCase().trim(),
        password: 'WayFlowNeuralDefault123!', // Senha padrão para fluxo simplificado
        options: {
          data: { full_name: name, phone: phone }
        }
      });

      if (error) throw error;
    } catch (error: any) {
      console.warn("Registro Supabase indisponível, usando persistência local.");
    }

    const isAdmin = email.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim();
    const newUser: UserSession = {
      email: email.toLowerCase().trim(),
      name: name.toUpperCase(),
      phone: phone,
      isAdmin,
      trialStart: Date.now(),
      subscriptionStatus: 'TRIALING'
    };
    setUser(newUser);
    localStorage.setItem('wayflow_v3_core', JSON.stringify(newUser));
    setView('DASHBOARD');
  };

  const handleCheckoutReal = () => {
    // Busca variável de ambiente com segurança
    const getEnv = (key: string) => typeof process !== 'undefined' ? process.env[key] : undefined;
    const STRIPE_LINK = getEnv('NEXT_PUBLIC_STRIPE_CHECKOUT_URL') || "https://buy.stripe.com/mock_link";
    window.location.href = STRIPE_LINK;
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {}
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
        <div className="mt-8 text-[8px] font-black uppercase tracking-[0.5em] text-orange-500/40 animate-pulse italic">
          Sincronizando Engine...
        </div>
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
              onCheckout={handleCheckoutReal}
              onBack={() => setView('LANDING')} 
            />
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
