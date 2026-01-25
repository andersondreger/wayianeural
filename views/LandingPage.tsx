
import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShieldCheck, Cpu, Smartphone, 
  BarChart, ChevronRight, ChevronLeft, BrainCircuit, 
  Workflow, Database, MessageSquare, Activity,
  CheckCircle, Quote, Instagram, Twitter, Linkedin,
  ArrowUpRight, PlayCircle, Lock, Server, Globe,
  Layers, Zap, Terminal, Code2, Network, Users, Clock,
  Mail, Phone, MapPin, Youtube, MessageCircle
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
            <button onClick={() => scrollToSection('ecossistema')} className="hover:text-orange-500 transition-colors uppercase cursor-pointer outline-none">Ecossistema</button>
            <button onClick={() => scrollToSection('infraestrutura')} className="hover:text-orange-500 transition-colors uppercase cursor-pointer outline-none">Infraestrutura</button>
            <button onClick={() => scrollToSection('otimizacao')} className="hover:text-orange-500 transition-colors uppercase cursor-pointer outline-none">Otimização</button>
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
            className="mt-14 text-4xl md:text-6xl font-black uppercase leading-[1.1] tracking-tighter"
          >
            Potencialize sua <br />
            <span className="neon-pulse italic">Operação de Escala.</span>
          </motion.h1>

          <motion.p className="mt-8 text-gray-400 text-sm md:text-base max-w-2xl mx-auto leading-relaxed font-medium uppercase tracking-wider opacity-90">
            Solução unificada de alta performance: integrando automações de escala industrial e inteligência neural ao dia a dia do seu negócio
          </motion.p>

          <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-center items-center mb-6">
              <NeonButton onClick={onStart} className="!px-8 !py-4 !text-[10px] shadow-2xl shadow-orange-600/40">Acesse Gratuitamente</NeonButton>
              <GlassButton className="!px-6 !py-4 !text-[10px]" onClick={() => scrollToSection('ecossistema')}>Explorar Ecossistema</GlassButton>
          </div>
        </div>

        {/* SEÇÃO DE INTEGRAÇÃO */}
        <section className="relative z-10 w-full flex flex-col items-center mt-2 mb-6 px-4 md:px-12">
          <div className="text-[9px] font-black uppercase tracking-[0.5em] text-orange-500/80 mb-6 italic animate-pulse">
            Sincronização neural ativa
          </div>
          
          <div className="w-full">
            <GlassCard 
              onClick={() => setIsIntegrationActive(!isIntegrationActive)}
              className={`!p-0 w-full overflow-hidden relative transition-all duration-700 cursor-pointer shadow-2xl border-2 ${
                isIntegrationActive 
                ? 'border-orange-500 ring-4 ring-orange-500/20 shadow-[0_0_60px_rgba(255,115,0,0.3)] bg-orange-500/[0.03]' 
                : 'border-white/10 hover:border-orange-500/30'
              }`}
            >
              <div className="animate-marquee py-6 md:py-8 flex items-center gap-16 md:gap-32">
                {[...integrations, ...integrations, ...integrations].map((logo, i) => (
                  <div key={i} className="flex flex-col items-center gap-4 group transition-transform duration-500 hover:scale-105">
                    <img 
                      src={logo.url} 
                      alt={logo.name} 
                      className={`h-6 md:h-8 w-auto object-contain transition-all ${isIntegrationActive ? 'brightness-125' : 'grayscale opacity-50'}`} 
                    />
                    <span className={`text-[7px] font-black uppercase tracking-[0.2em] transition-colors ${isIntegrationActive ? 'text-orange-500' : 'text-gray-600'}`}>
                      {logo.name}
                    </span>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>
        </section>
      </header>

      {/* Seção 2: Ecossistema */}
      <section id="ecossistema" className="relative z-10 pb-12 pt-12 bg-[#030303] scroll-mt-24">
        <div className="max-w-6xl mx-auto px-6">
            <div className="grid md:grid-cols-2 gap-16 md:gap-24 items-center">
                <div className="order-2 md:order-1">
                    <div className="grid grid-cols-2 gap-4 md:gap-6">
                        <GlassCard className="!p-6 md:!p-8 border-orange-500/20">
                            <Terminal className="text-orange-500 mb-4" size={24} />
                            <div className="text-xs font-black uppercase tracking-widest mb-2 italic">Atendimento Instantâneo</div>
                            <div className="text-[10px] text-gray-400 leading-relaxed font-semibold">Processamento em tempo real.</div>
                        </GlassCard>
                        <GlassCard className="!p-6 md:!p-8 mt-6 border-blue-500/10">
                            <BrainCircuit className="text-blue-500 mb-4" size={24} />
                            <div className="text-xs font-black uppercase tracking-widest mb-2 italic">Cérebro Digital</div>
                            <div className="text-[10px] text-gray-400 leading-relaxed font-semibold">Qualificação automática de leads.</div>
                        </GlassCard>
                        <GlassCard className="!p-6 md:!p-8 -mt-6 border-green-500/10">
                            <Workflow className="text-green-500 mb-4" size={24} />
                            <div className="text-xs font-black uppercase tracking-widest mb-2 italic">Integração Total</div>
                            <div className="text-[10px] text-gray-400 leading-relaxed font-semibold">Conexão nativa com seu CRM.</div>
                        </GlassCard>
                        <GlassCard className="!p-6 md:!p-8 border-yellow-500/10">
                            <Zap className="text-yellow-500 mb-4" size={24} />
                            <div className="text-xs font-black uppercase tracking-widest mb-2 italic">Humano & Ágil</div>
                            <div className="text-[10px] text-gray-400 leading-relaxed font-semibold">Respostas naturais em ms.</div>
                        </GlassCard>
                    </div>
                </div>
                <div className="order-1 md:order-2 space-y-4">
                    <span className="text-orange-500 font-bold text-[10px] uppercase tracking-[0.5em] italic">Ecossistema Neural</span>
                    <h2 className="text-3xl md:text-5xl font-black uppercase italic tracking-tighter leading-[0.9]">Inteligência <span className="text-orange-500">Centralizada.</span></h2>
                    <p className="text-gray-400 text-sm md:text-base leading-relaxed font-medium opacity-80">
                        Muito além de um bot. É a espinha dorsal da sua operação. Não entregamos apenas automação; entregamos um sistema nervoso digital que integra suas ferramentas favoritas à inteligência mais avançada do planeta.
                    </p>
                    <div className="pt-4 flex gap-4">
                        <NeonButton className="!px-6 !py-4 !text-[9px]" onClick={onStart}>Teste Grátis</NeonButton>
                        <GlassButton className="!px-6 !py-4 !text-[9px]" onClick={() => scrollToSection('infraestrutura')}>Infraestrutura</GlassButton>
                    </div>
                </div>
            </div>
        </div>
      </section>

      {/* Seção 3: Performance */}
      <section id="infraestrutura" className="relative z-10 py-16 bg-black border-y border-white/5 scroll-mt-24">
        <div className="max-w-6xl mx-auto px-6 text-center space-y-12 md:space-y-16">
          <div className="space-y-4">
            <span className="text-orange-500 font-bold text-[10px] uppercase tracking-[0.2em] italic">Tecnologia Enterprise para o Comércio</span>
            <h2 className="text-3xl md:text-5xl font-black uppercase italic tracking-tighter">Foco na <span className="text-orange-500">Experiência do Cliente.</span></h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6 md:gap-8">
            {[
              { value: 'Resposta Instantânea', sub: 'Sem vácuo para o seu cliente.', icon: Zap },
              { value: 'Inteligência Humana', sub: 'Experiência fluida e natural.', icon: Users },
              { value: 'Disponibilidade 24/7', sub: 'Sua empresa nunca para.', icon: Clock }
            ].map((stat, i) => (
              <GlassCard key={i} className="!p-10 flex flex-col justify-center min-h-[300px]">
                <div className="w-12 h-12 bg-orange-500/10 rounded-xl flex items-center justify-center mx-auto mb-6">
                  <stat.icon className="text-orange-500" size={24} />
                </div>
                <div className="text-xl md:text-2xl font-black italic mb-4 tracking-tighter">{stat.value}</div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{stat.sub}</div>
              </GlassCard>
            ))}
          </div>
        </div>
      </section>

      {/* Seção 4: Produtos */}
      <section id="produtos" className="relative z-10 py-16 scroll-mt-24 bg-white/[0.01]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-8">
            <div className="space-y-2">
              <span className="text-orange-500 font-bold text-[10px] uppercase tracking-[0.5em] block italic">Especialistas</span>
              <h2 className="text-3xl md:text-5xl font-black uppercase italic tracking-tighter">Pronto para a sua <span className="text-orange-500">Empresa.</span></h2>
            </div>
            <div className="flex gap-4">
              <button onClick={() => scroll('left')} className="p-4 glass rounded-xl hover:bg-orange-600 transition-all"><ChevronLeft size={20} /></button>
              <button onClick={() => scroll('right')} className="p-4 glass rounded-xl hover:bg-orange-600 transition-all"><ChevronRight size={20} /></button>
            </div>
          </div>

          <div ref={scrollRef} className="flex gap-6 overflow-x-auto snap-x snap-mandatory no-scrollbar pb-8">
            {products.map((p, i) => (
              <div key={i} className="min-w-[280px] md:min-w-[380px] snap-center">
                <GlassCard className="h-[450px] flex flex-col justify-between !p-8 relative overflow-hidden group">
                  {p.bgImage && (
                    <div className="absolute inset-0 z-0">
                        <img src={p.bgImage} className="w-full h-full object-cover opacity-10 group-hover:opacity-20 transition-opacity" alt="" />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/60 to-transparent"></div>
                    </div>
                  )}
                  <div className="space-y-4 relative z-10">
                    <div className="flex justify-between items-center">
                        <div className="w-12 h-12 bg-white/[0.03] rounded-xl flex items-center justify-center">
                            {typeof p.icon === 'string' ? <img src={p.icon} className="w-8 h-8 object-contain" /> : <p.icon className={p.color} size={24} />}
                        </div>
                        <span className="text-[8px] font-black uppercase tracking-widest text-orange-500 border border-orange-500/20 px-2 py-1 rounded-full">{p.tag}</span>
                    </div>
                    <h3 className="text-xl md:text-2xl font-black uppercase italic tracking-tighter">{p.title}</h3>
                    <div className="text-[10px] md:text-xs leading-relaxed font-medium text-gray-400">
                      {(i === 0 || i === 1) ? highlightText(p.desc) : p.desc}
                    </div>
                  </div>
                  <NeonButton onClick={onStart} className="w-full !py-3 !text-[9px] relative z-10">Acessar Painel</NeonButton>
                </GlassCard>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Seção 5: CTA */}
      <section id="otimizacao" className="relative z-10 py-20 bg-gradient-to-b from-black to-[#050505] text-center border-t border-white/5 scroll-mt-24">
        <div className="max-w-4xl mx-auto px-6 space-y-8">
            <h2 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter leading-none">Pronto para <br/><span className="text-orange-500">Escalar?</span></h2>
            <p className="text-gray-500 text-xs md:text-sm font-bold uppercase tracking-[0.2em]">Entre na infraestrutura neural hoje.</p>
            <div className="pt-6">
                <NeonButton onClick={onStart} className="!px-12 !py-5 !text-[11px]">Começar Agora</NeonButton>
            </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 bg-[#020202] pt-16 pb-8">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
            <div className="space-y-6">
              <Logo size="sm" />
              <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest leading-relaxed max-w-xs">Espinha dorsal tecnológica para empresas que buscam escala industrial.</p>
              <div className="flex gap-4">
                {[Instagram, Twitter, Linkedin].map((Icon, i) => (
                  <a key={i} href="#" className="w-8 h-8 rounded-lg glass flex items-center justify-center text-gray-400 hover:text-orange-500 transition-all"><Icon size={14} /></a>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <h4 className="text-[9px] font-black uppercase tracking-[0.4em] text-orange-500 italic">Ecossistema</h4>
              <ul className="space-y-3 text-[9px] font-bold uppercase tracking-widest text-gray-400">
                <li><button onClick={() => scrollToSection('produtos')} className="hover:text-white transition-colors">PetFlow Master</button></li>
                <li><button onClick={() => scrollToSection('produtos')} className="hover:text-white transition-colors">ImobiVision 360</button></li>
                <li><button className="hover:text-white transition-colors">Evolution API</button></li>
              </ul>
            </div>

            <div className="space-y-6">
              <h4 className="text-[9px] font-black uppercase tracking-[0.4em] text-orange-500 italic">Plataforma</h4>
              <ul className="space-y-3 text-[9px] font-bold uppercase tracking-widest text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Documentação</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Segurança</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Afiliados</a></li>
              </ul>
            </div>

            <div className="space-y-6">
              <h4 className="text-[9px] font-black uppercase tracking-[0.4em] text-orange-500 italic">Contato</h4>
              <ul className="space-y-4">
                <li className="flex items-center gap-3 group">
                  <div className="p-2 glass rounded-lg text-orange-500 group-hover:bg-orange-500 group-hover:text-white transition-all"><Mail size={12}/></div>
                  <div className="text-[8px] font-black uppercase tracking-widest text-gray-400">neural@wayflow.ai</div>
                </li>
                <li className="flex items-center gap-3 group">
                  <div className="p-2 glass rounded-lg text-green-500 group-hover:bg-green-500 group-hover:text-white transition-all"><MessageCircle size={12}/></div>
                  <div className="text-[8px] font-black uppercase tracking-widest text-gray-400">+55 (45) 99904-5858</div>
                </li>
                <li className="flex items-center gap-3 group">
                  <div className="p-2 glass rounded-lg text-orange-500 group-hover:bg-orange-500 group-hover:text-white transition-all"><MapPin size={12}/></div>
                  <div className="text-[8px] font-black uppercase tracking-widest text-gray-400 leading-tight">Rua Tiradentes, 810 <br/> Matelândia - PR</div>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-white/5 text-center">
            <div className="text-[8px] font-black uppercase text-gray-700 tracking-[0.3em] italic">© 2025 WAYFLOW NEURAL TECHNOLOGIES. ALL RIGHTS RESERVED.</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
