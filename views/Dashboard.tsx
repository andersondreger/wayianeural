
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, MessageSquare, Users, CreditCard, 
  Terminal, Settings, LogOut, Search, Smartphone,
  User as UserIcon, Activity, Workflow, Plus, Trash2, 
  QrCode, ChevronRight, Filter, Crown, Share2, BrainCircuit,
  Pause, Play, Save, CheckCircle2, AlertCircle
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { UserSession, DashboardTab, EvolutionInstance, Lead, AgentIA, Sentiment } from '../types';
import { GlassCard } from '../components/GlassCard';
import { GlassButton, NeonButton } from '../components/Buttons';
import { Logo } from '../components/Logo';

export function Dashboard({ user, onLogout }: { user: UserSession; onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  
  // -- State: Evolution API --
  const [instances, setInstances] = useState<EvolutionInstance[]>([
    { id: '1', name: 'Atendimento Principal', status: 'CONNECTED', phone: '5511999999999' }
  ]);
  const [showQrModal, setShowQrModal] = useState(false);

  // -- State: CRM Kanban --
  const [leads, setLeads] = useState<Lead[]>([
    { id: 'lead-1', name: 'Anderson Dreger', phone: '5511988887777', lastMessage: 'Olá, gostaria de saber mais sobre a WayFlow', summary: 'Interessado em automação enterprise.', sentiment: 'happy', time: '10:30', stage: 'novo', isPaused: false },
    { id: 'lead-2', name: 'Maria Silva', phone: '5521977776666', lastMessage: 'Obrigado pelo retorno!', summary: 'Lead qualificado buscando integração n8n.', sentiment: 'neutral', time: 'Ontem', stage: 'qualificado', isPaused: true }
  ]);

  // -- State: Neural Agent --
  const [agent, setAgent] = useState<AgentIA>({
    id: 'agent-1',
    name: 'Neural Guard',
    companyName: 'WayFlow Neural',
    tone: 'Profissional e prestativo',
    objective: 'Qualificar leads e agendar demos',
    knowledgeBase: 'A WayFlow Neural é uma plataforma v3.1 de escalabilidade de atendimento...'
  });

  const stages: {id: Lead['stage'], label: string}[] = [
    { id: 'novo', label: 'Novo Lead' },
    { id: 'qualificado', label: 'Qualificado' },
    { id: 'agendado', label: 'Agendado' },
    { id: 'fechado', label: 'Fechado' }
  ];

  const onDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const updatedLeads = leads.map(l => {
      if (l.id === draggableId) {
        return { ...l, stage: destination.droppableId as Lead['stage'] };
      }
      return l;
    });
    setLeads(updatedLeads);
    console.log(`Lead ${draggableId} movido para ${destination.droppableId} - Disparando n8n update...`);
  };

  const togglePause = (id: string) => {
    setLeads(leads.map(l => l.id === id ? { ...l, isPaused: !l.isPaused } : l));
  };

  const getSentimentEmoji = (s: Sentiment) => {
    switch(s) {
      case 'happy': return '😊';
      case 'neutral': return '😐';
      case 'angry': return '😡';
      default: return '😐';
    }
  };

  const SidebarBtn = ({ id, icon: Icon, label, isAdmin = false }: { id: DashboardTab, icon: any, label: string, isAdmin?: boolean }) => {
    if (isAdmin && !user.isAdmin) return null;
    return (
      <button 
        onClick={() => setActiveTab(id)}
        className={`w-full flex items-center gap-3 px-5 py-3 rounded-lg transition-all relative group ${
          activeTab === id 
            ? 'bg-orange-600/10 text-orange-500 border border-orange-500/10 shadow-sm' 
            : 'text-gray-600 hover:text-white hover:bg-white/[0.02]'
        }`}
      >
        <Icon size={16} className={activeTab === id ? 'text-orange-500' : 'opacity-40'} />
        <span className="text-[9px] font-bold uppercase tracking-widest">{label}</span>
      </button>
    );
  };

  return (
    <div className="flex h-screen bg-[#050505] overflow-hidden text-white font-sans">
      <div className="fixed inset-0 grid-engine pointer-events-none opacity-10"></div>

      <aside className="w-[240px] border-r border-white/5 flex flex-col p-6 bg-black/40 backdrop-blur-xl z-50">
        <Logo size="sm" className="mb-12 px-2" />

        <nav className="flex-1 space-y-1">
          <SidebarBtn id="overview" icon={LayoutDashboard} label="Overview" />
          <SidebarBtn id="evolution" icon={Smartphone} label="Evolution API" />
          <SidebarBtn id="atendimento" icon={MessageSquare} label="CRM Atendimento" />
          <SidebarBtn id="config-neural" icon={BrainCircuit} label="Agentes Neurais" />
          <SidebarBtn id="financeiro" icon={CreditCard} label="Faturamento" />
          <div className="h-px bg-white/5 my-6 mx-2" />
          <SidebarBtn id="n8n" icon={Workflow} label="Orquestrador n8n" />
          
          {user.isAdmin && (
            <div className="pt-4 space-y-1">
              <div className="px-5 mb-2 text-[7px] font-black uppercase tracking-[0.3em] text-orange-500/50">Admin Master</div>
              <SidebarBtn id="admin" icon={Crown} label="Controle Clientes" isAdmin />
              <SidebarBtn id="afiliados" icon={Share2} label="Rede Afiliados" isAdmin />
            </div>
          )}
        </nav>

        <button onClick={onLogout} className="mt-auto flex items-center gap-3 px-5 py-4 text-gray-700 hover:text-red-500 transition-colors uppercase text-[9px] font-bold tracking-widest border-t border-white/5">
            <LogOut size={16} /> Logout Engine
        </button>
      </aside>

      <main className="flex-1 flex flex-col relative overflow-hidden bg-[#070707]">
        <header className="h-16 flex items-center justify-between px-10 border-b border-white/5 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
             <span className="text-[10px] font-black uppercase text-orange-500 tracking-widest">{activeTab}</span>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-[10px] font-bold uppercase italic leading-none">{user.name}</div>
                  <div className="text-[7px] text-orange-500 font-black uppercase tracking-widest mt-1">{user.isAdmin ? 'MASTER ADMIN' : 'ELITE USER'}</div>
                </div>
                <div className="w-9 h-9 bg-rajado rounded-lg border border-white/10 flex items-center justify-center">
                  <UserIcon size={16} />
                </div>
            </div>
          </div>
        </header>

        <div className="flex-1 p-10 overflow-y-auto z-10 custom-scrollbar">
          <AnimatePresence mode="wait">
            <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="h-full">
              
              {/* --- OVERVIEW --- */}
              {activeTab === 'overview' && (
                <div className="space-y-10">
                   <h2 className="text-4xl font-black uppercase italic tracking-tighter">Status <span className="text-orange-500">Neural</span></h2>
                   <div className="grid grid-cols-4 gap-6">
                      {[
                        { l: 'MRR', v: 'R$ 8.4k', t: '+12%', c: 'text-green-500' },
                        { l: 'Nodes Active', v: '04', t: 'Evolution', c: 'text-blue-500' },
                        { l: 'Neural Hits', v: '1.2k', t: 'IA Processing', c: 'text-orange-500' },
                        { l: 'Uptime', v: '99.9%', t: 'Guaranteed', c: 'text-purple-500' }
                      ].map((s, i) => (
                        <GlassCard key={i} className="!p-6 border-white/5">
                          <div className="text-[8px] font-black text-gray-700 uppercase mb-2 tracking-widest">{s.l}</div>
                          <div className="text-2xl font-black italic">{s.v}</div>
                          <div className={`mt-3 text-[7px] font-bold uppercase tracking-widest ${s.c}`}>{s.t}</div>
                        </GlassCard>
                      ))}
                   </div>
                </div>
              )}

              {/* --- EVOLUTION API --- */}
              {activeTab === 'evolution' && (
                <div className="space-y-8">
                    <div className="flex justify-between items-center">
                        <h2 className="text-3xl font-black uppercase italic tracking-tighter">Evolution <span className="text-orange-500">Core</span></h2>
                        <NeonButton className="!px-6 !py-3 flex items-center gap-2"><Plus size={14}/> Nova Instância</NeonButton>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {instances.map(inst => (
                            <GlassCard key={inst.id} className="!p-8 space-y-6 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-10"><Smartphone size={60}/></div>
                                <div>
                                    <div className="text-lg font-black uppercase italic tracking-tight">{inst.name}</div>
                                    <div className="text-[8px] font-bold text-gray-700 mt-1 uppercase tracking-widest">{inst.phone || 'AGUARDANDO...'}</div>
                                </div>
                                <div className="flex items-center gap-3 py-4 border-y border-white/5">
                                    <div className={`w-2 h-2 rounded-full ${inst.status === 'CONNECTED' ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-red-500 animate-pulse'}`}></div>
                                    <span className="text-[9px] font-black uppercase tracking-widest">{inst.status}</span>
                                </div>
                                <div className="flex gap-2">
                                    <GlassButton className="flex-1 !py-3 !text-[8px]" onClick={() => setShowQrModal(true)}><QrCode size={12} className="mr-2 inline"/> Conectar</GlassButton>
                                    <button className="p-3 glass rounded-lg text-red-500/40 hover:text-red-500 transition-all"><Trash2 size={16}/></button>
                                </div>
                            </GlassCard>
                        ))}
                    </div>
                </div>
              )}

              {/* --- KANBAN CRM --- */}
              {activeTab === 'atendimento' && (
                <div className="h-full flex flex-col gap-6">
                    <div className="flex justify-between items-center">
                        <h2 className="text-3xl font-black uppercase italic tracking-tighter italic">Kanban <span className="text-orange-500">Pipeline</span></h2>
                        <div className="flex gap-2">
                            <GlassButton className="!px-4 !py-2 !text-[8px] flex items-center gap-2"><Filter size={12}/> Filtrar Ativos</GlassButton>
                        </div>
                    </div>

                    <DragDropContext onDragEnd={onDragEnd}>
                        <div className="flex-1 flex gap-6 overflow-x-auto pb-4 no-scrollbar">
                            {stages.map((stage) => (
                                <Droppable key={stage.id} droppableId={stage.id}>
                                    {(provided) => (
                                        <div 
                                            {...provided.droppableProps} 
                                            ref={provided.innerRef}
                                            className="min-w-[320px] flex flex-col gap-4 bg-white/[0.01] rounded-2xl p-4 border border-white/5"
                                        >
                                            <div className="flex justify-between items-center mb-2 px-2">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 italic">{stage.label}</span>
                                                <span className="bg-orange-500/10 text-orange-500 px-2 py-0.5 rounded text-[8px] font-black">
                                                    {leads.filter(l => l.stage === stage.id).length}
                                                </span>
                                            </div>
                                            <div className="space-y-4">
                                                {leads.filter(l => l.stage === stage.id).map((lead, index) => (
                                                    <Draggable key={lead.id} draggableId={lead.id} index={index}>
                                                        {(provided) => (
                                                            <div
                                                                ref={provided.innerRef}
                                                                {...provided.draggableProps}
                                                                {...provided.dragHandleProps}
                                                            >
                                                                <GlassCard className={`!p-5 space-y-4 ${lead.isPaused ? 'border-orange-500/40 bg-orange-600/[0.02]' : ''}`}>
                                                                    <div className="flex justify-between items-start">
                                                                        <div className="flex gap-3">
                                                                            <div className="w-9 h-9 rounded-lg bg-orange-600 flex items-center justify-center font-black italic shadow-lg shadow-orange-600/10">
                                                                                {lead.name.charAt(0)}
                                                                            </div>
                                                                            <div>
                                                                                <div className="text-[11px] font-black uppercase italic tracking-tight">{lead.name}</div>
                                                                                <div className="text-[8px] text-gray-700 font-bold uppercase mt-0.5">{lead.phone}</div>
                                                                            </div>
                                                                        </div>
                                                                        <div className="text-xl" title="Sentimento do Lead">
                                                                            {getSentimentEmoji(lead.sentiment)}
                                                                        </div>
                                                                    </div>
                                                                    
                                                                    {lead.summary && (
                                                                        <div className="p-3 bg-white/[0.03] rounded-lg border border-white/5">
                                                                            <div className="text-[7px] font-black uppercase tracking-widest text-orange-500 mb-1">IA Summary</div>
                                                                            <div className="text-[9px] text-gray-500 leading-relaxed font-medium">"{lead.summary}"</div>
                                                                        </div>
                                                                    )}

                                                                    <div className="flex justify-between items-center pt-2">
                                                                        <div className="text-[8px] text-gray-800 font-bold uppercase tracking-widest">{lead.time}</div>
                                                                        <button 
                                                                            onClick={() => togglePause(lead.id)}
                                                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest transition-all ${
                                                                                lead.isPaused 
                                                                                ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' 
                                                                                : 'bg-white/5 text-gray-600 hover:text-white'
                                                                            }`}
                                                                        >
                                                                            {lead.isPaused ? <><Play size={10}/> IA Pausada</> : <><Pause size={10}/> Assumir</>}
                                                                        </button>
                                                                    </div>
                                                                </GlassCard>
                                                            </div>
                                                        )}
                                                    </Draggable>
                                                ))}
                                                {provided.placeholder}
                                            </div>
                                        </div>
                                    )}
                                </Droppable>
                            ))}
                        </div>
                    </DragDropContext>
                </div>
              )}

              {/* --- NEURAL CONFIG --- */}
              {activeTab === 'config-neural' && (
                <div className="max-w-4xl space-y-10">
                   <div>
                        <h2 className="text-3xl font-black uppercase italic tracking-tighter">Engine <span className="text-orange-500">Neural Config</span></h2>
                        <p className="text-[9px] font-bold text-gray-700 uppercase tracking-widest mt-2">Personalize a identidade e comportamento da IA</p>
                   </div>

                   <GlassCard className="!p-10 space-y-8">
                       <div className="grid grid-cols-2 gap-8">
                           <div className="space-y-2">
                               <label className="text-[9px] font-black uppercase text-gray-600 tracking-widest flex items-center gap-2"><Plus size={10}/> Nome do Agente</label>
                               <input type="text" value={agent.name} onChange={e => setAgent({...agent, name: e.target.value})} className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-3 px-5 outline-none focus:border-orange-500/40 font-bold text-sm" />
                           </div>
                           <div className="space-y-2">
                               <label className="text-[9px] font-black uppercase text-gray-600 tracking-widest flex items-center gap-2"><Smartphone size={10}/> Tom de Voz</label>
                               <select value={agent.tone} onChange={e => setAgent({...agent, tone: e.target.value})} className="w-full bg-black border border-white/10 rounded-xl py-3 px-5 outline-none focus:border-orange-500/40 font-bold text-sm appearance-none">
                                   <option>Profissional e prestativo</option>
                                   <option>Casual e amigável</option>
                                   <option>Consultivo e técnico</option>
                                   <option>Direto e persuasivo</option>
                               </select>
                           </div>
                       </div>

                       <div className="space-y-2">
                           <label className="text-[9px] font-black uppercase text-gray-600 tracking-widest flex items-center gap-2"><Activity size={10}/> Objetivo do Agente</label>
                           <input type="text" value={agent.objective} onChange={e => setAgent({...agent, objective: e.target.value})} className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-3 px-5 outline-none focus:border-orange-500/40 font-bold text-sm" />
                       </div>

                       <div className="space-y-2">
                           <label className="text-[9px] font-black uppercase text-gray-600 tracking-widest flex items-center gap-2"><Workflow size={10}/> Base de Conhecimento</label>
                           <textarea rows={6} value={agent.knowledgeBase} onChange={e => setAgent({...agent, knowledgeBase: e.target.value})} className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-5 px-5 outline-none focus:border-orange-500/40 font-bold text-sm custom-scrollbar" />
                       </div>

                       <div className="flex justify-end pt-4">
                           <NeonButton className="!px-10 !py-4 flex items-center gap-3"><Save size={16}/> Sincronizar com n8n Core</NeonButton>
                       </div>
                   </GlassCard>

                   <GlassCard className="!p-8 bg-orange-600/[0.02] border-orange-500/10 flex items-start gap-5">
                       <div className="p-3 bg-orange-500/10 rounded-xl text-orange-500"><BrainCircuit size={24}/></div>
                       <div className="space-y-2">
                           <div className="text-[10px] font-black uppercase italic tracking-widest text-orange-500">Master Prompt Logic</div>
                           <div className="text-[10px] text-gray-600 font-mono leading-relaxed bg-black/40 p-4 rounded-lg border border-white/5 italic">
                               "Você é o agente <b>{agent.name}</b> da empresa <b>{agent.companyName}</b>. Seu tom de voz é <b>{agent.tone}</b>. Use a base de conhecimento: <b>[KB_DATA]</b>. Se o cliente estiver na etapa <b>[STAGE]</b>, seu objetivo é levá-lo para <b>[NEXT_STAGE]</b>. Se o cliente pedir humano, mude o status para ATENDIMENTO_HUMANO."
                           </div>
                       </div>
                   </GlassCard>
                </div>
              )}

              {/* TAB: FINANCEIRO */}
              {activeTab === 'financeiro' && (
                <div className="space-y-12">
                     <div className="text-center max-w-2xl mx-auto space-y-4">
                        <h2 className="text-4xl font-black uppercase italic tracking-tighter">Checkout <span className="text-orange-500">Stripe Secure</span></h2>
                        <p className="text-gray-600 text-xs font-medium uppercase tracking-widest">Ative sua licença v3.14 Enterprise</p>
                     </div>

                     <div className="grid grid-cols-2 gap-8 max-w-4xl mx-auto">
                        <GlassCard className="!p-10 flex flex-col justify-between border-white/10 group">
                            <div className="space-y-8">
                                <div>
                                    <div className="text-[9px] font-black text-orange-500 uppercase tracking-[0.4em] mb-4 italic">Plano Pro Mensal</div>
                                    <div className="text-6xl font-black italic tracking-tighter">R$ 89,<span className="text-2xl">90</span></div>
                                    <div className="text-[9px] font-bold text-gray-700 uppercase mt-4">Renovação Automática</div>
                                </div>
                                <ul className="space-y-4">
                                    {['05 Evolution Nodes', 'CRM Kanban Realtime', 'n8n Webhook Bridge', 'Neural Sentiments'].map((f, i) => (
                                        <li key={i} className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-tight text-gray-500">
                                            <CheckCircle2 size={12} className="text-orange-500" /> {f}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <NeonButton className="w-full !py-5 mt-12">Ativar Via Stripe</NeonButton>
                        </GlassCard>

                        <GlassCard className="!p-10 flex flex-col justify-between border-orange-500/20 bg-orange-600/[0.02] relative">
                            <div className="absolute top-6 right-6 px-3 py-1 glass rounded-full text-[8px] font-black uppercase text-orange-500 animate-pulse italic">Best Flow</div>
                            <div className="space-y-8">
                                <div>
                                    <div className="text-[9px] font-black text-orange-500 uppercase tracking-[0.4em] mb-4 italic">Anual WayFlow Elite</div>
                                    <div className="text-6xl font-black italic tracking-tighter">R$ 863,<span className="text-2xl">04</span></div>
                                    <div className="text-[9px] font-bold text-gray-700 uppercase mt-4">Economize R$ 215,76 ao ano</div>
                                </div>
                                <ul className="space-y-4">
                                    {['Tudo do Pro', 'Instâncias Ilimitadas', 'Custom Domain (White-label)', 'Suporte Master 1:1'].map((f, i) => (
                                        <li key={i} className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-tight text-gray-400">
                                            <CheckCircle2 size={12} className="text-orange-500" /> {f}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <NeonButton className="w-full !py-5 mt-12">Ativar Elite Anual</NeonButton>
                        </GlassCard>
                     </div>
                </div>
              )}

              {/* TAB: ADMIN (EXCLUSIVO MASTER) */}
              {activeTab === 'admin' && user.isAdmin && (
                <div className="space-y-10">
                    <div className="flex justify-between items-center">
                        <h2 className="text-3xl font-black uppercase italic tracking-tighter">Engine <span className="text-orange-500">Master Control</span></h2>
                        <div className="flex gap-4">
                             <GlassCard className="!px-6 !py-3 flex flex-col items-center">
                                 <span className="text-[8px] font-bold text-gray-700 uppercase">Total Clientes</span>
                                 <span className="text-lg font-black italic">1.248</span>
                             </GlassCard>
                             <GlassCard className="!px-6 !py-3 flex flex-col items-center">
                                 <span className="text-[8px] font-bold text-gray-700 uppercase">Revenue Live</span>
                                 <span className="text-lg font-black italic text-orange-500">R$ 112.2k</span>
                             </GlassCard>
                        </div>
                    </div>
                    <GlassCard className="!p-0 border-white/5 overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-white/[0.02] border-b border-white/5">
                                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-700 italic">User Handle</th>
                                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-700 italic">Tier</th>
                                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-700 italic">Status</th>
                                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-700 italic text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 font-mono text-[10px]">
                                {[1, 2, 3, 4, 5].map(i => (
                                    <tr key={i} className="hover:bg-white/[0.01] transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-white uppercase tracking-tight">WayFlow_Enterprise_{i}</div>
                                            <div className="text-[8px] text-gray-700 uppercase mt-0.5 tracking-tighter italic">client_{i}@engine.ia</div>
                                        </td>
                                        <td className="px-6 py-4"><span className="text-[8px] font-black uppercase px-2 py-0.5 glass rounded text-blue-500">ELITE ANUAL</span></td>
                                        <td className="px-6 py-4 flex items-center gap-2 pt-5"><div className="w-1.5 h-1.5 rounded-full bg-green-500"></div> SINC</td>
                                        <td className="px-6 py-4 text-right"><button className="text-[8px] font-black uppercase text-orange-500 hover:text-white transition-colors underline underline-offset-4">Gerenciar</button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </GlassCard>
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* MODAL: QR CODE (MOCKUP EVOLUTION) */}
      <AnimatePresence>
        {showQrModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}>
              <GlassCard className="!p-12 max-w-sm text-center space-y-8 relative">
                <button onClick={() => setShowQrModal(false)} className="absolute top-6 right-6 text-gray-600 hover:text-white"><Plus className="rotate-45"/></button>
                <div>
                  <h3 className="text-xl font-black uppercase italic tracking-tighter italic">Conexão <span className="text-orange-500">Evolution</span></h3>
                  <p className="text-[9px] font-bold text-gray-700 uppercase tracking-widest mt-2 italic">Aponte seu WhatsApp para o cluster</p>
                </div>
                <div className="w-48 h-48 mx-auto bg-white p-4 rounded-2xl shadow-2xl shadow-orange-500/10">
                    <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=WayFlowNeuralConnection_v3" alt="QR Code Mock" className="w-full h-full grayscale contrast-125" />
                </div>
                <div className="flex items-center justify-center gap-3 text-[10px] font-bold text-orange-500 uppercase italic animate-pulse">
                  <Activity size={12}/> Aguardando Handshake...
                </div>
                <p className="text-[8px] text-gray-600 font-medium leading-relaxed">
                  Ao conectar, a IA WayFlow assumirá automaticamente as conversas pendentes conforme configurado no n8n.
                </p>
              </GlassCard>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
