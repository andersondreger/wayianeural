
import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageSquare, LogOut, Plus, Loader2, RefreshCw, 
  Trash2, X, Layers, Search, Send, CheckCircle2, 
  Smartphone, ShieldCheck, ChevronLeft, ChevronRight,
  Bot, Zap, Activity, AlertCircle, Paperclip, MoreVertical,
  Settings, LayoutDashboard, Globe, User, Terminal, AlertTriangle,
  LayoutGrid, Target, DollarSign, Filter, Sliders, Bell, Brain,
  Trophy, TrendingUp, Sparkles, Hash, Power, UserCheck, ArrowRight
} from 'lucide-react';
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
const HEADERS = { 
  'apikey': EVOLUTION_API_KEY, 
  'Content-Type': 'application/json' 
};

const KANBAN_COLUMNS: KanbanColumn[] = [
  { id: 'novo', title: 'Novos Leads', color: 'border-blue-500/20 text-blue-400' },
  { id: 'em_atendimento', title: 'Atendimento', color: 'border-orange-500/20 text-orange-400' },
  { id: 'aguardando', title: 'Aguardando', color: 'border-purple-500/20 text-purple-400' },
  { id: 'ganho', title: 'Ganho', color: 'border-green-500/20 text-green-400' }
];

export function Dashboard({ user, onLogout }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [instances, setInstances] = useState<EvolutionInstance[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [leads, setLeads] = useState<Ticket[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [newInstanceName, setNewInstanceName] = useState('');
  const [isCreatingInstance, setIsCreatingInstance] = useState(false);
  const [qrModal, setQrModal] = useState({ isOpen: false, code: '', name: '', status: '', connected: false });

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // --- EVOLUTION API: CRUD DE INSTÂNCIAS ---
  const fetchInstances = async () => {
    try {
      const res = await fetch(`${EVOLUTION_URL}/instance/fetchInstances`, { headers: HEADERS });
      const data = await res.json();
      const raw = Array.isArray(data) ? data : (data.instances || []);
      const mapped = raw.map((item: any) => {
        const inst = item.instance || item;
        return {
          id: inst.instanceName || inst.name,
          name: inst.instanceName || inst.name,
          status: inst.connectionStatus === 'open' || inst.status === 'open' ? 'CONNECTED' : 'DISCONNECTED',
          phone: inst.ownerJid?.split('@')[0] || '---',
          profilePicUrl: inst.profilePicUrl || ''
        } as EvolutionInstance;
      });
      setInstances(mapped);
    } catch (e) { console.error("Error fetching instances:", e); }
  };

  const createInstance = async () => {
    if (!newInstanceName.trim()) return;
    setIsCreatingInstance(true);
    const name = newInstanceName.trim().toLowerCase().replace(/\s+/g, '-');
    try {
      const res = await fetch(`${EVOLUTION_URL}/instance/create`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({ instanceName: name, qrcode: true })
      });
      if (res.ok) {
        setNewInstanceName('');
        setQrModal({ isOpen: true, code: '', name: name, status: 'Handshake Inicial...', connected: false });
        await fetchInstances();
        // Buscar QR Code imediatamente
        connectInstance(name);
      }
    } catch (e) { console.error(e); } finally { setIsCreatingInstance(false); }
  };

  const connectInstance = async (name: string) => {
    setQrModal(p => ({ ...p, isOpen: true, name, status: 'Gerando QR Neural...' }));
    try {
      const res = await fetch(`${EVOLUTION_URL}/instance/connect/${name}`, { headers: HEADERS });
      const data = await res.json();
      if (data.base64) {
        setQrModal(p => ({ ...p, code: data.base64, status: 'Escanear Agora' }));
      }
    } catch (e) { console.error(e); }
  };

  const deleteInstance = async (name: string) => {
    if (!confirm(`Deseja remover a engine ${name}? Esta ação é irreversível.`)) return;
    try {
      await fetch(`${EVOLUTION_URL}/instance/delete/${name}`, { method: 'DELETE', headers: HEADERS });
      await fetchInstances();
    } catch (e) { console.error(e); }
  };

  const logoutInstance = async (name: string) => {
    try {
      await fetch(`${EVOLUTION_URL}/instance/logout/${name}`, { method: 'DELETE', headers: HEADERS });
      await fetchInstances();
    } catch (e) { console.error(e); }
  };

  // --- GESTÃO DE CHATS E LEADS ---
  const syncChats = async () => {
    setIsSyncing(true);
    const allLeads: Ticket[] = [];
    try {
      const activeInstances = instances.filter(i => i.status === 'CONNECTED');
      if (activeInstances.length === 0) {
        alert("Nenhuma engine conectada para sincronizar.");
        setIsSyncing(false);
        return;
      }

      for (const inst of activeInstances) {
        try {
          const res = await fetch(`${EVOLUTION_URL}/chat/findChats/${inst.name}`, { method: 'POST', headers: HEADERS });
          const data = await res.json();
          const items = Array.isArray(data) ? data : (data.data || data.chats || []);
          
          items.forEach((item: any) => {
            const jid = item.jid || item.id;
            if (!jid || jid.includes('@g.us')) return; // Ignorar grupos por enquanto

            allLeads.push({
              id: jid,
              contactName: item.pushName || item.name || jid.split('@')[0],
              contactPhone: jid.split('@')[0],
              avatar: item.profilePicUrl || "",
              lastMessage: item.message?.conversation || item.lastMsg?.text || "Sincronização Ativa",
              time: "Agora",
              status: 'novo',
              unreadCount: item.unreadCount || 0,
              assignedTo: 'AI Neural',
              protocol: Math.random().toString(36).substring(7).toUpperCase(),
              messages: [],
              instanceSource: inst.name,
              sentiment: 'happy',
              value: Math.floor(Math.random() * 500) + 100,
              lastActivity: Date.now()
            });
          });
        } catch (e) { console.error(`Error on inst ${inst.name}:`, e); }
      }
      setLeads(allLeads);
    } catch (e) { console.error(e); } finally { setIsSyncing(false); }
  };

  const handleSend = async () => {
    const lead = leads.find(l => l.id === selectedLeadId);
    if (!lead || !messageInput.trim() || isSending) return;
    
    setIsSending(true);
    const text = messageInput;
    setMessageInput('');

    try {
      const res = await fetch(`${EVOLUTION_URL}/message/sendText/${lead.instanceSource}`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({ number: lead.id, text: text })
      });

      if (res.ok) {
        setChatMessages(prev => [...prev, {
          id: Date.now().toString(),
          text: text,
          sender: 'me',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: 'sent',
          type: 'text'
        }]);
      }
    } catch (e) { console.error(e); } finally { setIsSending(false); }
  };

  useEffect(() => {
    fetchInstances();
    const interval = setInterval(fetchInstances, 15000);
    return () => clearInterval(interval);
  }, []);

  const currentLead = useMemo(() => leads.find(l => l.id === selectedLeadId), [selectedLeadId, leads]);

  // --- SIDEBAR NAVIGATION ---
  const NavItem = ({ id, icon: Icon, label }: { id: DashboardTab, icon: any, label: string }) => (
    <button 
      onClick={() => setActiveTab(id)}
      className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all border ${
        activeTab === id 
        ? 'bg-orange-600/10 text-orange-500 border-orange-500/20 shadow-lg shadow-orange-600/5' 
        : 'text-gray-600 border-transparent hover:bg-white/[0.02] hover:text-white'
      }`}
    >
      <Icon size={20} strokeWidth={2.5} />
      {isSidebarExpanded && <span className="text-[10px] font-black uppercase tracking-widest italic">{label}</span>}
    </button>
  );

  return (
    <div className="flex h-screen bg-[#020202] text-white selection:bg-orange-500/30 overflow-hidden">
      {/* Background Neural Orbs */}
      <div className="neural-orb top-[-10%] left-[-10%] opacity-20"></div>
      <div className="neural-orb bottom-[-10%] right-[-10%] bg-blue-500/5 opacity-30"></div>
      <div className="fixed inset-0 grid-engine pointer-events-none opacity-5"></div>

      {/* Sidebar Híbrida */}
      <motion.aside 
        animate={{ width: isSidebarExpanded ? 260 : 85 }}
        className="relative z-[60] h-full border-r border-white/5 bg-black/60 backdrop-blur-3xl flex flex-col p-6 transition-all duration-300"
      >
        <div className="mb-12 flex items-center justify-between">
          <button onClick={() => setIsSidebarExpanded(!isSidebarExpanded)} className="p-3 glass rounded-xl text-orange-500 hover:scale-110 transition-transform">
            {isSidebarExpanded ? <ChevronLeft size={18}/> : <ChevronRight size={18}/>}
          </button>
        </div>

        <nav className="flex-1 space-y-3">
          <NavItem id="overview" icon={LayoutDashboard} label="Visão Geral" />
          <NavItem id="atendimento" icon={MessageSquare} label="Atendimento" />
          <NavItem id="kanban" icon={LayoutGrid} label="Neural CRM" />
          <NavItem id="integracoes" icon={Layers} label="Engines" />
          <NavItem id="agentes" icon={Bot} label="Agentes IA" />
          <NavItem id="settings" icon={Settings} label="Configurações" />
        </nav>

        <button onClick={onLogout} className="mt-auto flex items-center gap-4 p-4 text-gray-700 hover:text-red-500 transition-colors">
          <LogOut size={20} />
          {isSidebarExpanded && <span className="text-[10px] font-black uppercase tracking-widest italic">Desconectar</span>}
        </button>
      </motion.aside>

      <div className="flex-1 flex flex-col relative overflow-hidden">
        {/* Top Bar Sonexo Style */}
        <header className="relative z-50 border-b border-white/5 bg-black/40 backdrop-blur-2xl px-8 py-5 flex items-center justify-between shadow-2xl">
           <div className="flex items-center gap-4">
              <Logo size="sm" />
              <div className="h-6 w-px bg-white/10 mx-4 hidden md:block"></div>
              <div className="hidden md:flex items-center gap-3">
                <span className="text-[9px] font-black uppercase tracking-[0.4em] text-gray-600 italic">Cluster Status:</span>
                <div className="flex items-center gap-2 px-3 py-1 glass rounded-full border-orange-500/20">
                   <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse shadow-[0_0_10px_orange]" />
                   <span className="text-[8px] font-black text-orange-500 uppercase tracking-widest italic">{instances.filter(i => i.status === 'CONNECTED').length} Chips Online</span>
                </div>
              </div>
           </div>

           <div className="flex items-center gap-6">
              <div className="flex items-center gap-4 glass px-5 py-2 rounded-full border-white/10 group cursor-pointer hover:border-orange-500/30 transition-all">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-orange-600 to-red-600 flex items-center justify-center text-[10px] font-black italic shadow-xl">
                   {user.name?.[0] || 'W'}
                </div>
                <div>
                   <div className="text-[9px] font-black uppercase tracking-tighter text-white">{user.name}</div>
                   <div className="text-[7px] font-black uppercase tracking-widest text-orange-500 italic">WayFlow Master</div>
                </div>
                <Bell size={14} className="text-gray-600 group-hover:text-white transition-colors ml-2" />
              </div>
           </div>
        </header>

        {/* Dynamic Content Area */}
        <main className="flex-1 overflow-y-auto custom-scrollbar p-10 relative">
          
          {/* VIEW: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
               <div className="flex flex-col md:flex-row justify-between items-end gap-6">
                  <div>
                    <h2 className="text-5xl font-black uppercase italic tracking-tighter mb-2">Neural <span className="text-orange-500">Overview.</span></h2>
                    <p className="text-[10px] font-black text-gray-700 uppercase tracking-widest italic">Métricas de Performance do Cluster Neural</p>
                  </div>
                  <div className="flex gap-4">
                     <GlassButton className="!px-8">Relatórios</GlassButton>
                     <NeonButton onClick={syncChats} className="!px-10 flex items-center gap-2">
                        {isSyncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} 
                        Sincronizar Tudo
                     </NeonButton>
                  </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <GlassCard className="!p-8 relative overflow-hidden group border-orange-500/10">
                    <div className="relative z-10">
                      <TrendingUp size={24} className="text-orange-500 mb-6" />
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-600 mb-1 italic">Vendas Estimadas</h3>
                      <div className="text-4xl font-black italic tracking-tighter text-white">R$ {leads.reduce((acc, curr) => acc + (curr.value || 0), 0).toLocaleString()}</div>
                    </div>
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><DollarSign size={80}/></div>
                  </GlassCard>

                  <GlassCard className="!p-8 border-blue-500/10">
                    <MessageSquare size={24} className="text-blue-500 mb-6" />
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-600 mb-1 italic">Leads Sincronizados</h3>
                    <div className="text-4xl font-black italic tracking-tighter text-white">{leads.length}</div>
                  </GlassCard>

                  <GlassCard className="!p-8 border-green-500/10">
                    <CheckCircle2 size={24} className="text-green-500 mb-6" />
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-600 mb-1 italic">Concluidos</h3>
                    <div className="text-4xl font-black italic tracking-tighter text-white">{leads.filter(l => l.status === 'ganho').length}</div>
                  </GlassCard>

                  <GlassCard className="!p-8 border-purple-500/10">
                    <Activity size={24} className="text-purple-500 mb-6" />
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-600 mb-1 italic">Taxa de Resposta</h3>
                    <div className="text-4xl font-black italic tracking-tighter text-white">99%</div>
                  </GlassCard>
               </div>

               <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <GlassCard className="lg:col-span-2 !p-0 overflow-hidden">
                     <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.3em] italic text-orange-500">Fluxo de Atendimento Recente</h4>
                        <div className="flex gap-2">
                           <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                           <span className="text-[8px] font-bold text-gray-600 uppercase tracking-widest italic">Live Stream</span>
                        </div>
                     </div>
                     <div className="p-4 space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar">
                        {leads.slice(0, 10).map(lead => (
                          <div key={lead.id} className="flex items-center justify-between p-5 rounded-2xl hover:bg-white/[0.03] transition-all border border-transparent hover:border-white/5 group">
                             <div className="flex items-center gap-5">
                                <div className="w-12 h-12 rounded-2xl bg-orange-600/10 flex items-center justify-center text-orange-500 font-black italic border border-orange-500/10 overflow-hidden shadow-lg">
                                   {lead.avatar ? <img src={lead.avatar} className="w-full h-full object-cover" /> : lead.contactName[0]}
                                </div>
                                <div>
                                   <div className="text-[11px] font-black uppercase italic text-white/90 tracking-tighter">{lead.contactName}</div>
                                   <div className="text-[8px] font-black uppercase text-gray-700 tracking-[0.2em]">{lead.contactPhone}</div>
                                </div>
                             </div>
                             <div className="flex items-center gap-10">
                                <div className="text-right">
                                   <div className="text-[10px] font-black text-orange-500 italic">R$ {lead.value},00</div>
                                   <div className="text-[7px] font-bold uppercase text-gray-800 italic">Value Est.</div>
                                </div>
                                <button onClick={() => {setSelectedLeadId(lead.id); setActiveTab('atendimento');}} className="p-3 glass rounded-xl text-gray-700 hover:text-orange-500 transition-colors opacity-0 group-hover:opacity-100"><ArrowRight size={14}/></button>
                             </div>
                          </div>
                        ))}
                     </div>
                  </GlassCard>

                  <div className="space-y-8">
                     <GlassCard className="!p-10 !rounded-[3rem] border-orange-500/10 flex flex-col justify-center items-center text-center bg-gradient-to-br from-orange-500/[0.03] to-transparent shadow-2xl">
                        <Trophy className="text-orange-500 mb-6" size={48} />
                        <h4 className="text-2xl font-black uppercase italic tracking-tighter mb-4">Meta Batida <br/> <span className="text-orange-500">WayFlow!</span></h4>
                        <p className="text-[10px] font-bold text-gray-700 uppercase tracking-widest leading-relaxed italic mb-8">Você converteu 85% dos leads quentes nesta semana.</p>
                        <NeonButton className="w-full !py-4">Explorar Insights</NeonButton>
                     </GlassCard>
                  </div>
               </div>
            </div>
          )}

          {/* VIEW: ATENDIMENTO */}
          {activeTab === 'atendimento' && (
            <div className="flex-1 h-[calc(100vh-200px)] flex overflow-hidden glass rounded-[3rem] border-white/5 shadow-2xl animate-in zoom-in-95 duration-500">
               <div className="w-[400px] border-r border-white/5 flex flex-col bg-black/40">
                  <header className="p-8 border-b border-white/5 flex items-center justify-between">
                     <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                        <h3 className="text-[10px] font-black uppercase tracking-[0.4em] italic text-orange-500">Neural Inbox</h3>
                     </div>
                     <button onClick={syncChats} className={`p-2 rounded-xl transition-all ${isSyncing ? 'animate-spin text-orange-500' : 'text-gray-700 hover:bg-white/5'}`}><RefreshCw size={14}/></button>
                  </header>
                  <div className="p-6">
                    <div className="relative">
                       <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-700" size={14} />
                       <input placeholder="BUSCAR CONTATO..." className="w-full bg-black/40 border border-white/5 rounded-2xl py-3 pl-12 pr-6 text-[10px] font-black uppercase tracking-widest outline-none focus:border-orange-500/30 transition-all shadow-inner" />
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
                     {leads.map(lead => (
                       <button 
                         key={lead.id} 
                         onClick={() => setSelectedLeadId(lead.id)}
                         className={`w-full flex items-center gap-4 p-5 rounded-[2.5rem] transition-all text-left border ${selectedLeadId === lead.id ? 'bg-orange-600/10 border-orange-500/20 shadow-xl' : 'border-transparent hover:bg-white/[0.03]'}`}
                       >
                          <div className="w-14 h-14 rounded-3xl bg-orange-600/10 flex items-center justify-center text-orange-500 font-black italic border border-orange-500/10 shrink-0 uppercase overflow-hidden shadow-lg relative">
                             {lead.avatar ? <img src={lead.avatar} className="w-full h-full object-cover" /> : lead.contactName[0]}
                             <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-[#020202] rounded-full shadow-[0_0_10px_green]" />
                          </div>
                          <div className="flex-1 overflow-hidden">
                             <div className="flex justify-between items-center mb-1">
                                <span className="text-[11px] font-black uppercase truncate italic text-white tracking-tighter">{lead.contactName}</span>
                                <span className="text-[7px] text-gray-700 font-bold">{lead.time}</span>
                             </div>
                             <p className="text-[9px] text-gray-600 truncate italic leading-relaxed">"{lead.lastMessage}"</p>
                             <div className="mt-2 flex items-center gap-2">
                                <span className="text-[7px] font-black uppercase text-orange-500/60 tracking-widest italic">{lead.instanceSource}</span>
                             </div>
                          </div>
                       </button>
                     ))}
                  </div>
               </div>

               <div className="flex-1 flex flex-col bg-black/20">
                  {selectedLeadId && currentLead ? (
                     <div className="flex-1 flex flex-col h-full relative">
                        <header className="p-8 border-b border-white/5 flex items-center justify-between bg-black/40 backdrop-blur-3xl z-10 shadow-2xl">
                           <div className="flex items-center gap-6">
                              <div className="w-16 h-16 rounded-[2rem] bg-orange-600/10 flex items-center justify-center text-orange-500 font-black italic border border-orange-500/10 shadow-2xl overflow-hidden">
                                 {currentLead.avatar ? <img src={currentLead.avatar} className="w-full h-full object-cover" /> : currentLead.contactName[0]}
                              </div>
                              <div>
                                 <h4 className="text-3xl font-black uppercase italic tracking-tighter text-orange-500">{currentLead.contactName}</h4>
                                 <div className="flex items-center gap-4 mt-1">
                                    <span className="text-[10px] font-black uppercase text-gray-700 tracking-[0.2em] italic">{currentLead.contactPhone}</span>
                                    <span className="px-3 py-1 rounded-full bg-orange-500/10 text-[7px] font-black uppercase text-orange-500 tracking-widest border border-orange-500/20 shadow-lg shadow-orange-500/5">via {currentLead.instanceSource}</span>
                                 </div>
                              </div>
                           </div>
                           <div className="flex gap-4">
                              <button className="p-4 rounded-2xl bg-white/5 text-gray-600 hover:text-orange-500 transition-all border border-white/5 shadow-xl"><UserCheck size={18}/></button>
                              <button className="p-4 rounded-2xl bg-white/5 text-gray-600 hover:text-orange-500 transition-all border border-white/5 shadow-xl"><MoreVertical size={18}/></button>
                           </div>
                        </header>

                        <div className="flex-1 overflow-y-auto p-12 space-y-6 custom-scrollbar bg-gradient-to-b from-transparent to-black/30">
                           {chatMessages.map((m, idx) => (
                             <div key={idx} className={`flex ${m.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[70%] p-7 rounded-[2.5rem] shadow-2xl relative ${m.sender === 'me' ? 'bg-orange-600 text-white rounded-br-none shadow-orange-600/10' : 'bg-white/[0.03] text-gray-100 border border-white/10 rounded-bl-none shadow-black/80'}`}>
                                   <p className="text-[14px] font-medium leading-relaxed tracking-tight">{m.text}</p>
                                   <div className="text-[8px] font-black uppercase mt-4 opacity-30 tracking-widest text-right italic">{m.time}</div>
                                </div>
                             </div>
                           ))}
                           <div ref={chatEndRef} />
                        </div>

                        <div className="p-10 border-t border-white/5 flex gap-5 bg-black/60 backdrop-blur-3xl shadow-[0_-20px_50px_rgba(0,0,0,0.5)]">
                           <button className="p-5 rounded-2xl bg-white/5 text-gray-700 hover:text-orange-500 transition-all border border-white/5"><Paperclip size={24}/></button>
                           <input 
                             value={messageInput} onChange={e => setMessageInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleSend()}
                             placeholder="ESCREVER RESPOSTA NEURAL..." 
                             className="flex-1 bg-white/[0.02] border border-white/10 rounded-2xl py-5 px-8 text-[12px] font-black uppercase italic outline-none focus:border-orange-500 transition-all placeholder:text-gray-900 shadow-inner"
                           />
                           <button onClick={handleSend} className="p-6 bg-orange-600 text-white rounded-3xl hover:bg-orange-500 shadow-2xl transition-all min-w-[120px] flex items-center justify-center transform active:scale-95 group">
                              {isSending ? <Loader2 className="animate-spin" size={26} /> : <Send size={26} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />}
                           </button>
                        </div>
                     </div>
                  ) : (
                     <div className="flex-1 flex flex-col items-center justify-center text-center p-20">
                        <div className="w-32 h-32 bg-orange-500/5 rounded-full flex items-center justify-center mb-10 animate-pulse border border-orange-500/10">
                           <Logo size="sm" className="grayscale opacity-20" />
                        </div>
                        <h4 className="text-xl font-black uppercase italic tracking-[0.5em] text-gray-800">Selecione um Terminal</h4>
                        <p className="text-[10px] font-bold text-gray-800 uppercase tracking-widest mt-4 max-w-xs leading-relaxed italic">Inicie uma conexão neural selecionando um lead na lista lateral.</p>
                     </div>
                  )}
               </div>
            </div>
          )}

          {/* VIEW: ENGINES (Integracoes) */}
          {activeTab === 'integracoes' && (
            <div className="space-y-12 animate-in slide-in-from-right-8 duration-700">
               <header className="flex flex-col md:flex-row justify-between items-end gap-6">
                  <div>
                    <h2 className="text-5xl font-black uppercase italic tracking-tighter mb-2">Neural <span className="text-orange-500">Chips.</span></h2>
                    <p className="text-[10px] font-black text-gray-700 uppercase tracking-widest italic">Gestão de Motores Evolution v2 - Cluster Ativo</p>
                  </div>
                  <div className="flex gap-4">
                     <input 
                       value={newInstanceName} onChange={e => setNewInstanceName(e.target.value)}
                       placeholder="NOME DA NOVA ENGINE..." 
                       className="bg-black border border-white/10 rounded-full py-4 px-8 text-[11px] font-black uppercase outline-none focus:border-orange-500 transition-all shadow-inner w-[300px]"
                     />
                     <NeonButton onClick={createInstance} className="!px-10 flex items-center gap-2">
                        {isCreatingInstance ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} 
                        Injetar Engine
                     </NeonButton>
                  </div>
               </header>

               <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-6">
                     {instances.map(inst => (
                       <GlassCard key={inst.id} className="!p-8 !rounded-[3rem] border-white/5 flex items-center justify-between group hover:border-orange-500/40 transition-all shadow-2xl hover:bg-orange-500/[0.01]">
                          <div className="flex items-center gap-8">
                             <div className="relative">
                                <div className={`w-16 h-16 rounded-[2rem] bg-white/5 flex items-center justify-center border border-white/10 overflow-hidden shadow-2xl`}>
                                   {inst.profilePicUrl ? <img src={inst.profilePicUrl} className="w-full h-full object-cover" /> : <Smartphone size={24} className="text-gray-700" />}
                                </div>
                                <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-4 border-[#020202] ${inst.status === 'CONNECTED' ? 'bg-green-500 shadow-[0_0_15px_green]' : 'bg-red-500 shadow-[0_0_15px_red]'} animate-pulse`} />
                             </div>
                             <div>
                                <div className="text-xl font-black uppercase italic tracking-tight text-white mb-1">{inst.name}</div>
                                <div className="flex items-center gap-3">
                                   <span className="text-[9px] font-black uppercase text-gray-700 tracking-[0.3em] italic">{inst.phone}</span>
                                   <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md ${inst.status === 'CONNECTED' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'} italic`}>
                                      {inst.status === 'CONNECTED' ? 'Cluster Ativo' : 'Desconectado'}
                                   </span>
                                </div>
                             </div>
                          </div>
                          <div className="flex gap-3 opacity-0 group-hover:opacity-100 transition-all transform translate-x-4 group-hover:translate-x-0">
                             {inst.status === 'DISCONNECTED' && (
                               <button onClick={() => connectInstance(inst.name)} className="p-4 rounded-2xl bg-orange-600 text-white shadow-xl hover:bg-orange-500 transition-all" title="Gerar QR Code"><RefreshCw size={16}/></button>
                             )}
                             {inst.status === 'CONNECTED' && (
                               <button onClick={() => logoutInstance(inst.name)} className="p-4 rounded-2xl bg-white/5 text-gray-600 border border-white/5 hover:bg-white/10 transition-all" title="Fazer Logout"><Power size={16}/></button>
                             )}
                             <button onClick={() => deleteInstance(inst.name)} className="p-4 rounded-2xl bg-red-600/10 text-red-500 border border-red-500/20 hover:bg-red-600 hover:text-white transition-all shadow-xl" title="Deletar Instância"><Trash2 size={16}/></button>
                          </div>
                       </GlassCard>
                     ))}
                  </div>

                  <div className="space-y-8">
                     <GlassCard className="!p-12 !rounded-[4rem] border-orange-500/10 bg-gradient-to-br from-orange-500/[0.05] to-transparent text-center shadow-2xl h-full flex flex-col justify-center items-center">
                        <div className="w-24 h-24 bg-orange-500/10 rounded-[2.5rem] flex items-center justify-center text-orange-500 mb-8 border border-orange-500/20 shadow-2xl">
                           <Activity size={48} />
                        </div>
                        <h4 className="text-3xl font-black uppercase italic tracking-tighter mb-4 text-white">Cluster Health <br/> <span className="text-orange-500 italic">99.8% Stability.</span></h4>
                        <p className="text-[10px] font-bold text-gray-700 uppercase tracking-widest leading-relaxed max-w-xs italic">Sua infraestrutura neural está rodando em alta performance em Matelândia-PR.</p>
                     </GlassCard>
                  </div>
               </div>
            </div>
          )}

        </main>
      </div>

      {/* QR MODAL NEURAL */}
      <AnimatePresence>
        {qrModal.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/98 backdrop-blur-3xl">
            <div className="bg-[#050505] border border-white/10 p-16 rounded-[4rem] text-center max-w-sm w-full relative shadow-[0_0_100px_rgba(255,115,0,0.2)]">
              <button onClick={() => setQrModal(p => ({ ...p, isOpen: false }))} className="absolute top-12 right-12 text-gray-700 hover:text-white p-3 hover:bg-white/5 rounded-full transition-all"><X size={32}/></button>
              
              <div className="relative mb-12">
                 <div className="bg-white p-10 rounded-[4rem] flex items-center justify-center min-h-[300px] shadow-[0_0_50px_white/5] overflow-hidden group">
                    {qrModal.code ? (
                      <img src={qrModal.code} className="w-full h-auto scale-110 group-hover:scale-125 transition-transform duration-1000" alt="Evolution QR Code" />
                    ) : (
                      <div className="flex flex-col items-center gap-6">
                         <Loader2 className="animate-spin text-orange-500" size={64} />
                         <span className="text-[8px] font-black uppercase tracking-[0.5em] text-orange-500 italic animate-pulse">Injetando Engine...</span>
                      </div>
                    )}
                 </div>
                 <div className="absolute inset-0 border-2 border-orange-500/20 rounded-[4rem] pointer-events-none" />
              </div>

              <h3 className="text-3xl font-black uppercase italic mb-3 tracking-tighter text-white">{qrModal.name}</h3>
              <p className="text-[12px] font-black uppercase text-orange-500 animate-pulse tracking-[0.4em] italic">{qrModal.status}</p>
              
              <div className="mt-10 pt-10 border-t border-white/5 space-y-4">
                 <div className="flex items-center justify-center gap-3">
                    <ShieldCheck size={14} className="text-green-500" />
                    <span className="text-[8px] font-black uppercase tracking-widest text-gray-600">Conexão Segura TLS 1.3</span>
                 </div>
                 <p className="text-[9px] text-gray-800 font-bold uppercase tracking-widest italic">Aguardando leitura do handshake...</p>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
