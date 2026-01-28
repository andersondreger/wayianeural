
import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, 
  MessageSquare, 
  LogOut, 
  Smartphone, 
  Plus, 
  QrCode, 
  Loader2, 
  RefreshCw, 
  Trash2, 
  X,
  Layers, 
  Network, 
  Link2,
  Lock,
  SignalHigh,
  Zap,
  Activity,
  BarChart3,
  Search,
  Send,
  MessageCircle,
  Users,
  Check,
  ChevronRight,
  Database,
  Cpu,
  Unplug,
  CheckCircle2,
  AlertTriangle,
  Wifi,
  Waves,
  ShieldAlert,
  Terminal,
  RotateCw
} from 'lucide-react';
import { UserSession, DashboardTab, EvolutionInstance, Ticket, Message } from '../types';
import { GlassCard } from '../components/GlassCard';
import { NeonButton, GlassButton } from '../components/Buttons';
import { Logo } from '../components/Logo';

const ADMIN_MASTER = 'dregerr.anderson@gmail.com';

export function Dashboard({ user, onLogout }: { user: UserSession; onLogout: () => void; onCheckout: () => void }) {
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [instances, setInstances] = useState<(EvolutionInstance & { leadCount?: number })[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [selectedInstanceName, setSelectedInstanceName] = useState<string>('');
  const [messageInput, setMessageInput] = useState('');
  const [isLoadingChats, setIsLoadingChats] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isCreatingInstance, setIsCreatingInstance] = useState(false);
  const [newInstanceName, setNewInstanceName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState({ totalLeads: 0, activeChannels: 0, messagesProcessed: 0 });
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [qrCodeModal, setQrCodeModal] = useState<{ 
    isOpen: boolean; 
    code: string; 
    name: string; 
    status: string;
    token?: string;
    error?: string;
    attempts: number;
    isBooting: boolean;
    debugLog: string[];
  }>({ 
    isOpen: false, 
    code: '', 
    name: '',
    status: 'Injetando Engine...',
    attempts: 0,
    isBooting: true,
    debugLog: []
  });

  const evolutionUrl = 'https://evo2.wayiaflow.com.br'; 
  const evolutionApiKey = 'd86920ba398e31464c46401214779885';

  const getHeaders = () => ({ 
    'apikey': evolutionApiKey, 
    'Content-Type': 'application/json',
    'accept': '*/*'
  });
  
  const getBaseUrl = () => {
    let url = evolutionUrl;
    if (url.endsWith('/')) url = url.slice(0, -1);
    return url;
  };

  const addDebug = (msg: string) => {
    setQrCodeModal(prev => ({
      ...prev,
      debugLog: [msg, ...prev.debugLog].slice(0, 5)
    }));
  };

  const fetchInstances = async () => {
    try {
      const res = await fetch(`${getBaseUrl()}/instance/fetchInstances`, { headers: getHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.instances || []);
      
      const mapped = await Promise.all(list.map(async (inst: any) => {
        const name = inst.instanceName || inst.name;
        const state = inst.status || inst.connectionStatus || inst.state || inst.instance?.state || 'disconnected';
        const isConnected = state === 'open' || state === 'CONNECTED';
        let leadCount = 0;
        if (isConnected) {
          try {
            const chatRes = await fetch(`${getBaseUrl()}/chat/fetchChats/${name}`, { headers: getHeaders() });
            if (chatRes.ok) {
              const chatData = await chatRes.json();
              leadCount = Array.isArray(chatData) ? chatData.length : (chatData.chats?.length || 0);
            }
          } catch (e) {}
        }
        return {
          id: inst.instanceId || name,
          name: name,
          status: isConnected ? 'CONNECTED' : 'DISCONNECTED',
          phone: inst.ownerJid?.split('@')[0] || inst.number || 'Aguardando Login',
          instanceKey: inst.token || inst.instanceKey,
          leadCount: leadCount
        };
      }));
      setInstances(mapped);
      setStats(prev => ({ 
        ...prev, 
        activeChannels: mapped.filter(i => i.status === 'CONNECTED').length,
        totalLeads: mapped.reduce((acc, curr) => acc + (curr.leadCount || 0), 0)
      }));
    } catch (err) {}
  };

  const startQrPolling = (name: string) => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);

    const performPoll = async () => {
      if (!qrCodeModal.isOpen) return;

      try {
        const stateRes = await fetch(`${getBaseUrl()}/instance/connectionState/${name}`, { headers: getHeaders() });
        const stateData = await stateRes.json();
        const actualState = stateData?.instance?.state || stateData?.state;

        if (actualState === 'open' || actualState === 'CONNECTED') {
          addDebug("✓ Sincronizado!");
          setQrCodeModal(prev => ({ ...prev, status: 'Ativo!', code: 'CONNECTED', isBooting: false }));
          setTimeout(() => {
            setQrCodeModal(p => ({ ...p, isOpen: false }));
            fetchInstances();
          }, 1500);
          return;
        }

        addDebug(`Buscando QR (${qrCodeModal.attempts + 1})...`);
        const qrRes = await fetch(`${getBaseUrl()}/instance/qrcode/${name}`, { headers: getHeaders() });
        
        if (qrRes.status === 404) {
          addDebug("Engine Offline (404)");
          setQrCodeModal(prev => ({ ...prev, attempts: prev.attempts + 1, isBooting: true }));
          pollTimerRef.current = setTimeout(performPoll, 1200);
          return;
        }

        const qrData = await qrRes.json();
        const qr = qrData?.base64 || qrData?.qrcode?.base64 || qrData?.code;

        if (qr) {
          addDebug("QR Sintonizado!");
          const formattedQr = qr.startsWith('data:image') ? qr : `data:image/png;base64,${qr}`;
          setQrCodeModal(prev => ({ ...prev, code: formattedQr, status: 'Pronto para Escaneamento', isBooting: false, attempts: 0 }));
          pollTimerRef.current = setTimeout(performPoll, 4000);
        } else {
          addDebug("Resposta nula da API");
          pollTimerRef.current = setTimeout(performPoll, 2000);
        }
      } catch (err) {
        addDebug("Falha de Comunicação");
        pollTimerRef.current = setTimeout(performPoll, 3000);
      }
    };

    performPoll();
  };

  const connectInstance = async (name: string, token?: string) => {
    setQrCodeModal({ 
      isOpen: true, code: '', name, token, 
      status: 'Acionando Handshake...', error: undefined, 
      attempts: 0, isBooting: true, debugLog: ["Iniciando conexão..."] 
    });
    
    try {
      addDebug("Enviando sinal de ativação...");
      await fetch(`${getBaseUrl()}/instance/connect/${name}`, { headers: getHeaders() }).catch(() => {});
      startQrPolling(name);
    } catch (err) {
      setQrCodeModal(prev => ({ ...prev, status: 'Erro Fatal', error: 'Evolution API não responde.' }));
    }
  };

  const handleProvisionInstance = async () => {
    if (!newInstanceName.trim()) return;
    setIsCreatingInstance(true);
    const finalName = newInstanceName.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '');
    const finalToken = Math.random().toString(36).substring(2, 18).toUpperCase();
    
    try {
      addDebug("Provisionando nova Engine...");
      const res = await fetch(`${getBaseUrl()}/instance/create`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ instanceName: finalName, token: finalToken, qrcode: true })
      });
      
      if (res.ok || res.status === 409) {
        setNewInstanceName('');
        await fetchInstances();
        connectInstance(finalName, finalToken);
      } else {
        const data = await res.json();
        addDebug(`Erro: ${data.message}`);
        setQrCodeModal({ isOpen: true, code: '', name: finalName, status: 'Erro', error: data.message, attempts: 0, isBooting: false, debugLog: ["Criação falhou"] });
      }
    } catch (err) {
      addDebug("Falha de rede no provisionamento");
    } finally { setIsCreatingInstance(false); }
  };

  const fetchChats = async (instanceName: string) => {
    if (!instanceName) return;
    setIsLoadingChats(true);
    setTickets([]);
    try {
      const res = await fetch(`${getBaseUrl()}/chat/fetchChats/${instanceName}`, { headers: getHeaders() });
      if (res.ok) {
        const json = await res.json();
        const chatsRaw = Array.isArray(json) ? json : (json.chats || []);
        const mapped: Ticket[] = chatsRaw.map((item: any) => ({
          id: item.id || item.remoteJid,
          contactName: item.pushName || item.name || item.id?.split('@')[0] || 'Lead Desconhecido',
          contactPhone: item.id?.split('@')[0] || 'Desconhecido',
          lastMessage: item.lastMessage?.message?.conversation || item.message || 'Sem mensagens',
          sentiment: 'neutral',
          time: 'Ativo',
          status: 'novo',
          unreadCount: item.unreadCount || 0,
          assignedTo: instanceName,
          protocol: String(Math.floor(Math.random() * 90000) + 10000),
          avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(item.pushName || 'U')}&background=ff7300&color=fff&rounded=true`,
          messages: []
        }));
        setTickets(mapped);
      }
    } catch (e) {} finally { setIsLoadingChats(false); }
  };

  const fetchMessages = async (ticket: Ticket) => {
    if (!selectedInstanceName || !ticket.id) return;
    setIsLoadingMessages(true);
    try {
      const res = await fetch(`${getBaseUrl()}/chat/fetchMessages/${selectedInstanceName}`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ remoteJid: ticket.id, count: 50 })
      });
      if (res.ok) {
        const json = await res.json();
        const messagesRaw = Array.isArray(json) ? json : (json.messages || []);
        const mapped: Message[] = messagesRaw.reverse().map((m: any) => ({
          id: m.key?.id || Math.random().toString(),
          text: m.message?.conversation || m.message?.extendedTextMessage?.text || "📎 Mídia",
          sender: m.key?.fromMe ? 'me' : 'contact',
          time: new Date(m.messageTimestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: 'read',
          type: 'text'
        }));
        setSelectedTicket({ ...ticket, messages: mapped });
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      }
    } catch (e) {} finally { setIsLoadingMessages(false); }
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedTicket || !selectedInstanceName) return;
    const msgText = messageInput;
    setMessageInput('');
    try {
      const res = await fetch(`${getBaseUrl()}/message/sendText/${selectedInstanceName}`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ number: selectedTicket.id, text: msgText, delay: 1000 })
      });
      if (res.ok) {
        const newMsg: Message = { id: Date.now().toString(), text: msgText, sender: 'me', time: 'Agora', status: 'sent', type: 'text' };
        setSelectedTicket(prev => prev ? { ...prev, messages: [...prev.messages, newMsg] } : null);
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      }
    } catch (e) {}
  };

  const deleteInstance = async (name: string) => {
    if (!confirm(`Desativar ${name} permanentemente?`)) return;
    try {
      await fetch(`${getBaseUrl()}/instance/delete/${name}`, { method: 'DELETE', headers: getHeaders() });
      fetchInstances();
    } catch (e) {}
  };

  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      const name = (t.contactName || '').toLowerCase();
      const phone = (t.contactPhone || '').toLowerCase();
      const search = searchTerm.toLowerCase();
      return name.includes(search) || phone.includes(search);
    });
  }, [tickets, searchTerm]);

  useEffect(() => {
    fetchInstances();
    const interval = setInterval(fetchInstances, 60000);
    return () => clearInterval(interval);
  }, []);

  if (!user) return <div className="h-screen bg-black flex items-center justify-center text-orange-500 font-black italic animate-pulse uppercase tracking-[0.5em]">WAYFLOW NEURAL CLUSTER</div>;

  return (
    <div className="flex h-screen bg-[#050505] overflow-hidden text-white font-sans selection:bg-orange-500/30">
      <div className="fixed inset-0 grid-engine pointer-events-none opacity-5"></div>

      <aside className="w-[280px] border-r border-white/5 flex flex-col p-6 bg-black/40 backdrop-blur-3xl z-50">
        <Logo size="sm" className="mb-10 px-2" />
        <nav className="flex-1 space-y-2">
          <button onClick={() => setActiveTab('overview')} className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all ${activeTab === 'overview' ? 'bg-orange-600/10 text-orange-500 border border-orange-500/10 shadow-[0_0_25px_rgba(255,115,0,0.15)]' : 'text-gray-500 hover:text-white hover:bg-white/[0.02]'}`}>
             <LayoutDashboard size={18} /> <span className="text-[10px] font-black uppercase tracking-widest">Dashboard</span>
          </button>
          <button onClick={() => setActiveTab('atendimento')} className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all ${activeTab === 'atendimento' ? 'bg-orange-600/10 text-orange-500 border border-orange-500/10 shadow-[0_0_25px_rgba(255,115,0,0.15)]' : 'text-gray-500 hover:text-white hover:bg-white/[0.02]'}`}>
             <MessageSquare size={18} /> <span className="text-[10px] font-black uppercase tracking-widest">Atendimento</span>
          </button>
          <button onClick={() => setActiveTab('integracoes')} className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all ${activeTab === 'integracoes' ? 'bg-orange-600/10 text-orange-500 border border-orange-500/10 shadow-[0_0_25px_rgba(255,115,0,0.15)]' : 'text-gray-500 hover:text-white hover:bg-white/[0.02]'}`}>
             <Layers size={18} /> <span className="text-[10px] font-black uppercase tracking-widest">Integrações</span>
          </button>
        </nav>
        <div className="mt-auto border-t border-white/5 pt-6 space-y-4">
          <div className="px-5 py-4 glass rounded-[2rem] flex items-center gap-4">
             <div className="w-10 h-10 rounded-2xl bg-orange-600 flex items-center justify-center font-black text-xs italic">W</div>
             <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black uppercase truncate">{user.name}</p>
                <p className="text-[8px] text-gray-600 uppercase font-bold truncate">Neural Master</p>
             </div>
          </div>
          <button onClick={onLogout} className="w-full flex items-center gap-3 px-6 py-4 text-gray-600 hover:text-red-500 transition-colors uppercase text-[9px] font-black tracking-widest">
              <LogOut size={18} /> Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative overflow-hidden bg-[#070707]">
        <AnimatePresence>
          {qrCodeModal.isOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/95 backdrop-blur-2xl">
              <motion.div initial={{ scale: 0.9, y: 30 }} animate={{ scale: 1, y: 0 }} className="bg-[#0a0a0a] border border-white/10 p-12 rounded-[3.5rem] max-w-2xl w-full text-center space-y-10 relative overflow-hidden shadow-[0_0_100px_rgba(255,115,0,0.25)]">
                <button onClick={() => setQrCodeModal(p => ({ ...p, isOpen: false }))} className="absolute top-10 right-10 text-gray-600 hover:text-white transition-colors p-2"><X size={28} /></button>
                <div className="space-y-4">
                  <div className="p-5 bg-orange-500/10 rounded-full w-fit mx-auto"><QrCode className="text-orange-500" size={48} /></div>
                  <h3 className="text-4xl font-black uppercase italic tracking-tighter leading-none">Canal <span className="text-orange-500">Neural.</span></h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                  <div className="bg-white p-6 rounded-[3rem] border-8 border-orange-500/10 flex items-center justify-center min-h-[300px] relative overflow-hidden">
                    {qrCodeModal.code === 'CONNECTED' ? (
                       <div className="text-center text-green-600 space-y-6">
                          <CheckCircle2 size={100} className="mx-auto drop-shadow-lg" />
                          <div className="space-y-2">
                             <div className="text-2xl font-black uppercase italic">Conectado!</div>
                             <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest animate-pulse">Sincronizando Clusters...</p>
                          </div>
                       </div>
                    ) : qrCodeModal.code ? (
                      <motion.div className="space-y-4">
                        <motion.img initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} src={qrCodeModal.code} className="w-64 h-64 object-contain mx-auto shadow-2xl rounded-xl" />
                        <div className="flex items-center justify-center gap-2 text-black/40 text-[9px] font-black uppercase tracking-widest italic animate-pulse">
                           <Wifi size={14} className="text-orange-500" /> Aguardando Leitura
                        </div>
                      </motion.div>
                    ) : (
                      <div className="text-center text-black space-y-6">
                        <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
                           <Loader2 className="animate-spin text-orange-500 absolute inset-0 opacity-20" size={96} />
                           <Waves className="text-orange-500 animate-pulse" size={48} />
                        </div>
                        <div className="space-y-2">
                          <span className="text-[11px] font-black uppercase tracking-widest block italic opacity-60">Sintonizando Engine...</span>
                          <p className="text-[8px] text-gray-500 font-bold uppercase max-w-[200px] mx-auto leading-relaxed italic">Acordando cluster Baileys. Isso pode levar 10-15s.</p>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="text-left space-y-6">
                    <div className="bg-white/[0.02] p-7 rounded-3xl border border-white/5">
                      <div className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-1">ID da Instância</div>
                      <div className="text-lg font-black text-white truncate uppercase italic">{qrCodeModal.name}</div>
                    </div>

                    <div className="bg-black/50 p-6 rounded-3xl border border-white/5 space-y-3">
                       <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-orange-500 text-[9px] font-black uppercase tracking-widest"><Terminal size={14} /> Status em tempo real</div>
                          <button onClick={() => connectInstance(qrCodeModal.name, qrCodeModal.token)} className="text-[8px] font-black uppercase bg-white/5 px-2 py-1 rounded hover:bg-orange-500/20 transition-all flex items-center gap-1"><RotateCw size={10} /> Recarregar</button>
                       </div>
                       <div className="space-y-1">
                          {qrCodeModal.debugLog.map((log, i) => (
                            <div key={i} className={`text-[9px] font-mono italic ${i === 0 ? 'text-white' : 'text-gray-600'}`}>{`> ${log}`}</div>
                          ))}
                       </div>
                    </div>

                    <div className="flex items-center gap-4 text-orange-500 animate-pulse text-[12px] font-black uppercase italic tracking-widest">
                      <SignalHigh size={20} /> {qrCodeModal.status}
                    </div>
                  </div>
                </div>
                <NeonButton onClick={() => setQrCodeModal(p => ({ ...p, isOpen: false }))} className="w-full !py-6 !rounded-[2.2rem] !text-[11px] shadow-2xl shadow-orange-600/30">Retornar ao Cockpit</NeonButton>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {activeTab === 'overview' && (
          <div className="flex-1 p-10 lg:p-16 overflow-y-auto custom-scrollbar">
            <header className="mb-16 space-y-4">
              <div className="flex items-center gap-3 text-orange-500"><Activity size={20} /><span className="text-[11px] font-black uppercase tracking-[0.5em] italic">Monitoramento Neural</span></div>
              <h2 className="text-6xl md:text-8xl font-black uppercase italic tracking-tighter leading-none">Visão <span className="text-orange-500">Geral.</span></h2>
            </header>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
              <GlassCard className="!p-10 border-orange-500/10 text-center hover:bg-orange-500/[0.02] cursor-default transition-all"><Smartphone className="text-orange-500 mb-6 mx-auto" size={32} /><div className="text-[11px] font-black text-gray-500 uppercase tracking-widest mb-2">Engines Ativas</div><div className="text-6xl font-black italic">{stats.activeChannels}</div></GlassCard>
              <GlassCard className="!p-10 border-blue-500/10 text-center hover:bg-blue-500/[0.02] cursor-default transition-all"><Users className="text-blue-500 mb-6 mx-auto" size={32} /><div className="text-[11px] font-black text-gray-500 uppercase tracking-widest mb-2">Base de Leads</div><div className="text-6xl font-black italic">{stats.totalLeads}</div></GlassCard>
              <GlassCard className="!p-10 border-green-500/10 text-center hover:bg-green-500/[0.02] cursor-default transition-all"><CheckCircle2 className="text-green-500 mb-6 mx-auto" size={32} /><div className="text-[11px] font-black text-gray-500 uppercase tracking-widest mb-2">Mensagens</div><div className="text-6xl font-black italic">14.2K</div></GlassCard>
            </div>
          </div>
        )}

        {activeTab === 'atendimento' && (
          <div className="flex h-full w-full overflow-hidden">
            <div className="w-[400px] border-r border-white/5 flex flex-col bg-black/30 backdrop-blur-2xl">
              <div className="p-10 border-b border-white/5 space-y-8">
                <h3 className="text-[12px] font-black uppercase tracking-[0.4em] italic text-orange-500">Neural Chat</h3>
                <select value={selectedInstanceName} onChange={e => { setSelectedInstanceName(e.target.value); fetchChats(e.target.value); }} className="w-full bg-white/[0.03] border border-white/10 rounded-[1.8rem] py-5 px-6 text-[11px] font-black uppercase outline-none focus:border-orange-500 transition-all cursor-pointer">
                  <option value="">Selecione a Engine...</option>
                  {instances.map(i => <option key={i.id} value={i.name}>{i.status === 'CONNECTED' ? '🟢' : '🔴'} {i.name}</option>)}
                </select>
                <div className="relative">
                   <Search size={18} className="absolute left-6 top-5 text-gray-600" />
                   <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="PESQUISAR LEAD..." className="w-full bg-white/[0.03] border border-white/10 rounded-[1.8rem] py-5 px-14 text-[11px] font-black uppercase outline-none focus:border-orange-500/40" />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4">
                {isLoadingChats ? (
                  <div className="flex flex-col items-center justify-center py-20 opacity-20">
                     <Loader2 className="animate-spin mb-4" size={32} />
                     <span className="text-[10px] font-black uppercase tracking-widest">Sincronizando...</span>
                  </div>
                ) : filteredTickets.length > 0 ? (
                  filteredTickets.map(t => (
                    <div key={t.id} onClick={() => { setSelectedTicket(t); fetchMessages(t); }} className={`p-6 rounded-[2.2rem] cursor-pointer transition-all border ${selectedTicket?.id === t.id ? 'bg-orange-600/10 border-orange-500/40 shadow-2xl' : 'bg-transparent border-transparent hover:bg-white/[0.03]'}`}>
                      <div className="flex gap-5 items-center">
                        <img src={t.avatar} className="w-14 h-14 rounded-2xl border border-white/10 shadow-xl" />
                        <div className="flex-1 min-w-0"><h4 className="text-[13px] font-black uppercase truncate text-white mb-1">{t.contactName}</h4><p className="text-[10px] text-gray-500 truncate italic">"{t.lastMessage}"</p></div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-20 opacity-20">
                     <Search size={48} className="mx-auto mb-4" />
                     <p className="text-[10px] font-black uppercase tracking-widest italic">Nenhum lead encontrado</p>
                  </div>
                )}
              </div>
            </div>
            <div className="flex-1 flex flex-col bg-[#090909] relative">
              {selectedTicket ? (
                <>
                  <header className="h-28 border-b border-white/5 flex items-center justify-between px-12 bg-black/40 backdrop-blur-3xl z-10">
                    <div className="flex items-center gap-6">
                       <img src={selectedTicket.avatar} className="w-16 h-16 rounded-[1.5rem] border border-white/10 shadow-2xl" />
                       <div><h3 className="text-xl font-black uppercase italic tracking-tighter">{selectedTicket.contactName}</h3><div className="text-[10px] text-orange-500 font-black uppercase tracking-widest italic animate-pulse">Chat em tempo real</div></div>
                    </div>
                    <GlassButton onClick={() => fetchMessages(selectedTicket)} className="!px-8 !py-4 !rounded-2xl">{isLoadingMessages ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18}/>}</GlassButton>
                  </header>
                  <div className="flex-1 overflow-y-auto p-12 space-y-10 custom-scrollbar">
                    {selectedTicket.messages.map((m, i) => (
                      <div key={i} className={`flex ${m.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] p-7 rounded-[2.5rem] ${m.sender === 'me' ? 'bg-orange-600 text-white rounded-tr-none shadow-xl' : 'bg-[#151515] text-gray-200 border border-white/5 rounded-tl-none'}`}>
                          <p className="text-[15px] font-semibold leading-relaxed tracking-tight">{m.text}</p>
                          <div className={`text-[9px] mt-4 opacity-50 font-black italic ${m.sender === 'me' ? 'text-right' : ''}`}>{m.time}</div>
                        </div>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>
                  <div className="p-10 border-t border-white/5 bg-black/60 backdrop-blur-3xl">
                    <div className="flex gap-5 bg-white/[0.03] border border-white/10 rounded-[3rem] p-3 px-10 focus-within:border-orange-500 transition-all shadow-inner">
                       <input value={messageInput} onChange={e => setMessageInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleSendMessage()} placeholder="DIGITE SUA MENSAGEM..." className="flex-1 bg-transparent border-none outline-none text-[15px] font-bold py-5 text-white placeholder:text-gray-800" />
                       <button onClick={handleSendMessage} className="bg-orange-600 p-5 rounded-full hover:scale-110 active:scale-95 transition-all shadow-2xl text-white shadow-orange-600/20"><Send size={28} /></button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center opacity-10"><MessageCircle size={180} className="text-orange-500 mb-10" /><h2 className="text-6xl font-black uppercase italic tracking-tighter">Cockpit CRM</h2><p className="text-[14px] font-black uppercase tracking-[0.5em] mt-6 italic">Selecione uma conversa ao lado</p></div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'integracoes' && (
          <div className="flex-1 p-10 lg:p-16 overflow-y-auto custom-scrollbar">
             <header className="mb-16 space-y-4">
                <Layers size={24} className="text-orange-500" />
                <h2 className="text-6xl md:text-8xl font-black uppercase italic tracking-tighter leading-none">Canais.</h2>
             </header>
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                <GlassCard className="!p-12 border-orange-500/20 bg-orange-500/[0.01]">
                   <h3 className="text-4xl font-black uppercase italic tracking-tighter mb-6">WhatsApp Engine</h3>
                   <div className="flex gap-4 mb-10">
                      <input value={newInstanceName} onChange={e => setNewInstanceName(e.target.value)} placeholder="NOME DA ENGINE (EX: SUPORTE)" className="flex-1 bg-white/[0.03] border border-white/10 rounded-2xl py-5 px-6 text-[12px] font-black uppercase outline-none focus:border-orange-500/40 transition-all" />
                      <NeonButton onClick={handleProvisionInstance} disabled={isCreatingInstance || !newInstanceName} className="!px-10 !rounded-2xl shadow-orange-600/30">
                        {isCreatingInstance ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} />}
                      </NeonButton>
                   </div>
                   <div className="space-y-6">
                      {instances.length === 0 && !isCreatingInstance && (
                        <div className="text-center py-20 opacity-20"><Smartphone size={64} className="mx-auto mb-4" /><p className="text-[10px] font-black uppercase tracking-widest italic">Nenhuma engine configurada</p></div>
                      )}
                      {instances.map(inst => (
                          <div key={inst.id} className="group flex items-center justify-between p-8 bg-white/[0.02] border border-white/5 rounded-[2.8rem] hover:border-orange-500/30 transition-all hover:bg-orange-500/[0.01]">
                             <div className="flex items-center gap-6">
                                <div className={`w-3.5 h-3.5 rounded-full ${inst.status === 'CONNECTED' ? 'bg-green-500 shadow-[0_0_20px_rgba(34,197,94,0.5)] animate-pulse' : 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.2)]'}`} />
                                <div className="space-y-1">
                                   <div className="flex items-center gap-3"><span className="text-[18px] font-black uppercase italic block text-white tracking-tight">{inst.name}</span></div>
                                   <span className="text-[10px] text-gray-600 font-bold uppercase tracking-widest italic">{inst.status === 'CONNECTED' ? inst.phone : 'Aguardando Ativação'}</span>
                                </div>
                             </div>
                             <div className="flex gap-8 opacity-0 group-hover:opacity-100 transition-all">
                                <button onClick={() => connectInstance(inst.name, inst.instanceKey)} className="text-[11px] font-black uppercase text-orange-500 hover:text-orange-400 underline underline-offset-8 transition-all decoration-orange-500/30">Ver QR Code</button>
                                <button onClick={() => deleteInstance(inst.name)} className="text-[11px] font-black uppercase text-red-500/30 hover:text-red-500 transition-all">Remover</button>
                             </div>
                          </div>
                        ))}
                   </div>
                </GlassCard>
                <div className="space-y-12">
                  <GlassCard className="!p-12 border-blue-500/10 text-center hover:bg-blue-500/[0.01] transition-all">
                     <Database size={40} className="text-blue-500 mb-6 mx-auto" />
                     <h3 className="text-4xl font-black uppercase italic tracking-tighter mb-2">Neural Base</h3>
                     <p className="text-[11px] text-gray-500 font-black uppercase tracking-widest italic mb-8">Base de dados Supabase ativa no cluster.</p>
                     <div className="flex items-center justify-center gap-3 text-green-500 text-[11px] font-black uppercase tracking-widest italic animate-pulse"><CheckCircle2 size={18} /> Sistema Ativo</div>
                  </GlassCard>
                </div>
             </div>
          </div>
        )}
      </main>
    </div>
  );
}
