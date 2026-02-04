
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageSquare, LogOut, Plus, Loader2, RefreshCw, 
  Trash2, X, Layers, Search, Send, CheckCircle2, 
  Smartphone, ShieldCheck, ChevronLeft, ChevronRight,
  Bot, Zap, Activity, AlertCircle, Paperclip, MoreVertical,
  Settings, LayoutDashboard, Globe, User, Terminal, AlertTriangle,
  LayoutGrid, Target, DollarSign, Filter, Sliders, Bell, Brain,
  Trophy, TrendingUp, Sparkles, Hash, Power, UserCheck, Star,
  Calendar, GripVertical, Smile, Image as ImageIcon, Mic, Phone, ArrowRight,
  Database, Link2
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { UserSession, DashboardTab, EvolutionInstance, Ticket, Message, KanbanColumn } from '../types';
import { GlassCard } from '../components/GlassCard';
import { NeonButton, GlassButton } from '../components/Buttons';
import { Logo } from '../components/Logo';

interface DashboardProps {
  user: UserSession;
  onLogout: () => void;
  onCheckout?: () => void;
}

const EVOLUTION_URL = 'https://evo2.wayiaflow.com.br';
const EVOLUTION_API_KEY = 'd86920ba398e31464c46401214779885';
const HEADERS = { 'apikey': EVOLUTION_API_KEY, 'Content-Type': 'application/json' };

const KANBAN_COLS: KanbanColumn[] = [
  { id: 'novo', title: 'Novos Leads', color: 'text-gray-400' },
  { id: 'em_atendimento', title: 'Em Atendimento', color: 'text-orange-400' },
  { id: 'ganho', title: 'Conversão', color: 'text-green-400' }
];

