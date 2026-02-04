
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageSquare, LogOut, Plus, Loader2, RefreshCw, 
  Trash2, X, Layers, Search, Send, CheckCircle2, 
  Smartphone, ShieldCheck, ChevronLeft, Bot, Zap, 
  Activity, User, Smile, Mic, ArrowRight,
  Database, QrCode, LayoutDashboard, Power
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
          phone: instData.ownerJid ? instData.ownerJid.split('@')[0] : 'Motor Standby',
          profilePicUrl: instData.profilePicUrl || ""
        };
      });
      setInstances(mapped);

      if (qrModal.isOpen && !qrModal.connected) {
        const current = mapped.find(i => i.name === qrModal.name);
        if (current?.status === 'CONNECTED') {
          setQrModal(p => ({ ...p, connected: true, status: 'Engine Sincronizada!' }));
          if (poolingRef.current) clearInterval(poolingRef.current);
        }
      }
    } catch (e) {
      console.error('Fetch Instances Fail');
    }
  };

  const pollQrCode = async (name: string) => {
    try {
      const res = await fetch(`${EVOLUTION_URL}/instance/connect/${name}`, { headers: HEADERS });
      const data = await res.json();
      
      // Busca profunda por base64 em múltiplos caminhos possíveis da API
      const qrCode = data.base64 || 
                     data.qrcode?.base64 || 
                     data.code?.base64 ||
                     (typeof data.code === 'string' && data.code.includes('base64') ? data.code : null);
      
      if (qrCode) {
        setQrModal(p => {
          if (p.connected) return p;
          return { ...p, code: qrCode, status: 'Pronto para Escanear' };
        });
      } else if (data.status === 'open' || data.instance?.status === 'open' || data.connectionStatus === 'open') {
        setQrModal(p => ({ ...p, connected: true, status: 'Conectado com Sucesso!' }));
        if (poolingRef.current) clearInterval(poolingRef.current);
        fetchInstances();
      }
    } catch (e) {
      console.log("Aguardando motor...");
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
      // Tenta criar
      const res = await fetch(`${EVOLUTION_URL}/instance/create`, {
        method: 'POST', 
        headers: HEADERS, 
        body: JSON.stringify({ instanceName: sanitizedName, qrcode: true })
      });
      
      const data = await res.json();

      // Se já existe ou criou, força o pooling de conexão
      if (res.ok || data.status === 400 || data.message?.includes('exists')) {
        setNewInstanceName('');
        
        // Force Logout antes para garantir um QR novo
        await fetch(`${EVOLUTION_URL}/instance/logout/${sanitizedName}`, { method: 'DELETE', headers: HEADERS }).catch(() => {});
        
        if (poolingRef.current) clearInterval(poolingRef.current);
        pollQrCode(sanitizedName);
        poolingRef.current = setInterval(() => pollQrCode(sanitizedName), 3000);
        
        fetchInstances();
      } else {
        alert("Falha na Injeção: " + (data.message || "Erro desconhecido"));
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

  const connectInstance = async (name: string) => {
    setQrModal({ isOpen: true, name, status: 'Reiniciando Handshake...', code: '', connected: false });
    
    // Força um logout para limpar o cache da Evolution e gerar QR novo
    await fetch(`${EVOLUTION_URL}/instance/logout/${name}`, { method: 'DELETE', headers: HEADERS }).catch(() => {});
    
    pollQrCode(name);
    if (poolingRef.current) clearInterval(poolingRef.current);
    poolingRef.current = setInterval(() => pollQrCode(name), 3000);
  };

  const deleteInstance = async (name: string) => {
    if (!confirm(`Remover motor ${name} permanentemente?`)) return;
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
    <button onClick={onClick} className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all group ${active ? 'bg-orange-500/10 text-orange-500 border border-orange-500/20 shadow-md' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}>
      <div className="flex items-center gap-3">
        <Icon size={16} className={active ? 'text-orange-500' : 'text-gray-500 group-hover:text-orange-500 transition-colors'} />
        {isSidebarExpanded && <span className="text-[9px] font-black uppercase tracking-[0.2em]">{label}</span>}
      </div>
      {isSidebarExpanded && badge && <span className="text-[7px] font-black text-white bg-orange-600 px-1.5 py-0.5 rounded-full">{badge}</span>}
    </button>
  );

  return (
    <div className="flex h-screen bg-[#050505] text-white overflow-hidden relative font-sans">
      <div className="fixed inset-0 grid-engine pointer-events-none opacity-5"></div>
      
      {/* SIDEBAR COMPACTA */}
      <aside className={`flex flex-col border-r border-white/5 bg-black/40 backdrop-blur-xl transition-all duration-300 z-50 ${isSidebarExpanded ? 'w-56' : 'w-16'}`}>
        <div className="p-6 flex justify-center"><Logo size="sm" /></div>
        <div className="flex-1 px-3 py-4 space-y-1.5">
          <SidebarItem icon={LayoutDashboard} label="Dashboard" active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} />
          <SidebarItem icon={MessageSquare} label="Chats" active={activeTab === 'atendimento'} onClick={() => setActiveTab('atendimento')} badge={leads.length} />
          <SidebarItem icon={Layers} label="Pipeline" active={activeTab === 'kanban'} onClick={() => setActiveTab('kanban')} />
          <SidebarItem icon={Smartphone} label="Engines" active={activeTab === 'integracoes'} onClick={() => setActiveTab('integracoes')} badge={instances.length} />
          <SidebarItem icon={Bot} label="Agentes IA" active={activeTab === 'agentes'} onClick={() => setActiveTab('agentes')} />
        </div>
        <div className="p-3 border-t border-white/5">
          <button onClick={onLogout} className="w-full flex items-center gap-3 px-3 py-4 text-gray-700 hover:text-orange-500 transition-all group font-black uppercase text-[8px] tracking-[0.3em]">
            <LogOut size={14} className="group-hover:-translate-x-1 transition-transform" />
            {isSidebarExpanded && <span>Sair</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-white/5 bg-black/20 backdrop-blur-md flex items-center justify-between px-8 shrink-0 z-40">
          <div className="flex items-center gap-5">
            <button onClick={() => setIsSidebarExpanded(!isSidebarExpanded)} className="p-1.5 glass rounded-lg text-orange-500 hover:scale-105 transition-transform"><ChevronLeft size={12} className={!isSidebarExpanded ? 'rotate-180' : ''} /></button>
            <h2 className="text-[8px] font-black uppercase tracking-[0.6em] text-white italic opacity-40">Neural Engine v3.14</h2>
          </div>
          <div className="flex items-center gap-6">
            <button onClick={() => {fetchInstances(); syncChats();}} className={`p-1.5 glass rounded-xl text-gray-400 hover:text-orange-500 transition-all ${isSyncing ? 'animate-spin text-orange-500' : ''}`}><RefreshCw size={12}/></button>
            <div className="flex items-center gap-3">
               <span className="text-[8px] font-black uppercase text-white italic tracking-widest">{user.name}</span>
               <div className="w-7 h-7 rounded-lg bg-rajado p-0.5 shadow-lg shadow-orange-500/20">
                  <div className="w-full h-full bg-black rounded-[6px] flex items-center justify-center text-[9px] font-black italic">{user.name?.[0]}</div>
               </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-8 custom-scrollbar">
           {activeTab === 'integracoes' && (
             <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="flex flex-col md:flex-row justify-between items-end gap-6 border-b border-white/5 pb-8">
                  <div>
                    <h1 className="text-4xl font-black uppercase italic tracking-tighter mb-1">Neural <span className="text-orange-500">Engines.</span></h1>
                    <p className="text-[8px] font-black uppercase tracking-[0.5em] text-gray-700 italic">Clusters de Processamento Neural</p>
                  </div>
                  <div className="flex gap-3 w-full md:w-auto">
                    <input 
                      value={newInstanceName} onChange={e => setNewInstanceName(e.target.value)}
                      placeholder="Identidade do Motor..." 
                      className="flex-1 md:w-56 bg-white/[0.02] border border-white/5 rounded-xl py-3 px-5 text-[9px] font-black uppercase outline-none focus:border-orange-500/40 transition-all"
                    />
                    <NeonButton onClick={createInstance} className="!px-6 !text-[8px] !py-3">
                      {isCreatingInstance ? <Loader2 className="animate-spin" size={12}/> : 'Ativar Motor'}
                    </NeonButton>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                   {instances.map(inst => (
                     <GlassCard key={inst.id} className="!p-5 group relative overflow-hidden bg-gradient-to-br from-white/[0.01] to-transparent">
                        <div className="flex flex-col gap-5 relative z-10">
                           <div className="flex items-center gap-4">
                              <div className="relative">
                                 <div className="w-12 h-12 rounded-xl bg-black border border-white/5 flex items-center justify-center overflow-hidden shadow-2xl">
                                    {inst.profilePicUrl ? <img src={inst.profilePicUrl} className="w-full h-full object-cover" /> : <Smartphone size={20} className="text-gray-800" />}
                                 </div>
                                 <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-[3px] border-[#050505] ${inst.status === 'CONNECTED' ? 'bg-green-500 shadow-[0_0_8px_green]' : 'bg-red-500 shadow-[0_0_8px_red]'}`} />
                              </div>
                              <div className="flex-1 overflow-hidden">
                                 <div className="text-lg font-black uppercase italic tracking-tighter text-white truncate leading-none mb-1">{inst.name}</div>
                                 <div className="text-[7px] font-black text-gray-700 uppercase tracking-[0.2em] italic">{inst.phone}</div>
                              </div>
                           </div>
                           <div className="flex gap-1.5">
                              {inst.status === 'DISCONNECTED' ? (
                                <NeonButton onClick={() => connectInstance(inst.name)} className="flex-1 !py-2 !text-[7px] !rounded-lg">Sincronizar</NeonButton>
                              ) : (
                                <div className="flex-1 py-2 border border-green-500/20 rounded-lg text-green-500 text-[7px] font-black uppercase text-center bg-green-500/5 flex items-center justify-center gap-1.5">
                                  <CheckCircle2 size={10}/> Online
                                </div>
                              )}
                              <button onClick={() => connectInstance(inst.name)} title="Forçar Handshake" className="p-2.5 rounded-lg bg-white/[0.02] text-gray-500 hover:text-orange-500 border border-white/5 transition-all"><Power size={12}/></button>
                              <button onClick={() => deleteInstance(inst.name)} className="p-2.5 rounded-lg bg-red-600/5 text-red-500 hover:bg-red-600 hover:text-white border border-red-500/10 transition-all"><Trash2 size={12}/></button>
                           </div>
                        </div>
                     </GlassCard>
                   ))}
                </div>
             </div>
           )}

           {activeTab === 'atendimento' && (
             <div className="h-[calc(100vh-160px)] flex glass rounded-[1.5rem] overflow-hidden border-white/5 shadow-2xl animate-in zoom-in-95 duration-500">
                <div className="w-[320px] border-r border-white/5 flex flex-col bg-black/40">
                   <header className="p-5 border-b border-white/5 bg-black/20 flex items-center justify-between">
                      <span className="text-[8px] font-black uppercase tracking-[0.4em] italic text-orange-500">Threads Ativas</span>
                      <button onClick={syncChats} className={`p-1 glass rounded-lg text-gray-500 hover:text-orange-500 transition-all ${isSyncing ? 'animate-spin' : ''}`}><RefreshCw size={10}/></button>
                   </header>
                   <div className="flex-1 overflow-y-auto custom-scrollbar p-2.5 space-y-1">
                      {leads.map(lead => (
                        <button key={lead.id} onClick={() => setSelectedLeadId(lead.id)} className={`w-full flex items-center gap-3.5 p-3.5 rounded-2xl text-left border transition-all ${selectedLeadId === lead.id ? 'bg-orange-500/5 border-orange-500/20' : 'border-transparent hover:bg-white/[0.02]'}`}>
                           <div className="w-9 h-9 rounded-xl bg-black flex items-center justify-center text-orange-500 font-black italic border border-white/5 overflow-hidden">
                              {lead.avatar ? <img src={lead.avatar} className="w-full h-full object-cover" /> : lead.contactName[0]}
                           </div>
                           <div className="flex-1 overflow-hidden">
                              <span className="text-[10px] font-black uppercase italic truncate text-white block tracking-tighter mb-0.5">{lead.contactName}</span>
                              <p className="text-[7px] text-gray-600 italic truncate opacity-60 leading-none">"{lead.lastMessage}"</p>
                           </div>
                        </button>
                      ))}
                   </div>
                </div>
                <div className="flex-1 flex flex-col bg-black/60 relative">
                   {selectedLeadId ? (
                     <div className="flex-1 flex flex-col h-full">
                        <header className="p-5 border-b border-white/5 bg-black/40 backdrop-blur-3xl flex items-center justify-between z-10">
                           <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center text-orange-500 font-black italic border border-orange-500/20 overflow-hidden">
                                 {leads.find(l => l.id === selectedLeadId)?.avatar ? <img src={leads.find(l => l.id === selectedLeadId)?.avatar} className="w-full h-full object-cover" /> : <User size={18}/>}
                              </div>
                              <div>
                                <h4 className="text-lg font-black uppercase italic tracking-tighter text-white leading-none mb-1">{leads.find(l => l.id === selectedLeadId)?.contactName}</h4>
                                <span className="text-[7px] font-black text-gray-700 tracking-[0.2em] italic">{leads.find(l => l.id === selectedLeadId)?.contactPhone}</span>
                              </div>
                           </div>
                        </header>
                        <div className="flex-1 overflow-y-auto p-8 space-y-5 custom-scrollbar">
                           {chatMessages.map((m, idx) => (
                             <div key={idx} className={`flex ${m.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] p-4 rounded-[1.5rem] shadow-xl ${m.sender === 'me' ? 'bg-orange-600 text-white rounded-br-none' : 'bg-white/[0.03] text-gray-100 border border-white/5 rounded-bl-none'}`}>
                                   <p className="text-[12px] font-medium leading-snug tracking-tight">{m.text}</p>
                                   <div className="text-[5px] font-black uppercase mt-2.5 text-right opacity-30 italic">{m.time}</div>
                                </div>
                             </div>
                           ))}
                           <div ref={chatEndRef} />
                        </div>
                        <div className="p-6 bg-black/40 border-t border-white/5">
                           <div className="max-w-3xl mx-auto flex gap-3">
                              <input 
                                value={messageInput} onChange={e => setMessageInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleSend()}
                                placeholder="Resposta Neural..." 
                                className="flex-1 bg-white/[0.02] border border-white/10 rounded-xl py-3 px-6 text-[11px] font-bold uppercase outline-none focus:border-orange-500/40 transition-all"
                              />
                              <NeonButton onClick={handleSend} className="!p-3.5 !rounded-xl shadow-xl group">
                                 <Send size={18} className="group-hover:translate-x-1 transition-transform" />
                              </NeonButton>
                           </div>
                        </div>
                     </div>
                   ) : (
                     <div className="flex-1 flex flex-col items-center justify-center opacity-10 p-20 text-center scale-75">
                        <Logo size="md" className="grayscale mb-6" />
                        <h4 className="text-2xl font-black uppercase tracking-[0.6em] italic text-white">Cluster Standby</h4>
                     </div>
                   )}
                </div>
             </div>
           )}

           {activeTab === 'kanban' && (
             <div className="h-full animate-in slide-in-from-right-8 duration-700">
                <header className="mb-8">
                   <h1 className="text-4xl font-black uppercase italic tracking-tighter leading-none">Neural <span className="text-orange-500">Pipeline.</span></h1>
                   <p className="text-[8px] font-black uppercase tracking-[0.4em] text-gray-700 italic mt-1.5">Gestão Industrial de Leads</p>
                </header>
                <DragDropContext onDragEnd={onDragEnd}>
                  <div className="flex gap-6 items-start overflow-x-auto custom-scrollbar pb-8">
                    {KANBAN_COLS.map(col => (
                      <div key={col.id} className="w-[320px] shrink-0">
                        <div className="px-5 py-3.5 flex items-center justify-between mb-5 glass rounded-xl border-white/10 shadow-lg bg-gradient-to-r from-white/[0.01] to-transparent">
                           <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white italic">{col.title}</span>
                           <div className="text-[7px] font-black text-orange-500 bg-orange-500/10 px-2.5 py-1 rounded-full border border-orange-500/20">{leads.filter(l => l.status === col.id).length}</div>
                        </div>
                        <Droppable droppableId={col.id}>
                          {(provided) => (
                            <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-5 min-h-[500px]">
                              {leads.filter(l => l.status === col.id).map((lead, index) => (
                                <Draggable key={lead.id} draggableId={lead.id} index={index}>
                                  {(provided, snapshot) => (
                                    <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} className={`p-5 rounded-[1.8rem] glass border-white/10 shadow-xl transition-all ${snapshot.isDragging ? 'rotate-1 scale-105 z-[100] border-orange-500/40 bg-orange-500/5' : 'hover:border-orange-500/20'}`}>
                                       <h4 className="text-base font-black uppercase italic tracking-tighter text-white mb-1.5 leading-none">{lead.contactName}</h4>
                                       <p className="text-[8px] text-gray-600 line-clamp-2 italic mb-6 leading-relaxed font-medium">"{lead.lastMessage}"</p>
                                       <div className="pt-5 border-t border-white/5 flex items-center justify-between">
                                          <div className="text-xs font-black text-orange-500 italic">R$ {lead.value},00</div>
                                          <button onClick={() => {setSelectedLeadId(lead.id); setActiveTab('atendimento');}} className="p-2 glass rounded-lg text-orange-500 hover:bg-orange-500 hover:text-white transition-all"><ArrowRight size={14}/></button>
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

      {/* MODAL QR - COMPACTO E INFALÍVEL */}
      <AnimatePresence>
        {qrModal.isOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/98 backdrop-blur-3xl">
            <div className="bg-[#050505] border border-orange-500/30 p-8 rounded-[2.5rem] text-center max-w-sm w-full relative shadow-[0_0_100px_rgba(255,115,0,0.1)] animate-in zoom-in-95 duration-500">
              <button 
                onClick={() => { setQrModal(p => ({ ...p, isOpen: false })); if(poolingRef.current) clearInterval(poolingRef.current); }} 
                className="absolute top-6 right-6 text-gray-800 hover:text-white p-1.5 hover:bg-white/5 rounded-full transition-all"
              >
                <X size={24}/>
              </button>
              
              <div className="mb-6">
                <div className="flex items-center justify-center gap-3 mb-3">
                  <div className="p-2.5 bg-orange-500/10 rounded-xl border border-orange-500/20">
                    <QrCode className="text-orange-500" size={24} />
                  </div>
                  <h3 className="text-2xl font-black uppercase italic tracking-tighter text-white leading-none">{qrModal.name}</h3>
                </div>
                <div className="flex items-center justify-center gap-2.5">
                  <div className={`w-1 h-1 rounded-full ${qrModal.connected ? 'bg-green-500 shadow-[0_0_8px_green]' : 'bg-orange-500 animate-pulse'}`} />
                  <p className="text-[9px] font-black uppercase text-orange-500 tracking-[0.4em] italic">{qrModal.status}</p>
                </div>
              </div>

              <div className="relative mb-6 flex justify-center">
                 <div className="bg-white p-5 rounded-[2rem] flex items-center justify-center min-h-[280px] min-w-[280px] border-[8px] border-white/5 relative overflow-hidden shadow-xl">
                    {qrModal.code ? (
                      <motion.img 
                        key={qrModal.code} // Chave dinâmica força renderização limpa
                        initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} 
                        src={qrModal.code.startsWith('data:') ? qrModal.code : `data:image/png;base64,${qrModal.code}`} 
                        className="w-full h-auto block rounded-lg shadow-inner" 
                        alt="Neural Sync QR" 
                        onLoad={() => setQrModal(p => ({ ...p, status: 'Pronto para Sincronizar' }))}
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-6 p-8">
                        <div className="relative">
                          <Loader2 className="animate-spin text-orange-500" size={40} strokeWidth={3} />
                          <Activity className="absolute inset-0 m-auto text-orange-500/20" size={16} />
                        </div>
                        <span className="text-[8px] font-black text-gray-900 uppercase tracking-[0.2em] italic animate-pulse">Injetando Sincronização Neural...</span>
                      </div>
                    )}
                 </div>
                 
                 {qrModal.connected && (
                   <div className="absolute inset-0 bg-black/95 backdrop-blur-2xl rounded-[2rem] flex flex-col items-center justify-center z-20 border border-green-500/30 animate-in fade-in duration-500">
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mb-5 border border-green-500/20 shadow-[0_0_30px_rgba(34,197,94,0.1)]">
                         <CheckCircle2 size={36} className="text-green-500" />
                      </motion.div>
                      <h4 className="text-xl font-black uppercase italic text-white mb-1.5 tracking-tighter">Conectado</h4>
                      <p className="text-[8px] font-black uppercase tracking-[0.3em] text-gray-600 mb-6 italic">Engine Operacional</p>
                      <NeonButton onClick={() => setQrModal(p => ({ ...p, isOpen: false }))} className="!px-10 !py-3.5 !text-[9px] shadow-2xl">Acessar Painel</NeonButton>
                   </div>
                 )}
              </div>
              
              <div className="pt-6 border-t border-white/5 opacity-40 flex items-center justify-center gap-6">
                 <div className="flex items-center gap-2 text-white">
                    <ShieldCheck size={14} className="text-orange-500" />
                    <span className="text-[7px] font-black uppercase tracking-widest italic">Neural Guard</span>
                 </div>
                 <div className="flex items-center gap-2 text-white">
                    <Zap size={14} className="text-orange-500" />
                    <span className="text-[7px] font-black uppercase tracking-widest italic">Sync 24Ghz</span>
                 </div>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
