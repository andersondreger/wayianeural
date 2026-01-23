import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShieldCheck, Cpu, Smartphone, 
  BarChart, ChevronRight, ChevronLeft, BrainCircuit, 
  Workflow, Database, MessageSquare, Activity,
  CheckCircle, Quote, Instagram, Twitter, Linkedin,
  ArrowUpRight, PlayCircle, Lock, Server, Globe,
  Layers, Zap, Terminal, Code2, Network, Users, Clock,
  Mail, Phone, MapPin, Youtube
} from 'lucide-react';
import { NeonButton, GlassButton } from '../components/Buttons';
import { GlassCard } from '../components/GlassCard';
import { Logo } from '../components/Logo';

export function LandingPage({ onStart }: { onStart: () => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isIntegrationActive, setIsIntegrationActive] = useState(false);

  const products = [
    { 
      title: "PetFlow Master", 
      desc: "O Cérebro Digital do seu Pet Shop\nAgenda Preditiva: Acabe com horários ociosos. A IA organiza os banhos e tosas para o lucro máximo.\nFidelização Ativa: Alertas automáticos de vacinas e vermífugos via WhatsApp com 98% de taxa de leitura.\nEstoque Inteligente: O sistema prevê quando a ração do cliente vai acabar e já oferece a recompra.", 
      icon: "https://qonrpzlkjhdmswjfxvtu.supabase.co/storage/v1/object/public/WayIAFlow/logopetshop2-removebg-preview.png", 
      color: "text-orange-500", 
      tag: "Acesse seu Petshop",
      bgImage: "https://qonrpzlkjhdmswjfxvtu.supabase.co/storage/v1/object/public/WayIAFlow/petshop1.jpg"
    },
    { 
      title: "ImobiVision 360", 
      desc: "A Máquina de Vendas da Sua Imobiliária\nChega de perder vendas por demora no atendimento ou gastar tempo com curiosos. O ImobiVision 360 atende e qualifica cada lead instantaneamente, 24/7, entregando para sua equipe apenas clientes prontos para visitar e comprar. Transforme interessados em chaves na mão com velocidade máxima.", 
      icon: "https://qonrpzlkjhdmswjfxvtu.supabase.co/storage/v1/object/public/WayIAFlow/logoimobi-removebg-preview.png", 
      color: "text-blue-500", 
      tag: "Acesse sua Imobiliária",
      bgImage: "https://qonrpzlkjhdmswjfxvtu.supabase.co/storage/v1/object/public/WayIAFlow/unnamed.jpg"
    },
    { title: "Flow Master", desc: "Orquestração visual de fluxos complexos via n8n e Webhooks em tempo real.", icon: Workflow, color: "text-green-500", tag: "Pro" },
    { title: "Neuro Analytics", desc: "Métricas preditivas sobre o comportamento e conversão real dos seus leads.", icon: BarChart, color: "text-purple-500", tag: "New" },
  ];

  const integrations = [
    { name: 'Anthropic', url: 'https://qonrpzlkjhdmswjfxvtu.supabase.co/storage/v1/object/public/WayIAFlow/images-removebg-preview.png' },
    { name: 'Meta', url: 'https://qonrpzlkjhdmswjfxvtu.supabase.co/storage/v1/object/public/WayIAFlow/meta_ai-logo_brandlogos.net_xjwry-512x504.png' },
    { name: 'OpenAI', url: 'https://qonrpzlkjhdmswjfxvtu.supabase.co/storage/v1/object/public/WayIAFlow/images.png' },
    { name: 'n8n', url: 'https://qonrpzlkjhdmswjfxvtu.supabase.co/storage/v1/object/public/WayIAFlow/n8n-removebg-preview.png' },
    { name: 'Make', url: 'https://qonrpzlkjhdmswjfxvtu.supabase.co/storage/v1/object/public/WayIAFlow/make-color.png' },
  ];

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const scrollTo = direction === 'left' ? scrollLeft - clientWidth : scrollLeft + clientWidth;
      scrollRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
    }
  };

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const highlightText = (text: string) => {
    const keywords = [
      "O Cérebro Digital", "Agenda Preditiva", "Fidelização Ativa", "Estoque Inteligente",
      "A Máquina de Vendas", "ImobiVision 360", "qualifica cada lead", "chaves na mão"
    ];
    let parts: (string | React.ReactNode)[] = [text];

    keywords.forEach(keyword => {
      const newParts: (string | React.ReactNode)[] = [];
      parts.forEach(part => {
        if (typeof part === 'string') {
          const split = part.split(new RegExp(`(${keyword})`, 'g'));
          split.forEach((s, j) => {
            if (s === keyword) {
              newParts.push(<span key={`${keyword}-${j}`} className="text-orange-500 font-black">{s}</span>);
            } else if (s !== "") {
              newParts.push(s);
            }
          });
        } else {
          newParts.push(part);
        }
      });
      parts = newParts;
    });

    return parts;
  };

  return (
    <div className="relative min-h-screen bg-[#050505] text-white selection:bg-orange-500/30">
      <div className="fixed inset-0 grid-engine pointer-events-none opacity-10"></div>
      
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-[100] border-b border-white/5 backdrop-blur-lg bg-black/40">
        <div className="max-w-6xl mx-auto px-6 py-2 flex items-center justify-between">
          <Logo size="sm" className="cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />
          
          <div className="hidden md:flex items-center gap-8 text-[9px] font-bold uppercase tracking-[0.3em] text-gray-500">
            <button 
              onClick={() => scrollToSection('ecossistema')} 
              className="hover:text-orange-500 transition-colors uppercase cursor-pointer outline-none"
            >
              Ecossistema
            </button>
            <button 
              onClick={() => scrollToSection('infraestrutura')} 
              className="hover:text-orange-500 transition-colors uppercase cursor-pointer outline-none"
            >
              Infraestrutura
            </button>
            <button 
              onClick={() => scrollToSection('otimizacao')} 
              className="hover:text-orange-500 transition-colors uppercase cursor-pointer outline-none"
            >
              Otimização
            </button>
          </div>

          <div className="flex items-center gap-4">
             <NeonButton onClick={onStart} className="!px-5 !py-2.5 !text-[9px]">Acessar</NeonButton>
          </div>
        </div>
      </nav>

      {/* Hero Header */}
      <header className="relative z-10 pt-28 pb-12 px-6 text-center max-w-none">
        <div className="max-w-6xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <span className="px-6 py-2 rounded-full glass text-orange-500 text-[10px] font-black uppercase tracking-[0.4em] border border-orange-500/20">
              Engine v3.14 - Operando em Alta Frequência
            </span>
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="mt-14 text-5xl md:text-7xl lg:text-8xl font-black uppercase leading-[1] tracking-tighter"
          >
            Potencialize sua <br />
            <span className="neon-pulse italic">Operação de Escala.</span>
          </motion.h1>

          <motion.p className="mt-12 text-gray-400 text-lg md:text-xl max-w-3xl mx-auto leading-relaxed font-medium uppercase tracking-wider opacity-90">
            Solução unificada de alta performance: integrando automações de escala industrial e inteligência neural ao dia a dia do seu negócio
          </motion.p>

          <div className="mt-20 flex flex-col sm:flex-row gap-4 justify-center items-center mb-6">
              <NeonButton onClick={onStart} className="!px-8 !py-4 !text-[10px] shadow-2xl shadow-orange-600/40">Acesse Gratuitamente</NeonButton>
              <GlassButton className="!px-6 !py-4 !text-[10px]" onClick={() => scrollToSection('ecossistema')}>Explorar Ecossistema</GlassButton>
          </div>
        </div>

        {/* --- SEÇÃO DE INTEGRAÇÃO --- */}
        <section className="relative z-10 w-full flex flex-col items-center mt-2 mb-6 px-8 md:px-12 lg:px-16">
          <div className="text-[10px] font-black uppercase tracking-[0.8em] text-orange-500/80 mb-6 italic animate-pulse">
            Clique no cluster para ativar sincronização neural
          </div>
          
          <div className="w-full">
            <GlassCard 
              onClick={() => setIsIntegrationActive(!isIntegrationActive)}
              className={`!p-0 w-full overflow-hidden relative transition-all duration-700 cursor-pointer shadow-2xl border-2 ${
                isIntegrationActive 
                ? 'border-orange-500 ring-8 ring-orange-500/20 shadow-[0_0_80px_rgba(255,115,0,0.4)] scale-[1.01] bg-orange-500/[0.03]' 
                : 'border-white/10 hover:border-orange-500/30'
              }`}
            >
              <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[#050505] to-transparent z-10"></div>
              <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-[#050505] to-transparent z-10"></div>
              
              <div className="animate-marquee py-8 md:py-10 flex items-center gap-24 md:gap-40">
                {[...integrations, ...integrations, ...integrations, ...integrations].map((logo, i) => (
                  <div key={i} className="flex flex-col items-center gap-4 group transform transition-all duration-500 hover:scale-110">
                    <img 
                      src={logo.url} 
                      alt={logo.name} 
                      className={`h-8 md:h-10 w-auto object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.1)] transition-all ${isIntegrationActive ? 'brightness-125 saturate-150' : ''}`} 
                    />
                    <span className={`text-[8px] font-black uppercase tracking-[0.2em] transition-colors ${isIntegrationActive ? 'text-orange-500' : 'text-gray-600 group-hover:text-white'}`}>
                      {logo.name}
                    </span>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>
        </section>
      </header>

      {/* Seção 2: Ecossistema de Fluxo */}
      <section id="ecossistema" className="relative z-10 pb-0 pt-4 bg-[#030303] scroll-mt-24">
        <div className="max-w-6xl mx-auto px-6">
            <div className="grid md:grid-cols-2 gap-32 items-start">
                <div className="order-2 md:order-1">
                    <div className="grid grid-cols-2 gap-6">
                        <GlassCard className="!p-10 border-orange-500/30 bg-orange-500/[0.05] shadow-2xl shadow-orange-500/10">
                            <Terminal className="text-orange-500 mb-5" size={32} />
                            <div className="text-sm font-black uppercase tracking-widest mb-3 italic">Atendimento Instantâneo</div>
                            <div className="text-[11px] text-gray-400 leading-relaxed font-semibold">Capacidade de processar milhares de interações simultâneas sem filas ou espera.</div>
                        </GlassCard>
                        <GlassCard className="!p-10 mt-12 border-blue-500/20">
                            <BrainCircuit className="text-blue-500 mb-5" size={32} />
                            <div className="text-sm font-black uppercase tracking-widest mb-3 italic">Cérebro Digital</div>
                            <div className="text-[11px] text-gray-400 leading-relaxed font-semibold">Identifica exatamente o que seu cliente quer e extrai dados importantes de forma automática.</div>
                        </GlassCard>
                        <GlassCard className="!p-10 -mt-12 border-green-500/20">
                            <Workflow className="text-green-500 mb-5" size={32} />
                            <div className="text-sm font-black uppercase tracking-widest mb-3 italic">Integração Total</div>
                            <div className="text-[11px] text-gray-400 leading-relaxed font-semibold">Conecta seu CRM e ferramentas de gestão em um fluxo de trabalho único e sem falhas.</div>
                        </GlassCard>
                        <GlassCard className="!p-10 border-yellow-500/20">
                            <Zap className="text-yellow-500 mb-5" size={32} />
                            <div className="text-sm font-black uppercase tracking-widest mb-3 italic">Resposta Humanizada</div>
                            <div className="text-[11px] text-gray-400 leading-relaxed font-semibold">Interações naturais e extremamente rápidas em milissegundos que encantam o cliente.</div>
                        </GlassCard>
                    </div>
                </div>
                <div className="order-1 md:order-2 space-y-4">
                    <span className="text-orange-500 font-bold text-[10px] uppercase tracking-[0.8em] italic">Ecossistema de Fluxo</span>
                    <h2 className="text-5xl font-black uppercase italic tracking-tighter leading-[0.9]">Inteligência <span className="text-orange-500">Centralizada.</span></h2>
                    <p className="text-gray-400 text-xl leading-relaxed font-medium opacity-80">
                        Muito além de um simples bot. É a espinha dorsal da sua operação. Não entregamos apenas automação; entregamos um system nervoso digital que integra suas ferramentas favoritas à inteligência mais avançada do planeta.
                        Nossa infraestrutura foi desenhada para escala industrial, garantindo que sua operação nunca pare, mesmo nos momentos de maior demanda. Enquanto outros falham, nós garantimos estabilidade, segurança e eficiência para o seu negócio local crescer sem limites.
                    </p>
                    <div className="pt-0 flex gap-6">
                        <NeonButton className="!px-10 !py-5" onClick={onStart}>Acessa Gratuitamente</NeonButton>
                        <GlassButton className="!px-10 !py-5" onClick={() => scrollToSection('ecossistema')}>Acesso Neural</GlassButton>
                    </div>
                </div>
            </div>
        </div>
      </section>

      {/* Seção 3: Performance & Infraestrutura */}
      <section id="infraestrutura" className="relative z-10 py-12 bg-black border-y border-white/5 scroll-mt-24">
        <div className="max-w-6xl mx-auto px-6 text-center space-y-20">
          <div className="space-y-6">
            <span className="text-orange-500 font-bold text-[10px] uppercase tracking-[0.3em] italic">Tecnologia de Gigante, moldada para o seu Comércio</span>
            <h2 className="text-6xl font-black uppercase italic tracking-tighter">Foco na <span className="text-orange-500">Experiência do Cliente</span></h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-10">
            {[
              { label: 'Sua empresa atende em milissegundos.', value: 'Resposta Instantânea', sub: 'Sem filas, sem espera e sem deixar seu cliente no "vácuo".', icon: Zap },
              { label: 'IA que entende gírias e áudios.', value: 'Inteligência Humana', sub: 'Experiência natural de conversa with intenções reais.', icon: Users },
              { label: 'Sua empresa continua vendendo.', value: 'Disponibilidade 24/7', sub: 'Enquanto você descansa, garantimos total estabilidade.', icon: Clock }
            ].map((stat, i) => (
              <GlassCard key={i} className="!p-12 space-y-6 border-white/5 hover:bg-white/[0.02] flex flex-col justify-center min-h-[400px]">
                <div className="w-16 h-16 bg-orange-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <stat.icon className="text-orange-500" size={32} />
                </div>
                <div className="text-3xl font-black italic text-white tracking-tighter leading-tight">{stat.value}</div>
                <div className="space-y-3">
                  <div className="text-xs font-black uppercase tracking-widest text-orange-500/80 italic">{stat.label}</div>
                  <div className="text-[11px] font-bold uppercase tracking-widest text-gray-500 leading-relaxed">{stat.sub}</div>
                </div>
              </GlassCard>
            ))}
          </div>
        </div>
      </section>

      {/* Módulos Especialistas */}
      <section id="produtos" className="relative z-10 pt-12 pb-12 bg-white/[0.01] scroll-mt-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-end mb-24 gap-12">
            <div className="space-y-4">
              <span className="text-orange-500 font-bold text-[10px] uppercase tracking-[0.7em] block italic">Ecossistemas Especialistas</span>
              <h2 className="text-6xl font-black uppercase italic tracking-tighter">Pronto para a sua <span className="text-orange-500">Empresa.</span></h2>
            </div>
            <div className="flex gap-6">
              <button onClick={() => scroll('left')} className="p-6 glass rounded-2xl hover:bg-orange-600 transition-all hover:scale-110"><ChevronLeft size={28} /></button>
              <button onClick={() => scroll('right')} className="p-6 glass rounded-2xl hover:bg-orange-600 transition-all hover:scale-110"><ChevronRight size={28} /></button>
            </div>
          </div>

          <div ref={scrollRef} className="flex gap-10 overflow-x-auto snap-x snap-mandatory no-scrollbar pb-16">
            {products.map((p, i) => (
              <div key={i} className="min-w-[300px] md:min-w-[420px] snap-center">
                <GlassCard className={`h-[500px] flex flex-col justify-between !p-10 hover:border-orange-500/50 transition-all group relative overflow-hidden shadow-2xl`}>
                  {p.bgImage && (
                    <div className="absolute inset-0 z-0">
                        <img src={p.bgImage} className="w-full h-full object-cover opacity-20 group-hover:opacity-40 transition-opacity duration-1000 scale-125 group-hover:scale-100" alt="" />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-[#050505]/95"></div>
                    </div>
                  )}
                  
                  <div className="space-y-6 relative z-10">
                    <div className="flex justify-between items-start">
                        <div className={`${p.title === "PetFlow Master" || p.title === "ImobiVision 360" ? "w-48 h-48 bg-transparent" : "w-20 h-20 bg-white/[0.03] group-hover:bg-orange-600"} rounded-3xl flex items-center justify-center transition-all ${p.title === "PetFlow Master" || p.title === "ImobiVision 360" ? "" : "shadow-2xl ring-1 ring-white/10 group-hover:ring-orange-500/50"} overflow-hidden`}>
                            {typeof p.icon === 'string' ? (
                                <img src={p.icon} alt={p.title} className={`${p.title === "PetFlow Master" || p.title === "ImobiVision 360" ? "w-44 h-44" : "w-16 h-16"} object-contain`} />
                            ) : (
                                <p.icon className={`${p.color} group-hover:text-white transition-colors`} size={40} />
                            )}
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-orange-500 border border-orange-500/20 px-3 py-1.5 rounded-full bg-black/40">{p.tag}</span>
                    </div>
                    <h3 className="text-3xl font-black uppercase italic tracking-tighter leading-none">{p.title}</h3>
                    <div className={`text-sm leading-relaxed font-medium whitespace-pre-line ${(i === 0 || i === 1) ? 'text-orange-100/90' : 'text-gray-400 opacity-80'}`}>
                      {(i === 0 || i === 1) ? highlightText(p.desc) : p.desc}
                    </div>
                  </div>

                  <div className="relative z-10 space-y-6">
                    <div className="h-px bg-white/10 w-full"></div>
                    <GlassButton 
                        onClick={onStart}
                        className="w-full !py-4 !text-[9px] !bg-black/60 backdrop-blur-2xl hover:!bg-orange-600 transition-all"
                    >
                        {i === 0 ? "Acesse Gratuitamente" : i === 1 ? "Acessar Imobiliaria ImobiVision 360" : "Analisar Métrica Operacional"}
                    </GlassButton>
                  </div>
                </GlassCard>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Seção 4: Otimização & Escala */}
      <section id="otimizacao" className="relative z-10 py-24 bg-gradient-to-b from-black to-[#050505] text-center border-t border-white/5 scroll-mt-24">
        <div className="max-w-4xl mx-auto px-6 space-y-12">
            <h2 className="text-7xl font-black uppercase italic tracking-tighter leading-none">Pronto para <br/><span className="text-orange-500">Escalar?</span></h2>
            <p className="text-gray-500 text-xl font-bold uppercase tracking-widest leading-relaxed">Não deixe sua operação na mão de ferramentas instáveis. <br/>Mude para a infraestrutura neural hoje.</p>
            <div className="pt-10">
                <NeonButton onClick={onStart} className="!px-20 !py-8 !text-lg">Começar Agora</NeonButton>
            </div>
        </div>
      </section>

      {/* Professional Footer */}
      <footer className="relative z-10 border-t border-white/5 bg-[#020202] pt-24 pb-12">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-16 mb-24">
            {/* Column 1: Identity */}
            <div className="space-y-8">
              <Logo size="sm" />
              <p className="text-gray-500 text-[11px] font-bold uppercase tracking-widest leading-relaxed max-w-xs">
                A espinha dorsal tecnológica para empresas que buscam escala industrial através de inteligência neural e automação de ponta.
              </p>
              <div className="flex gap-4">
                {[Instagram, Twitter, Linkedin, Youtube].map((Icon, i) => (
                  <a key={i} href="#" className="w-10 h-10 rounded-xl glass flex items-center justify-center text-gray-400 hover:text-orange-500 hover:border-orange-500/50 transition-all">
                    <Icon size={18} />
                  </a>
                ))}
              </div>
            </div>

            {/* Column 2: Ecosystem */}
            <div className="space-y-8">
              <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-orange-500 italic">Ecossistema</h4>
              <ul className="space-y-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                <li><button onClick={() => scrollToSection('produtos')} className="hover:text-white transition-colors uppercase text-left">PetFlow Master</button></li>
                <li><button onClick={() => scrollToSection('produtos')} className="hover:text-white transition-colors uppercase text-left">ImobiVision 360</button></li>
                <li><button className="hover:text-white transition-colors uppercase text-left">Evolution API</button></li>
                <li><button className="hover:text-white transition-colors uppercase text-left">n8n Orchestration</button></li>
                <li><button className="hover:text-white transition-colors uppercase text-left">Neuro Analytics</button></li>
              </ul>
            </div>

            {/* Column 3: Platform */}
            <div className="space-y-8">
              <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-orange-500 italic">Plataforma</h4>
              <ul className="space-y-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Documentação API</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Status do Cluster</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Roadmap Neural</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Segurança & TLS</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Programa Afiliados</a></li>
              </ul>
            </div>

            {/* Column 4: Contact */}
            <div className="space-y-8">
              <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-orange-500 italic">Contato Direct</h4>
              <ul className="space-y-6">
                <li className="flex items-center gap-4 group cursor-pointer">
                  <div className="p-3 glass rounded-xl text-orange-500 group-hover:bg-orange-500 group-hover:text-white transition-all"><Mail size={14}/></div>
                  <div className="text-[9px] font-black uppercase tracking-widest text-gray-400 group-hover:text-white">neural@wayflow.ai</div>
                </li>
                <li className="flex items-center gap-4 group cursor-pointer">
                  <div className="p-3 glass rounded-xl text-orange-500 group-hover:bg-orange-500 group-hover:text-white transition-all"><Phone size={14}/></div>
                  <div className="text-[9px] font-black uppercase tracking-widest text-gray-400 group-hover:text-white">+55 (11) 98888-7777</div>
                </li>
                <li className="flex items-center gap-4 group cursor-pointer">
                  <div className="p-3 glass rounded-xl text-orange-500 group-hover:bg-orange-500 group-hover:text-white transition-all"><MapPin size={14}/></div>
                  <div className="text-[9px] font-black uppercase tracking-widest text-gray-400 group-hover:text-white">Neural Hub, São Paulo - BR</div>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="text-[9px] font-black uppercase text-gray-700 tracking-[0.5em] italic">
              © 2025 WAYFLOW NEURAL TECHNOLOGIES. ALL RIGHTS RESERVED.
            </div>
            <div className="flex gap-12 text-[8px] font-black uppercase tracking-widest text-gray-600 italic">
              <a href="#" className="hover:text-orange-500 transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-orange-500 transition-colors">Terms of Service</a>
              <a href="#" className="hover:text-orange-500 transition-colors">SLA Agreement</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}