export function Dashboard({ user, onLogout }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<DashboardTab>('integracoes');
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [instances, setInstances] = useState<EvolutionInstance[]>([]);
  const [leads, setLeads] = useState<Ticket[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [newInstanceName, setNewInstanceName] = useState('');
  const [isCreatingInstance, setIsCreatingInstance] = useState(false);
  const [qrModal, setQrModal] = useState({ isOpen: false, code: '', name: '', status: '', connected: false });

  const chatEndRef = useRef<HTMLDivElement>(null);

  // --- EVOLUTION API CORE ---

  const fetchInstances = async () => {
    try {
      const res = await fetch(`${EVOLUTION_URL}/instance/fetchInstances`, { headers: HEADERS });
      if (!res.ok) throw new Error('Falha ao buscar motores');
      const data = await res.json();
      
      const raw = Array.isArray(data) ? data : (data.instances || []);
      const mapped: EvolutionInstance[] = raw.map((i: any) => {
        const instData = i.instance || i;
        return {
          id: instData.instanceName || instData.id,
          name: instData.instanceName,
          status: (instData.status === 'open' || instData.connectionStatus === 'open') ? 'CONNECTED' : 'DISCONNECTED',
          phone: instData.ownerJid ? instData.ownerJid.split('@')[0] : 'Motor em Standby',
          profilePicUrl: instData.profilePicUrl || ""
        };
      });
      setInstances(mapped);
    } catch (e) {
      console.error('Fetch Error:', e);
    }
  };

  const createInstance = async () => {
    if (!newInstanceName.trim()) {
      alert("Defina uma identidade para o motor neural.");
      return;
    }
    
    setIsCreatingInstance(true);
    const sanitizedName = newInstanceName.trim().toLowerCase().replace(/\s+/g, '-');
    
    try {
      // 1. Inicia o modal imediatamente para feedback tátil
      setQrModal({ 
        isOpen: true, 
        code: '', 
        name: sanitizedName, 
        status: 'Injetando no Cluster...', 
        connected: false 
      });

      const res = await fetch(`${EVOLUTION_URL}/instance/create`, {
        method: 'POST', 
        headers: HEADERS, 
        body: JSON.stringify({ 
          instanceName: sanitizedName, 
          token: Math.random().toString(36).substring(7),
          qrcode: true 
        })
      });
      
      if (res.ok) {
        setNewInstanceName('');
        // 2. Aguarda um curto período de "aquecimento" do motor
        setQrModal(p => ({ ...p, status: 'Aquecendo Motor Neural...' }));
        
        // 3. Tenta conectar com pooling (Causa raiz: delay de inicialização)
        let attempts = 0;
        const tryConnect = async () => {
          const connected = await connectInstance(sanitizedName, true);
          if (!connected && attempts < 5) {
            attempts++;
            setTimeout(tryConnect, 2000);
          }
        };
        setTimeout(tryConnect, 1500);
        await fetchInstances();
      } else {
        const err = await res.json();
        setQrModal(p => ({ ...p, isOpen: false }));
        alert(`Erro Evolution: ${err.message || 'Falha ao injetar motor'}`);
      }
    } catch (e) { 
      setQrModal(p => ({ ...p, isOpen: false }));
      alert("Falha crítica na rede neural.");
    } finally { 
      setIsCreatingInstance(false); 
    }
  };

  const connectInstance = async (name: string, isSilent: boolean = false) => {
    if (!isSilent) {
      setQrModal({ isOpen: true, name, status: 'Gerando Handshake QR...', code: '', connected: false });
    }
    
    try {
      const res = await fetch(`${EVOLUTION_URL}/instance/connect/${name}`, { headers: HEADERS });
      const data = await res.json();
      
      const qrCode = data.base64 || (data.qrcode && data.qrcode.base64) || data.code;
      
      if (qrCode) {
        setQrModal(p => ({ ...p, code: qrCode, status: 'Escaneie para Conectar' }));
        return true;
      } else if (data.status === 'open' || data.connectionStatus === 'open') {
        setQrModal(p => ({ ...p, status: 'Motor já está operacional.', connected: true }));
        fetchInstances();
        return true;
      }
      return false;
    } catch (e) { 
      if (!isSilent) setQrModal(p => ({ ...p, status: 'Erro na conexão neural.' }));
      return false;
    }
  };

  const deleteInstance = async (name: string) => {
    if (!confirm(`Confirmar desativação definitiva do motor ${name}?`)) return;
    
    try {
      const res = await fetch(`${EVOLUTION_URL}/instance/delete/${name}`, { 
        method: 'DELETE', 
        headers: HEADERS 
      });
      
      if (res.ok) {
        setInstances(prev => prev.filter(i => i.name !== name));
        await fetchInstances();
      }
    } catch (e) { 
      console.error('Delete Error:', e);
    }
  };

  const syncChats = async () => {
    if (instances.length === 0) return;
    setIsSyncing(true);
    try {
      const conn = instances.filter(i => i.status === 'CONNECTED');
      let all: Ticket[] = [];
      
      for (const inst of conn) {
        try {
          const res = await fetch(`${EVOLUTION_URL}/chat/findChats/${inst.name}`, { 
            method: 'POST', 
            headers: HEADERS 
          });
          const data = await res.json();
          const items = data.data || data.chats || [];
          
          items.forEach((item: any) => {
            all.push({
              id: item.jid,
              contactName: item.pushName || item.name || item.jid.split('@')[0],
              contactPhone: item.jid.split('@')[0],
              avatar: item.profilePicUrl || "",
              lastMessage: item.message?.conversation || item.message?.extendedTextMessage?.text || "Atividade neural",
              time: "Agora",
              status: 'novo',
              unreadCount: item.unreadCount || 0,
              assignedTo: 'IA Central',
              protocol: 'NX-' + Math.floor(Math.random() * 9000),
              messages: [],
              instanceSource: inst.name,
              sentiment: 'neutral',
              value: Math.floor(Math.random() * 1000)
            });
          });
        } catch (e) {}
      }
      setLeads(all);
    } catch (e) {} finally { setIsSyncing(false); }
  };

  useEffect(() => {
    fetchInstances();
    const interval = setInterval(fetchInstances, 30000); 
    return () => clearInterval(interval);
  }, []);

  useEffect(() => { 
    if (instances.some(i => i.status === 'CONNECTED')) syncChats(); 
  }, [instances.filter(i => i.status === 'CONNECTED').length]);

  const handleSend = async () => {
    const lead = leads.find(l => l.id === selectedLeadId);
    if (!lead || !messageInput.trim()) return;
    
    const text = messageInput;
    setMessageInput('');

    try {
      const res = await fetch(`${EVOLUTION_URL}/message/sendText/${lead.instanceSource}`, {
        method: 'POST', 
        headers: HEADERS, 
        body: JSON.stringify({ number: lead.id, text: text, delay: 1000 })
      });
      if (res.ok) {
        setChatMessages(prev => [...prev, {
          id: Date.now().toString(), 
          text, 
          sender: 'me', 
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 
          status: 'sent', 
          type: 'text'
        }]);
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      }
    } catch (e) { console.error(e); }
  };

  const onDragEnd = (result: any) => {
    if (!result.destination) return;
    const { source, destination, draggableId } = result;
    if (source.droppableId === destination.droppableId) return;
    setLeads(prev => prev.map(l => l.id === draggableId ? { ...l, status: destination.droppableId as any } : l));
  };

  const SidebarItem = ({ icon: Icon, label, badge, active, onClick }: any) => (
    <button 
      onClick={onClick}
      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all group ${active ? 'bg-orange-500/10 text-orange-500 border border-orange-500/20 shadow-[0_0_15px_rgba(255,115,0,0.1)]' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
    >
      <div className="flex items-center gap-3">
        <Icon size={18} className={active ? 'text-orange-500' : 'text-gray-500 group-hover:text-orange-500 transition-colors'} />
        {isSidebarExpanded && <span className="text-[11px] font-black uppercase tracking-widest">{label}</span>}
      </div>
      {isSidebarExpanded && badge && <span className="text-[9px] font-black text-white bg-orange-600 px-2 py-0.5 rounded-full">{badge}</span>}
    </button>
  );

  return (
    <div className="flex h-screen bg-[#050505] text-white overflow-hidden font-sans relative">
      <div className="fixed inset-0 grid-engine pointer-events-none opacity-10"></div>
      
      {/* SIDEBAR */}
      <aside className={`flex flex-col border-r border-white/5 bg-black/40 backdrop-blur-xl transition-all duration-300 z-50 ${isSidebarExpanded ? 'w-64' : 'w-20'}`}>
        <div className="p-8 flex items-center justify-between">
          <Logo size="sm" onClick={() => setActiveTab('overview')} />
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-6 space-y-8">
          <div>
            {isSidebarExpanded && <div className="px-4 text-[9px] font-black uppercase text-orange-500/50 tracking-[0.4em] mb-4 italic">Painel de Controle</div>}
            <SidebarItem icon={LayoutDashboard} label="Visão Geral" active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} />
            <SidebarItem icon={MessageSquare} label="Atendimento" active={activeTab === 'atendimento'} onClick={() => setActiveTab('atendimento')} badge={leads.length} />
            <SidebarItem icon={Layers} label="Pipeline" active={activeTab === 'kanban'} onClick={() => setActiveTab('kanban')} />
          </div>

          <div>
            {isSidebarExpanded && <div className="px-4 text-[9px] font-black uppercase text-orange-500/50 tracking-[0.4em] mb-4 italic">Infraestrutura</div>}
            <SidebarItem icon={Smartphone} label="Engines" active={activeTab === 'integracoes'} onClick={() => setActiveTab('integracoes')} badge={instances.length} />
            <SidebarItem icon={Bot} label="Agentes IA" active={activeTab === 'agentes'} onClick={() => setActiveTab('agentes')} />
          </div>
        </div>

        <div className="p-4 border-t border-white/5 bg-black/20">
          <button onClick={onLogout} className="w-full flex items-center gap-3 px-4 py-4 text-gray-600 hover:text-orange-500 transition-all group">
            <LogOut size={18} className="group-hover:-translate-x-1 transition-transform" />
            {isSidebarExpanded && <span className="text-[10px] font-black uppercase tracking-widest">Sair do Cluster</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 bg-transparent">
        <header className="h-20 border-b border-white/5 bg-black/20 backdrop-blur-md flex items-center justify-between px-10 shrink-0 z-40">
          <div className="flex items-center gap-6">
            <button onClick={() => setIsSidebarExpanded(!isSidebarExpanded)} className="p-2 glass rounded-lg text-orange-500 hover:scale-110 transition-all">
              <ChevronLeft size={16} className={!isSidebarExpanded ? 'rotate-180' : ''} />
            </button>
            <div className="flex flex-col">
              <h2 className="text-xs font-black uppercase tracking-[0.3em] text-white italic">
                {activeTab === 'atendimento' ? 'Terminal Atendimento' : activeTab === 'kanban' ? 'Fluxo de Escala' : activeTab === 'integracoes' ? 'Neural Connection Cluster' : 'Dashboard Master'}
              </h2>
              <span className="text-[8px] font-bold text-orange-500 uppercase tracking-widest opacity-60 italic">Engines operando em alta frequência</span>
            </div>
          </div>

          <div className="flex items-center gap-8">
            <button onClick={() => {fetchInstances(); syncChats();}} className={`p-2 glass rounded-xl text-gray-500 hover:text-orange-500 transition-all ${isSyncing ? 'animate-spin text-orange-500' : ''}`}><RefreshCw size={16}/></button>
            <div className="hidden lg:flex items-center gap-3 glass px-4 py-2 rounded-full border-orange-500/10">
               <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_10px_green]" />
               <span className="text-[9px] font-black uppercase tracking-widest text-green-500">{instances.filter(i => i.status === 'CONNECTED').length} Engines On</span>
            </div>
            <div className="h-6 w-px bg-white/5"></div>
            <div className="flex items-center gap-4">
               <div className="text-right hidden md:block">
                  <div className="text-[10px] font-black uppercase text-white leading-none italic">{user.name}</div>
               </div>
               <div className="w-10 h-10 rounded-xl bg-rajado p-0.5 shadow-lg shadow-orange-500/20">
                  <div className="w-full h-full bg-black rounded-[9px] flex items-center justify-center text-xs font-black italic">
                    {user.name?.[0]}
                  </div>
               </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-10">
           
           {/* VIEW: ENGINES (Destaque para o nome e botão de atualizar) */}
           {activeTab === 'integracoes' && (
             <div className="max-w-6xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="flex flex-col md:flex-row justify-between items-end gap-6">
                  <div>
                    <h1 className="text-5xl font-black uppercase italic tracking-tighter mb-2">Neural <span className="text-orange-500">Engines.</span></h1>
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-700 italic">Cada Engine processa centenas de leads por hora</p>
                  </div>
                  <div className="flex gap-4 w-full md:w-auto">
                    <input 
                      value={newInstanceName} 
                      onChange={e => setNewInstanceName(e.target.value)}
                      placeholder="Identidade do Motor..." 
                      className="flex-1 md:w-80 bg-white/[0.02] border border-white/5 rounded-2xl py-4 px-6 text-[11px] font-bold uppercase outline-none focus:border-orange-500/40 shadow-inner"
                    />
                    <NeonButton onClick={createInstance} className="!px-10">
                      {isCreatingInstance ? <Loader2 className="animate-spin" size={16}/> : <><Plus size={16} className="mr-2"/> Adicionar Motor</>}
                    </NeonButton>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                   {instances.map(inst => (
                     <GlassCard key={inst.id} className="!p-8 group hover:border-orange-500/40 transition-all relative overflow-hidden bg-gradient-to-br from-white/[0.02] to-transparent">
                        <div className="flex flex-col gap-8 relative z-10">
                           <div className="flex items-center gap-6">
                              <div className="relative">
                                 <div className="w-16 h-16 rounded-2xl bg-black border border-white/5 flex items-center justify-center overflow-hidden shadow-2xl">
                                    {inst.profilePicUrl ? <img src={inst.profilePicUrl} className="w-full h-full object-cover" /> : <Smartphone size={28} className="text-gray-800" />}
                                 </div>
                                 <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-4 border-[#050505] ${inst.status === 'CONNECTED' ? 'bg-green-500 shadow-[0_0_15px_green]' : 'bg-red-500 shadow-[0_0_15px_red]'}`} />
                              </div>
                              <div className="flex-1 overflow-hidden">
                                 <div className="text-2xl font-black uppercase italic tracking-tighter text-white truncate">{inst.name}</div>
                                 <div className="text-[9px] font-black text-gray-700 tracking-[0.2em] uppercase mt-1 italic">{inst.phone}</div>
                              </div>
                           </div>

                           <div className="flex gap-4">
                              {inst.status === 'DISCONNECTED' ? (
                                <NeonButton onClick={() => connectInstance(inst.name)} className="flex-1 !py-3 !text-[9px] shadow-lg">Handshake QR</NeonButton>
                              ) : (
                                <div className="flex-1 py-3 text-center border border-green-500/20 rounded-xl text-green-500 text-[9px] font-black uppercase tracking-widest bg-green-500/5 flex items-center justify-center gap-2">
                                  <CheckCircle2 size={12}/> Operacional
                                </div>
                              )}
                              
                              {/* BOTÃO ATUALIZAR CONEXÃO */}
                              <button 
                                onClick={() => connectInstance(inst.name)} 
                                title="Atualizar Handshake" 
                                className="p-4 rounded-2xl bg-white/[0.03] text-gray-500 hover:text-orange-500 hover:border-orange-500/30 transition-all border border-white/5"
                              >
                                <Zap size={18}/>
                              </button>

                              <button 
                                onClick={() => deleteInstance(inst.name)} 
                                title="Remover Engine" 
                                className="p-4 rounded-2xl bg-red-600/10 text-red-500 hover:bg-red-600 hover:text-white transition-all border border-red-500/10"
                              >
                                <Trash2 size={18}/>
                              </button>
                           </div>
                        </div>
                        <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity pointer-events-none"><Zap size={80}/></div>
                     </GlassCard>
                   ))}

                   {instances.length === 0 && (
                     <div className="col-span-full py-20 text-center opacity-30">
                        <Database size={32} className="mx-auto mb-6" />
                        <p className="text-[10px] font-black uppercase tracking-widest italic">Nenhum motor neural detectado</p>
                     </div>
                   )}
                </div>
             </div>
           )}

           {/* VIEW: ATENDIMENTO */}
           {activeTab === 'atendimento' && (
             <div className="h-[calc(100vh-220px)] flex glass rounded-[2.5rem] border-white/5 overflow-hidden shadow-2xl animate-in zoom-in-95 duration-500">
                <div className="w-[400px] border-r border-white/5 flex flex-col bg-black/40">
                   <header className="p-8 border-b border-white/5 bg-black/20 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                         <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                         <span className="text-[11px] font-black uppercase tracking-[0.4em] italic text-orange-500">Threads Ativas</span>
                      </div>
                      <button onClick={syncChats} className={`p-2 glass rounded-xl text-gray-600 hover:text-orange-500 transition-all ${isSyncing ? 'animate-spin' : ''}`}><RefreshCw size={14}/></button>
                   </header>
                   <div className="p-6">
                      <div className="relative">
                         <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-800" size={14} />
                         <input placeholder="Buscar Leads..." className="w-full bg-white/[0.02] border border-white/5 rounded-2xl py-4 pl-12 pr-6 text-[10px] font-black uppercase outline-none focus:border-orange-500/30 transition-all" />
                      </div>
                   </div>
                   <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-4 space-y-2">
                      {leads.map(lead => (
                        <button key={lead.id} onClick={() => setSelectedLeadId(lead.id)} className={`w-full flex items-center gap-4 p-5 rounded-[2rem] transition-all text-left border ${selectedLeadId === lead.id ? 'bg-orange-500/10 border-orange-500/20 shadow-xl' : 'border-transparent hover:bg-white/[0.03]'}`}>
                           <div className="w-12 h-12 rounded-2xl bg-black flex items-center justify-center text-orange-500 font-black italic border border-white/5 overflow-hidden">
                              {lead.avatar ? <img src={lead.avatar} className="w-full h-full object-cover" /> : lead.contactName[0]}
                           </div>
                           <div className="flex-1 overflow-hidden">
                              <div className="flex justify-between items-center mb-1">
                                 <span className="text-[12px] font-black uppercase italic truncate text-white tracking-tighter">{lead.contactName}</span>
                                 <span className="text-[7px] text-gray-700 font-black">{lead.time}</span>
                              </div>
                              <p className="text-[9px] text-gray-600 italic truncate leading-relaxed">"{lead.lastMessage}"</p>
                              <div className="mt-2 flex items-center gap-3">
                                 <div className="px-2 py-0.5 rounded-full bg-orange-500/10 text-[6px] font-black uppercase text-orange-500 tracking-widest border border-orange-500/10 italic">{lead.instanceSource}</div>
                              </div>
                           </div>
                        </button>
                      ))}
                   </div>
                </div>

                <div className="flex-1 flex flex-col bg-black/60 relative">
                   {selectedLeadId ? (
                     <div className="flex-1 flex flex-col h-full">
                        <header className="p-8 border-b border-white/5 bg-black/40 backdrop-blur-3xl flex items-center justify-between shadow-2xl z-10">
                           <div className="flex items-center gap-6">
                              <div className="w-14 h-14 rounded-2xl bg-black flex items-center justify-center text-orange-500 font-black italic border border-orange-500/20 shadow-2xl overflow-hidden">
                                 {leads.find(l => l.id === selectedLeadId)?.avatar ? <img src={leads.find(l => l.id === selectedLeadId)?.avatar} className="w-full h-full object-cover" /> : <User size={24}/>}
                              </div>
                              <div>
                                 <h4 className="text-2xl font-black uppercase italic tracking-tighter text-white">{leads.find(l => l.id === selectedLeadId)?.contactName}</h4>
                                 <div className="flex items-center gap-4 mt-1">
                                    <span className="text-[9px] font-black text-gray-700 tracking-[0.2em] italic">{leads.find(l => l.id === selectedLeadId)?.contactPhone}</span>
                                 </div>
                              </div>
                           </div>
                        </header>

                        <div className="flex-1 overflow-y-auto p-12 space-y-8 custom-scrollbar">
                           {chatMessages.map((m, idx) => (
                             <div key={idx} className={`flex ${m.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[75%] p-6 rounded-[2.5rem] shadow-2xl relative ${m.sender === 'me' ? 'bg-orange-600 text-white rounded-br-none shadow-orange-900/20' : 'bg-white/[0.03] text-gray-100 border border-white/5 rounded-bl-none'}`}>
                                   <p className="text-[14px] font-medium leading-relaxed tracking-tight">{m.text}</p>
                                   <div className="text-[7px] font-black uppercase mt-4 tracking-widest text-right opacity-30 italic">{m.time}</div>
                                </div>
                             </div>
                           ))}
                           <div ref={chatEndRef} />
                        </div>

                        <div className="p-10 border-t border-white/5 bg-black/40 backdrop-blur-3xl">
                           <div className="max-w-5xl mx-auto flex gap-6">
                              <div className="flex-1 relative">
                                 <input 
                                   value={messageInput} onChange={e => setMessageInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleSend()}
                                   placeholder="Injetar Resposta Neural..." 
                                   className="w-full bg-white/[0.02] border border-white/5 rounded-[1.8rem] py-6 px-10 text-sm font-bold uppercase outline-none focus:border-orange-500/40 transition-all placeholder:text-gray-900"
                                 />
                                 <div className="absolute right-6 top-1/2 -translate-y-1/2 flex gap-4 text-gray-900">
                                    <Smile size={20} className="cursor-pointer hover:text-orange-500 transition-colors" />
                                    <Mic size={20} className="cursor-pointer hover:text-orange-500 transition-colors" />
                                 </div>
                              </div>
                              <NeonButton onClick={handleSend} className="!p-6 !rounded-[1.8rem] shadow-2xl shadow-orange-600/30 group">
                                 <Send size={28} className="group-hover:translate-x-1 transition-transform" />
                              </NeonButton>
                           </div>
                        </div>
                     </div>
                   ) : (
                     <div className="flex-1 flex flex-col items-center justify-center text-center p-20 opacity-20">
                        <Logo size="md" className="grayscale mb-12" />
                        <h4 className="text-3xl font-black uppercase italic tracking-[0.6em] text-white">Cluster Standby</h4>
                        <p className="text-[11px] font-black text-gray-800 uppercase tracking-widest mt-8 max-w-xs italic">Aguardando thread para iniciar processamento.</p>
                     </div>
                   )}
                </div>
             </div>
           )}

           {activeTab === 'kanban' && (
             <div className="h-full animate-in slide-in-from-right-8 duration-700">
                <header className="mb-12 flex flex-col md:flex-row justify-between items-end gap-6">
                  <div>
                    <h1 className="text-5xl font-black uppercase italic tracking-tighter mb-2">Neural <span className="text-orange-500">Pipeline.</span></h1>
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-700 italic">Gestão de Leads em Massa</p>
                  </div>
                </header>

                <DragDropContext onDragEnd={onDragEnd}>
                  <div className="flex gap-10 h-full items-start overflow-x-auto custom-scrollbar pb-10">
                    {KANBAN_COLS.map(col => (
                      <div key={col.id} className="flex flex-col w-[400px] shrink-0">
                        <div className="px-8 py-5 flex items-center justify-between mb-6 glass rounded-3xl border-white/5">
                           <span className="text-[13px] font-black uppercase tracking-[0.2em] text-white italic">{col.title}</span>
                           <div className="text-[10px] font-black text-orange-500 bg-orange-500/10 px-4 py-1 rounded-full">{leads.filter(l => l.status === col.id).length}</div>
                        </div>

                        <Droppable droppableId={col.id}>
                          {(provided) => (
                            <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-6 min-h-[600px]">
                              {leads.filter(l => l.status === col.id).map((lead, index) => (
                                <Draggable key={lead.id} draggableId={lead.id} index={index}>
                                  {(provided, snapshot) => (
                                    <div 
                                      ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}
                                      className={`p-8 rounded-[2.5rem] glass shadow-2xl relative group transition-all border-white/5 ${snapshot.isDragging ? 'rotate-2 scale-105 z-[100] bg-orange-500/[0.03]' : ''}`}
                                    >
                                       <h4 className="text-lg font-black uppercase italic tracking-tighter text-white mb-2 leading-none">{lead.contactName}</h4>
                                       <p className="text-[11px] text-gray-600 line-clamp-2 italic leading-relaxed mb-8">"{lead.lastMessage}"</p>
                                       <div className="pt-8 border-t border-white/5 flex items-center justify-between">
                                          <div className="text-sm font-black text-orange-500 italic">R$ {lead.value},00</div>
                                          <button onClick={() => {setSelectedLeadId(lead.id); setActiveTab('atendimento');}} className="p-2 glass rounded-xl text-orange-500 hover:scale-110"><ArrowRight size={18}/></button>
                                       </div>
                                    </div>
                                  )}
                                </Draggable>
                              ))}
                              {provided.placeholder}
                            </div>
                          )}
                        </Droppable>
                      </div>
                    ))}
                  </div>
                </DragDropContext>
             </div>
           )}

        </div>
      </main>

      {/* QR MODAL (Redesenhado para máxima fidelidade) */}
      <AnimatePresence>
        {qrModal.isOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-8 bg-black/98 backdrop-blur-3xl">
            <div className="bg-[#050505] border border-orange-500/30 p-16 rounded-[4rem] text-center max-w-lg w-full relative shadow-[0_0_150px_rgba(255,115,0,0.15)] animate-in zoom-in-95 duration-500">
              <button onClick={() => setQrModal(p => ({ ...p, isOpen: false }))} className="absolute top-12 right-12 text-gray-800 hover:text-white p-3 hover:bg-white/5 rounded-full transition-all"><X size={32}/></button>
              
              <div className="mb-10">
                <h3 className="text-4xl font-black uppercase italic mb-2 tracking-tighter text-white">Engine: {qrModal.name}</h3>
                <div className="flex items-center justify-center gap-3">
                   <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                   <p className="text-[11px] font-black uppercase text-orange-500 tracking-[0.4em] italic">{qrModal.status}</p>
                </div>
              </div>

              <div className="relative mb-12">
                 <div className="bg-white p-12 rounded-[3.5rem] flex items-center justify-center min-h-[350px] shadow-inner overflow-hidden border-8 border-white/5">
                    {qrModal.code ? (
                      <motion.img 
                        initial={{ opacity: 0, scale: 0.9 }} 
                        animate={{ opacity: 1, scale: 1 }} 
                        src={qrModal.code.startsWith('data:') ? qrModal.code : `data:image/png;base64,${qrModal.code}`} 
                        className="w-full scale-105" 
                        alt="Handshake QR" 
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-8">
                        <Loader2 className="animate-spin text-orange-500" size={64} />
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest italic animate-pulse">Sincronizando Frequência Neural...</span>
                      </div>
                    )}
                 </div>
                 {qrModal.connected && (
                   <div className="absolute inset-0 bg-black/80 backdrop-blur-sm rounded-[3.5rem] flex flex-col items-center justify-center">
                      <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mb-6">
                         <CheckCircle2 size={48} className="text-green-500" />
                      </div>
                      <h4 className="text-2xl font-black uppercase italic text-white mb-2">Motor Operacional</h4>
                      <NeonButton onClick={() => setQrModal(p => ({ ...p, isOpen: false }))} className="!px-8 !py-3">Fechar Terminal</NeonButton>
                   </div>
                 )}
              </div>
              
              <div className="pt-8 border-t border-white/5 opacity-40">
                 <div className="flex items-center justify-center gap-4 text-white">
                    <ShieldCheck size={18} />
                    <span className="text-[9px] font-black uppercase tracking-widest italic">Handshake Criptografado TLS 1.3</span>
                 </div>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
