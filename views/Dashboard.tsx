
import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageSquare, LogOut, Plus, Loader2, RefreshCw, 
  Trash2, X, Layers, Search, Send, CheckCircle2, 
  Smartphone, ShieldCheck, ChevronLeft, ChevronRight,
  Bot, Zap, Activity, AlertCircle, Paperclip, MoreVertical,
  Settings, LayoutDashboard, Globe, User
} from 'lucide-react';
import { UserSession, DashboardTab, EvolutionInstance, Ticket, Message } from '../types';
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

export function Dashboard({ user, onLogout }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<DashboardTab>('integracoes');
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [instances, setInstances] = useState<EvolutionInstance[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newInstanceName, setNewInstanceName] = useState('');
  
  // CRM & Chat States
  const [leads, setLeads] = useState<Ticket[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Modais
  const [qrModal, setQrModal] = useState({ 
    isOpen: false, code: '', name: '', status: 'Iniciando...', connected: false 
  });

  // --- GESTÃO EVOLUTION API (CRUD REAL) ---
  const fetchInstances = async () => {
    try {
      const res = await fetch(`${EVOLUTION_URL}/instance/fetchInstances`, { headers: HEADERS });
      const data = await res.json();
      // Evolution retorna as instâncias em data ou direto no array
      const raw = Array.isArray(data) ? data : (data?.data || data?.instances || []);
      
      const mapped = raw.map((item: any) => {
        const inst = item.instance || item;
        const state = (inst.status || inst.connectionStatus || inst.state || '').toLowerCase();
        
        let phoneNumber = '---';
        if (inst.ownerJid) {
          phoneNumber = inst.ownerJid.split('@')[0];
        } else if (inst.number) {
          phoneNumber = inst.number;
        }

        return {
          id: inst.instanceId || inst.name,
          name: inst.instanceName || inst.name,
          status: (state === 'open' || state === 'connected') ? 'CONNECTED' : 'DISCONNECTED',
          phone: phoneNumber
        } as EvolutionInstance;
      });
      setInstances(mapped);
    } catch (e) { console.error("Erro fetchInstances:", e); }
  };

  const handleCreate = async () => {
    if (!newInstanceName.trim()) return;
    setIsCreating(true);
    try {
      // Endpoint exato da v2
      const res = await fetch(`${EVOLUTION_URL}/instance/create`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({ 
          instanceName: newInstanceName, 
          token: Math.random().toString(36).substring(7),
          qrcode: true 
        })
      });
      const data = await res.json();
      
      if (res.ok) {
        const createdName = data.instance?.instanceName || newInstanceName;
        setNewInstanceName('');
        await fetchInstances();
        // Abre o QR automaticamente após criar
        setTimeout(() => openQR(createdName), 500);
      } else {
        alert("Erro ao criar: " + (data.message || "Tente outro nome"));
      }
    } catch (e) { 
      console.error("Erro handleCreate:", e); 
    } finally { setIsCreating(false); }
  };

  const openQR = async (name: string) => {
    setQrModal({ isOpen: true, code: '', name, status: 'Conectando à Engine...', connected: false });
    try {
      const res = await fetch(`${EVOLUTION_URL}/instance/connect/${name}`, { headers: HEADERS });
      const data = await res.json();
      
      if (data.base64) {
        setQrModal(p => ({ ...p, code: data.base64, status: 'Escanear agora!' }));
        pollConnection(name);
      } else {
        setQrModal(p => ({ ...p, status: 'Erro ao gerar QR Code' }));
      }
    } catch (e) { 
      console.error("Erro openQR:", e);
      setQrModal(p => ({ ...p, status: 'Falha na conexão' }));
    }
  };

  const pollConnection = (name: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${EVOLUTION_URL}/instance/connectionStatus/${name}`, { headers: HEADERS });
        const data = await res.json();
        const state = (data.instance?.state || data.state || '').toLowerCase();
        
        if (state === 'open' || state === 'connected') {
          setQrModal(p => ({ ...p, status: 'Sincronizado!', connected: true }));
          fetchInstances();
          clearInterval(interval);
          setTimeout(() => setQrModal(p => ({ ...p, isOpen: false })), 2000);
        }
      } catch (e) { clearInterval(interval); }
    }, 4000);
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`Deseja destruir o cluster ${name}? Esta ação é irreversível.`)) return;
    try {
      const res = await fetch(`${EVOLUTION_URL}/instance/delete/${name}`, { 
        method: 'DELETE', 
        headers: HEADERS 
      });
      if (res.ok) {
        setInstances(prev => prev.filter(i => i.name !== name));
        if (selectedLeadId) setSelectedLeadId(null);
      }
    } catch (e) { console.error("Erro handleDelete:", e); }
  };

  // --- CRM & ATENDIMENTO COM AVATARES ---
  const syncChats = async () => {
    const connectedOnes = instances.filter(i => i.status === 'CONNECTED');
    if (connectedOnes.length === 0) return;
    
    setIsSyncing(true);
    let allLeads: Ticket[] = [];
    
    for (const inst of connectedOnes) {
      try {
        const res = await fetch(`${EVOLUTION_URL}/chat/fetchChats/${inst.name}`, { headers: HEADERS });
        const data = await res.json();
        const chats = Array.isArray(data) ? data : (data?.data || []);
        
        for (const c of chats) {
          const jid = c.id || c.remoteJid;
          if (!jid || jid.includes('@g.us')) continue;
          
          // Tenta buscar o avatar se a Evolution permitir
          let avatarUrl = "";
          try {
            const profileRes = await fetch(`${EVOLUTION_URL}/chat/fetchProfilePictureUrl/${inst.name}`, {
              method: 'POST',
              headers: HEADERS,
              body: JSON.stringify({ number: jid.split('@')[0] })
            });
            const profileData = await profileRes.json();
            avatarUrl = profileData.profilePictureUrl || "";
          } catch(e) {}

          allLeads.push({
            id: jid,
            contactName: c.name || jid.split('@')[0],
            contactPhone: jid.split('@')[0],
            avatar: avatarUrl,
            lastMessage: c.lastMessage?.message?.conversation || "Interação WayIA",
            time: new Date((c.lastMessage?.messageTimestamp || Date.now()/1000) * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            status: 'novo',
            unreadCount: c.unreadCount || 0,
            assignedTo: 'Neural Agent',
            protocol: jid.split('@')[0],
            sentiment: 'neutral',
            messages: [],
            instanceSource: inst.name
          } as Ticket);
        }
      } catch (e) {}
    }
    setLeads(allLeads);
    setIsSyncing(false);
  };

  const loadHistory = async (lead: Ticket) => {
    try {
      const res = await fetch(`${EVOLUTION_URL}/chat/fetchMessages/${(lead as any).instanceSource}`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({ remoteJid: lead.id, count: 25 })
      });
      const data = await res.json();
      const raw = Array.isArray(data) ? data : (data?.messages || data?.data || []);
      
      const mapped: Message[] = raw.map((m: any) => ({
        id: m.key.id,
        text: m.message?.conversation || m.message?.extendedTextMessage?.text || "📎 Conteúdo de Mídia",
        sender: m.key.fromMe ? 'me' : 'contact',
        time: new Date((m.messageTimestamp || Date.now()/1000) * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'read',
        type: 'text'
      })).reverse();
      
      setChatMessages(mapped);
    } catch (e) {}
  };

  const handleSend = async () => {
    const lead = leads.find(l => l.id === selectedLeadId);
    if (!lead || !messageInput || isSending) return;

    setIsSending(true);
    try {
      const res = await fetch(`${EVOLUTION_URL}/messages/sendText/${(lead as any).instanceSource}`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({
          number: lead.contactPhone,
          textMessage: { text: messageInput }
        })
      });
      if (res.ok) {
        setChatMessages(prev => [...prev, {
          id: Date.now().toString(),
          text: messageInput,
          sender: 'me',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: 'sent',
          type: 'text'
        }]);
        setMessageInput('');
      }
    } catch (e) {} finally { setIsSending(false); }
  };

  useEffect(() => {
    fetchInstances();
    const interval = setInterval(fetchInstances, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activeTab === 'atendimento') syncChats();
  }, [activeTab, instances.filter(i => i.status === 'CONNECTED').length]);

  const currentLead = useMemo(() => leads.find(l => l.id === selectedLeadId), [selectedLeadId, leads]);
  useEffect(() => { if (currentLead) loadHistory(currentLead); }, [currentLead]);

  return (
    <div className="flex h-screen bg-[#050505] text-white font-sans overflow-hidden">
      <div className="fixed inset-0 grid-engine pointer-events-none opacity-[0.03]"></div>

      {/* SIDEBAR RETRÁTIL */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarExpanded ? 280 : 80 }}
        className="relative h-full border-r border-white/5 bg-black/40 backdrop-blur-3xl flex flex-col p-6 z-50 transition-all duration-300"
      >
        <div className="mb-12 flex items-center justify-between">
          <AnimatePresence mode="wait">
            {isSidebarExpanded && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="overflow-hidden">
                <Logo size="sm" />
              </motion.div>
            )}
          </AnimatePresence>
          <button 
            onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
            className="p-2 glass rounded-xl text-orange-500 hover:bg-orange-600 hover:text-white transition-all shrink-0"
          >
            {isSidebarExpanded ? <ChevronLeft size={18}/> : <ChevronRight size={18}/>}
          </button>
        </div>

        <nav className="flex-1 space-y-3">
          {[
            { id: 'integracoes', icon: Layers, label: 'Integrações' },
            { id: 'atendimento', icon: MessageSquare, label: 'Atendimento' },
            { id: 'agentes', icon: Bot, label: 'Agentes IA' },
            { id: 'settings', icon: Settings, label: 'Configurações' }
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as DashboardTab)}
              className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all border ${activeTab === tab.id ? 'bg-orange-600/10 text-orange-500 border-orange-500/20 shadow-[0_0_20px_rgba(255,115,0,0.05)]' : 'text-gray-600 border-transparent hover:bg-white/[0.02]'}`}
            >
              <tab.icon size={20} className="shrink-0" />
              <AnimatePresence>
                {isSidebarExpanded && (
                  <motion.span 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="text-[10px] font-black uppercase tracking-widest truncate"
                  >
                    {tab.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          ))}
        </nav>

        <button onClick={onLogout} className="mt-auto flex items-center gap-4 p-4 text-gray-700 hover:text-red-500 transition-colors">
          <LogOut size={20} className="shrink-0" />
          {isSidebarExpanded && <span className="text-[10px] font-black uppercase tracking-widest">Sair</span>}
        </button>
      </motion.aside>

      <main className="flex-1 flex flex-col relative overflow-hidden bg-[#070707]">
        
        {/* TELA DE INTEGRAÇÕES */}
        {activeTab === 'integracoes' && (
          <div className="flex-1 p-10 lg:p-20 overflow-y-auto custom-scrollbar">
            <header className="mb-16">
              <h2 className="text-6xl font-black uppercase italic tracking-tighter leading-none mb-4">Neural <span className="text-orange-500">Engines.</span></h2>
              <p className="text-[11px] font-black text-gray-700 uppercase tracking-[0.4em] italic">Cluster Control v3.1</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              <GlassCard className="!p-10 !rounded-[3.5rem] border-white/5 bg-black/20">
                <h3 className="text-xl font-black uppercase italic mb-8 flex items-center gap-3">
                  <Plus size={22} className="text-orange-500" /> Provisionar Engine
                </h3>
                
                <div className="flex gap-4 mb-12">
                  <input 
                    value={newInstanceName} onChange={e => setNewInstanceName(e.target.value)}
                    placeholder="NOME DO CLUSTER..." 
                    className="flex-1 bg-black border border-white/10 rounded-2xl py-5 px-8 text-xs font-black uppercase outline-none focus:border-orange-500 transition-all placeholder:text-gray-800"
                  />
                  <NeonButton onClick={handleCreate} disabled={!newInstanceName || isCreating} className="!px-10 !rounded-2xl min-w-[140px]">
                    {isCreating ? <Loader2 className="animate-spin mx-auto" /> : "Criar Engine"}
                  </NeonButton>
                </div>

                <div className="space-y-4">
                  {instances.map(inst => (
                    <div key={inst.id} className="p-8 bg-white/[0.01] border border-white/5 rounded-[2.5rem] flex items-center justify-between group hover:border-orange-500/20 transition-all">
                      <div className="flex items-center gap-6">
                        <div className={`w-3 h-3 rounded-full ${inst.status === 'CONNECTED' ? 'bg-green-500 shadow-[0_0_15px_#22c55e] animate-pulse' : 'bg-red-600 shadow-[0_0_15px_#dc2626]'}`} />
                        <div>
                          <div className="text-lg font-black uppercase italic leading-none mb-2">{inst.name}</div>
                          <div className="text-[10px] font-black uppercase text-orange-500 tracking-widest flex items-center gap-2">
                             <Smartphone size={10} /> {inst.phone || 'NÃO VINCULADO'}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 opacity-40 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openQR(inst.name)} className="p-4 glass rounded-xl text-orange-500 hover:bg-orange-600 hover:text-white transition-all shadow-lg" title="Sincronizar QR"><RefreshCw size={18}/></button>
                        <button onClick={() => handleDelete(inst.name)} className="p-4 glass rounded-xl text-red-500 hover:bg-red-600 hover:text-white transition-all shadow-lg" title="Remover Cluster"><Trash2 size={18}/></button>
                      </div>
                    </div>
                  ))}
                  {instances.length === 0 && (
                    <div className="py-20 text-center text-gray-800 text-[10px] font-black uppercase tracking-[0.4em] italic opacity-50">
                      Nenhum cluster neural provisionado...
                    </div>
                  )}
                </div>
              </GlassCard>

              <div className="space-y-8">
                <GlassCard className="!p-10 !rounded-[3rem] bg-orange-600/[0.02] border-orange-500/10">
                  <ShieldCheck size={48} className="text-orange-500 mb-6" />
                  <h4 className="text-2xl font-black uppercase italic mb-4">Sincronização Ativa</h4>
                  <p className="text-[11px] text-gray-500 font-bold uppercase tracking-widest leading-relaxed italic">
                    A Evolution API permite que você opere múltiplos chips sem delay. Use o botão de lixeira para limpar clusters antigos.
                  </p>
                </GlassCard>
                
                <div className="grid grid-cols-2 gap-8">
                  <GlassCard className="!p-8 !rounded-[2.5rem] text-center border-white/5 bg-black/40 shadow-2xl">
                    <div className="text-5xl font-black text-orange-500 mb-1 leading-none">{instances.filter(i => i.status === 'CONNECTED').length}</div>
                    <div className="text-[8px] font-black uppercase tracking-widest text-gray-700">Chips Online</div>
                  </GlassCard>
                  <GlassCard className="!p-8 !rounded-[2.5rem] text-center border-white/5 bg-black/40 shadow-2xl">
                    <div className="text-5xl font-black text-white mb-1 leading-none">{leads.length}</div>
                    <div className="text-[8px] font-black uppercase tracking-widest text-gray-700">Leads Handshake</div>
                  </GlassCard>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TELA DE ATENDIMENTO / CRM */}
        {activeTab === 'atendimento' && (
          <div className="flex-1 flex overflow-hidden">
            <div className="w-[350px] lg:w-[420px] border-r border-white/5 flex flex-col bg-black/30 backdrop-blur-3xl z-10">
              <header className="p-8 border-b border-white/5 flex items-center justify-between bg-black/20">
                <h3 className="text-sm font-black uppercase italic tracking-[0.2em] text-orange-500">Neural CRM</h3>
                <button 
                  onClick={syncChats} 
                  className={`p-2 glass rounded-lg transition-all ${isSyncing ? 'animate-spin text-orange-500' : 'text-gray-600 hover:text-orange-500'}`}
                >
                  <RefreshCw size={14} />
                </button>
              </header>
              <div className="p-6">
                <div className="relative group">
                  <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-700 group-focus-within:text-orange-500 transition-colors" />
                  <input 
                    placeholder="BUSCAR LEAD OU NÚMERO..." 
                    className="w-full bg-white/[0.02] border border-white/5 rounded-2xl py-5 pl-12 pr-4 text-[9px] font-black uppercase outline-none focus:border-orange-500/30 transition-all placeholder:text-gray-800" 
                  />
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
                {leads.map(lead => (
                  <button 
                    key={lead.id}
                    onClick={() => setSelectedLeadId(lead.id)}
                    className={`w-full flex items-center gap-4 p-5 rounded-[2.5rem] transition-all text-left border relative group ${selectedLeadId === lead.id ? 'bg-orange-600/10 border-orange-500/20 shadow-2xl shadow-orange-600/10' : 'hover:bg-white/[0.02] border-transparent'}`}
                  >
                    <div className="w-12 h-12 rounded-2xl bg-orange-600/10 flex items-center justify-center text-orange-500 font-black italic text-xl border border-orange-500/10 group-hover:scale-110 transition-transform overflow-hidden">
                      {lead.avatar ? (
                        <img src={lead.avatar} className="w-full h-full object-cover" alt="" />
                      ) : (
                        <span>{lead.contactName[0].toUpperCase()}</span>
                      )}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] font-black uppercase truncate italic text-white/90">{lead.contactName}</span>
                        <span className="text-[7px] font-black text-gray-800 uppercase">{lead.time}</span>
                      </div>
                      <p className="text-[9px] text-gray-600 truncate italic leading-none">{lead.lastMessage}</p>
                    </div>
                    {lead.unreadCount > 0 && (
                      <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_10px_#ff7300]" />
                    )}
                  </button>
                ))}
                {leads.length === 0 && (
                  <div className="py-20 text-center opacity-10 font-black text-[10px] uppercase tracking-[0.5em] italic">
                    Chips conectados: {instances.filter(i => i.status === 'CONNECTED').length}
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 flex flex-col bg-black/40 relative">
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03] pointer-events-none" />
              
              {selectedLeadId && currentLead ? (
                <div className="flex-1 flex flex-col relative z-10">
                  <header className="p-8 border-b border-white/5 flex items-center justify-between bg-black/20 backdrop-blur-xl">
                    <div className="flex items-center gap-5">
                      <div className="w-14 h-14 rounded-3xl bg-orange-600/10 flex items-center justify-center text-orange-500 font-black italic text-2xl border border-orange-500/10 overflow-hidden">
                        {currentLead.avatar ? (
                          <img src={currentLead.avatar} className="w-full h-full object-cover" alt="" />
                        ) : (
                          <span>{currentLead.contactName[0].toUpperCase()}</span>
                        )}
                      </div>
                      <div>
                        <h4 className="text-2xl font-black uppercase italic tracking-tighter leading-none mb-1">{currentLead.contactName}</h4>
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_5px_green]" />
                          <span className="text-[8px] font-black uppercase text-gray-700 tracking-[0.2em]">Cluster: {(currentLead as any).instanceSource} • {currentLead.contactPhone}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <GlassButton className="!p-4 hover:text-orange-500"><Smartphone size={18}/></GlassButton>
                      <GlassButton className="!p-4 hover:text-orange-500"><MoreVertical size={18}/></GlassButton>
                    </div>
                  </header>

                  <div className="flex-1 overflow-y-auto p-12 space-y-6 custom-scrollbar scroll-smooth">
                    {chatMessages.map((m, idx) => (
                      <div key={idx} className={`flex ${m.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[70%] p-6 rounded-[2.5rem] shadow-2xl relative ${m.sender === 'me' ? 'bg-orange-600 rounded-br-none shadow-[0_0_40px_rgba(255,115,0,0.15)] text-white' : 'bg-white/[0.04] border border-white/5 rounded-bl-none text-gray-200'}`}>
                          <p className="text-sm font-medium leading-relaxed tracking-tight">{m.text}</p>
                          <div className={`text-[7px] font-black uppercase mt-3 tracking-[0.3em] ${m.sender === 'me' ? 'text-white/40' : 'text-gray-700'}`}>
                            {m.time} • {m.sender === 'me' ? 'SISTEMA NEURAL' : 'LEAD INPUT'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-10 border-t border-white/5 bg-[#080808]/80 flex gap-4 backdrop-blur-2xl">
                    <button className="p-6 glass rounded-[2rem] text-gray-700 hover:text-orange-500 transition-all"><Paperclip size={24}/></button>
                    <input 
                      value={messageInput}
                      onChange={e => setMessageInput(e.target.value)}
                      onKeyPress={e => e.key === 'Enter' && handleSend()}
                      placeholder="ESCREVA OU COLE SUA RESPOSTA..."
                      className="flex-1 bg-white/[0.01] border border-white/10 rounded-[2.5rem] py-6 px-12 text-xs font-bold uppercase outline-none focus:border-orange-500 transition-all placeholder:text-gray-900"
                    />
                    <button 
                      onClick={handleSend}
                      disabled={isSending || !messageInput.trim()}
                      className="p-6 bg-orange-600 rounded-[2.5rem] hover:bg-orange-500 shadow-[0_0_40px_rgba(255,115,0,0.25)] transition-all flex items-center justify-center min-w-[90px]"
                    >
                      {isSending ? <Loader2 className="animate-spin" size={28} /> : <Send size={28}/>}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-20 opacity-20">
                   <MessageSquare size={60} className="mb-10" />
                   <h3 className="text-4xl font-black uppercase italic tracking-tighter">Terminal CRM</h3>
                   <p className="text-[10px] font-black uppercase tracking-[0.6em] mt-4">Aguardando Handshake com Lead</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* MODAL QR CODE (FIXED) */}
        <AnimatePresence>
          {qrModal.isOpen && (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center p-8 bg-black/95 backdrop-blur-3xl">
              <div className="bg-[#0a0a0a] border border-white/10 p-20 rounded-[5rem] text-center max-w-sm w-full relative shadow-[0_0_200px_rgba(255,115,0,0.15)]">
                <button 
                  onClick={() => setQrModal(p => ({ ...p, isOpen: false }))} 
                  className="absolute top-12 right-12 text-gray-800 hover:text-white transition-all p-2 glass rounded-full"
                >
                  <X size={32}/>
                </button>
                
                <div className="bg-white p-10 rounded-[3.5rem] aspect-square flex items-center justify-center mb-12 mx-auto max-w-[340px] overflow-hidden shadow-[inset_0_0_40px_rgba(0,0,0,0.1)]">
                   {qrModal.connected ? (
                     <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex flex-col items-center">
                       <CheckCircle2 size={120} className="text-green-500 mb-4 shadow-[0_0_30px_#22c55e44]" />
                       <span className="text-black font-black uppercase text-[12px] tracking-[0.4em]">Handshake Sucesso!</span>
                     </motion.div>
                   ) : 
                    qrModal.code ? (
                      <img src={qrModal.code} className="w-full h-full object-contain scale-110" alt="Evolution QR Code" />
                    ) : (
                      <div className="flex flex-col items-center gap-4">
                        <Loader2 className="animate-spin text-orange-500" size={60} />
                        <span className="text-black text-[8px] font-black uppercase tracking-widest">Provisionando...</span>
                      </div>
                    )}
                </div>
                
                <h3 className="text-4xl font-black uppercase italic mb-2 tracking-tighter">{qrModal.name}</h3>
                <p className="text-[11px] font-black uppercase text-orange-500 animate-pulse tracking-[0.4em] italic">{qrModal.status}</p>
                
                <div className="mt-12 flex items-center gap-4 justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-ping" />
                  <div className="text-[8px] font-black text-gray-800 uppercase tracking-widest leading-relaxed">Não feche esta janela durante a leitura</div>
                </div>
              </div>
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
