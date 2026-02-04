
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageSquare, LogOut, Plus, Loader2, RefreshCw, 
  Trash2, X, Layers, Search, Send, CheckCircle2, 
  Smartphone, ShieldCheck, ChevronLeft, Bot, Zap, 
  Activity, User, Smile, Mic, ArrowRight,
  Database, QrCode, LayoutDashboard
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { UserSession, DashboardTab, EvolutionInstance, Ticket, Message, KanbanColumn } from '../types';
import { GlassCard } from '../components/GlassCard';
import { NeonButton } from '../components/Buttons';
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
  
  const [qrModal, setQrModal] = useState({ 
    isOpen: false, 
    code: '', 
    name: '', 
    status: '', 
    connected: false 
  });

  const chatEndRef = useRef<HTMLDivElement>(null);
  const poolingRef = useRef<any>(null);

  const fetchInstances = async () => {
    try {
      const res = await fetch(`${EVOLUTION_URL}/instance/fetchInstances`, { headers: HEADERS });
      if (!res.ok) throw new Error('API Offline');
      const data = await res.json();
      
      const raw = Array.isArray(data) ? data : (data.instances || []);
      const mapped: EvolutionInstance[] = raw.map((i: any) => {
        const instData = i.instance || i;
        const name = instData.instanceName || instData.name || instData.id;
        return {
          id: instData.id || instData.instanceId || name,
          name: name,
          status: (instData.status === 'open' || instData.connectionStatus === 'open') ? 'CONNECTED' : 'DISCONNECTED',
          phone: instData.ownerJid ? instData.ownerJid.split('@')[0] : 'Standby',
          profilePicUrl: instData.profilePicUrl || ""
        };
      });
      setInstances(mapped);

      if (qrModal.isOpen && !qrModal.connected) {
        const current = mapped.find(i => i.name === qrModal.name);
        if (current?.status === 'CONNECTED') {
          setQrModal(p => ({ ...p, connected: true, status: 'Engine Operacional!' }));
          if (poolingRef.current) clearInterval(poolingRef.current);
        }
      }
    } catch (e) {
      console.error('Fetch Fail');
    }
  };

  const pollQrCode = async (name: string) => {
    try {
      const res = await fetch(`${EVOLUTION_URL}/instance/connect/${name}`, { headers: HEADERS });
      const data = await res.json();
      
      // Mapeamento exaustivo de base64 (Cobre v1, v2 e formatos customizados)
      const qrCode = data.base64 || 
                     data.qrcode?.base64 || 
                     (typeof data.code === 'string' && data.code.length > 100 ? data.code : null) ||
                     data.qrcode;
      
      if (qrCode && typeof qrCode === 'string') {
        setQrModal(p => {
          if (p.connected) return p;
          return { ...p, code: qrCode, status: 'Escaneie para Conectar' };
        });
      } else if (data.status === 'open' || data.instance?.status === 'open') {
        setQrModal(p => ({ ...p, connected: true, status: 'Sincronizado!' }));
        if (poolingRef.current) clearInterval(poolingRef.current);
        fetchInstances();
      }
    } catch (e) {
      console.log("Pooling...");
    }
  };

  const createInstance = async () => {
    if (!newInstanceName.trim()) return;
    setIsCreatingInstance(true);
    const sanitizedName = newInstanceName.trim().toLowerCase().replace(/[^a-z0-9]/g, '-');
    
    setQrModal({ 
      isOpen: true, 
      code: '', 
      name: sanitizedName, 
      status: 'Injetando no Cluster...', 
      connected: false 
    });

    try {
      const res = await fetch(`${EVOLUTION_URL}/instance/create`, {
        method: 'POST', 
        headers: HEADERS, 
        body: JSON.stringify({ instanceName: sanitizedName, qrcode: true })
      });
      
      const data = await res.json();

      // Se der erro de "já existe", não paramos, vamos direto pro pooling de conexão
      if (res.ok || data.status === 400 || data.message?.includes('exists')) {
        setNewInstanceName('');
        
        // Inicia pooling imediato e agressivo
        if (poolingRef.current) clearInterval(poolingRef.current);
        pollQrCode(sanitizedName); // Primeira tentativa instantânea
        poolingRef.current = setInterval(() => pollQrCode(sanitizedName), 3000);
        
        fetchInstances();
      } else {
        alert("Erro Evolution: " + (data.message || "Falha ao injetar motor"));
        setQrModal(p => ({ ...p, isOpen: false }));
      }
    } catch (e) { 
      pollQrCode(sanitizedName);
      if (poolingRef.current) clearInterval(poolingRef.current);
      poolingRef.current = setInterval(() => pollQrCode(sanitizedName), 3000);
    } finally { 
      setIsCreatingInstance(false); 
    }
  };

  const connectInstance = (name: string) => {
    setQrModal({ isOpen: true, name, status: 'Solicitando Handshake...', code: '', connected: false });
    pollQrCode(name);
    if (poolingRef.current) clearInterval(poolingRef.current);
    poolingRef.current = setInterval(() => pollQrCode(name), 3000);
  };

  const deleteInstance = async (name: string) => {
    if (!confirm(`Remover motor ${name}?`)) return;
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
              time: "Agora", status: 'novo', unreadCount: item.unreadCount || 0,
              assignedTo: 'IA Central', protocol: 'NX-' + Math.floor(Math.random() * 9000),
              messages: [], instanceSource: inst.name, sentiment: 'neutral', value: Math.floor(Math.random() * 1000)
            });
          });
        } catch (e) {}
      }
      setLeads(all);
    } catch (e) {} finally { setIsSyncing(false); }
  };

  useEffect(() => {
    fetchInstances();
    const interval = setInterval(fetchInstances, 15000); 
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
    <button onClick={onClick} className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl transition-all group ${active ? 'bg-orange-500/10 text-orange-500 border border-orange-500/20 shadow-lg' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}>
      <div className="flex items-center gap-3">
        <Icon size={18} className={active ? 'text-orange-500' : 'text-gray-500 group-hover:text-orange-500 transition-colors'} />
        {isSidebarExpanded && <span className="text-[10px] font-black uppercase tracking-[0.2em]">{label}</span>}
      </div>
      {isSidebarExpanded && badge && <span className="text-[8px] font-black text-white bg-orange-600 px-2 py-0.5 rounded-full">{badge}</span>}
    </button>
  );

  return (
    <div className="flex h-screen bg-[#050505] text-white overflow-hidden relative font-sans">
      <div className="fixed inset-0 grid-engine pointer-events-none opacity-5"></div>
      
      <aside className={`flex flex-col border-r border-white/5 bg-black/40 backdrop-blur-xl transition-all duration-300 z-50 ${isSidebarExpanded ? 'w-64' : 'w-20'}`}>
        <div className="p-8 flex justify-center"><Logo size="sm" /></div>
        <div className="flex-1 px-3 py-6 space-y-2">
          <SidebarItem icon={LayoutDashboard} label="Dashboard" active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} />
          <SidebarItem icon={MessageSquare} label="Chats" active={activeTab === 'atendimento'} onClick={() => setActiveTab('atendimento')} badge={leads.length} />
          <SidebarItem icon={Layers} label="Pipeline" active={activeTab === 'kanban'} onClick={() => setActiveTab('kanban')} />
          <SidebarItem icon={Smartphone} label="Engines" active={activeTab === 'integracoes'} onClick={() => setActiveTab('integracoes')} badge={instances.length} />
          <SidebarItem icon={Bot} label="Agentes IA" active={activeTab === 'agentes'} onClick={() => setActiveTab('agentes')} />
        </div>
        <div className="p-4 border-t border-white/5">
          <button onClick={onLogout} className="w-full flex items-center gap-4 px-4 py-5 text-gray-700 hover:text-orange-500 transition-all group font-black uppercase text-[9px] tracking-[0.3em]">
            <LogOut size={16} className="group-hover:-translate-x-1 transition-transform" />
            {isSidebarExpanded && <span>Desconectar</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-white/5 bg-black/20 backdrop-blur-md flex items-center justify-between px-10 shrink-0 z-40">
          <div className="flex items-center gap-6">
            <button onClick={() => setIsSidebarExpanded(!isSidebarExpanded)} className="p-2 glass rounded-lg text-orange-500 hover:scale-105 transition-transform"><ChevronLeft size={14} className={!isSidebarExpanded ? 'rotate-180' : ''} /></button>
            <h2 className="text-[9px] font-black uppercase tracking-[0.5em] text-white italic opacity-60">Neural Engine v3.1</h2>
          </div>
          <div className="flex items-center gap-8">
            <button onClick={() => {fetchInstances(); syncChats();}} className={`p-2 glass rounded-xl text-gray-400 hover:text-orange-500 transition-all ${isSyncing ? 'animate-spin text-orange-500' : ''}`}><RefreshCw size={14}/></button>
            <div className="flex items-center gap-4">
               <span className="text-[9px] font-black uppercase text-white italic tracking-widest">{user.name}</span>
               <div className="w-8 h-8 rounded-lg bg-rajado p-0.5 shadow-lg shadow-orange-500/20">
                  <div className="w-full h-full bg-black rounded-[7px] flex items-center justify-center text-[10px] font-black italic">{user.name?.[0]}</div>
               </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-10 custom-scrollbar">
           {activeTab === 'integracoes' && (
             <div className="max-w-5xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="flex flex-col md:flex-row justify-between items-end gap-6 border-b border-white/5 pb-10">
                  <div>
                    <h1 className="text-5xl font-black uppercase italic tracking-tighter mb-2">Neural <span className="text-orange-500">Engines.</span></h1>
                    <p className="text-[9px] font-black uppercase tracking-[0.5em] text-gray-700 italic">Infraestrutura em escala real</p>
                  </div>
                  <div className="flex gap-4 w-full md:w-auto">
                    <input 
                      value={newInstanceName} onChange={e => setNewInstanceName(e.target.value)}
                      placeholder="Identidade do Motor..." 
                      className="flex-1 md:w-64 bg-white/[0.02] border border-white/5 rounded-xl py-3.5 px-6 text-[10px] font-black uppercase outline-none focus:border-orange-500/40 transition-all"
                    />
                    <NeonButton onClick={createInstance} className="!px-8 !text-[9px]">
                      {isCreatingInstance ? <Loader2 className="animate-spin" size={14}/> : 'Ativar Motor'}
                    </NeonButton>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                   {instances.map(inst => (
                     <GlassCard key={inst.id} className="!p-6 group relative overflow-hidden bg-gradient-to-br from-white/[0.01] to-transparent">
                        <div className="flex flex-col gap-6 relative z-10">
                           <div className="flex items-center gap-5">
                              <div className="relative">
                                 <div className="w-14 h-14 rounded-xl bg-black border border-white/5 flex items-center justify-center overflow-hidden shadow-2xl">
                                    {inst.profilePicUrl ? <img src={inst.profilePicUrl} className="w-full h-full object-cover" /> : <Smartphone size={24} className="text-gray-800" />}
                                 </div>
                                 <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-[3px] border-[#050505] ${inst.status === 'CONNECTED' ? 'bg-green-500 shadow-[0_0_10px_green]' : 'bg-red-500 shadow-[0_0_10px_red]'}`} />
                              </div>
                              <div className="flex-1 overflow-hidden">
                                 <div className="text-xl font-black uppercase italic tracking-tighter text-white truncate leading-none mb-1">{inst.name}</div>
                                 <div className="text-[8px] font-black text-gray-700 uppercase tracking-[0.2em] italic">{inst.phone}</div>
                              </div>
                           </div>
                           <div className="flex gap-2">
                              {inst.status === 'DISCONNECTED' ? (
                                <NeonButton onClick={() => connectInstance(inst.name)} className="flex-1 !py-2.5 !text-[8px] !rounded-lg">Sincronizar</NeonButton>
                              ) : (
                                <div className="flex-1 py-2.5 border border-green-500/20 rounded-lg text-green-500 text-[8px] font-black uppercase text-center bg-green-500/5 flex items-center justify-center gap-2">
                                  <CheckCircle2 size={10}/> Online
                                </div>
                              )}
                              <button onClick={() => connectInstance(inst.name)} className="p-3 rounded-lg bg-white/[0.02] text-gray-500 hover:text-orange-500 border border-white/5 transition-all"><Zap size={14}/></button>
                              <button onClick={() => deleteInstance(inst.name)} className="p-3 rounded-lg bg-red-600/5 text-red-500 hover:bg-red-600 hover:text-white border border-red-500/10 transition-all"><Trash2 size={14}/></button>
                           </div>
                        </div>
                     </GlassCard>
                   ))}
                </div>
             </div>
           )}

           {activeTab === 'atendimento' && (
             <div className="h-[calc(100vh-180px)] flex glass rounded-[2rem] overflow-hidden border-white/5 shadow-2xl animate-in zoom-in-95 duration-500">
                <div className="w-[360px] border-r border-white/5 flex flex-col bg-black/40">
                   <header className="p-6 border-b border-white/5 bg-black/20 flex items-center justify-between">
                      <span className="text-[9px] font-black uppercase tracking-[0.4em] italic text-orange-500">Threads Ativas</span>
                      <button onClick={syncChats} className={`p-1.5 glass rounded-lg text-gray-500 hover:text-orange-500 transition-all ${isSyncing ? 'animate-spin' : ''}`}><RefreshCw size={12}/></button>
                   </header>
                   <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1.5">
                      {leads.map(lead => (
                        <button key={lead.id} onClick={() => setSelectedLeadId(lead.id)} className={`w-full flex items-center gap-4 p-4 rounded-3xl text-left border transition-all ${selectedLeadId === lead.id ? 'bg-orange-500/5 border-orange-500/20' : 'border-transparent hover:bg-white/[0.02]'}`}>
                           <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center text-orange-500 font-black italic border border-white/5 overflow-hidden">
                              {lead.avatar ? <img src={lead.avatar} className="w-full h-full object-cover" /> : lead.contactName[0]}
                           </div>
                           <div className="flex-1 overflow-hidden">
                              <span className="text-[11px] font-black uppercase italic truncate text-white block tracking-tighter mb-0.5">{lead.contactName}</span>
                              <p className="text-[8px] text-gray-600 italic truncate opacity-60">"{lead.lastMessage}"</p>
                           </div>
                        </button>
                      ))}
                   </div>
                </div>
                <div className="flex-1 flex flex-col bg-black/60 relative">
                   {selectedLeadId ? (
                     <div className="flex-1 flex flex-col h-full">
                        <header className="p-6 border-b border-white/5 bg-black/40 backdrop-blur-3xl flex items-center justify-between z-10">
                           <div className="flex items-center gap-5">
                              <div className="w-11 h-11 rounded-xl bg-black flex items-center justify-center text-orange-500 font-black italic border border-orange-500/20 overflow-hidden">
                                 {leads.find(l => l.id === selectedLeadId)?.avatar ? <img src={leads.find(l => l.id === selectedLeadId)?.avatar} className="w-full h-full object-cover" /> : <User size={20}/>}
                              </div>
                              <div>
                                <h4 className="text-xl font-black uppercase italic tracking-tighter text-white leading-none mb-1">{leads.find(l => l.id === selectedLeadId)?.contactName}</h4>
                                <span className="text-[8px] font-black text-gray-700 tracking-[0.2em] italic">{leads.find(l => l.id === selectedLeadId)?.contactPhone}</span>
                              </div>
                           </div>
                        </header>
                        <div className="flex-1 overflow-y-auto p-10 space-y-6 custom-scrollbar">
                           {chatMessages.map((m, idx) => (
                             <div key={idx} className={`flex ${m.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] p-5 rounded-[2rem] shadow-xl ${m.sender === 'me' ? 'bg-orange-600 text-white rounded-br-none' : 'bg-white/[0.03] text-gray-100 border border-white/5 rounded-bl-none'}`}>
                                   <p className="text-[13px] font-medium leading-relaxed tracking-tight">{m.text}</p>
                                   <div className="text-[6px] font-black uppercase mt-3 text-right opacity-30 italic">{m.time}</div>
                                </div>
                             </div>
                           ))}
                           <div ref={chatEndRef} />
                        </div>
                        <div className="p-8 bg-black/40 border-t border-white/5">
                           <div className="max-w-4xl mx-auto flex gap-4">
                              <input 
                                value={messageInput} onChange={e => setMessageInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleSend()}
                                placeholder="Resposta Neural..." 
                                className="flex-1 bg-white/[0.02] border border-white/10 rounded-2xl py-4 px-8 text-xs font-bold uppercase outline-none focus:border-orange-500/40 transition-all"
                              />
                              <NeonButton onClick={handleSend} className="!p-4 !rounded-2xl shadow-xl group">
                                 <Send size={22} className="group-hover:translate-x-1 transition-transform" />
                              </NeonButton>
                           </div>
                        </div>
                     </div>
                   ) : (
                     <div className="flex-1 flex flex-col items-center justify-center opacity-10 p-20 text-center scale-90">
                        <Logo size="md" className="grayscale mb-8" />
                        <h4 className="text-3xl font-black uppercase tracking-[0.6em] italic text-white">Cluster Standby</h4>
                     </div>
                   )}
                </div>
             </div>
           )}

           {activeTab === 'kanban' && (
             <div className="h-full animate-in slide-in-from-right-8 duration-700">
                <header className="mb-10">
                   <h1 className="text-5xl font-black uppercase italic tracking-tighter leading-none">Neural <span className="text-orange-500">Pipeline.</span></h1>
                   <p className="text-[9px] font-black uppercase tracking-[0.4em] text-gray-700 italic mt-2">Gestão de leads e conversão</p>
                </header>
                <DragDropContext onDragEnd={onDragEnd}>
                  <div className="flex gap-8 items-start overflow-x-auto custom-scrollbar pb-10">
                    {KANBAN_COLS.map(col => (
                      <div key={col.id} className="w-[360px] shrink-0">
                        <div className="px-6 py-4 flex items-center justify-between mb-6 glass rounded-2xl border-white/10 shadow-lg bg-gradient-to-r from-white/[0.02] to-transparent">
                           <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white italic">{col.title}</span>
                           <div className="text-[8px] font-black text-orange-500 bg-orange-500/10 px-3 py-1 rounded-full border border-orange-500/20">{leads.filter(l => l.status === col.id).length}</div>
                        </div>
                        <Droppable droppableId={col.id}>
                          {(provided) => (
                            <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-6 min-h-[600px]">
                              {leads.filter(l => l.status === col.id).map((lead, index) => (
                                <Draggable key={lead.id} draggableId={lead.id} index={index}>
                                  {(provided, snapshot) => (
                                    <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} className={`p-6 rounded-[2rem] glass border-white/10 shadow-xl transition-all ${snapshot.isDragging ? 'rotate-2 scale-105 z-[100] border-orange-500/40 bg-orange-500/5' : 'hover:border-orange-500/20'}`}>
                                       <h4 className="text-lg font-black uppercase italic tracking-tighter text-white mb-2 leading-none">{lead.contactName}</h4>
                                       <p className="text-[9px] text-gray-600 line-clamp-2 italic mb-8 leading-relaxed font-medium">"{lead.lastMessage}"</p>
                                       <div className="pt-6 border-t border-white/5 flex items-center justify-between">
                                          <div className="text-sm font-black text-orange-500 italic">R$ {lead.value},00</div>
                                          <button onClick={() => {setSelectedLeadId(lead.id); setActiveTab('atendimento');}} className="p-2.5 glass rounded-xl text-orange-500 hover:bg-orange-500 hover:text-white transition-all"><ArrowRight size={16}/></button>
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

      {/* MODAL QR - TAMANHO REDUZIDO E LOGICA BLINDADA */}
      <AnimatePresence>
        {qrModal.isOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/98 backdrop-blur-3xl">
            <div className="bg-[#050505] border border-orange-500/30 p-8 md:p-10 rounded-[3.5rem] text-center max-w-lg w-full relative shadow-[0_0_150px_rgba(255,115,0,0.1)] animate-in zoom-in-95 duration-500">
              <button 
                onClick={() => { setQrModal(p => ({ ...p, isOpen: false })); if(poolingRef.current) clearInterval(poolingRef.current); }} 
                className="absolute top-8 right-8 text-gray-800 hover:text-white p-2 hover:bg-white/5 rounded-full transition-all"
              >
                <X size={28}/>
              </button>
              
              <div className="mb-8">
                <div className="flex items-center justify-center gap-4 mb-4">
                  <div className="p-3 bg-orange-500/10 rounded-2xl border border-orange-500/20">
                    <QrCode className="text-orange-500" size={28} />
                  </div>
                  <h3 className="text-3xl font-black uppercase italic tracking-tighter text-white leading-none">{qrModal.name}</h3>
                </div>
                <div className="flex items-center justify-center gap-3">
                  <div className={`w-1.5 h-1.5 rounded-full ${qrModal.connected ? 'bg-green-500 shadow-[0_0_10px_green]' : 'bg-orange-500 animate-pulse'}`} />
                  <p className="text-[10px] font-black uppercase text-orange-500 tracking-[0.4em] italic">{qrModal.status}</p>
                </div>
              </div>

              <div className="relative mb-8 flex justify-center">
                 <div className="bg-white p-6 rounded-[3rem] flex items-center justify-center min-h-[320px] min-w-[320px] border-[10px] border-white/5 relative overflow-hidden shadow-2xl">
                    {qrModal.code ? (
                      <motion.img 
                        key={qrModal.code}
                        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} 
                        src={qrModal.code.startsWith('data:') ? qrModal.code : `data:image/png;base64,${qrModal.code}`} 
                        className="w-full h-auto block rounded-xl" 
                        alt="Handshake QR" 
                        onLoad={() => setQrModal(p => ({ ...p, status: 'Pronto para Escanear' }))}
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-8 p-10">
                        <div className="relative">
                          <Loader2 className="animate-spin text-orange-500" size={50} strokeWidth={3} />
                        </div>
                        <span className="text-[9px] font-black text-gray-900 uppercase tracking-[0.2em] italic animate-pulse">Injetando Sincronização...</span>
                      </div>
                    )}
                 </div>
                 
                 {qrModal.connected && (
                   <div className="absolute inset-0 bg-black/95 backdrop-blur-2xl rounded-[3rem] flex flex-col items-center justify-center z-20 border border-green-500/30 animate-in fade-in duration-500">
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mb-6 border border-green-500/20 shadow-[0_0_30px_rgba(34,197,94,0.1)]">
                         <CheckCircle2 size={44} className="text-green-500" />
                      </motion.div>
                      <h4 className="text-2xl font-black uppercase italic text-white mb-2 tracking-tighter">Conectado</h4>
                      <p className="text-[8px] font-black uppercase tracking-[0.3em] text-gray-600 mb-8 italic">Engine Operacional em 24Ghz</p>
                      <NeonButton onClick={() => setQrModal(p => ({ ...p, isOpen: false }))} className="!px-12 !py-4 !text-[10px] shadow-2xl">Acessar Painel</NeonButton>
                   </div>
                 )}
              </div>
              
              <div className="pt-8 border-t border-white/5 opacity-40 flex items-center justify-center gap-8">
                 <div className="flex items-center gap-3 text-white">
                    <ShieldCheck size={16} className="text-orange-500" />
                    <span className="text-[8px] font-black uppercase tracking-widest italic">Neural Guard V3</span>
                 </div>
                 <div className="flex items-center gap-3 text-white">
                    <Zap size={16} className="text-orange-500" />
                    <span className="text-[8px] font-black uppercase tracking-widest italic">Fast Sync</span>
                 </div>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
