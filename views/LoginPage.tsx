
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, ArrowLeft, Phone, User, Mail } from 'lucide-react';
import { NeonButton, GlassButton } from '../components/Buttons';
import { Logo } from '../components/Logo';

export function LoginPage({ onLogin, onBack }: { onLogin: (e: string, name?: string, phone?: string) => void; onBack: () => void }) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(email, name, phone);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex h-screen bg-[#050505]">
      <div className="hidden lg:flex w-[45%] bg-white/[0.01] border-r border-white/5 p-16 flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 grid-engine opacity-10"></div>
        <div onClick={onBack} className="flex items-center gap-3 cursor-pointer group z-10 opacity-60 hover:opacity-100 transition-all">
          <ArrowLeft size={16} />
          <span className="font-bold uppercase tracking-widest text-[9px]">Portal WayFlow</span>
        </div>
        <div className="z-10">
          <Logo size="lg" className="mb-10" />
          <h2 className="text-5xl font-black uppercase tracking-tighter leading-none italic">Infraestrutura <br/> <span className="text-orange-500">Imparável.</span></h2>
          <p className="text-gray-600 mt-6 uppercase text-[9px] font-bold tracking-[0.3em] max-w-xs leading-relaxed">Cluster Neural para alta escala em atendimento e automação multi-agente.</p>
        </div>
        <div className="flex items-center gap-3 opacity-30 z-10">
          <ShieldCheck size={16} className="text-orange-500" />
          <span className="text-[8px] font-bold uppercase tracking-widest">TLS 1.3 Certified Handshake</span>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 bg-black">
        <div className="w-full max-w-sm space-y-8">
          <div className="text-center lg:text-left">
            <h1 className="text-3xl font-black uppercase italic tracking-tighter">
              {isRegister ? 'Criar Acesso' : 'Entrar na Engine'}
            </h1>
            <p className="text-gray-700 text-[9px] font-bold uppercase tracking-[0.3em] mt-2">
              Sincronização com cluster neural principal
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <AnimatePresence mode="wait">
              {isRegister && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[8px] font-black uppercase text-gray-700 tracking-widest ml-1 flex items-center gap-2"><User size={10}/> Nome Completo</label>
                    <input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-3 px-5 outline-none focus:border-orange-500/40 font-bold transition-all text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[8px] font-black uppercase text-gray-700 tracking-widest ml-1 flex items-center gap-2"><Phone size={10}/> WhatsApp (Com DDD)</label>
                    <input type="tel" required value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-3 px-5 outline-none focus:border-orange-500/40 font-bold transition-all text-sm" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-1.5">
              <label className="text-[8px] font-black uppercase text-gray-700 tracking-widest ml-1 flex items-center gap-2"><Mail size={10}/> E-mail Corporativo</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-3 px-5 outline-none focus:border-orange-500/40 font-bold transition-all text-sm" />
            </div>

            <NeonButton type="submit" className="w-full !py-4 mt-4">
              {isRegister ? 'Finalizar Cadastro Gratuito' : 'Acessar Workspace'}
            </NeonButton>
          </form>

          <div className="text-center">
            <button 
              onClick={() => setIsRegister(!isRegister)}
              className="text-[9px] font-bold uppercase tracking-widest text-gray-600 hover:text-orange-500 transition-colors"
            >
              {isRegister ? 'Já possui conta? Fazer Login' : 'Novo por aqui? Criar conta gratuita'}
            </button>
          </div>

          <div className="relative flex items-center py-2">
            <div className="flex-grow border-t border-white/5"></div>
            <span className="px-4 text-[8px] font-bold text-gray-800 uppercase tracking-widest">Handshake Social</span>
            <div className="flex-grow border-t border-white/5"></div>
          </div>

          <GlassButton onClick={() => onLogin('google@auth.com', 'Google User')} className="w-full !py-4 flex items-center justify-center gap-3 hover:bg-white/[0.05]">
            <img src="https://www.google.com/favicon.ico" className="w-4 h-4 grayscale" alt="Google" />
            Continuar com Google
          </GlassButton>
        </div>
      </div>
    </motion.div>
  );
}
