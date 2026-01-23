
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, MessageSquare, Users, CreditCard, 
  Terminal, Settings, LogOut, Search, Smartphone,
  User as UserIcon, Activity, Workflow, Plus, Trash2, 
  QrCode, ChevronRight, Filter, Crown, Share2, BrainCircuit,
  Pause, Play, Save, CheckCircle2, AlertCircle, Ban, Zap, Send
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { UserSession, DashboardTab, EvolutionInstance, Lead, AgentIA, Sentiment, SystemMessage } from '../types';
import { GlassCard } from '../components/GlassCard';
import { GlassButton, NeonButton } from '../components/Buttons';
import { Logo } from '../components/Logo';

export function Dashboard({ user, onLogout }: { user: UserSession; onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState<DashboardTab>(user.isAdmin ? 'admin' : 'overview');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  
  // -- State: Admin Users Management (Mock) --
  const [systemUsers, setSystemUsers] = useState([
    { id: 'u1', name: 'PetShop Central', email: 'contato@petflow.com', status: 'ACTIVE', plan: 'Enterprise', mrr: 89 },
    { id: 'u2', name: 'Imobiliária Vision', email: 'admin@vision.imobi', status: 'TRIALING', plan: 'Trial 15d', mrr: 0 },
    { id: 'u3', name: 'Alpha Automotiva', email: 'financeiro@alpha.br', status: 'INACTIVE', plan: 'Enterprise', mrr: 89 }
  ]);

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

  const stages: {id: Lead['stage'], label: string}[] = [
    { id: 'novo', label: 'Novo Lead' },
    { id: 'qualificado', label: 'Qualificado' },
    { id: 'agendado', label: 'Agendado' },
    { id: 'fechado', label: 'Fechado' }
  ];

  const onDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    const updatedLeads = leads.map(l => l.id === draggableId ? { ...l, stage: destination.droppableId as Lead['stage'] } : l);
    setLeads(updatedLeads);
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
              <div className="px-5 mb-2 text-[7px] font-black uppercase tracking-[0.3em] text-orange-500/50">Master Admin</div>
              <SidebarBtn id="admin" icon={Crown} label="Gestão Clientes" isAdmin />
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
                  <div className="text-[7px] text-orange-500 font-black uppercase tracking-widest mt-1">{user.isAdmin ? 'NEURAL MASTER' : 'OPERADOR ELITE'}</div>
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
                   <div className="flex justify-between items-end">
                      <h2 className="text-4xl font-black uppercase italic tracking-tighter">Status <span className="text-orange-500">Neural</span></h2>
                      <div className="glass px-4 py-2 rounded-xl border-orange-500/20 text-[9px] font-black text-orange-500 uppercase tracking-widest animate-pulse">
                         {user.subscriptionStatus === 'TRIALING' ? 'Período Trial Ativo: 14 dias restantes' : 'Licença Enterprise Ativa'}
                      </div>
                   </div>

                   {/* Inbox de Mensagens do Sistema */}
                   {user.messages && user.messages.length > 0 && (
                     <div className="space-y-4">
                        <div className="text-[9px] font-black uppercase text-gray-700 tracking-[0.4em] italic">Alertas do Comando Central</div>
                        {user.messages.map(msg => (
                          <GlassCard key={msg.id} className="!p-4 border-orange-500/30 bg-orange-500/[0.03] flex items-center gap-4">
                             <div className="p-2 bg-orange-500/10 rounded-lg text-orange-500"><AlertCircle size={18}/></div>
                             <div className="text-[11px] font-bold text-gray-300 italic">"{msg.text}"</div>
                          </GlassCard>
                        ))}
                     </div>
                   )}

                   <div className="grid grid-cols-4 gap-6">
                      {[
                        { l: 'MRR Individual', v: user.isAdmin ? 'R$ 112k' : 'R$ 89,00', t: 'Stripe Active', c: 'text-green-500' },
                        { l: 'Nodes Conectados', v: '04', t: 'Evolution Core', c: 'text-blue-500' },
                        { l: 'Processamento IA', v: '1.2k', t: 'Hits/Dia', c: 'text-orange-500' },
                        { l: 'Confiabilidade', v: '99.9%', t: 'SLA Cluster', c: 'text-purple-500' }
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

              {/* --- ADMIN MASTER CONTROL --- */}
              {activeTab === 'admin' && user.isAdmin && (
                <div className="space-y-10">
                    <div className="flex justify-between items-center">
                        <h2 className="text-3xl font-black uppercase italic tracking-tighter">Engine <span className="text-orange-500">Master Control</span></h2>
                        <div className="flex gap-4">
                             <GlassCard className="!px-6 !py-3 flex flex-col items-center">
                                 <span className="text-[8px] font-bold text-gray-700 uppercase">Total Clientes</span>
                                 <span className="text-lg font-black italic">1.248</span>
                             </GlassCard>
                             <GlassCard className="!px-6 !py-3 border-orange-500/20 flex flex-col items-center">
                                 <span className="text-[8px] font-bold text-gray-700 uppercase">Revenue Stripe</span>
                                 <span className="text-lg font-black italic text-orange-500">R$ 112.2k</span>
                             </GlassCard>
                        </div>
                    </div>

                    {/* Broadcast System */}
                    <GlassCard className="!p-8 border-blue-500/20 bg-blue-500/[0.01] space-y-4">
                        <div className="flex items-center gap-3 text-blue-500">
                           <Zap size={20} />
                           <span className="text-[10px] font-black uppercase tracking-[0.4em] italic">Neural Broadcast (Mensagem Global)</span>
                        </div>
                        <div className="flex gap-4">
                           <input 
                              placeholder="Digite o comando para todos os dashboards de usuários..."
                              value={broadcastMessage}
                              onChange={e => setBroadcastMessage(e.target.value)}
                              className="flex-1 bg-white/[0.03] border border-white/10 rounded-xl py-4 px-6 outline-none focus:border-blue-500/40 font-bold text-sm italic"
                           />
                           <NeonButton 
                              onClick={() => {
                                 alert(`Mensagem enviada para todos os clusters: ${broadcastMessage}`);
                                 setBroadcastMessage('');
                              }} 
                              className="!px-8 flex items-center gap-3"
                           >
                              <Send size={16}/> Enviar
                           </NeonButton>
                        </div>
                    </GlassCard>

                    <div className="grid grid-cols-1 gap-6">
                        <div className="text-[9px] font-black uppercase text-gray-700 tracking-[0.5em] italic ml-2">Gerenciamento de Licenças e Pagamentos</div>
                        <GlassCard className="!p-0 border-white/5 overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-white/[0.02] border-b border-white/5">
                                        <th className="px-6 py-5 text-[9px] font-black uppercase tracking-widest text-gray-700 italic">Cliente / Empresa</th>
                                        <th className="px-6 py-5 text-[9px] font-black uppercase tracking-widest text-gray-700 italic">Status Stripe</th>
                                        <th className="px-6 py-5 text-[9px] font-black uppercase tracking-widest text-gray-700 italic">MRR</th>
                                        <th className="px-6 py-5 text-[9px] font-black uppercase tracking-widest text-gray-700 italic text-right">Ações de Controle</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 font-mono text-[10px]">
                                    {systemUsers.map(u => (
                                        <tr key={u.id} className="hover:bg-white/[0.01] transition-colors group">
                                            <td className="px-6 py-5">
                                                <div className="font-bold text-white uppercase tracking-tight">{u.name}</div>
                                                <div className="text-[8px] text-gray-700 uppercase mt-0.5 tracking-tighter italic">{u.email}</div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded border ${
                                                  u.status === 'ACTIVE' ? 'text-green-500 border-green-500/20 bg-green-500/5' :
                                                  u.status === 'TRIALING' ? 'text-blue-500 border-blue-500/20 bg-blue-500/5' :
                                                  'text-red-500 border-red-500/20 bg-red-500/5'
                                                }`}>
                                                  {u.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-5 font-black text-gray-400">R$ {u.mrr},00</td>
                                            <td className="px-6 py-5 text-right space-x-3">
                                                <button className="text-[9px] font-black uppercase text-gray-600 hover:text-white transition-all underline underline-offset-4">
                                                   Stripe Link
                                                </button>
                                                <button 
                                                  onClick={() => alert(`Alterando status de ${u.name}`)}
                                                  className={`p-2 rounded-lg border transition-all ${
                                                   u.status === 'ACTIVE' ? 'text-red-500 border-red-500/10 hover:bg-red-500/10' : 'text-green-500 border-green-500/10 hover:bg-green-500/10'
                                                  }`}
                                                >
                                                   {u.status === 'ACTIVE' ? <Ban size={14}/> : <CheckCircle2 size={14}/>}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </GlassCard>
                    </div>
                </div>
              )}

              {/* --- OUTRAS TABS (Mantendo Funcionalidade) --- */}
              {activeTab === 'atendimento' && (
                <div className="h-full flex flex-col gap-6">
                    <h2 className="text-3xl font-black uppercase italic tracking-tighter italic">Kanban <span className="text-orange-500">Pipeline</span></h2>
                    <DragDropContext onDragEnd={onDragEnd}>
                        <div className="flex-1 flex gap-6 overflow-x-auto pb-4 no-scrollbar">
                            {stages.map((stage) => (
                                <Droppable key={stage.id} droppableId={stage.id}>
                                    {(provided) => (
                                        <div {...provided.droppableProps} ref={provided.innerRef} className="min-w-[320px] flex flex-col gap-4 bg-white/[0.01] rounded-2xl p-4 border border-white/5">
                                            <div className="flex justify-between items-center mb-2 px-2">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 italic">{stage.label}</span>
                                            </div>
                                            <div className="space-y-4">
                                                {leads.filter(l => l.stage === stage.id).map((lead, index) => (
                                                    <Draggable key={lead.id} draggableId={lead.id} index={index}>
                                                        {(provided) => (
                                                            <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}>
                                                                <GlassCard className={`!p-5 space-y-4 ${lead.isPaused ? 'border-orange-500/40 bg-orange-600/[0.02]' : ''}`}>
                                                                    <div className="text-[11px] font-black uppercase italic">{lead.name}</div>
                                                                    <div className="text-[8px] text-gray-700 font-bold uppercase">{lead.phone}</div>
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

              {/* ... Outras abas ... */}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
