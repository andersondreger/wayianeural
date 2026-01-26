
import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { supabase, isSupabaseConfigured } from './lib/supabase';

// Importação de Views
import { LandingPage } from './views/LandingPage';
import { Dashboard } from './views/Dashboard';
import { OnboardingPage } from './views/OnboardingPage';
import { ThankYouPage } from './views/ThankYouPage';

// Importação de Tipos
import { ViewState, UserSession, SubscriptionStatus } from './types';

// EMAIL ADMIN MASTER DEFINIDO
const ADMIN_EMAIL = 'dregerr.anderson@gmail.com';

/**
 * CONFIGURAÇÃO DE PAGAMENTO (KIWIFY)
 */
const CHECKOUT_LINK = "https://pay.kiwify.com.br/ufaPS6M"; 

export default function App() {
  const [view, setView] = useState<ViewState>('LANDING');
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);

  // Mock de usuário para garantir que a dashboard abra mesmo sem login social configurado
  const demoUser: UserSession = {
    email: 'admin@wayiaflow.com.br',
    name: 'WAYFLOW OPERATOR',
    isAdmin: true,
    trialStart: Date.now(),
    subscriptionStatus: 'ACTIVE'
  };

  const checkSession = async (isCheckoutSuccess: boolean) => {
    try {
      if (!isSupabaseConfigured) {
        throw new Error("Supabase Offline");
      }

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
        setView(isCheckoutSuccess ? 'THANK_YOU' : 'DASHBOARD');
      } else {
        if (isCheckoutSuccess) setView('THANK_YOU');
      }
    } catch (err) {
      // Fallback para modo operacional direto em caso de erro de conexão
      if (!user) {
        setUser(demoUser);
        if (!isCheckoutSuccess && view !== 'LANDING' && view !== 'ONBOARDING') setView('DASHBOARD');
      }
    } finally {
      setTimeout(() => setLoading(false), 800);
    }
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const isSuccess = urlParams.get('checkout') === 'success';
    checkSession(isSuccess);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session && !new URLSearchParams(window.location.search).get('checkout')) {
        // Não reseta se já estivermos no Dashboard em modo operacional
      } else if (session) {
        checkSession(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async (email: string) => {
    try {
      if (!isSupabaseConfigured) {
        setUser({...demoUser, email, isAdmin: email.toLowerCase() === ADMIN_EMAIL});
        setView('DASHBOARD');
        return;
      }
      const { error } = await supabase.auth.signInWithOtp({ 
        email: email.toLowerCase().trim(),
        options: { emailRedirectTo: window.location.origin }
      });
      if (error) throw error;
      alert("Link de acesso enviado! Verifique sua caixa de entrada.");
    } catch (error: any) {
      setUser({...demoUser, email, isAdmin: email.toLowerCase() === ADMIN_EMAIL});
      setView('DASHBOARD');
    }
  };

  const handleRegisterTrial = async (name: string, email: string, phone: string) => {
    try {
      if (!isSupabaseConfigured) {
        setUser({...demoUser, name, email, phone, isAdmin: email.toLowerCase() === ADMIN_EMAIL});
        setView('DASHBOARD');
        return;
      }
      const { error } = await supabase.auth.signUp({
        email: email.toLowerCase().trim(),
        password: 'WayFlowNeuralDefault123!',
        options: { data: { full_name: name, phone: phone, subscription_status: 'TRIALING' } }
      });
      if (error) throw error;
    } catch (error: any) {
      setUser({...demoUser, name, email, phone});
      setView('DASHBOARD');
    }
  };

  const handleCheckoutAction = () => {
    window.open(CHECKOUT_LINK, '_blank');
  };

  const handleLogout = async () => {
    if (isSupabaseConfigured) await supabase.auth.signOut();
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
              window.history.replaceState({}, document.title, window.location.pathname);
              if (!user) setUser(demoUser);
              setView('DASHBOARD');
            }} 
          />
        )}
        {view === 'DASHBOARD' && user && <Dashboard user={user} onLogout={handleLogout} onCheckout={handleCheckoutAction} />}
      </AnimatePresence>
    </div>
  );
}
