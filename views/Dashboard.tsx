
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
  Database, Link2, QrCode
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
  
  // Estado do Modal com persistência para evitar sumiço do QR
  const [qrModal, setQrModal] = useState({ 
    isOpen: false, 
    code: '', 
    name: '', 
    status: '', 
    connected: false,
    loading: false
  });

  const chatEndRef = useRef<HTMLDivElement>(null);
  const poolingRef = useRef<any>(null);

  const fetchInstances = async () => {
    try {
      const res = await fetch(`${EVOLUTION_URL}/instance/fetchInstances`, { headers: HEADERS });
      if (!res.ok) throw new Error('Falha ao buscar motores');
      const data = await res.json();
      
      const raw = Array.isArray(data) ? data : (data.instances || []);
      const mapped: EvolutionInstance[] = raw.map((i: any) => {
        const instData = i.instance || i;
        const name = instData.instanceName || instData.name || instData.id;
        return {
          id: instData.id || instData.instanceId || name,
          name: name,
          status: (instData.status === 'open' || instData.connectionStatus === 'open') ? 'CONNECTED' : 'DISCONNECTED',
          phone: instData.ownerJid ? instData.ownerJid.split('@')[0] : 'Motor em Standby',
          profilePicUrl: instData.profilePicUrl || ""
        };
      });
      setInstances(mapped);

      // Verificação em tempo real: Se o modal está aberto e a instância acabou de conectar
      if (qrModal.isOpen && !qrModal.connected) {
        const currentInst = mapped.find(i => i.name === qrModal.name);
        if (currentInst?.status === 'CONNECTED') {
          setQrModal(p => ({ ...p, connected: true, status: 'Motor Operacional!' }));
          if (poolingRef.current) clearInterval(poolingRef.current);
        }
      }
    } catch (e) {
      console.error('Fetch Error:', e);
    }
  };

  // Função robusta para buscar QR sem limpar o estado anterior se falhar
  const pollQrCode = async (name: string) => {
    try {
      const res = await fetch(`${EVOLUTION_URL}/instance/connect/${name}`, { headers: HEADERS });
      const data = await res.json();
      
      const qrCode = data.base64 || (data.qrcode && data.qrcode.base64) || data.code;
      
      if (qrCode) {
        setQrModal(p => ({ 
          ...p, 
          code: qrCode, 
          status: 'Escaneie para Conectar', 
          loading: false 
        }));
      } else if (data.status === 'open' || data.connectionStatus === 'open') {
        setQrModal(p => ({ ...p, connected: true, status: 'Motor Operacional!', loading: false }));
        if (poolingRef.current) clearInterval(poolingRef.current);
        fetchInstances();
      }
    } catch (e) {
      console.warn("Tentativa de pooling falhou, tentando novamente...");
    }
  };

  const createInstance = async () => {
    if (!newInstanceName.trim()) return;
    
    setIsCreatingInstance(true);
    const sanitizedName = newInstanceName.trim().toLowerCase().replace(/\s+/g, '-');
    
    // Inicia o modal imediatamente para feedback do usuário
    setQrModal({ 
      isOpen: true, 
      code: '', 
      name: sanitizedName, 
      status: 'Injetando no Cluster...', 
      connected: false,
      loading: true
    });

    try {
      const res = await fetch(`${EVOLUTION_URL}/instance/create`, {
        method: 'POST', 
        headers: HEADERS, 
        body: JSON.stringify({ instanceName: sanitizedName, qrcode: true })
      });
      
      const data = await res.json();

      if (res.ok) {
        setNewInstanceName('');
        const initialQr = data.qrcode?.base64 || data.base64;
        
        if (initialQr) {
          setQrModal(p => ({ ...p, code: initialQr, status: 'Escaneie para Conectar', loading: false }));
        }
        
        // Inicia o pooling agressivo para garantir que o QR apareça e permaneça
        if (poolingRef.current) clearInterval(poolingRef.current);
        poolingRef.current = setInterval(() => pollQrCode(sanitizedName), 3000);
        
        fetchInstances();
      } else {
        setQrModal(p => ({ ...p, isOpen: false }));
        alert(`Erro: ${data.message || 'Falha na injeção'}`);
      }
    } catch (e) { 
      setQrModal(p => ({ ...p, isOpen: false }));
    } finally { 
      setIsCreatingInstance(false); 
    }
  };

  const connectInstance = (name: string) => {
    setQrModal({ 
      isOpen: true, 
      name, 
      status: 'Gerando Handshake QR...', 
      code: '', 
      connected: false,
      loading: true
    });
    
    // Inicia pooling imediato
    pollQrCode(name);
    if (poolingRef.current) clearInterval(poolingRef.current);
    poolingRef.current = setInterval(() => pollQrCode(name), 3000);
  };

  const deleteInstance = async (name: string) => {
    if (!confirm(`Desativar motor ${name}?`)) return;
    try {
      await fetch(`${EVOLUTION_URL}/instance/delete/${name}`, { method: 'DELETE', headers: HEADERS });
      fetchInstances();
    } catch (e) {}
  };

  const syncChats = async () => {
    if (instances.length === 0) return;
    setIsSyncing(true);
    try {
      const conn = instances.filter(i => i.status === 'CONNECTED');
      let all: Ticket[] = [];
      for (const inst of conn) {
        try {
          const res = await fetch(`${EVOLUTION_URL}/chat/findChats/${inst.name}`, { method: 'POST', headers: HEADERS });
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
    const interval = setInterval(fetchInstances, 10000); 
    return () => {
      clearInterval(interval);
      if (poolingRef.current) clearInterval(poolingRef.current);
    };
  }, []);

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
          id: Date.now().toString(), text, sender: 'me', 
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 
          status: 'sent', type: 'text'
        }]);
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      }
    } catch (e) {}
  };

  const onDragEnd = (result: any) => {
    if (!result.destination) return;
    const { source, destination, draggableId } = result;
    if (source.droppableId === destination.droppableId) return;
    setLeads(prev => prev.map(l => l.id === draggableId ? { ...l, status: destination.droppableId as any } : l));
  };

  const SidebarItem = ({ icon: Icon, label, badge, active, onClick }: any) => (
    <button onClick={onClick} className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all group ${active ? 'bg-orange-500/10 text-orange-500 border border-orange-500/20' : 'text-gray-500 hover:text-white'}`}>
      <div className="flex items-center gap-3">
        <Icon size={18} className={active ? 'text-orange-500' : 'text-gray-500'} />
        {isSidebarExpanded && <span className="text-[11px] font-black uppercase tracking-widest">{label}</span>}
      </div>
      {isSidebarExpanded && badge && <span className="text-[9px] font-black text-white bg-orange-600 px-2 py-0.5 rounded-full">{badge}</span>}
    </button>
  );

  return (
    <div className="flex h-screen bg-[#050505] text-white overflow-hidden relative">
      <div className="fixed inset-0 grid-engine pointer-events-none opacity-10"></div>
      
      {/* SIDEBAR */}
      <aside className={`flex flex-col border-r border-white/5 bg-black/40 backdrop-blur-xl transition-all duration-300 z-50 ${isSidebarExpanded ? 'w-64' : 'w-20'}`}>
        <div className="p-8"><Logo size="sm" /></div>
        <div className="flex-1 px-3 py-6 space-y-2">
          <SidebarItem icon={LayoutDashboard} label="Visão Geral" active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} />
          <SidebarItem icon={MessageSquare} label="Atendimento" active={activeTab === 'atendimento'} onClick={() => setActiveTab('atendimento')} badge={leads.length} />
          <SidebarItem icon={Layers} label="Pipeline" active={activeTab === 'kanban'} onClick={() => setActiveTab('kanban')} />
          <SidebarItem icon={Smartphone} label="Engines" active={activeTab === 'integracoes'} onClick={() => setActiveTab('integracoes')} badge={instances.length} />
          <SidebarItem icon={Bot} label="Agentes IA" active={activeTab === 'agentes'} onClick={() => setActiveTab('agentes')} />
        </div>
        <div className="p-4 border-t border-white/5">
          <button onClick={onLogout} className="w-full flex items-center gap-3 px-4 py-4 text-gray-600 hover:text-orange-500 transition-all"><LogOut size={18} />{isSidebarExpanded && <span className="text-[10px] font-black uppercase tracking-widest">Sair</span>}</button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-20 border-b border-white/5 bg-black/20 flex items-center justify-between px-10 shrink-0 z-40">
          <div className="flex items-center gap-6">
            <button onClick={() => setIsSidebarExpanded(!isSidebarExpanded)} className="p-2 glass rounded-lg text-orange-500"><ChevronLeft size={16} className={!isSidebarExpanded ? 'rotate-180' : ''} /></button>
            <h2 className="text-xs font-black uppercase tracking-[0.3em] text-white italic">{activeTab}</h2>
          </div>
          <div className="flex items-center gap-6">
            <button onClick={() => {fetchInstances(); syncChats();}} className={`p-2 glass rounded-xl ${isSyncing ? 'animate-spin' : ''}`}><RefreshCw size={16}/></button>
            <div className="h-6 w-px bg-white/5"></div>
            <div className="flex items-center gap-4">
               <span className="text-[10px] font-black uppercase text-white italic">{user.name}</span>
               <div className="w-10 h-10 rounded-xl bg-rajado p-0.5 shadow-lg shadow-orange-500/20">
                  <div className="w-full h-full bg-black rounded-[9px] flex items-center justify-center text-xs font-black italic">{user.name?.[0]}</div>
               </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-10">
           {activeTab === 'integracoes' && (
             <div className="max-w-6xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="flex justify-between items-end">
                  <div>
                    <h1 className="text-5xl font-black uppercase italic tracking-tighter">Neural <span className="text-orange-500">Engines.</span></h1>
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-700 italic">Infraestrutura em tempo real</p>
                  </div>
                  <div className="flex gap-4">
                    <input 
                      value={newInstanceName} onChange={e => setNewInstanceName(e.target.value)}
                      placeholder="Identidade do Motor..." 
                      className="bg-white/[0.02] border border-white/5 rounded-2xl py-4 px-6 text-[11px] font-bold uppercase outline-none focus:border-orange-500/40"
                    />
                    <NeonButton onClick={createInstance}>{isCreatingInstance ? <Loader2 className="animate-spin" size={16}/> : 'Adicionar Motor'}</NeonButton>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                   {instances.map(inst => (
                     <GlassCard key={inst.id} className="!p-8 group relative overflow-hidden">
                        <div className="flex flex-col gap-8 relative z-10">
                           <div className="flex items-center gap-6">
                              <div className="relative">
                                 <div className="w-16 h-16 rounded-2xl bg-black border border-white/5 flex items-center justify-center overflow-hidden">
                                    {inst.profilePicUrl ? <img src={inst.profilePicUrl} className="w-full h-full object-cover" /> : <Smartphone size={28} className="text-gray-800" />}
                                 </div>
                                 <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-4 border-[#050505] ${inst.status === 'CONNECTED' ? 'bg-green-500 shadow-[0_0_10px_green]' : 'bg-red-500 shadow-[0_0_10px_red]'}`} />
                              </div>
                              <div className="flex-1 overflow-hidden">
                                 <div className="text-2xl font-black uppercase italic tracking-tighter text-white truncate">{inst.name}</div>
                                 <div className="text-[9px] font-black text-gray-700 uppercase tracking-widest">{inst.phone}</div>
                              </div>
                           </div>
                           <div className="flex gap-3">
                              {inst.status === 'DISCONNECTED' ? (
                                <NeonButton onClick={() => connectInstance(inst.name)} className="flex-1 !py-3 !text-[9px]">Handshake QR</NeonButton>
                              ) : (
                                <div className="flex-1 py-3 border border-green-500/20 rounded-xl text-green-500 text-[9px] font-black uppercase text-center bg-green-500/5">Operacional</div>
                              )}
                              <button onClick={() => connectInstance(inst.name)} className="p-4 rounded-2xl bg-white/[0.03] text-gray-500 hover:text-orange-500"><Zap size={18}/></button>
                              <button onClick={() => deleteInstance(inst.name)} className="p-4 rounded-2xl bg-red-600/10 text-red-500 hover:bg-red-600 hover:text-white"><Trash2 size={18}/></button>
                           </div>
                        </div>
                     </GlassCard>
                   ))}
                </div>
             </div>
           )}

           {activeTab === 'atendimento' && (
             <div className="h-[calc(100vh-220px)] flex glass rounded-[2.5rem] overflow-hidden">
                <div className="w-[400px] border-r border-white/5 flex flex-col bg-black/40">
                   <header className="p-8 border-b border-white/5 flex items-center justify-between">
                      <span className="text-[11px] font-black uppercase tracking-[0.4em] italic text-orange-500">Threads Ativas</span>
                      <button onClick={syncChats} className={`p-2 glass rounded-xl ${isSyncing ? 'animate-spin' : ''}`}><RefreshCw size={14}/></button>
                   </header>
                   <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
                      {leads.map(lead => (
                        <button key={lead.id} onClick={() => setSelectedLeadId(lead.id)} className={`w-full flex items-center gap-4 p-5 rounded-[2rem] text-left border ${selectedLeadId === lead.id ? 'bg-orange-500/10 border-orange-500/20 shadow-xl' : 'border-transparent hover:bg-white/[0.03]'}`}>
                           <div className="w-12 h-12 rounded-2xl bg-black flex items-center justify-center text-orange-500 font-black italic overflow-hidden">
                              {lead.avatar ? <img src={lead.avatar} className="w-full h-full object-cover" /> : lead.contactName[0]}
                           </div>
                           <div className="flex-1 overflow-hidden">
                              <span className="text-[12px] font-black uppercase italic truncate text-white block tracking-tighter">{lead.contactName}</span>
                              <p className="text-[9px] text-gray-600 italic truncate mt-1">"{lead.lastMessage}"</p>
                           </div>
                        </button>
                      ))}
                   </div>
                </div>
                <div className="flex-1 flex flex-col bg-black/60">
                   {selectedLeadId ? (
                     <div className="flex-1 flex flex-col">
                        <header className="p-8 border-b border-white/5 bg-black/40 flex items-center justify-between shadow-2xl z-10">
                           <div className="flex items-center gap-6">
                              <div className="w-14 h-14 rounded-2xl bg-black flex items-center justify-center text-orange-500 font-black italic border border-orange-500/20 overflow-hidden">
                                 {leads.find(l => l.id === selectedLeadId)?.avatar ? <img src={leads.find(l => l.id === selectedLeadId)?.avatar} className="w-full h-full object-cover" /> : <User size={24}/>}
                              </div>
                              <h4 className="text-2xl font-black uppercase italic tracking-tighter text-white">{leads.find(l => l.id === selectedLeadId)?.contactName}</h4>
                           </div>
                        </header>
                        <div className="flex-1 overflow-y-auto p-12 space-y-8 custom-scrollbar">
                           {chatMessages.map((m, idx) => (
                             <div key={idx} className={`flex ${m.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[75%] p-6 rounded-[2.5rem] ${m.sender === 'me' ? 'bg-orange-600 text-white rounded-br-none' : 'bg-white/[0.03] text-gray-100 border border-white/5 rounded-bl-none'}`}>
                                   <p className="text-[14px] font-medium leading-relaxed">{m.text}</p>
                                   <div className="text-[7px] font-black uppercase mt-4 text-right opacity-30 italic">{m.time}</div>
                                </div>
                             </div>
                           ))}
                           <div ref={chatEndRef} />
                        </div>
                        <div className="p-10 bg-black/40 border-t border-white/5">
                           <div className="max-w-5xl mx-auto flex gap-6">
                              <input 
                                value={messageInput} onChange={e => setMessageInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleSend()}
                                placeholder="Injetar Resposta Neural..." 
                                className="flex-1 bg-white/[0.02] border border-white/5 rounded-[1.8rem] py-6 px-10 text-sm font-bold uppercase outline-none focus:border-orange-500/40 transition-all"
                              />
                              <NeonButton onClick={handleSend} className="!p-6 !rounded-[1.8rem] shadow-2xl shadow-orange-600/30 group">
                                 <Send size={28} className="group-hover:translate-x-1 transition-transform" />
                              </NeonButton>
                           </div>
                        </div>
                     </div>
                   ) : (
                     <div className="flex-1 flex flex-col items-center justify-center opacity-20"><Logo size="md" className="grayscale mb-8" /><h4 className="text-3xl font-black uppercase tracking-widest italic">Cluster Standby</h4></div>
                   )}
                </div>
             </div>
           )}

           {activeTab === 'kanban' && (
             <div className="h-full animate-in slide-in-from-right-8 duration-700">
                <header className="mb-12">
                   <h1 className="text-5xl font-black uppercase italic tracking-tighter">Neural <span className="text-orange-500">Pipeline.</span></h1>
                </header>
                <DragDropContext onDragEnd={onDragEnd}>
                  <div className="flex gap-10 items-start overflow-x-auto custom-scrollbar pb-10">
                    {KANBAN_COLS.map(col => (
                      <div key={col.id} className="w-[400px] shrink-0">
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
                                    <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} className={`p-8 rounded-[2.5rem] glass border-white/5 ${snapshot.isDragging ? 'rotate-2 scale-105 z-[100]' : ''}`}>
                                       <h4 className="text-lg font-black uppercase italic tracking-tighter text-white mb-2">{lead.contactName}</h4>
                                       <p className="text-[11px] text-gray-600 line-clamp-2 italic mb-8">"{lead.lastMessage}"</p>
                                       <div className="pt-8 border-t border-white/5 flex items-center justify-between">
                                          <div className="text-sm font-black text-orange-500 italic">R$ {lead.value},00</div>
                                          <button onClick={() => {setSelectedLeadId(lead.id); setActiveTab('atendimento');}} className="p-2 glass rounded-xl text-orange-500"><ArrowRight size={18}/></button>
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

      {/* QR MODAL: Estabilizado comPooling e Trava de Re-render */}
      <AnimatePresence>
        {qrModal.isOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-8 bg-black/95 backdrop-blur-3xl">
            <div className="bg-[#050505] border border-orange-500/20 p-12 md:p-16 rounded-[4rem] text-center max-w-2xl w-full relative shadow-[0_0_150px_rgba(255,115,0,0.1)]">
              <button onClick={() => { setQrModal(p => ({ ...p, isOpen: false })); if(poolingRef.current) clearInterval(poolingRef.current); }} className="absolute top-10 right-10 text-gray-800 hover:text-white"><X size={32}/></button>
              
              <div className="mb-10">
                <div className="flex items-center justify-center gap-4 mb-4">
                  <QrCode className="text-orange-500" size={32} />
                  <h3 className="text-4xl font-black uppercase italic tracking-tighter text-white">{qrModal.name}</h3>
                </div>
                <p className="text-[12px] font-black uppercase text-orange-500 tracking-[0.5em] italic">{qrModal.status}</p>
              </div>

              <div className="relative mb-12 flex justify-center">
                 <div className="bg-white p-8 md:p-12 rounded-[3.5rem] flex items-center justify-center min-h-[400px] min-w-[400px] border-[12px] border-white/5 relative overflow-hidden">
                    {qrModal.code ? (
                      <motion.img 
                        key={qrModal.code}
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} 
                        src={qrModal.code.startsWith('data:') ? qrModal.code : `data:image/png;base64,${qrModal.code}`} 
                        className="w-full h-auto block" 
                        alt="QR Code" 
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-6">
                        <Loader2 className="animate-spin text-orange-500" size={60} />
                        <span className="text-[10px] font-black text-gray-900 uppercase italic animate-pulse">Sincronizando...</span>
                      </div>
                    )}
                 </div>
                 
                 {qrModal.connected && (
                   <div className="absolute inset-0 bg-black/90 backdrop-blur-md rounded-[3.5rem] flex flex-col items-center justify-center z-20">
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center mb-8">
                         <CheckCircle2 size={56} className="text-green-500" />
                      </motion.div>
                      <h4 className="text-3xl font-black uppercase italic text-white mb-2">Motor Conectado</h4>
                      <NeonButton onClick={() => setQrModal(p => ({ ...p, isOpen: false }))}>Acessar Painel</NeonButton>
                   </div>
                 )}
              </div>
              
              <div className="pt-8 border-t border-white/5 opacity-50 flex items-center justify-center gap-8">
                 <div className="flex items-center gap-3 text-white">
                    <ShieldCheck size={18} className="text-orange-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest italic">Criptografia Ativa</span>
                 </div>
                 <div className="flex items-center gap-3 text-white">
                    <Zap size={18} className="text-orange-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest italic">Handshake Instantâneo</span>
                 </div>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
