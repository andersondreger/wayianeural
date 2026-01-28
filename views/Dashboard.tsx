
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
  User,
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
  RotateCw,
  Globe,
  MoreVertical,
  Paperclip,
  Smile,
  Mic,
  SmilePlus,
  Meh,
  Frown,
  CheckCheck,
  Circle
} from 'lucide-react';
import { UserSession, DashboardTab, EvolutionInstance, Ticket, Message } from '../types';
import { GlassCard } from '../components/GlassCard';
import { NeonButton, GlassButton } from '../components/Buttons';
import { Logo } from '../components/Logo';

export function Dashboard({ user, onLogout }: { user: UserSession; onLogout: () => void; onCheckout: () => void }) {
  const [activeTab, setActiveTab] = useState<DashboardTab>('atendimento');
  const [instances, setInstances] = useState<(EvolutionInstance & { leadCount?: number })[]>([]);
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [newInstanceName, setNewInstanceName] = useState('');
  const [isCreatingInstance, setIsCreatingInstance] = useState(false);
  const [isSyncingChats, setIsSyncingChats] = useState(false);
  
  // Estados de Atendimento (CRM Neural)
  const [tickets, setTickets] = useState<Ticket[]>([
    {
      id: '1',
      contactName: 'Anderson Dreger',
      contactPhone: '5545999045858',
      lastMessage: 'Sistema operacional e aguardando sincronização de leads.',
      sentiment: 'happy',
      time: 'Agora',
      status: 'em_atendimento',
      unreadCount: 0,
      assignedTo: 'Master',
      protocol: 'WAY-2025-ALPHA',
      messages: [
        { id: 'm1', text: 'Terminal Neural Ativo. Aguardando sincronização de instâncias...', sender: 'me', time: '10:00', status: 'read', type: 'text' }
      ]
    }
  ]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>('1');
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [qrCodeModal, setQrCodeModal] = useState<{ 
    isOpen: boolean; 
    code: string; 
    name: string; 
    status: string;
    attempts: number;
    isBooting: boolean;
    debugLog: string[];
  }>({ 
    isOpen: false, 
    code: '', 
    name: '',
    status: 'Iniciando Handshake...',
    attempts: 0,
    isBooting: true,
    debugLog: []
  });

  const evolutionUrl = 'https://evo2.wayiaflow.com.br'; 
  const evolutionApiKey = 'd86920ba398e31464c46401214779885';

  const getHeaders = () => ({ 
    'apikey': evolutionApiKey, 
    'Content-Type': 'application/json'
  });
  
  const getBaseUrl = () => {
    let url = evolutionUrl;
    if (url.endsWith('/')) url = url.slice(0, -1);
    return url;
  };

  const selectedTicket = useMemo(() => tickets.find(t => t.id === selectedTicketId), [tickets, selectedTicketId]);

  const filteredTickets = useMemo(() => {
    return tickets.filter(t => 
      t.contactName.toLowerCase().includes(searchQuery.toLowerCase()) || 
      t.contactPhone.includes(searchQuery)
    );
  }, [tickets, searchQuery]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedTicket?.messages]);

  // Sincronização Robusta de Chats (Melhorado para capturar leads reais)
  const syncChats = async (instanceName?: string) => {
    const target = instanceName || instances.find(i => i.status === 'CONNECTED')?.name;
    if (!target) return;

    setIsSyncingChats(true);
    try {
      const res = await fetch(`${getBaseUrl()}/chat/fetchChats/${target}`, { headers: getHeaders() });
      if (!res.ok) throw new Error("API Offline");
      const result = await res.json();
      
      // Suporte para múltiplos formatos de resposta da Evolution v2
      const chatList = Array.isArray(result) ? result : (result.data || result.instances || []);
      
      if (chatList.length > 0) {
        const newTickets: Ticket[] = chatList.map((chat: any) => ({
          id: chat.id || chat.remoteJid,
          contactName: chat.name || chat.pushName || chat.remoteJid?.split('@')[0] || 'Lead Novo',
          contactPhone: chat.remoteJid?.split('@')[0] || '',
          lastMessage: chat.lastMessage?.message?.conversation || chat.lastMessage?.message?.extendedTextMessage?.text || 'Mídia ou Mensagem do Sistema',
          sentiment: 'neutral',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: 'novo',
          unreadCount: chat.unreadCount || 0,
          assignedTo: 'IA',
          protocol: `NF-${Math.floor(1000 + Math.random() * 9000)}`,
          messages: []
        }));

        setTickets(prev => {
          // Mantemos apenas contatos únicos por ID/RemoteJid
          const existingIds = new Set(prev.map(p => p.id));
          const uniqueNewOnes = newTickets.filter(nt => !existingIds.has(nt.id));
          return [...prev, ...uniqueNewOnes];
        });
      }
    } catch (err) {
      console.error("Erro no Sync Neural:", err);
    } finally {
      setIsSyncingChats(false);
    }
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedTicket) return;

    const connectedInst = instances.find(i => i.status === 'CONNECTED');
    if (!connectedInst) {
      alert("ERRO: Nenhuma Engine conectada. Conecte uma instância no menu de Engines primeiro.");
      return;
    }

    const newMsg: Message = {
      id: Date.now().toString(),
      text: messageInput,
      sender: 'me',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'sent',
      type: 'text'
    };

    setTickets(prev => prev.map(t => 
      t.id === selectedTicketId ? { ...t, messages: [...t.messages, newMsg], lastMessage: messageInput } : t
    ));
    
    const textToSend = messageInput;
    setMessageInput('');

    try {
      await fetch(`${getBaseUrl()}/message/sendText/${connectedInst.name}`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          number: selectedTicket.contactPhone,
          text: textToSend,
          delay: 1000
        })
      });
    } catch (err) {
      console.error("Falha no disparo:", err);
    }
  };

  const addDebug = (msg: string) => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setQrCodeModal(prev => ({
      ...prev,
      debugLog: [`[${time}] ${msg}`, ...(prev.debugLog || [])].slice(0, 10)
    }));
  };

  const processQrData = (data: any) => {
    const qr = data?.base64 || data?.qrcode?.base64 || data?.code || data?.data?.qrcode;
    if (qr) {
      const cleanQr = qr.replace(/(\r\n|\n|\r)/gm, "");
      return cleanQr.startsWith('data:image') ? cleanQr : `data:image/png;base64,${cleanQr}`;
    }
    return null;
  };

  const fetchInstances = async () => {
    try {
      const res = await fetch(`${getBaseUrl()}/instance/fetchInstances`, { headers: getHeaders() });
      if (!res.ok) throw new Error("API Offline");
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data?.instances || []);
      
      const mapped = list.map((inst: any) => {
        if (!inst) return null;
        const name = inst.instanceName || inst.name || 'Sem Nome';
        const state = inst.status || inst.connectionStatus || inst.state || inst.instance?.state || 'disconnected';
        const isConnected = state === 'open' || state === 'CONNECTED';
        
        // Se a instância estiver conectada, tentamos sincronizar chats automaticamente
        if (isConnected) syncChats(name);

        return {
          id: inst.instanceId || name,
          name: name,
          status: isConnected ? 'CONNECTED' : 'DISCONNECTED' as any,
          phone: inst.ownerJid?.split('@')[0] || inst.number || 'Offline',
          instanceKey: inst.token || inst.instanceKey,
          leadCount: 0
        };
      }).filter(Boolean);

      setInstances(mapped);
      setApiStatus('online');
    } catch (err) {
      setApiStatus('offline');
    }
  };

  const startQrPolling = (name: string) => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    let attempts = 0;

    const performPoll = async () => {
      if (!qrCodeModal.isOpen) return;
      attempts++;

      try {
        const endpoint = attempts % 2 === 0 ? 'qrcode' : 'connect';
        const res = await fetch(`${getBaseUrl()}/instance/${endpoint}/${name}`, { headers: getHeaders() });
        
        if (res.status === 404) {
          addDebug(`Aguardando Engine...`);
          if (attempts % 4 === 0) await fetch(`${getBaseUrl()}/instance/connect/${name}`, { headers: getHeaders() });
          pollTimerRef.current = setTimeout(performPoll, 1500); 
          return;
        }

        const data = await res.json();
        const state = data?.instance?.state || data?.state;

        if (state === 'open' || state === 'CONNECTED') {
          addDebug("✓ SINCRO ESTABELECIDA!");
          setQrCodeModal(prev => ({ ...prev, status: 'Ativo!', code: 'CONNECTED', isBooting: false }));
          setTimeout(() => {
            setQrCodeModal(p => ({ ...p, isOpen: false }));
            fetchInstances();
          }, 1500);
          return;
        }

        const formattedQr = processQrData(data);
        if (formattedQr) {
          addDebug("QR Code Capturado!");
          setQrCodeModal(prev => ({ ...prev, code: formattedQr, status: 'Escaneie o QR', isBooting: false }));
          pollTimerRef.current = setTimeout(performPoll, 5000);
        } else {
          addDebug("Processando buffer visual...");
          pollTimerRef.current = setTimeout(performPoll, 1500);
        }
      } catch (err) {
        pollTimerRef.current = setTimeout(performPoll, 3000);
      }
    };
    performPoll();
  };

  const connectInstance = async (name: string) => {
    setQrCodeModal({ 
      isOpen: true, code: '', name, 
      status: 'Injetando Engine...', attempts: 0, isBooting: true, 
      debugLog: [`Ignificando: ${name}`] 
    });

    try {
      addDebug("Limpando cache...");
      await fetch(`${getBaseUrl()}/instance/logout/${name}`, { method: 'DELETE', headers: getHeaders() }).catch(() => {});
      addDebug("Sinalizando Cluster...");
      const res = await fetch(`${getBaseUrl()}/instance/connect/${name}`, { headers: getHeaders() });
      const data = await res.json();
      const instantQr = processQrData(data);
      if (instantQr) {
        addDebug("QR Instantâneo!");
        setQrCodeModal(prev => ({ ...prev, code: instantQr, status: 'Escaneie Agora', isBooting: false }));
      }
      startQrPolling(name);
    } catch (err) {
      addDebug("Erro de Conexão.");
      startQrPolling(name);
    }
  };

  const handleProvisionInstance = async () => {
    if (!newInstanceName.trim()) return;
    setIsCreatingInstance(true);
    const finalName = newInstanceName.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '');
    const finalToken = Math.random().toString(36).substring(2, 18).toUpperCase();

    try {
      const res = await fetch(`${getBaseUrl()}/instance/create`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ 
          instanceName: finalName, 
          token: finalToken, 
          qrcode: true,
          integration: "WHATSAPP-BAILEYS"
        })
      });

      if (res.ok || res.status === 409) {
        setNewInstanceName('');
        await fetchInstances();
        setTimeout(() => {
          setIsCreatingInstance(false);
          connectInstance(finalName);
        }, 1000);
      } else {
        setIsCreatingInstance(false);
        alert(`Erro: ${await res.text()}`);
      }
    } catch (err) {
      setIsCreatingInstance(false);
      alert("Falha de rede.");
    }
  };

  const deleteInstance = async (name: string) => {
    if (!window.confirm(`Destruir Engine ${name}?`)) return;
    try {
      const res = await fetch(`${getBaseUrl()}/instance/delete/${name}`, { method: 'DELETE', headers: getHeaders() });
      if (res.ok) fetchInstances();
    } catch (err) { alert("Erro."); }
  };

  useEffect(() => {
    fetchInstances();
    const inv = setInterval(fetchInstances, 45000);
    return () => clearInterval(inv);
  }, []);

  return (
    <div className="flex h-screen bg-[#050505] overflow-hidden text-white">
      <div className="fixed inset-0 grid-engine pointer-events-none opacity-5"></div>

      {/* Sidebar Neural */}
      <aside className="w-[280px] border-r border-white/5 flex flex-col p-6 bg-black/40 backdrop-blur-3xl z-50">
        <Logo size="sm" className="mb-10 px-2" />
        <nav className="flex-1 space-y-2">
          <button onClick={() => setActiveTab('overview')} className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all ${activeTab === 'overview' ? 'bg-orange-600/10 text-orange-500 border border-orange-500/10' : 'text-gray-500 hover:text-white'}`}>
             <LayoutDashboard size={18} /> <span className="text-[10px] font-black uppercase tracking-widest">Painel</span>
          </button>
          <button onClick={() => setActiveTab('atendimento')} className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all ${activeTab === 'atendimento' ? 'bg-orange-600/10 text-orange-500 border border-orange-500/10' : 'text-gray-500 hover:text-white'}`}>
             <MessageSquare size={18} /> <span className="text-[10px] font-black uppercase tracking-widest">Atendimento</span>
          </button>
          <button onClick={() => setActiveTab('integracoes')} className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all ${activeTab === 'integracoes' ? 'bg-orange-600/10 text-orange-500 border border-orange-500/10' : 'text-gray-500 hover:text-white'}`}>
             <Layers size={18} /> <span className="text-[10px] font-black uppercase tracking-widest">Engines</span>
          </button>
        </nav>
        <div className="mt-auto border-t border-white/5 pt-6">
          <button onClick={onLogout} className="w-full flex items-center gap-3 px-6 py-4 text-gray-600 hover:text-red-500 transition-colors uppercase text-[9px] font-black tracking-widest">
              <LogOut size={18} /> Sair
          </button>
        </div>
      </aside>

      {/* Conteúdo Principal */}
      <main className="flex-1 flex flex-col relative overflow-hidden bg-[#070707]">
        
        {/* Modal QR Code */}
        <AnimatePresence>
          {qrCodeModal.isOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/98 backdrop-blur-3xl">
              <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-[#0a0a0a] border border-white/10 p-10 rounded-[3rem] max-w-4xl w-full relative">
                <button onClick={() => { setQrCodeModal(p => ({ ...p, isOpen: false })); if(pollTimerRef.current) clearTimeout(pollTimerRef.current); }} className="absolute top-8 right-8 text-gray-600 hover:text-white transition-colors"><X size={32} /></button>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                  <div className="space-y-8 text-center md:text-left">
                    <h3 className="text-4xl font-black uppercase italic tracking-tighter">Sincro <span className="text-orange-500">Neural.</span></h3>
                    <div className="bg-white p-8 rounded-[3rem] aspect-square flex items-center justify-center border-8 border-orange-500/10">
                       {qrCodeModal.code === 'CONNECTED' ? (
                          <div className="text-center text-green-600 animate-pulse">
                             <CheckCircle2 size={140} />
                             <p className="text-2xl font-black uppercase mt-6 tracking-tighter">Ativado!</p>
                          </div>
                       ) : qrCodeModal.code ? (
                          <img src={qrCodeModal.code} className="w-full h-full object-contain" alt="QR Code" />
                       ) : (
                          <div className="flex flex-col items-center gap-6 text-black">
                             <Loader2 className="animate-spin text-orange-500" size={64} />
                             <span className="text-[10px] font-black uppercase tracking-[0.3em] italic animate-pulse">{qrCodeModal.status}</span>
                          </div>
                       )}
                    </div>
                  </div>
                  <div className="bg-black/60 border border-white/5 p-8 rounded-[2.5rem] flex flex-col">
                    <div className="text-[10px] font-black uppercase text-orange-500 flex items-center gap-2 mb-6"><Terminal size={14} /> Bridge Log</div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar font-mono text-[9px] text-gray-500">
                       {qrCodeModal.debugLog.map((log, i) => <div key={i}>{`>> ${log}`}</div>)}
                    </div>
                    <NeonButton onClick={() => connectInstance(qrCodeModal.name)} className="w-full mt-6 !py-5 !rounded-2xl">Recalibrar Engine</NeonButton>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {activeTab === 'atendimento' && (
          <div className="flex h-full min-h-0 relative">
            {/* Inbox Sidebar */}
            <div className="w-[400px] border-r border-white/5 flex flex-col bg-black/20 backdrop-blur-md h-full">
              <div className="p-8 space-y-6 shrink-0">
                <div className="flex items-center justify-between">
                   <h2 className="text-4xl font-black uppercase italic tracking-tighter leading-none">Inbox <span className="text-orange-500">Neural.</span></h2>
                   <button 
                     onClick={() => syncChats()} 
                     disabled={isSyncingChats}
                     className={`p-3 rounded-xl glass hover:text-orange-500 transition-all ${isSyncingChats ? 'animate-spin text-orange-500 scale-110' : 'text-gray-600'}`}
                   >
                     <RefreshCw size={18} />
                   </button>
                </div>
                <div className="relative">
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-700" size={16} />
                  <input 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="BUSCAR LEAD..." 
                    className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-5 pl-14 pr-6 text-[10px] font-bold uppercase outline-none focus:border-orange-500/40 transition-all placeholder:text-gray-800"
                  />
                </div>
              </div>

              {/* Lista de Leads com Scroll Garantido */}
              <div className="flex-1 overflow-y-auto custom-scrollbar px-4 space-y-2 pb-8 min-h-0">
                {filteredTickets.length > 0 ? (
                  filteredTickets.map(ticket => (
                    <button 
                      key={ticket.id}
                      onClick={() => setSelectedTicketId(ticket.id)}
                      className={`w-full p-6 rounded-[2rem] flex items-center gap-5 transition-all border ${selectedTicketId === ticket.id ? 'bg-orange-500/10 border-orange-500/20 shadow-[0_0_40px_rgba(255,115,0,0.05)]' : 'hover:bg-white/[0.02] border-transparent'}`}
                    >
                      <div className="relative shrink-0">
                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-gray-900 to-black border border-white/5 flex items-center justify-center overflow-hidden">
                          <Users size={24} className="text-gray-700" />
                        </div>
                        <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 border-black flex items-center justify-center ${
                          ticket.sentiment === 'happy' ? 'bg-green-500' : 'bg-gray-500'
                        }`}>
                           <Circle size={4} className="fill-white" />
                        </div>
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[12px] font-black uppercase tracking-tighter truncate">{ticket.contactName}</span>
                          <span className="text-[9px] font-bold text-gray-700 uppercase">{ticket.time}</span>
                        </div>
                        <p className="text-[10px] text-gray-600 font-bold uppercase tracking-tight truncate">{ticket.lastMessage}</p>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 opacity-30 text-center">
                     <Unplug size={40} className="mb-4 text-orange-500" />
                     <p className="text-[10px] font-black uppercase tracking-[0.2em] italic max-w-[200px] leading-relaxed">Nenhum lead detectado no cluster. Verifique a conexão das Engines.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Terminal de Chat */}
            <div className="flex-1 flex flex-col relative bg-[#080808]">
              {selectedTicket ? (
                <>
                  <header className="p-8 border-b border-white/5 flex items-center justify-between bg-black/40 backdrop-blur-md shrink-0">
                    <div className="flex items-center gap-6">
                      <div className="w-12 h-12 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                        <User size={20} className="text-orange-500" />
                      </div>
                      <div>
                        <h3 className="text-xl font-black uppercase italic tracking-tighter leading-none mb-1">{selectedTicket.contactName}</h3>
                        <div className="flex items-center gap-3">
                           <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">{selectedTicket.contactPhone}</span>
                           <div className="w-1 h-1 rounded-full bg-gray-800" />
                           <span className="text-[9px] font-black uppercase tracking-widest text-orange-500 italic">Protocolo: {selectedTicket.protocol}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <GlassButton className="!px-5 !py-3 !rounded-xl !text-[8px] text-green-500 border-green-500/10">Finalizar</GlassButton>
                      <button className="p-4 glass rounded-xl text-gray-600 hover:text-white transition-colors"><MoreVertical size={18} /></button>
                    </div>
                  </header>

                  <div className="flex-1 overflow-y-auto custom-scrollbar p-10 space-y-6">
                    {selectedTicket.messages.map((msg, i) => (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                        key={msg.id} 
                        className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[70%] p-6 rounded-[2rem] shadow-2xl ${msg.sender === 'me' ? 'bg-orange-600 text-white rounded-tr-none' : 'bg-[#151515] border border-white/5 text-gray-300 rounded-tl-none'}`}>
                            <p className="text-[13px] font-bold leading-relaxed">{msg.text}</p>
                            <div className="flex items-center gap-2 mt-3 opacity-30 text-[8px] font-black uppercase">
                              {msg.time} {msg.sender === 'me' && <CheckCheck size={12} />}
                            </div>
                        </div>
                      </motion.div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>

                  <footer className="p-8 bg-black/60 backdrop-blur-3xl border-t border-white/5 shrink-0">
                    <div className="max-w-4xl mx-auto flex items-end gap-4">
                      <div className="flex-1 glass border-white/10 rounded-[2.5rem] p-3 flex items-end gap-3">
                        <button className="p-4 text-gray-600 hover:text-orange-500 transition-colors"><Paperclip size={20} /></button>
                        <textarea 
                          value={messageInput}
                          onChange={e => setMessageInput(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())}
                          placeholder="DIGITE SUA RESPOSTA..." 
                          className="flex-1 bg-transparent border-none outline-none py-4 px-2 text-sm font-bold uppercase tracking-tight resize-none max-h-32 min-h-[50px] custom-scrollbar"
                        />
                        <button className="p-4 text-gray-600 hover:text-orange-500 transition-colors"><Smile size={20} /></button>
                      </div>
                      <NeonButton onClick={handleSendMessage} disabled={!messageInput.trim()} className="!w-16 !h-16 !rounded-full !p-0">
                        <Send size={24} className="ml-1" />
                      </NeonButton>
                    </div>
                  </footer>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-20 space-y-8">
                  <Activity className="text-orange-500 animate-pulse" size={64} />
                  <div className="space-y-4">
                    <h3 className="text-4xl font-black uppercase italic tracking-tighter">Terminal <span className="text-orange-500">Ocioso.</span></h3>
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-700 max-w-xs leading-loose italic">Aguardando seleção de lead para processamento tático.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'overview' && (
          <div className="flex-1 p-12 lg:p-20 overflow-y-auto custom-scrollbar">
            <header className="mb-16">
              <h2 className="text-6xl md:text-8xl font-black uppercase italic tracking-tighter leading-none">Status <span className="text-orange-500">Neural.</span></h2>
            </header>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <GlassCard className="!p-10 border-orange-500/10">
                <Smartphone className="text-orange-500 mb-6" size={36} />
                <div className="text-6xl font-black italic tracking-tighter">{instances.length}</div>
                <div className="text-[11px] font-black uppercase text-gray-500 tracking-[0.3em] mt-3">Engines Provisionadas</div>
              </GlassCard>
              <GlassCard className="!p-10 border-blue-500/10">
                 <div className={`text-[11px] font-black uppercase flex items-center gap-3 mb-8 ${apiStatus === 'online' ? 'text-green-500' : 'text-red-500'}`}>
                    <div className={`w-3 h-3 rounded-full ${apiStatus === 'online' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                    Cluster {apiStatus === 'online' ? 'Conectado' : 'Offline'}
                 </div>
                 <Globe className="text-blue-500 mb-4" size={32} />
                 <div className="text-[12px] font-black uppercase tracking-widest italic text-gray-400">evo2.wayiaflow.com.br</div>
              </GlassCard>
              <GlassCard className="!p-10 flex flex-col justify-center items-center border-orange-500/20">
                <Activity className="text-orange-500 animate-pulse mb-6" size={48} />
                <div className="text-[10px] font-black uppercase tracking-[0.5em] text-orange-500">Neural Core v4.1</div>
              </GlassCard>
            </div>
          </div>
        )}

        {activeTab === 'integracoes' && (
          <div className="flex-1 p-12 lg:p-20 overflow-y-auto custom-scrollbar">
             <header className="mb-16">
                <h2 className="text-6xl md:text-7xl font-black uppercase italic tracking-tighter leading-none">Gestão <span className="text-orange-500">de Engines.</span></h2>
             </header>
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                <GlassCard className="!p-12 border-white/10 bg-white/[0.01]">
                   <div className="flex items-center gap-5 mb-12">
                      <div className="p-5 bg-orange-500/10 rounded-3xl text-orange-500"><Plus size={28} /></div>
                      <div>
                         <h3 className="text-3xl font-black uppercase italic tracking-tight mb-1">Nova Engine</h3>
                         <p className="text-[11px] text-gray-600 font-bold uppercase tracking-widest">Injeção via Baileys Framework</p>
                      </div>
                   </div>
                   <div className="flex gap-4 mb-12">
                      <input 
                        value={newInstanceName} 
                        onChange={e => setNewInstanceName(e.target.value)} 
                        placeholder="NOME DA ENGINE" 
                        className="flex-1 bg-black/40 border border-white/5 rounded-2xl py-6 px-8 text-[14px] font-black uppercase outline-none focus:border-orange-500 transition-all font-mono placeholder:text-gray-800" 
                      />
                      <NeonButton onClick={handleProvisionInstance} disabled={!newInstanceName || isCreatingInstance} className="!px-12 !rounded-2xl">
                        {isCreatingInstance ? <Loader2 className="animate-spin" size={20} /> : "Ativar"}
                      </NeonButton>
                   </div>
                   <div className="space-y-4">
                      {instances.map(inst => (
                          <div key={inst?.id} className="group flex items-center justify-between p-8 bg-white/[0.02] border border-white/5 rounded-[3rem] hover:border-orange-500/40 transition-all">
                             <div className="flex items-center gap-6">
                                <div className={`w-4 h-4 rounded-full ${inst?.status === 'CONNECTED' ? 'bg-green-500 shadow-[0_0_20px_rgba(34,197,94,0.6)] animate-pulse' : 'bg-red-500'}`} />
                                <div>
                                   <div className="text-xl font-black uppercase italic leading-none mb-1">{inst?.name}</div>
                                   <div className="text-[11px] text-gray-700 font-bold font-mono italic">{inst?.status === 'CONNECTED' ? inst?.phone : 'Sync Pendente'}</div>
                                </div>
                             </div>
                             <div className="flex gap-8 opacity-0 group-hover:opacity-100 transition-all">
                                <button onClick={() => connectInstance(inst?.name)} className="text-[11px] font-black uppercase text-orange-500 hover:scale-110 transition-transform italic underline underline-offset-8 decoration-orange-500/20">Sincronizar</button>
                                <button onClick={() => deleteInstance(inst?.name)} className="text-[11px] font-black uppercase text-red-500/20 hover:text-red-500 transition-colors">Excluir</button>
                             </div>
                          </div>
                        ))}
                   </div>
                </GlassCard>
                <GlassCard className="!p-12 border-blue-500/10 bg-blue-500/[0.01] flex flex-col items-center justify-center text-center">
                   <Database size={56} className="text-blue-500 mb-8" />
                   <h3 className="text-4xl font-black uppercase italic tracking-tighter mb-3">Infra Ativa</h3>
                   <div className="text-green-500 text-[11px] font-black uppercase italic animate-pulse tracking-[0.4em] bg-green-500/5 px-8 py-4 rounded-full border border-green-500/10">Evolution Core v2.3.7</div>
                </GlassCard>
             </div>
          </div>
        )}
      </main>
    </div>
  );
}
