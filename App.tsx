
import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { supabase } from './lib/supabase';

import { LandingPage } from './views/LandingPage';
import { Dashboard } from './views/Dashboard';
import { OnboardingPage } from './views/OnboardingPage';
import { ThankYouPage } from './views/ThankYouPage';
import { BusinessQuizData } from './components/BusinessQuiz';

import { ViewState, UserSession } from './types';
import { AccountPanel } from './components/AccountPanel';
import { captureHandoff, payApi } from './lib/pay';
import { safeAvatarUrl } from './lib/avatar';

// Sessao REAL do Supabase (codigo por e-mail). Sem sessao nao existe usuario: nada de conta mestre/fallback.
// isAdmin vem do servidor (payments-api confere o JWT contra ADMIN_EMAILS), nunca de um e-mail fixo no front.
const toSession = (u: { email?: string; user_metadata?: Record<string, any> }, isAdmin: boolean): UserSession => {
  const email = u.email || '';
  const name = String(u.user_metadata?.full_name || email.split('@')[0] || 'Cliente').trim() || 'Cliente';
  return { email, name, phone: u.user_metadata?.phone || undefined, avatar: safeAvatarUrl(u.user_metadata?.avatar_url) || undefined, isAdmin, trialStart: Date.now(), subscriptionStatus: 'ACTIVE' };
};

export default function App() {
  const [view, setView] = useState<ViewState>('LANDING');
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  // /app/?pay=<projeto>: link de intencao de compra vindo dos outros projetos
  const [payProduct, setPayProduct] = useState<string | undefined>();
  // /app/?ml=<token_hash>&tab=financeiro: link de acesso de uso unico gerado pelo admin; entra sem pedir codigo por e-mail
  const [startTab, setStartTab] = useState<'financeiro' | 'pagamentos' | undefined>();

  const applySession = async (sbUser: { email?: string; user_metadata?: Record<string, any> } | null) => {
    if (!sbUser) { setUser(null); setView(v => (v === 'DASHBOARD' || v === 'BILLING' ? 'LANDING' : v)); return; }
    setUser(toSession(sbUser, false));
    setView(v => (v === 'LANDING' || v === 'ONBOARDING' ? 'DASHBOARD' : v));
    payApi.me().then(m => setUser(toSession(sbUser, m.isAdmin))).catch(() => {});
  };

  const checkSession = async () => {
    try {
      const qs = new URLSearchParams(window.location.search);
      const ml = qs.get('ml');
      if (ml && /^[A-Za-z0-9_-]{20,128}$/.test(ml)) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: ml, type: 'magiclink' });
        if (error) console.error('Link de acesso invalido ou expirado:', error.message);
        else setStartTab(qs.get('tab') === 'pagamentos' ? 'pagamentos' : 'financeiro');
        qs.delete('ml'); qs.delete('tab');
        const rest = qs.toString();
        history.replaceState(null, '', window.location.pathname + (rest ? `?${rest}` : ''));
      }
      const { data: { session } } = await supabase.auth.getSession();
      await applySession(session?.user ?? null);
    } catch (err) {
      console.error('Falha ao ler a sessao:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkSession();
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') void applySession(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('start') === 'onboarding') {
      setView('ONBOARDING');
    }
    const pay = params.get('pay');
    if (pay && /^[a-z0-9-]{1,32}$/.test(pay)) {
      setPayProduct(pay);
      // link assinado do projeto (so billing); sem ele e sem sessao, pede login
      setView(captureHandoff() ? 'BILLING' : 'ONBOARDING');
    }
  }, []);

  const handleCompleteQuiz = (data: BusinessQuizData) => {
    supabase.from('quiz_leads').insert({
      business_name: data.businessName,
      segment: data.segment,
      goals: data.goals,
      contact_name: data.contactName,
      contact_email: data.contactEmail,
      contact_phone: data.contactPhone,
    }).then(({ error }) => {
      if (error) console.error('Falha ao salvar lead do quiz:', error.message);
    });
  };

  const handleLogout = () => { void supabase.auth.signOut(); };

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
            onCompleteQuiz={handleCompleteQuiz}
            onBack={() => setView('LANDING')}
          />
        )}
        {view === 'BILLING' && (
          <div className="min-h-screen bg-[#050505] text-white p-6 md:p-12">
            <div className="max-w-6xl mx-auto"><AccountPanel initialProduct={payProduct} /></div>
          </div>
        )}
        {view === 'DASHBOARD' && user && (
          // /app logado: dashboard estilo Netflix (produtos, financeiro, suporte, Visao CEO). O painel antigo
          // (atendimento, instancias, AR) continua em /app/?go=neural ou pelo card WayFlow Neural.
          new URLSearchParams(window.location.search).get('go') === 'neural' ? (
            <Dashboard
              user={user}
              onLogout={handleLogout}
              initialTab={payProduct ? 'pagamentos' : startTab}
              initialProduct={payProduct}
            />
          ) : (
            <div className="min-h-screen bg-[#0f0620] text-white p-4 md:p-8">
              <div className="max-w-7xl mx-auto"><AccountPanel initialProduct={payProduct} /></div>
            </div>
          )
        )}
      </AnimatePresence>
    </div>
  );
}
