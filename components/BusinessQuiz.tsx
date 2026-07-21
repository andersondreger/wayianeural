
import React, { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, Camera, PawPrint, Building2, Sparkles,
  ShoppingBag, Layers, ImagePlus, X, TrendingUp, MessageCircle,
  Scan, HeartHandshake, CheckCircle2, ShieldCheck, Rocket, User, Mail, Smartphone
} from 'lucide-react';

export interface BusinessQuizData {
  businessName: string;
  segment: string;
  photoUrl: string | null;
  goals: string[];
  contactName: string;
  contactEmail: string;
  contactPhone: string;
}

const SEGMENTS = [
  { id: 'Petshop', label: 'Petshop', icon: PawPrint },
  { id: 'Imobiliária', label: 'Imobiliária', icon: Building2 },
  { id: 'Beleza', label: 'Salão de Beleza', icon: Sparkles },
  { id: 'Varejo', label: 'Loja / Varejo', icon: ShoppingBag },
  { id: 'Outro', label: 'Outro Negócio', icon: Layers },
];

const GOALS = [
  { id: 'Vender mais', label: 'Vender mais todo mês', icon: TrendingUp },
  { id: 'Automatizar WhatsApp', label: 'Automatizar o WhatsApp', icon: MessageCircle },
  { id: 'Realidade Aumentada', label: 'Criar experiência em RA', icon: Scan },
  { id: 'Fidelizar clientes', label: 'Fidelizar clientes', icon: HeartHandshake },
];

const STEP_LABELS = ['Seu Negócio', 'Sua Foto', 'Seu Objetivo', 'Prévia Neural'];

