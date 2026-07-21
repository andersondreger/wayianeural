
import React, { useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { 
  ShieldCheck, BrainCircuit, Workflow, Terminal, Zap,
  Mail, MapPin, Instagram, Twitter, Linkedin, MessageCircle
} from 'lucide-react';
import { NeonButton, GlassButton } from '../components/Buttons';
import { GlassCard } from '../components/GlassCard';
import { Logo } from '../components/Logo';
import { SolutionsCarousel } from '../components/SolutionsCarousel';
import { products } from '../data/products';

// Trilhas do circuito de fundo do hero (mesmas coordenadas do SVG estático em .hero-bg-image)
const CIRCUIT_PATHS: [number, number][][] = [
  [[0, 180], [220, 180], [260, 140], [460, 140], [500, 180], [800, 180]],
  [[1600, 120], [1360, 120], [1320, 160], [1080, 160], [1040, 120], [760, 120]],
  [[0, 760], [200, 760], [240, 800], [520, 800]],
  [[1600, 820], [1420, 820], [1380, 780], [1120, 780]],
  [[0, 420], [140, 420], [170, 460], [340, 460]],
  [[1600, 480], [1480, 480], [1450, 440], [1260, 440]],
];

const CIRCUIT_NODES: [number, number][] = [
  [260, 140], [500, 180], [1320, 160], [1040, 120],
  [240, 800], [1380, 780], [170, 460], [1450, 440],
];

const toPoints = (pts: [number, number][]) => pts.map(p => p.join(',')).join(' ');
const toPathD = (pts: [number, number][]) => pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ');

export function LandingPage({ onStart }: { onStart: () => void }) {
  const [isIntegrationActive, setIsIntegrationActive] = useState(true);
  const prefersReducedMotion = useReducedMotion();

  const integrations = [
    { name: 'Anthropic', url: '/images/integrations/anthropic.png' },
    { name: 'Meta', url: '/images/integrations/meta.png' },
    { name: 'OpenAI', url: '/images/integrations/openai.png' },
    { name: 'n8n', url: '/images/integrations/n8n.png' },
    { name: 'Make', url: '/images/integrations/make.png' },
  ];

  return (
    <div className="relative min-h-screen bg-[#050505] text-white selection:bg-orange-500/30">
      <div className="fixed inset-0 grid-engine pointer-events-none opacity-10"></div>
      
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-[100] border-b border-white/5 backdrop-blur-xl bg-black/40">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Logo size="sm" />
          <div className="hidden md:flex items-center gap-10 text-[10px] font-black uppercase tracking-[0.4em] text-gray-500">
            <button className="hover:text-orange-500 transition-colors">Ecossistema</button>
            <button className="hover:text-orange-500 transition-colors">Infraestrutura</button>
            <button className="hover:text-orange-500 transition-colors">Otimização</button>
          </div>
          <NeonButton onClick={onStart} className="!px-6 !py-2.5 !text-[10px]">Acessar</NeonButton>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="relative z-10 pt-44 pb-20 px-6 text-center overflow-hidden">
        {/* Fundo futurista do Hero */}
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div className="absolute inset-0 hero-bg-image"></div>
          <div className="absolute inset-0 hero-aurora"></div>
          <div className="absolute inset-0 grid-engine opacity-[0.07]"></div>
          <div className="absolute inset-0 hero-scanlines opacity-30"></div>
          <div className="hero-orb absolute top-10 left-1/4 w-72 h-72 bg-orange-600/20"></div>
          <div className="hero-orb absolute top-32 right-1/4 w-80 h-80 bg-amber-500/15" style={{ animationDelay: '3s' }}></div>
          <svg
            className="circuit-overlay absolute inset-0 w-full h-full opacity-80"
            viewBox="0 0 1600 1000"
            preserveAspectRatio="xMidYMin slice"
          >
            {CIRCUIT_PATHS.map((pts, i) => (
              <g key={i}>
                <polyline className="circuit-trace-halo" points={toPoints(pts)} style={{ animationDelay: `${i * 0.4}s` }} />
                <polyline className="circuit-trace" points={toPoints(pts)} style={{ animationDelay: `${i * 0.3}s` }} />
                {!prefersReducedMotion && (
                  <circle className="circuit-spark-point" r="4">
                    <animateMotion dur={`${2.6 + i * 0.35}s`} repeatCount="indefinite" path={toPathD(pts)} />
                  </circle>
                )}
              </g>
            ))}
            {CIRCUIT_NODES.map(([cx, cy], i) => (
              <circle key={i} className="circuit-node" cx={cx} cy={cy} r="5" style={{ animationDelay: `${i * 0.3}s` }} />
            ))}
          </svg>
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-[#050505]"></div>
        </div>

        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center text-center md:text-left">
            <div>
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <span className="px-6 py-2.5 rounded-full glass border border-orange-500/20 shadow-[0_0_20px_rgba(255,115,0,0.1)]">
                   <span className="text-orange-500 text-[10px] font-black uppercase tracking-[0.5em] italic">
                     Engine v3.14 - Operando em Alta Frequência
                   </span>
                </span>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="mt-16 text-4xl md:text-6xl font-black uppercase leading-[1.0] tracking-tighter"
              >
                Potencialize sua <br />
                <span className="text-orange-500 neon-glow italic">Operação de Escala.</span>
              </motion.h1>
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className="flex justify-center md:justify-end md:translate-x-6 lg:translate-x-12"
            >
              <img
                src="/images/hero-ar-avatar.png"
                alt="Aponte a câmera do seu celular para ver a Realidade Aumentada"
                className="w-full max-w-[160px] sm:max-w-[192px] md:max-w-[224px] h-auto object-contain drop-shadow-[0_0_40px_rgba(255,115,0,0.25)]"
              />
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="mt-14 flex flex-col items-center gap-5"
          >
            <span className="px-8 py-3 rounded-full glass border border-orange-500/20 shadow-[0_0_20px_rgba(255,115,0,0.1)] text-center">
              <span className="block text-gray-300 text-[11px] md:text-xs font-bold uppercase tracking-[0.3em]">
                Aponte a câmera do seu celular
              </span>
              <span className="block text-orange-500 text-lg md:text-2xl font-black uppercase italic neon-glow tracking-wide">
                Para ver a RA
              </span>
            </span>
            <img
              src="/images/hero-ar-qrcode.png"
              alt="QR code para abrir a experiência de Realidade Aumentada da WayAR"
              className="w-48 h-48 md:w-56 md:h-56 object-contain rounded-3xl drop-shadow-[0_0_30px_rgba(255,115,0,0.3)]"
            />
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-10 text-gray-500 text-sm md:text-lg max-w-3xl mx-auto leading-relaxed font-bold uppercase tracking-[0.2em] opacity-80 text-center"
          >
            Solução unificada de alta performance: integrando automações de escala industrial e inteligência neural ao dia a dia do seu negócio
          </motion.p>

          <div className="mt-16 flex flex-col sm:flex-row gap-6 justify-center items-center">
              <NeonButton onClick={onStart} className="!px-14 !py-6 !text-[12px] shadow-2xl shadow-orange-600/30">Acesse Gratuitamente</NeonButton>
              <GlassButton className="!px-12 !py-6 !text-[12px]">Explorar Ecossistema</GlassButton>
          </div>
        </div>

        {/* Marquee de Integrações */}
        <section className="mt-24 w-full flex flex-col items-center px-4">
          <div className="text-[10px] font-black uppercase tracking-[0.6em] text-orange-500 mb-8 italic opacity-60">
            Sincronização neural ativa
          </div>
          
          <div className="w-full max-w-6xl">
            <GlassCard className="!p-0 w-full overflow-hidden border-2 border-white/5 bg-black/40">
              <div className="animate-marquee py-12 flex items-center gap-32">
                {[...integrations, ...integrations, ...integrations].map((logo, i) => (
                  <div key={i} className="flex flex-col items-center gap-5 opacity-80 hover:opacity-100 hover:scale-110 transition-all duration-500 cursor-help">
                    <img src={logo.url} alt={logo.name} className="h-10 md:h-12 w-auto object-contain" />
                    <span className="text-[8px] font-black uppercase tracking-[0.3em] text-white">{logo.name}</span>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>
        </section>
      </header>

      {/* Seção de Produtos */}
      <section className="relative z-10 py-32 bg-[#020202]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-20 space-y-4">
             <span className="text-orange-500 font-black text-[12px] uppercase tracking-[0.5em] italic">Soluções Verticais</span>
             <h2 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter">Modelos de <span className="text-orange-500">Alta Conversão.</span></h2>
          </div>

          <SolutionsCarousel products={products} onAction={onStart} />
        </div>
      </section>

      {/* Ecossistema Neural */}
      <section className="relative z-10 py-32 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6">
            <div className="grid lg:grid-cols-2 gap-24 items-center">
                <div className="grid grid-cols-2 gap-8">
                    {[
                      { icon: Terminal, label: 'Handshake Instantâneo', color: 'text-orange-500' },
                      { icon: BrainCircuit, label: 'Cérebro Digital', color: 'text-blue-500' },
                      { icon: Workflow, label: 'Integração Total', color: 'text-green-500' },
                      { icon: Zap, label: 'Escala Humana', color: 'text-yellow-500' }
                    ].map((item, i) => (
                      <GlassCard key={i} className="!p-10 border-white/5 hover:bg-white/[0.02]">
                        <item.icon className={`${item.color} mb-5`} size={32} />
                        <div className="text-[11px] font-black uppercase tracking-widest leading-tight">{item.label}</div>
                      </GlassCard>
                    ))}
                </div>
                <div className="space-y-8">
                    <h2 className="text-5xl md:text-7xl font-black uppercase italic tracking-tighter leading-[0.9]">Inteligência <br/><span className="text-orange-500">Centralizada.</span></h2>
                    <p className="text-gray-500 text-lg md:text-xl font-bold uppercase tracking-tight leading-relaxed">
                        Esquecça os bots tradicionais. Entregamos um sistema nervoso digital orquestrado para escala industrial.
                    </p>
                    <div className="flex gap-6">
                        <NeonButton onClick={onStart} className="!px-10 !py-5">Teste Grátis</NeonButton>
                    </div>
                </div>
            </div>
        </div>
      </section>

      {/* Footer Completo */}
      <footer className="relative z-10 border-t border-white/5 bg-black pt-32 pb-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-20 mb-24">
            <div className="space-y-10">
              <Logo size="sm" />
              <p className="text-gray-600 text-[11px] font-bold uppercase tracking-widest leading-relaxed">Infraestrutura tecnológica para empresas que não aceitam limites de escala.</p>
              <div className="flex gap-4">
                {[Instagram, Twitter, Linkedin].map((Icon, i) => (
                  <a key={i} href="#" className="w-10 h-10 rounded-xl glass flex items-center justify-center text-gray-500 hover:text-orange-500 transition-all"><Icon size={16} /></a>
                ))}
              </div>
            </div>

            <div className="space-y-8">
              <h4 className="text-[11px] font-black uppercase tracking-[0.4em] text-orange-500 italic">Clusters</h4>
              <ul className="space-y-5 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                <li><a href="#" className="hover:text-white transition-colors">PetFlow Master</a></li>
                <li><a href="#" className="hover:text-white transition-colors">ImobiVision 360</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Neural CRM</a></li>
              </ul>
            </div>

            <div className="space-y-8">
              <h4 className="text-[11px] font-black uppercase tracking-[0.4em] text-orange-500 italic">Legal</h4>
              <ul className="space-y-5 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                <li><a href="#" className="hover:text-white transition-colors">Termos de Uso</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Privacidade</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Segurança TLS</a></li>
              </ul>
            </div>

            <div className="space-y-8">
              <h4 className="text-[11px] font-black uppercase tracking-[0.4em] text-orange-500 italic">Direto</h4>
              <ul className="space-y-6">
                <li className="flex items-center gap-4">
                  <div className="p-3 glass rounded-xl text-orange-500"><Mail size={16}/></div>
                  <div className="text-[9px] font-black uppercase tracking-widest text-gray-400">contato@wayia.com.br</div>
                </li>
                <li className="flex items-center gap-4">
                  <div className="p-3 glass rounded-xl text-green-500"><MessageCircle size={16}/></div>
                  <div className="text-[9px] font-black uppercase tracking-widest text-gray-400">+55 (45) 99139-7543</div>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-12 border-t border-white/5 text-center">
            <div className="text-[10px] font-black uppercase text-gray-800 tracking-[0.8em] italic">© 2025 WAYFLOW NEURAL TECHNOLOGIES. IMPARÁVEL.</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
