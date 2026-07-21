
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, User, Mail, Smartphone, LogIn, Sparkles } from 'lucide-react';
import { GlassButton } from '../components/Buttons';
import { BusinessQuiz, BusinessQuizData } from '../components/BusinessQuiz';

export function OnboardingPage({ onRegisterTrial, onLogin, onCompleteQuiz, onBack }: {
  onRegisterTrial: (name: string, email: string, phone: string) => void;
  onLogin: (email: string) => void;
  onCompleteQuiz: (data: BusinessQuizData) => void;
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

      {/* LADO ESQUERDO: FORMULARIO INTERATIVO SOBRE O NEGOCIO */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 lg:p-16 relative overflow-hidden border-r border-white/5 bg-gradient-to-br from-orange-500/[0.02] to-transparent">
        <BusinessQuiz onComplete={onCompleteQuiz} />
      </div>

      {/* LADO DIREITO: ACESSO GRATUITO OU LOGIN */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 lg:p-16 bg-black relative">
        <div className="max-w-md w-full space-y-8 z-10">
          <div className="text-center lg:text-left space-y-4">
             <div className="flex items-center gap-2 text-blue-500 mb-2">
                <Sparkles size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest">
                  {isLoginMode ? 'Acesso ao Painel' : 'Acesso Gratuito'}
                </span>
             </div>
             <h2 className="text-4xl font-black uppercase italic tracking-tighter leading-none">
               {isLoginMode ? <>Entrar na <span className="text-blue-500">Engine.</span></> : <>Acesse <span className="text-blue-500">Gratuitamente.</span></>}
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
              {isLoginMode ? <><LogIn size={14} /> Acessar Dashboard</> : <><Sparkles size={14} className="text-blue-500" /> Acessar Gratuitamente</>}
            </GlassButton>
          </form>

          <div className="text-center">
            <button
              onClick={() => setIsLoginMode(!isLoginMode)}
              className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-600 hover:text-blue-500 transition-colors"
            >
              {isLoginMode ? 'Novo por aqui? Criar conta grátis' : 'Já possui acesso? Fazer Login'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
