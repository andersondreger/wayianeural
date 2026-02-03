
import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { 
  MessageSquare, LogOut, Plus, Loader2, RefreshCw, 
  Trash2, X, Layers, Search, Send, CheckCircle2, 
  Smartphone, ShieldCheck, ChevronLeft, ChevronRight,
  Bot, Zap, Activity, AlertCircle, Paperclip, MoreVertical,
  Settings, LayoutDashboard, Globe, User, Terminal, AlertTriangle,
  LayoutGrid, Target, DollarSign, Filter, Sliders, Bell, Brain
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
  { id: 'novo', title: 'Novos Leads', color: 'border-blue-500/20 text-blue-500' },
  { id: 'em_atendimento', title: 'Em Atendimento', color: 'border-orange-500/20 text-orange-500' },
  { id: 'aguardando', title: 'Aguardando', color: 'border-purple-500/20 text-purple-500' },
  { id: 'ganho', title: 'Venda Concluída', color: 'border-green-500/20 text-green-500' }
];

export function Dashboard({ user, onLogout }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<DashboardTab>('atendimento');
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [instances, setInstances] = useState<EvolutionInstance[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newInstanceName, setNewInstanceName] = useState('');
  
  const [leads, setLeads] = useState<Ticket[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [isSending, setIsSending] = useState(false);

  const [qrModal, setQrModal] = useState({ 
    isOpen: false, code: '', name: '', status: 'Iniciando...', connected: false 
  });

  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  // --- BUSCA DE INSTÂNCIAS ---
  const fetchInstances = async (): Promise<EvolutionInstance[]> => {
    try {
      const res = await fetch(`${EVOLUTION_URL}/instance/fetchInstances?t=${Date.now()}`, { headers: HEADERS });
      const data = await res.json();
      const raw = Array.isArray(data) ? data : (data.instances || data.data || []);
      
      const mapped = raw.map((item: any) => {
        const inst = item.instance || item;
        const rawStatus = (inst.status || inst.connectionStatus || inst.state || inst.connection?.state || '').toLowerCase();
        const isOnline = ['open', 'connected', 'connected_chat', 'online'].includes(rawStatus);

        return {
          id: inst.instanceId || inst.name || inst.instanceName,
          name: inst.instanceName || inst.name,
          status: isOnline ? 'CONNECTED' : 'DISCONNECTED',
          phone: inst.ownerJid?.split('@')[0] || inst.number || '---'
        } as EvolutionInstance;
      });
      setInstances(mapped);
      return mapped;
    } catch (e) {
      return [];
    }
  };

  // --- SINCRONIZAÇÃO DE CHATS ---
  const syncChats = async () => {
    setIsSyncing(true);
    setSyncError(null);
    const allLeadsMap = new Map<string, Ticket>();

    try {
      const currentInstances = await fetchInstances();
      const connectedOnes = currentInstances.filter(i => i.status === 'CONNECTED');

      if (connectedOnes.length === 0) {
          setSyncError("Sem Chips Conectados.");
          setIsSyncing(false);
          return;
      }

      for (const inst of connectedOnes) {
        try {
          const res = await fetch(`${EVOLUTION_URL}/chat/findChats/${inst.name}`, {
            method: 'POST', headers: HEADERS, body: JSON.stringify({})
          });
          const data = await res.json();
          const items = Array.isArray(data) ? data : (data.data || data.chats || []);

          items.forEach((item: any) => {
            const jid = item.jid || item.remoteJid || item.key?.remoteJid;
            if (!jid) return;
            
            const isGroup = jid.includes('@g.us');
            const name = item.pushName || item.name || (isGroup ? "Grupo" : jid.split('@')[0]);
            
            if (!allLeadsMap.has(jid)) {
              allLeadsMap.set(jid, {
                id: jid,
                contactName: name,
                contactPhone: jid.split('@')[0],
                avatar: item.profilePicUrl || "", 
                lastMessage: item.message?.conversation || "Conversa Neural",
                time: "Agora",
                status: 'novo',
                unreadCount: item.unreadCount || 0,
                assignedTo: 'Neural Agent',
                protocol: jid.split('@')[0],
                sentiment: 'neutral',
                messages: [],
                instanceSource: inst.name,
                value: Math.floor(Math.random() * 1000)
              });
            }
          });
        } catch (err) {}
      }
      setLeads(Array.from(allLeadsMap.values()));
    } catch (e) {
      setSyncError("Cluster Desincronizado");
    } finally {
      setIsSyncing(false);
    }
  };

  // --- CARREGAR HISTÓRICO ---
  const loadHistory = async (lead: Ticket) => {
    try {
      const res = await fetch(`${EVOLUTION_URL}/chat/fetchMessages/${lead.instanceSource}`, {
        method: 'POST', headers: HEADERS, body: JSON.stringify({ remoteJid: lead.id, count: 50 })
      });
      const data = await res.json();
      const rawMsgs = Array.isArray(data) ? data : (data.messages || data.data || []);
      
      const mapped: Message[] = rawMsgs.map((m: any) => ({
        id: m.key.id,
        text: m.message?.conversation || m.message?.extendedTextMessage?.text || "📎 Arquivo Neural",
        sender: (m.key.fromMe ? 'me' : 'contact') as 'me' | 'contact',
        time: new Date((m.messageTimestamp || Date.now()/1000) * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'read',
        type: 'text'
      })).reverse();
      setChatMessages(mapped);
    } catch (e) {}
  };

  const handleSend = async () => {
    const lead = leads.find(l => l.id === selectedLeadId);
    if (!lead || !messageInput) return;
    const tempText = messageInput;
    setMessageInput('');
    setIsSending(true);
    
    try {
      const res = await fetch(`${EVOLUTION_URL}/message/sendText/${lead.instanceSource}`, {
        method: 'POST', headers: HEADERS, body: JSON.stringify({ number: lead.id, text: tempText })
      });

      if (res.ok) {
        setChatMessages(prev => [...prev, {
          id: Date.now().toString(), text: tempText, sender: 'me', time: 'Agora', status: 'sent', type: 'text'
        }]);
      }
    } catch (e) {} finally { setIsSending(false); }
  };

  useEffect(() => {
    fetchInstances();
    const inv = setInterval(fetchInstances, 20000);
    return () => clearInterval(inv);
  }, []);

  const currentLead = useMemo(() => leads.find(l => l.id === selectedLeadId), [selectedLeadId, leads]);
  useEffect(() => { if (currentLead) loadHistory(currentLead); }, [selectedLeadId]);

  // --- COMPONENTES INTERNOS ---
  const SidebarItem = ({ id, icon: Icon, label }: { id: DashboardTab, icon: any, label: string }) => (
    <button 
      onClick={() => setActiveTab(id)}
      className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all border ${activeTab === id ? 'bg-orange-600/10 text-orange-500 border-orange-500/20 shadow-lg scale-105' : 'text-gray-600 border-transparent hover:bg-white/[0.02]'}`}
    >
      <Icon size={20} />
      {isSidebarExpanded && <span className="text-[10px] font-black uppercase tracking-widest italic">{label}</span>}
    </button>
  );

  return (
    <div className="flex h-screen bg-[#020202] text-white font-sans overflow-hidden">
      <div className="fixed inset-0 grid-engine pointer-events-none opacity-[0.05]"></div>

      <motion.aside 
        animate={{ width: isSidebarExpanded ? 260 : 80 }}
        className="relative h-full border-r border-white/5 bg-black/60 backdrop-blur-3xl flex flex-col p-6 z-50 transition-all duration-300"
      >
        <div className="mb-12 flex items-center justify-between">
          {isSidebarExpanded && <Logo size="sm" />}
          <button onClick={() => setIsSidebarExpanded(!isSidebarExpanded)} className="p-2 glass rounded-xl text-orange-500">
            {isSidebarExpanded ? <ChevronLeft size={18}/> : <ChevronRight size={18}/>}
          </button>
        </div>

        <nav className="flex-1 space-y-3">
          <SidebarItem id="overview" icon={LayoutDashboard} label="Visão Geral" />
          <SidebarItem id="atendimento" icon={MessageSquare} label="Atendimento" />
          <SidebarItem id="kanban" icon={LayoutGrid} label="Neural CRM" />
          <SidebarItem id="integracoes" icon={Layers} label="Engines" />
          <SidebarItem id="agentes" icon={Bot} label="Agentes IA" />
          <SidebarItem id="settings" icon={Settings} label="Configurações" />
        </nav>

        <button onClick={onLogout} className="mt-auto flex items-center gap-4 p-4 text-gray-700 hover:text-red-500 transition-colors">
          <LogOut size={20} />
          {isSidebarExpanded && <span className="text-[10px] font-black uppercase tracking-widest italic">Encerrar</span>}
        </button>
      </motion.aside>

      <main className="flex-1 flex flex-col relative overflow-hidden">
        
        {/* TELA: ATENDIMENTO (CHAT) */}
        {activeTab === 'atendimento' && (
          <div className="flex-1 flex overflow-hidden animate-in fade-in duration-500">
            <div className="w-[380px] border-r border-white/5 flex flex-col bg-black/40 backdrop-blur-xl">
              <header className="p-6 border-b border-white/5 flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-widest text-orange-500 italic">Neural Chat</h3>
                <button onClick={syncChats} className={`p-2 glass rounded-lg ${isSyncing ? 'animate-spin text-orange-500' : 'text-gray-700'}`}><RefreshCw size={14}/></button>
              </header>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
                {leads.map(lead => (
                  <button 
                    key={lead.id} onClick={() => setSelectedLeadId(lead.id)}
                    className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all text-left border ${selectedLeadId === lead.id ? 'bg-orange-600/10 border-orange-500/20' : 'border-transparent hover:bg-white/[0.02]'}`}
                  >
                    <div className="w-12 h-12 rounded-2xl bg-orange-600/10 flex items-center justify-center text-orange-500 font-black italic border border-orange-500/10 shrink-0 uppercase overflow-hidden shadow-lg">
                      {lead.avatar ? <img src={lead.avatar} className="w-full h-full object-cover" /> : lead.contactName[0]}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[11px] font-black uppercase truncate italic text-white/90 tracking-tighter">{lead.contactName}</span>
                        <span className="text-[7px] text-gray-700 font-bold">{lead.time}</span>
                      </div>
                      <p className="text-[9px] text-gray-600 truncate italic leading-relaxed">{lead.lastMessage}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 flex flex-col bg-black/20">
              {selectedLeadId && currentLead ? (
                <div className="flex-1 flex flex-col">
                  <header className="p-6 border-b border-white/5 flex items-center justify-between bg-black/60 backdrop-blur-3xl shadow-2xl z-10">
                    <div className="flex items-center gap-6">
                      <div className="w-16 h-16 rounded-3xl bg-orange-600/10 flex items-center justify-center text-orange-500 font-black italic border border-orange-500/10 shadow-2xl overflow-hidden">
                        {currentLead.avatar ? <img src={currentLead.avatar} className="w-full h-full object-cover" /> : currentLead.contactName[0]}
                      </div>
                      <div>
                        <h4 className="text-2xl font-black uppercase italic tracking-tighter text-orange-500">{currentLead.contactName}</h4>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-black uppercase text-gray-600 tracking-[0.2em] italic">{currentLead.contactPhone}</span>
                          <span className="px-2 py-0.5 rounded-full border border-orange-500/20 text-[7px] font-black uppercase text-orange-500">Live Engine</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-4">
                       <button className="p-4 glass rounded-2xl text-gray-600 hover:text-orange-500 transition-all"><Search size={18}/></button>
                       <button className="p-4 glass rounded-2xl text-gray-600 hover:text-orange-500 transition-all"><MoreVertical size={18}/></button>
                    </div>
                  </header>

                  <div className="flex-1 overflow-y-auto p-12 space-y-6 custom-scrollbar bg-gradient-to-b from-transparent to-black/30">
                    {chatMessages.map((m, idx) => (
                      <div key={idx} className={`flex ${m.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[70%] p-6 rounded-3xl shadow-2xl relative ${m.sender === 'me' ? 'bg-orange-600 text-white rounded-br-none' : 'bg-white/[0.03] text-gray-100 border border-white/10 rounded-bl-none'}`}>
                          <p className="text-[14px] font-medium leading-relaxed tracking-tight">{m.text}</p>
                          <div className={`text-[7px] font-black uppercase mt-3 opacity-30 tracking-widest text-right`}>{m.time}</div>
                        </div>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>

                  <div className="p-8 border-t border-white/5 flex gap-5 bg-black/60 backdrop-blur-3xl shadow-2xl">
                    <button className="p-5 glass rounded-2xl text-gray-700 hover:text-orange-500 transition-all"><Paperclip size={22}/></button>
                    <input 
                      value={messageInput} onChange={e => setMessageInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleSend()}
                      placeholder="ESCREVER RESPOSTA NEURAL..." 
                      className="flex-1 bg-white/[0.02] border border-white/10 rounded-2xl py-5 px-8 text-[12px] font-black uppercase outline-none focus:border-orange-500 transition-all placeholder:text-gray-900 shadow-inner"
                    />
                    <button onClick={handleSend} className="p-5 bg-orange-600 text-white rounded-2xl hover:bg-orange-500 shadow-2xl transition-all min-w-[80px] flex items-center justify-center">
                      {isSending ? <Loader2 className="animate-spin" size={24} /> : <Send size={24}/>}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center opacity-10 animate-pulse italic uppercase font-black tracking-[1em]">
                   <Logo size="lg" className="grayscale mb-12" />
                   Neural Sync Waiting
                </div>
              )}
            </div>
          </div>
        )}

        {/* TELA: NEURAL KANBAN (Drag and Drop) */}
        {activeTab === 'kanban' && (
          <div className="flex-1 p-10 flex flex-col overflow-hidden animate-in zoom-in-95 duration-500">
            <header className="mb-10 flex items-center justify-between">
              <div>
                <h2 className="text-5xl font-black uppercase italic tracking-tighter mb-2">Neural <span className="text-orange-500">CRM.</span></h2>
                <p className="text-[10px] font-black text-gray-700 uppercase tracking-widest italic">Pipeline de Conversão de Alta Frequência</p>
              </div>
              <div className="flex gap-4">
                 <GlassButton className="!px-6"><Filter size={16} className="mr-2"/> Filtros</GlassButton>
                 <NeonButton onClick={syncChats} className="!px-6"><Plus size={16} className="mr-2"/> Novo Lead</NeonButton>
              </div>
            </header>

            <div className="flex-1 flex gap-8 overflow-x-auto pb-10 custom-scrollbar scroll-smooth">
              {KANBAN_COLUMNS.map(col => (
                <div key={col.id} className="min-w-[320px] flex flex-col">
                  <div className={`p-4 mb-4 border-b-2 flex items-center justify-between ${col.color}`}>
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] italic">{col.title}</h3>
                    <span className="text-[10px] font-black opacity-50">{leads.filter(l => l.status === col.id).length}</span>
                  </div>
                  
                  <div className="flex-1 space-y-4 overflow-y-auto no-scrollbar">
                    {leads.map((lead, idx) => (
                      <motion.div 
                        key={lead.id} 
                        drag 
                        dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                        whileDrag={{ scale: 1.05, rotate: 2 }}
                        className="glass p-5 rounded-3xl border border-white/5 hover:border-orange-500/20 cursor-grab active:cursor-grabbing group shadow-xl"
                      >
                        <div className="flex items-center gap-4 mb-4">
                          <div className="w-10 h-10 rounded-xl bg-orange-600/10 flex items-center justify-center text-orange-500 font-black italic border border-orange-500/10 uppercase overflow-hidden">
                            {lead.avatar ? <img src={lead.avatar} className="w-full h-full object-cover" /> : lead.contactName[0]}
                          </div>
                          <div className="flex-1 overflow-hidden">
                            <div className="text-[11px] font-black uppercase truncate italic text-white/90 leading-none mb-1">{lead.contactName}</div>
                            <div className="text-[8px] font-bold text-gray-700 uppercase tracking-widest">{lead.contactPhone}</div>
                          </div>
                          <div className={`w-2 h-2 rounded-full ${lead.sentiment === 'happy' ? 'bg-green-500' : 'bg-orange-500'} animate-pulse shadow-[0_0_10px_currentColor]`} />
                        </div>
                        <p className="text-[9px] text-gray-500 italic mb-4 line-clamp-2 leading-relaxed">"{lead.lastMessage}"</p>
                        <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                           <div className="text-[10px] font-black text-orange-500 italic">R$ {lead.value || '0'},00</div>
                           <button className="text-gray-800 group-hover:text-orange-500 transition-colors"><ChevronRight size={14}/></button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TELA: CONFIGURAÇÕES NEURAIS */}
        {activeTab === 'settings' && (
          <div className="flex-1 p-16 max-w-4xl overflow-y-auto custom-scrollbar animate-in slide-in-from-right duration-500">
            <header className="mb-16">
              <h2 className="text-5xl font-black uppercase italic tracking-tighter mb-4">Ajustes <span className="text-orange-500">Neural.</span></h2>
              <p className="text-[10px] font-black text-gray-700 uppercase tracking-widest italic">Sincronização de Cérebro e Integrações de Escala</p>
            </header>

            <div className="space-y-12">
              <section className="space-y-6">
                <div className="flex items-center gap-3 text-orange-500 mb-6">
                  <Brain size={20} />
                  <h4 className="text-xs font-black uppercase tracking-[0.3em] italic">Personalidade da IA</h4>
                </div>
                <GlassCard className="!p-8 !rounded-[2.5rem] border-white/5">
                  <label className="text-[9px] font-black uppercase text-gray-600 tracking-widest mb-4 block">Diretriz Primária (System Instruction)</label>
                  <textarea 
                    placeholder="VOCÊ É UM ATENDENTE SÊNIOR..." 
                    rows={6}
                    className="w-full bg-black border border-white/10 rounded-2xl p-6 text-[11px] font-bold uppercase italic outline-none focus:border-orange-500 transition-all text-gray-300 leading-relaxed shadow-inner"
                  />
                  <div className="mt-8 flex justify-end">
                    <NeonButton className="!px-10">Salvar Matriz</NeonButton>
                  </div>
                </GlassCard>
              </section>

              <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <GlassCard className="!p-8 border-blue-500/10">
                   <Target className="text-blue-500 mb-4" />
                   <h5 className="text-[10px] font-black uppercase italic mb-2">Qualificação de Leads</h5>
                   <p className="text-[8px] text-gray-600 uppercase tracking-widest mb-6">Score automático baseado em intenção.</p>
                   <div className="flex items-center gap-3">
                      <div className="w-10 h-6 bg-blue-500/20 rounded-full border border-blue-500/40 relative">
                         <div className="absolute right-1 top-1 w-4 h-4 bg-blue-500 rounded-full shadow-[0_0_10px_blue]" />
                      </div>
                      <span className="text-[8px] font-black uppercase text-blue-500">Ativado</span>
                   </div>
                </GlassCard>
                <GlassCard className="!p-8 border-purple-500/10">
                   <Bell className="text-purple-500 mb-4" />
                   <h5 className="text-[10px] font-black uppercase italic mb-2">Alertas de Vácuo</h5>
                   <p className="text-[8px] text-gray-600 uppercase tracking-widest mb-6">Notificar se o lead for ignorado por 5min.</p>
                   <div className="flex items-center gap-3">
                      <div className="w-10 h-6 bg-gray-800 rounded-full border border-white/10 relative">
                         <div className="absolute left-1 top-1 w-4 h-4 bg-gray-600 rounded-full" />
                      </div>
                      <span className="text-[8px] font-black uppercase text-gray-800">Desativado</span>
                   </div>
                </GlassCard>
              </section>
            </div>
          </div>
        )}

        {/* OUTRAS ABAS (CHIPS) */}
        {activeTab === 'integracoes' && (
           <div className="flex-1 p-10 overflow-y-auto custom-scrollbar animate-in fade-in duration-500">
             <header className="mb-12">
                <h2 className="text-5xl font-black uppercase italic tracking-tighter mb-2">Chips <span className="text-orange-500">Ativos.</span></h2>
                <p className="text-[10px] font-black text-gray-700 uppercase tracking-widest italic">Monitoramento de Fluxo Evolution</p>
             </header>

             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <GlassCard className="!p-10 !rounded-[3rem] border-white/5">
                   <h3 className="text-xs font-black uppercase italic mb-8 flex items-center gap-3 text-orange-500"><Plus size={18} /> Injetar Nova Engine</h3>
                   <div className="flex gap-4 mb-10">
                      <input 
                        value={newInstanceName} onChange={e => setNewInstanceName(e.target.value)}
                        placeholder="NOME DA INSTÂNCIA..." 
                        className="flex-1 bg-black border border-white/10 rounded-2xl py-5 px-8 text-[10px] font-black uppercase outline-none focus:border-orange-500 transition-all placeholder:text-gray-900 shadow-inner"
                      />
                      <NeonButton onClick={async () => {
                        const name = newInstanceName.trim().toLowerCase();
                        if (!name) return;
                        setIsCreating(true);
                        try {
                          await fetch(`${EVOLUTION_URL}/instance/create`, {
                            method: 'POST', headers: HEADERS, body: JSON.stringify({ instanceName: name, qrcode: true })
                          });
                          await fetchInstances();
                          setQrModal({ isOpen: true, code: '', name: name, status: 'Gerando QR Neural...', connected: false });
                          const qrRes = await fetch(`${EVOLUTION_URL}/instance/connect/${name}`, { headers: HEADERS });
                          const qrData = await qrRes.json();
                          if (qrData.base64) setQrModal(p => ({ ...p, code: qrData.base64, status: 'Escanear Agora' }));
                        } catch (e) {} finally { setIsCreating(false); }
                      }} className="!px-10">Criar</NeonButton>
                   </div>

                   <div className="space-y-4">
                      {instances.map(inst => (
                        <div key={inst.id} className="p-6 bg-white/[0.01] border border-white/5 rounded-[2rem] flex items-center justify-between group hover:border-orange-500/40 transition-all shadow-xl">
                           <div className="flex items-center gap-6">
                              <div className={`w-3 h-3 rounded-full ${inst.status === 'CONNECTED' ? 'bg-green-500 shadow-[0_0_15px_green] animate-pulse' : 'bg-red-500'}`} />
                              <div>
                                <div className="text-[11px] font-black uppercase italic tracking-tight">{inst.name}</div>
                                <div className="text-[8px] font-black uppercase text-gray-700 tracking-[0.3em]">{inst.phone}</div>
                              </div>
                           </div>
                           <div className="flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => {
                                 setQrModal({ isOpen: true, code: '', name: inst.name, status: 'Reiniciando Handshake...', connected: false });
                                 fetch(`${EVOLUTION_URL}/instance/connect/${inst.name}`, { headers: HEADERS })
                                   .then(r => r.json())
                                   .then(d => d.base64 && setQrModal(p => ({ ...p, code: d.base64, status: 'Escanear QR' })));
                              }} className="p-3 glass rounded-xl text-orange-500"><RefreshCw size={14}/></button>
                              <button onClick={async () => {
                                 if (confirm(`Remover Engine ${inst.name}?`)) {
                                   await fetch(`${EVOLUTION_URL}/instance/delete/${inst.name}`, { method: 'DELETE', headers: HEADERS });
                                   fetchInstances();
                                 }
                              }} className="p-3 glass rounded-xl text-red-500"><Trash2 size={14}/></button>
                           </div>
                        </div>
                      ))}
                   </div>
                </GlassCard>

                <div className="space-y-8">
                   <GlassCard className="!p-10 !rounded-[3rem] border-orange-500/10 flex flex-col justify-center text-center shadow-2xl">
                      <div className="text-7xl font-black text-orange-500 mb-2 italic drop-shadow-2xl">{instances.filter(i => i.status === 'CONNECTED').length}</div>
                      <div className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-700 italic">Chips Sincronizados</div>
                   </GlassCard>
                   <GlassCard className="!p-10 !rounded-[3rem] border-white/5 flex items-center gap-8 shadow-2xl group hover:border-blue-500/20">
                      <div className="w-16 h-16 bg-blue-500/10 rounded-3xl flex items-center justify-center text-blue-500 shadow-2xl group-hover:scale-110 transition-transform">
                         <Activity size={32} />
                      </div>
                      <div>
                        <div className="text-xs font-black uppercase italic mb-1 tracking-tight text-white">Neural Cluster Status</div>
                        <div className="text-[9px] font-black uppercase text-gray-700 tracking-widest">Sincronização 99.9% Operacional</div>
                      </div>
                   </GlassCard>
                </div>
             </div>
           </div>
        )}

        <AnimatePresence>
          {qrModal.isOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/95 backdrop-blur-2xl">
              <div className="bg-[#050505] border border-white/10 p-16 rounded-[4rem] text-center max-w-sm w-full relative shadow-[0_0_100px_rgba(255,115,0,0.1)]">
                <button onClick={() => setQrModal(p => ({ ...p, isOpen: false }))} className="absolute top-12 right-12 text-gray-700 hover:text-white p-3 hover:bg-white/5 rounded-full transition-all"><X size={32}/></button>
                <div className="bg-white p-10 rounded-[4rem] mb-12 flex items-center justify-center min-h-[300px] shadow-2xl overflow-hidden group">
                   {qrModal.code ? <img src={qrModal.code} className="w-full h-auto scale-110 group-hover:scale-125 transition-transform duration-700" alt="QR" /> : <Loader2 className="animate-spin text-orange-500" size={64} />}
                </div>
                <h3 className="text-3xl font-black uppercase italic mb-3 tracking-tighter text-white">{qrModal.name}</h3>
                <p className="text-[12px] font-black uppercase text-orange-500 animate-pulse tracking-[0.4em] italic">{qrModal.status}</p>
              </div>
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
