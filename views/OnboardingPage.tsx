
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, ShieldCheck, Zap, ArrowLeft, Clock, CreditCard, Sparkles, User, Mail, Smartphone, LogIn } from 'lucide-react';
import { NeonButton, GlassButton } from '../components/Buttons';
import { GlassCard } from '../components/GlassCard';
import { Logo } from '../components/Logo';

export function OnboardingPage({ onRegisterTrial, onLogin, onCheckout, onBack }: { 
  onRegisterTrial: (name: string, email: string, phone: string) => void;
  onLogin: (email: string) => void;
  onCheckout: () => void;
  onBack: () => void;
}) {
  const [isLoginMode, setIsLoginMode] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoginMode) {
      onLogin(formData.email);
    } else {
      onRegisterTrial(formData.name, formData.email, formData.phone);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-[#050505] text-white">
      <div className="fixed inset-0 grid-engine pointer-events-none opacity-5"></div>
      
      <button 
        onClick={onBack}
        className="absolute top-6 left-6 z-[110] flex items-center gap-2 text-gray-500 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest"
      >
        <ArrowLeft size={14} /> Voltar ao Portal
      </button>

      {/* LADO ESQUERDO: CHECKOUT STRIPE (89,00) */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 lg:p-16 relative overflow-hidden border-r border-white/5 bg-gradient-to-br from-orange-500/[0.02] to-transparent">
        <div className="max-w-md w-full space-y-8 z-10">
          <div className="space-y-4">
            <span className="px-4 py-1.5 glass rounded-full text-orange-500 text-[9px] font-black uppercase tracking-[0.3em] border border-orange-500/20 italic">
              Acesso Enterprise Ilimitado
            </span>
            <h2 className="text-5xl font-black uppercase italic tracking-tighter leading-none">Licença <br/><span className="text-orange-500">Neural Full.</span></h2>
            <p className="text-gray-500 text-[11px] font-bold uppercase tracking-widest leading-relaxed italic">Liberação de clusters de automação em escala industrial.</p>
          </div>

          <GlassCard className="!p-8 space-y-6 border-orange-500/10 bg-orange-500/[0.01]">
            <div className="flex justify-between items-end">
              <div>
                <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Assinatura Mensal</div>
                <div className="text-5xl font-black italic tracking-tighter">R$ 89,<span className="text-2xl">00</span></div>
              </div>
              <div className="text-right">
                <ShieldCheck className="text-orange-500 ml-auto mb-2" size={24} />
                <div className="text-[8px] font-black text-orange-500 uppercase tracking-widest italic">Stripe Secure</div>
              </div>
            </div>

            <div className="h-px bg-white/5 w-full"></div>

            <ul className="space-y-4">
              {[
                'Instâncias Ilimitadas (Evolution)',
                'Treinamento Neural de Agentes IA',
                'Kanban CRM com Análise de Sentimento',
                'Integração Nativa n8n & Webhooks',
                'Suporte Prioritário 24/7'
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-tight text-gray-400">
                  <CheckCircle2 size={12} className="text-orange-500 shrink-0" /> {item}
                </li>
              ))}
            </ul>

            <NeonButton onClick={onCheckout} className="w-full !py-5 mt-4 text-[12px]">
              <CreditCard size={14} className="mr-2" /> Ativar Licença Agora
            </NeonButton>
          </GlassCard>
        </div>
      </div>

      {/* LADO DIREITO: TRIAL OU LOGIN */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 lg:p-16 bg-black relative">
        <div className="max-w-md w-full space-y-8 z-10">
          <div className="text-center lg:text-left space-y-4">
             <div className="flex items-center gap-2 text-blue-500 mb-2">
                <Clock size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest">
                  {isLoginMode ? 'Acesso ao Painel' : 'Período de Experiência'}
                </span>
             </div>
             <h2 className="text-4xl font-black uppercase italic tracking-tighter leading-none">
               {isLoginMode ? <>Entrar na <span className="text-blue-500">Engine.</span></> : <>Teste <span className="text-blue-500">Grátis</span> por <br/> 15 Dias.</>}
             </h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <AnimatePresence mode="wait">
              {!isLoginMode && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-4 overflow-hidden">
                  <div className="space-y-1.5">
                    <label className="text-[8px] font-black uppercase text-gray-700 tracking-widest ml-1 flex items-center gap-2">
                      <User size={10} /> Nome da Operação
                    </label>
                    <input 
                      required
                      placeholder="Ex: Minha Empresa IA"
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-4 px-5 outline-none focus:border-blue-500/40 font-bold transition-all text-sm" 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[8px] font-black uppercase text-gray-700 tracking-widest ml-1 flex items-center gap-2">
                      <Smartphone size={10} /> WhatsApp (Com DDD)
                    </label>
                    <input 
                      required
                      type="tel"
                      placeholder="(11) 99999-9999"
                      value={formData.phone}
                      onChange={e => setFormData({...formData, phone: e.target.value})}
                      className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-4 px-5 outline-none focus:border-blue-500/40 font-bold transition-all text-sm" 
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-1.5">
              <label className="text-[8px] font-black uppercase text-gray-700 tracking-widest ml-1 flex items-center gap-2">
                <Mail size={10} /> E-mail Corporativo
              </label>
              <input 
                required
                type="email"
                placeholder="nome@empresa.com"
                value={formData.email}
                onChange={e => setFormData({...formData, email: e.target.value})}
                className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-4 px-5 outline-none focus:border-blue-500/40 font-bold transition-all text-sm" 
              />
            </div>

            <GlassButton type="submit" className="w-full !py-5 mt-4 !text-[12px] !border-blue-500/20 hover:!bg-blue-600/10 flex items-center justify-center gap-2">
              {isLoginMode ? <><LogIn size={14} /> Acessar Dashboard</> : <><Sparkles size={14} className="text-blue-500" /> Iniciar 15 Dias de Trial</>}
            </GlassButton>
          </form>

          <div className="text-center">
            <button 
              onClick={() => setIsLoginMode(!isLoginMode)}
              className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-600 hover:text-blue-500 transition-colors"
            >
              {isLoginMode ? 'Novo por aqui? Criar conta trial' : 'Já possui acesso? Fazer Login'}
            </button>
          </div>

          {!isLoginMode && (
            <div className="p-6 glass rounded-2xl border-white/5 flex gap-4 items-start">
               <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500"><Zap size={18}/></div>
               <div>
                  <div className="text-[9px] font-black uppercase text-white mb-1 tracking-widest italic">Políticas de Handshake</div>
                  <p className="text-[8px] text-gray-600 font-bold uppercase tracking-wider leading-relaxed">
                    Após o período de 15 dias, os clusters serão suspensos. Ative a licença Enterprise para manter a sincronização vitalícia.
                  </p>
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