export function BusinessQuiz({ onComplete }: { onComplete: (data: BusinessQuizData) => void }) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [businessName, setBusinessName] = useState('');
  const [segment, setSegment] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [goals, setGoals] = useState<string[]>([]);
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const lastStep = STEP_LABELS.length - 1;

  const goNext = () => {
    if (step >= lastStep) {
      onComplete({ businessName, segment, photoUrl, goals, contactName, contactEmail, contactPhone });
      return;
    }
    setDirection(1);
    setStep(s => Math.min(s + 1, lastStep));
  };

  const goBack = () => {
    setDirection(-1);
    setStep(s => Math.max(s - 1, 0));
  };

  const toggleGoal = (id: string) => {
    setGoals(g => g.includes(id) ? g.filter(x => x !== id) : [...g, id]);
  };

  const handleFile = (file?: File) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPhotoUrl(url);
  };

  const canAdvance = step === 0 ? (businessName.trim().length > 0 && segment.length > 0)
    : step === 2 ? goals.length > 0
    : step === 3 ? (contactName.trim().length > 0 && contactEmail.trim().length > 0 && contactPhone.trim().length > 0)
    : true;

  const variants = {
    enter: (dir: number) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -60 : 60, opacity: 0 }),
  };

  return (
    <div className="max-w-md w-full space-y-8 z-10">
      <div className="space-y-4">
        <span className="px-4 py-1.5 glass rounded-full text-orange-500 text-[9px] font-black uppercase tracking-[0.3em] border border-orange-500/20 italic">
          Formulário Interativo · Powered by WayAR
        </span>
        <h2 className="text-4xl font-black uppercase italic tracking-tighter leading-none">
          Conte sobre <br /><span className="text-orange-500">seu Negócio.</span>
        </h2>
        <p className="text-gray-500 text-[11px] font-bold uppercase tracking-widest leading-relaxed italic">
          Responda em segundos e já vemos como fica a experiência em Realidade Aumentada.
        </p>
      </div>

      <div className="flex items-center gap-2">
        {STEP_LABELS.map((label, i) => (
          <div key={label} className="flex-1 space-y-2">
            <div className={`h-1.5 rounded-full transition-all duration-500 ${i <= step ? 'bg-orange-500' : 'bg-white/10'}`} />
            <span className={`text-[7px] font-black uppercase tracking-widest ${i <= step ? 'text-orange-500' : 'text-gray-700'}`}>{label}</span>
          </div>
        ))}
      </div>

      <div className="relative min-h-[320px]">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-5"
          >
            {step === 0 && (
              <div className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-[8px] font-black uppercase text-gray-700 tracking-widest ml-1">Nome do Negócio</label>
                  <input
                    autoFocus
                    placeholder="Ex: Pet Amigo, Studio Bela..."
                    value={businessName}
                    onChange={e => setBusinessName(e.target.value)}
                    className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-4 px-5 outline-none focus:border-orange-500/40 font-bold transition-all text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[8px] font-black uppercase text-gray-700 tracking-widest ml-1">Qual o seu Segmento?</label>
                  <div className="grid grid-cols-2 gap-3">
                    {SEGMENTS.map(s => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSegment(s.id)}
                        className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border text-left transition-all ${segment === s.id ? 'bg-orange-500/10 border-orange-500/40 text-orange-500' : 'bg-white/[0.02] border-white/10 text-gray-400 hover:border-white/20'}`}
                      >
                        <s.icon size={16} />
                        <span className="text-[9px] font-black uppercase tracking-widest">{s.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <label className="text-[8px] font-black uppercase text-gray-700 tracking-widest ml-1 block">Uma Foto do seu Negócio</label>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => handleFile(e.target.files?.[0])} />
                {photoUrl ? (
                  <div className="relative rounded-2xl overflow-hidden border border-orange-500/30 aspect-video group">
                    <img src={photoUrl} alt="Foto do negócio" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setPhotoUrl(null)}
                      className="absolute top-3 right-3 p-2 rounded-full bg-black/70 text-white hover:bg-red-500/80 transition-all"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full aspect-video rounded-2xl border-2 border-dashed border-white/10 hover:border-orange-500/40 flex flex-col items-center justify-center gap-3 text-gray-600 hover:text-orange-500 transition-all"
                  >
                    <ImagePlus size={28} />
                    <span className="text-[9px] font-black uppercase tracking-widest">Enviar Foto (Logo, Loja, Produto)</span>
                  </button>
                )}
                <p className="text-[8px] font-bold text-gray-700 uppercase tracking-widest italic">Opcional — usamos essa imagem para simular sua experiência em RA.</p>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-3">
                <label className="text-[8px] font-black uppercase text-gray-700 tracking-widest ml-1 block">Qual seu Objetivo Principal?</label>
                {GOALS.map(g => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => toggleGoal(g.id)}
                    className={`w-full flex items-center gap-4 px-5 py-4 rounded-xl border text-left transition-all ${goals.includes(g.id) ? 'bg-orange-500/10 border-orange-500/40 text-orange-500' : 'bg-white/[0.02] border-white/10 text-gray-400 hover:border-white/20'}`}
                  >
                    <g.icon size={16} className="shrink-0" />
                    <span className="text-[10px] font-black uppercase tracking-widest flex-1">{g.label}</span>
                    {goals.includes(g.id) && <CheckCircle2 size={16} />}
                  </button>
                ))}
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5">
                <div className="relative rounded-2xl overflow-hidden border border-orange-500/40 aspect-video bg-black/40 shadow-[0_0_50px_rgba(255,115,0,0.15)]">
                  {photoUrl ? (
                    <img src={photoUrl} alt="Prévia" className="w-full h-full object-cover opacity-90" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-700">
                      <Camera size={36} />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  <div className="absolute top-0 left-0 w-full h-1 bg-orange-500/80 animate-scan z-10" />
                  <div className="absolute bottom-3 left-3 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/70 border border-orange-500/30">
                    <Scan size={11} className="text-orange-500" />
                    <span className="text-[7px] font-black uppercase tracking-widest text-orange-500">Prévia gerada via WayAR</span>
                  </div>
                </div>
                <div className="glass rounded-2xl p-5 space-y-2 border-white/5">
                  <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Resumo</p>
                  <p className="text-sm font-black uppercase italic">{businessName || 'Sua Empresa'} · <span className="text-orange-500">{segment || 'Segmento'}</span></p>
                  <div className="flex flex-wrap gap-2 pt-2">
                    {goals.length > 0 ? goals.map(g => (
                      <span key={g} className="px-3 py-1 rounded-full bg-orange-500/10 text-orange-500 text-[8px] font-black uppercase tracking-widest border border-orange-500/20">{g}</span>
                    )) : (
                      <span className="text-[8px] font-bold text-gray-700 uppercase tracking-widest italic">Nenhum objetivo selecionado</span>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[8px] font-black uppercase text-gray-700 tracking-widest ml-1 block">Para onde enviamos sua Prévia?</label>
                  <div className="relative">
                    <User size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" />
                    <input
                      required
                      placeholder="Seu nome"
                      value={contactName}
                      onChange={e => setContactName(e.target.value)}
                      className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-3.5 pl-11 pr-5 outline-none focus:border-orange-500/40 font-bold transition-all text-sm"
                    />
                  </div>
                  <div className="relative">
                    <Mail size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" />
                    <input
                      required
                      type="email"
                      placeholder="Seu e-mail"
                      value={contactEmail}
                      onChange={e => setContactEmail(e.target.value)}
                      className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-3.5 pl-11 pr-5 outline-none focus:border-orange-500/40 font-bold transition-all text-sm"
                    />
                  </div>
                  <div className="relative">
                    <Smartphone size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" />
                    <input
                      required
                      type="tel"
                      placeholder="Seu WhatsApp (com DDD)"
                      value={contactPhone}
                      onChange={e => setContactPhone(e.target.value)}
                      className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-3.5 pl-11 pr-5 outline-none focus:border-orange-500/40 font-bold transition-all text-sm"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 opacity-60">
                  <ShieldCheck size={14} className="text-orange-500" />
                  <span className="text-[8px] font-bold uppercase tracking-widest text-gray-500">Seus dados ficam só com você, nunca compartilhamos.</span>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex items-center gap-4">
        {step > 0 && (
          <button
            type="button"
            onClick={goBack}
            className="p-4 rounded-xl glass border border-white/10 text-gray-400 hover:text-white hover:border-white/20 transition-all"
          >
            <ArrowLeft size={16} />
          </button>
        )}
        <button
          type="button"
          onClick={goNext}
          disabled={!canAdvance}
          className="flex-1 py-4 rounded-xl bg-orange-500 disabled:bg-white/5 disabled:text-gray-700 disabled:cursor-not-allowed text-white font-black uppercase text-[11px] tracking-widest italic hover:bg-orange-600 transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20"
        >
          {step >= lastStep ? <><Rocket size={14} /> Concluir e Acessar Dashboard</> : <>Continuar <ArrowRight size={14} /></>}
        </button>
      </div>
    </div>
  );
}
