
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Rocket, ArrowRight, ShieldCheck, Zap, Sparkles, Loader2, Cpu } from 'lucide-react';
import { NeonButton } from '../components/Buttons';
import { GlassCard } from '../components/GlassCard';
import { Logo } from '../components/Logo';

export function ThankYouPage({ onGoToDashboard }: { onGoToDashboard: () => void }) {
  const [status, setStatus] = useState<'syncing' | 'ready'>('syncing');
  const [progress, setProgress] = useState(0);

  // Simulação de Sincronização Neural para encantar o cliente
  useEffect(() => {
    const timer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(timer);
          setStatus('ready');
          return 100;
        }
        return prev + 2;
      });
    }, 50);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 md:p-6 overflow-hidden bg-[#050505]">
      {/* Background Neural Dinâmico */}
      <div className="absolute inset-0 z-0">
        <motion.img 
          initial={{ scale: 1.2, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.15 }}
          transition={{ duration: 2 }}
          src="https://qonrpzlkjhdmswjfxvtu.supabase.co/storage/v1/object/public/WayIAFlow/unnamed.jpg" 
          className="w-full h-full object-cover" 
          alt="Neural Background" 
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#050505] via-transparent to-[#050505]"></div>
        <div className="absolute inset-0 grid-engine opacity-20"></div>
        
        {/* Orbes de Luz para Profundidade */}
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-orange-500/10 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-blue-500/5 rounded-full blur-[120px] animate-pulse delay-700"></div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative z-10 max-w-xl w-full text-center space-y-8"
      >
        <div className="flex justify-center">
          <Logo size="md" className="drop-shadow-[0_0_15px_rgba(255,115,0,0.3)]" />
        </div>

        <div className="space-y-4">
          <div className="relative inline-block">
            <AnimatePresence mode="wait">
              {status === 'syncing' ? (
                <motion.div 
                  key="loader"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="w-20 h-20 border-2 border-orange-500/20 border-t-orange-500 rounded-full flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(255,115,0,0.1)]"
                >
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
                    <Cpu size={32} className="text-orange-500/50" />
                  </motion.div>
                </motion.div>
              ) : (
                <motion.div 
                  key="check"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200 }}
                  className="w-20 h-20 bg-orange-500/10 border border-orange-500/20 rounded-full flex items-center justify-center mx-auto shadow-[0_0_50px_rgba(255,115,0,0.2)]"
                >
                  <CheckCircle2 size={40} className="text-orange-500" />
                </motion.div>
              )}
            </AnimatePresence>
            
            {status === 'ready' && (
              <motion.div 
                animate={{ opacity: [0, 1, 0], scale: [1, 1.5, 2] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 border-2 border-orange-500/30 rounded-full"
              />
            )}
          </div>
          
          <div className="space-y-2">
            <h1 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter leading-none">
              {status === 'syncing' ? 'Sincronizando...' : <>Acesso <span className="text-orange-500">Liberado.</span></>}
            </h1>
            <p className="text-gray-400 text-[10px] md:text-xs font-black uppercase tracking-[0.4em] italic flex items-center justify-center gap-2">
              <Sparkles size={12} className="text-orange-500" />
              {status === 'syncing' ? `Handshake Neural: ${progress}%` : 'Sincronização Neural Completa'}
              <Sparkles size={12} className="text-orange-500" />
            </p>
          </div>
        </div>

        <GlassCard className="!p-8 md:!p-10 border-orange-500/20 bg-orange-500/[0.02] backdrop-blur-3xl shadow-2xl relative overflow-hidden">
          {/* Barra de Progresso de Ativação */}
          {status === 'syncing' && (
            <div className="absolute top-0 left-0 h-1 bg-orange-500 transition-all duration-300" style={{ width: `${progress}%` }} />
          )}

          <div className="grid grid-cols-3 gap-4 text-center mb-10">
            <div className="space-y-2">
              <Zap size={14} className="text-orange-500 mx-auto" />
              <div className="text-[8px] font-black uppercase tracking-widest text-white">Instantâneo</div>
            </div>
            <div className="space-y-2 border-x border-white/5">
              <ShieldCheck size={14} className="text-orange-500 mx-auto" />
              <div className="text-[8px] font-black uppercase tracking-widest text-white">Seguro</div>
            </div>
            <div className="space-y-2">
              <Rocket size={14} className="text-orange-500 mx-auto" />
              <div className="text-[8px] font-black uppercase tracking-widest text-white">Enterprise</div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white/[0.03] border border-white/5 p-4 rounded-xl text-left space-y-1">
              <div className="text-[7px] font-black text-gray-500 uppercase tracking-widest">Status do Sistema</div>
              <div className={`text-[9px] font-bold uppercase flex items-center gap-2 ${status === 'ready' ? 'text-green-500' : 'text-orange-500/50'}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${status === 'ready' ? 'bg-green-500 animate-pulse' : 'bg-orange-500/50'}`} />
                {status === 'ready' ? 'Clusters n8n & Evolution Operacionais' : 'Aguardando Aprovação do Gateway...'}
              </div>
            </div>

            <NeonButton 
              disabled={status === 'syncing'}
              onClick={onGoToDashboard} 
              className={`w-full !py-6 !text-[11px] flex items-center justify-center gap-3 group relative overflow-hidden ${status === 'syncing' ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
            >
              {status === 'syncing' ? 'Autenticando Licença...' : 'Começar a Escalar Agora'} 
              {status === 'ready' && <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />}
            </NeonButton>
            
            <p className="text-[8px] font-black uppercase tracking-widest text-gray-600 italic">
              Identificador na Fatura: <span className="text-white">WAYFLOW*NEURAL</span>
            </p>
          </div>
        </GlassCard>

        {/* Parceiros de Tecnologia */}
        <div className="pt-4 flex flex-wrap justify-center gap-8 md:gap-12 opacity-20 grayscale">
            <img src="https://qonrpzlkjhdmswjfxvtu.supabase.co/storage/v1/object/public/WayIAFlow/images.png" className="h-3 md:h-4 object-contain" alt="OpenAI" />
            <img src="https://qonrpzlkjhdmswjfxvtu.supabase.co/storage/v1/object/public/WayIAFlow/n8n-removebg-preview.png" className="h-3 md:h-4 object-contain" alt="n8n" />
            <img src="https://qonrpzlkjhdmswjfxvtu.supabase.co/storage/v1/object/public/WayIAFlow/meta_ai-logo_brandlogos.net_xjwry-512x504.png" className="h-3 md:h-4 object-contain" alt="Meta" />
        </div>
      </motion.div>
    </div>
  );
}
