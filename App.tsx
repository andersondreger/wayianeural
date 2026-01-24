
import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { supabase } from './lib/supabase';

// Importação de Views
import { LandingPage } from './views/LandingPage';
import { LoginPage } from './views/LoginPage';
import { Dashboard } from './views/Dashboard';
import { OnboardingPage } from './views/OnboardingPage';
import { ThankYouPage } from './views/ThankYouPage';

// Importação de Tipos
import { ViewState, UserSession, SubscriptionStatus } from './types';

const ADMIN_EMAIL = 'dregerr.anderson@gmail.com';

/**
 * CONFIGURAÇÃO DE PAGAMENTO (KIWIFY)
 * Link dinâmico que será usado no botão de checkout
 */
const CHECKOUT_LINK = "https://pay.kiwify.com.br/SEU_CODIGO_AQUI"; 

export default function App() {
  const [view, setView] = useState<ViewState>('LANDING');
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const isSuccess = urlParams.get('checkout') === 'success';

    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          const isAdmin = session.user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
          
          const userData: UserSession = {
            email: session.user.email || '',
            name: profile?.full_name || session.user.email?.split('@')[0].toUpperCase(),
            phone: profile?.phone,
            isAdmin,
            trialStart: new Date(profile?.created_at || session.user.created_at).getTime(),
            subscriptionStatus: isAdmin ? 'ACTIVE' : (profile?.subscription_status as SubscriptionStatus || 'TRIALING')
          };
          
          setUser(userData);
          
          // Se for sucesso do checkout, mantemos na ThankYouPage
          // Caso contrário, se estiver logado, vai pro Dashboard
          if (isSuccess) {
            setView('THANK_YOU');
          } else {
            setView('DASHBOARD');
          }
        } else {
          // Se não tiver sessão e for sucesso, mostra ThankYouPage mesmo assim
          if (isSuccess) {
            setView('THANK_YOU');
          }
        }
      } catch (err) {
        console.warn("Sessão offline.");
        if (isSuccess) setView('THANK_YOU');
      } finally {
        setTimeout(() => setLoading(false), 800);
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setUser(null);
        // Só volta para LANDING se não estivermos na tela de sucesso
        const currentParams = new URLSearchParams(window.location.search);
        if (currentParams.get('checkout') !== 'success') {
          setView('LANDING');
        }
      } else if (_event === 'SIGNED_IN') {
        checkSession();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async (email: string) => {
    try {
      const { error } = await supabase.auth.signInWithOtp({ 
        email: email.toLowerCase().trim(),
        options: { emailRedirectTo: window.location.origin }
      });
      if (error) throw error;
      alert("Pulsar neural enviado! Verifique seu e-mail.");
    } catch (error: any) {
      alert("Erro: " + error.message);
    }
  };

  const handleRegisterTrial = async (name: string, email: string, phone: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email: email.toLowerCase().trim(),
        password: 'WayFlowNeuralDefault123!',
        options: {
          data: { full_name: name, phone: phone, subscription_status: 'TRIALING' }
        }
      });
      if (error) throw error;
      alert("Conta criada! Verifique seu e-mail para ativar.");
    } catch (error: any) {
      alert("Erro: " + error.message);
    }
  };

  const handleCheckoutAction = () => {
    const url = new URL(CHECKOUT_LINK);
    if (user?.email) url.searchParams.append('email', user.email);
    if (user?.name) url.searchParams.append('name', user.name);
    window.open(url.toString(), '_blank');
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setView('LANDING');
  };

  if (loading) {
    return (
      <div className="h-screen bg-[#050505] flex flex-col items-center justify-center">
        <div className="relative">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }} className="w-20 h-20 border-2 border-orange-500/5 border-t-orange-500 rounded-full" />
          <div className="absolute inset-0 flex items-center justify-center">
             <img src="https://qonrpzlkjhdmswjfxvtu.supabase.co/storage/v1/object/public/WayIAFlow/logo.png" alt="WayFlow" className="w-8 h-8 object-contain" />
          </div>
        </div>
        <div className="mt-8 text-[8px] font-black uppercase tracking-[0.5em] text-orange-500/40 italic">Sincronizando Engine...</div>
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
            onCheckout={handleCheckoutAction}
            onBack={() => setView('LANDING')} 
          />
        )}
        {view === 'THANK_YOU' && (
          <ThankYouPage 
            onGoToDashboard={() => {
              // Limpa o parâmetro da URL ao entrar no Dashboard para evitar loops
              window.history.replaceState({}, document.title, window.location.pathname);
              setView(user ? 'DASHBOARD' : 'ONBOARDING');
            }} 
          />
        )}
        {view === 'DASHBOARD' && user && <Dashboard user={user} onLogout={handleLogout} onCheckout={handleCheckoutAction} />}
      </AnimatePresence>
    </div>
  );
}
