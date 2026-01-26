
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, MessageSquare, CreditCard, 
  LogOut, Smartphone, User as UserIcon, Activity, 
  Crown, Info, ShieldCheck, Zap, Send, Search, Filter,
  Plus, QrCode, Brain, MoreVertical, Clock, Loader2, 
  RefreshCw, Trash2, CheckCircle2, Paperclip, Smile,
  Mic, UserCircle, Bot, Phone, MessageCircle, ChevronDown,
  ChevronUp, History, ClipboardList, Star, AlertCircle,
  X, ExternalLink, Power, Trash, MoreHorizontal, UserCheck,
  CheckCircle, ListFilter, UserPlus, Hash, FileText, SendHorizontal,
  Terminal as TerminalIcon, ShieldAlert, Settings2, Database, Link,
  Signal, SignalHigh
} from 'lucide-react';
import { UserSession, DashboardTab, EvolutionInstance, Ticket, Message } from '../types';
import { GlassCard } from '../components/GlassCard';
import { NeonButton, GlassButton } from '../components/Buttons';
import { Logo } from '../components/Logo';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const ADMIN_MASTER = 'dregerr.anderson@gmail.com';

export function Dashboard({ user, onLogout, onCheckout }: { user: UserSession; onLogout: () => void; onCheckout: () => void }) {
  const [activeTab, setActiveTab] = useState<DashboardTab>('atendimento');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [activeFilter, setActiveFilter] = useState<'aberto' | 'pendente' | 'resolvido'>('aberto');
  const [instances, setInstances] = useState<EvolutionInstance[]>([]);
  const [selectedInstanceName, setSelectedInstanceName] = useState<string>('');
  const [messageInput, setMessageInput] = useState('');
  const [isLoadingChats, setIsLoadingChats] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isCreatingInstance, setIsCreatingInstance] = useState(false);
  const [qrCodeModal, setQrCodeModal] = useState<{ isOpen: boolean; code: string; name: string }>({ isOpen: false, code: '', name: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [instanceLeadsCount, setInstanceLeadsCount] = useState<Record<string, number>>({});
  
  const [systemLogs, setSystemLogs] = useState<{msg: string, type: 'info' | 'error' | 'success', time: string}[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [evolutionUrl] = useState('https://evo2.wayiaflow.com.br'); 
  const [evolutionApiKey] = useState('d86920ba398e31464c46401214779885');

  const addLog = (msg: string, type: 'info' | 'error' | 'success' = 'info') => {
    const newLog = { msg, type, time: new Date().toLocaleTimeString() };
    setSystemLogs(prev => [newLog, ...prev].slice(0, 50));
  };

  const userPrefix = useMemo(() => user.email.split('@')[0].toUpperCase().replace(/[^A-Z0-9]/g, ''), [user.email]);
  const isAdminMaster = user.email.toLowerCase() === ADMIN_MASTER.toLowerCase();

  const getHeaders = () => ({ 'apikey': evolutionApiKey, 'Content-Type': 'application/json' });
  const getBaseUrl = () => evolutionUrl.endsWith('/') ? evolutionUrl.slice(0, -1) : evolutionUrl;

  // --- GESTÃO DE INSTÂNCIAS (EVOLUTION) ---
  const fetchInstances = async () => {
    try {
      addLog("Consultando instâncias no Cluster Neural...", "info");
      const res = await fetch(`${getBaseUrl()}/instance/fetchInstances`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.instances || []);
        const mapped = list.map((inst: any) => ({
          id: inst.instanceId || inst.name,
          name: inst.instanceName || inst.name,
          status: (inst.status === 'open' || inst.connectionStatus === 'open' || inst.state === 'open' || inst.connectionStatus === 'CONNECTED') ? 'CONNECTED' : 'DISCONNECTED',
          phone: inst.ownerJid?.split('@')[0] || 'Aguardando Link',
          instanceKey: inst.token || inst.instanceKey
        })).filter((inst: any) => isAdminMaster || inst.name.startsWith(`${userPrefix}_`));
        
        setInstances(mapped);
        addLog(`${mapped.length} chips sincronizados.`, "success");

        // Buscar contagem de leads para cada instância
        mapped.forEach((inst: any) => {
          if (inst.status === 'CONNECTED') {
            updateLeadCount(inst.name);
          }
        });
        
        if (activeTab === 'atendimento' && (!selectedInstanceName || !mapped.find(i => i.name === selectedInstanceName))) {
          const firstConnected = mapped.find(i => i.status === 'CONNECTED');
          if (firstConnected) setSelectedInstanceName(firstConnected.name);
        }
      }
    } catch (err: any) { 
      addLog(`Falha Crítica Evolution: ${err.message}`, "error");
    }
  };

  const updateLeadCount = async (name: string) => {
    try {
      const res = await fetch(`${getBaseUrl()}/chat/fetchChats/${name}`, { headers: getHeaders() });
      if (res.ok) {
        const json = await res.json();
        const chats = Array.isArray(json) ? json : (json.chats || []);
        setInstanceLeadsCount(prev => ({ ...prev, [name]: chats.length }));
      }
    } catch (e) {}
  };

  const createInstance = async () => {
    const name = `${userPrefix}_CH_${instances.length + 1}`;
    setIsCreatingInstance(true);
    addLog(`Configurando nova engine: ${name}`, "info");
    try {
      const res = await fetch(`${getBaseUrl()}/instance/create`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          instanceName: name,
          token: Math.random().toString(36).substring(7),
          qrcode: true
        })
      });
      if (res.ok) {
        addLog(`Instância ${name} implantada com sucesso.`, "success");
        await fetchInstances();
      }
    } catch (err: any) { 
      addLog(`Erro na criação: ${err.message}`, "error");
    } finally { setIsCreatingInstance(false); }
  };

  const deleteInstance = async (name: string) => {
    if (!confirm(`Deseja desintegrar permanentemente a instância ${name}?`)) return;
    addLog(`Removendo canal: ${name}`, "info");
    try {
      const res = await fetch(`${getBaseUrl()}/instance/delete/${name}`, { method: 'DELETE', headers: getHeaders() });
      if (res.ok) {
        addLog(`Canal ${name} removido do cluster.`, "success");
        fetchInstances();
      }
    } catch (err: any) { addLog(`Erro ao deletar: ${err.message}`, "error"); }
  };

  const connectInstance = async (name: string) => {
    addLog(`Gerando link neural para: ${name}`, "info");
    try {
      const res = await fetch(`${getBaseUrl()}/instance/connect/${name}`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (data.base64) {
          setQrCodeModal({ isOpen: true, code: data.base64, name });
        } else {
          addLog("Canal já sincronizado ou indisponível.", "error");
          fetchInstances();
        }
      }
    } catch (err: any) { addLog(`Erro de conexão: ${err.message}`, "error"); }
  };

  const fetchChatsFromInstance = async (instanceName: string) => {
    if (!instanceName) return;
    setIsLoadingChats(true);
    try {
      const res = await fetch(`${getBaseUrl()}/chat/fetchChats/${instanceName}`, { headers: getHeaders() });
      if (res.ok) {
        const json = await res.json();
        const chatsRaw = Array.isArray(json) ? json : (json.chats || []);
        
        const mappedTickets: Ticket[] = chatsRaw
          .filter((item: any) => item.id?.includes('@s.whatsapp.net'))
          .map((item: any) => ({
            id: item.id,
            contactName: item.pushName || item.name || item.id.split('@')[0],
            contactPhone: item.id.split('@')[0],
            lastMessage: item.lastMessage?.message?.conversation || 'Nova conversa',
            sentiment: 'neutral',
            time: 'Hoje',
            status: 'aberto',
            unreadCount: item.unreadCount || 0,
            assignedTo: instanceName,
            protocol: String(Math.floor(Math.random() * 90000) + 10000),
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(item.pushName || 'U')}&background=ff7300&color=fff&bold=true`,
            messages: []
          }));

        setTickets(mappedTickets);
        setInstanceLeadsCount(prev => ({ ...prev, [instanceName]: mappedTickets.length }));
      }
    } catch (err: any) { addLog(`Erro Sync Leads: ${err.message}`, "error"); } finally { setIsLoadingChats(false); }
  };

  const fetchMessagesForTicket = async (ticket: Ticket) => {
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
        const mappedMessages: Message[] = messagesRaw.reverse().map((m: any) => ({
          id: m.key?.id || Math.random().toString(),
          text: m.message?.conversation || m.message?.extendedTextMessage?.text || "Mídia",
          sender: m.key?.fromMe ? 'me' : 'contact',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: 'read',
          type: 'text'
        }));
        const updatedTicket = { ...ticket, messages: mappedMessages };
        setSelectedTicket(updatedTicket);
        setTickets(prev => prev.map(t => t.id === ticket.id ? updatedTicket : t));
      }
    } catch (err: any) { console.error(err); } finally { setIsLoadingMessages(false); }
  };

  useEffect(() => {
    fetchInstances();
    const timer = setInterval(fetchInstances, 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (selectedInstanceName && activeTab === 'atendimento') {
      fetchChatsFromInstance(selectedInstanceName);
    }
  }, [selectedInstanceName, activeTab]);

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedTicket || !selectedInstanceName) return;
    const currentMsg = messageInput;
    setMessageInput('');
    try {
      const res = await fetch(`${getBaseUrl()}/message/sendText/${selectedInstanceName}`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ number: selectedTicket.id, text: currentMsg, delay: 500 })
      });
      if (res.ok) {
        const newMessage: Message = {
          id: Date.now().toString(),
          text: currentMsg,
          sender: 'me',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: 'sent',
          type: 'text'
        };
        const updated = { ...selectedTicket, messages: [...selectedTicket.messages, newMessage] };
        setSelectedTicket(updated);
        setTickets(prev => prev.map(t => t.id === updated.id ? updated : t));
      }
    } catch (e) {}
  };

  const filteredTickets = useMemo(() => {
    return tickets
      .filter(t => t.status === activeFilter)
      .filter(t => t.contactName.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [tickets, activeFilter, searchTerm]);

  const SidebarBtn = ({ id, icon: Icon, label, isAdmin = false }: { id: DashboardTab, icon: any, label: string, isAdmin?: boolean }) => {
    if (isAdmin && !user.isAdmin) return null;
    return (
      <button 
        onClick={() => setActiveTab(id)}
        className={`w-full flex items-center gap-3 px-5 py-3 rounded-xl transition-all relative group ${
          activeTab === id 
            ? 'bg-orange-600/10 text-orange-500 border border-orange-500/10 shadow-sm' 
            : 'text-gray-500 hover:text-white hover:bg-white/[0.02]'
        }`}
      >
        <Icon size={16} className={activeTab === id ? 'text-orange-500' : 'opacity-40'} />
        <span className="text-[9px] font-bold uppercase tracking-widest">{label}</span>
      </button>
    );
  };

  return (
    <div className="flex h-screen bg-[#050505] overflow-hidden text-white font-sans">
      <div className="fixed inset-0 grid-engine pointer-events-none opacity-5"></div>

      {/* SIDEBAR */}
      <aside className="w-[260px] border-r border-white/5 flex flex-col p-6 bg-black/40 backdrop-blur-2xl z-50">
        <Logo size="sm" className="mb-8 px-2" />
        
        <div className="mb-6 px-2 flex items-center justify-between">
           <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${isSupabaseConfigured ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
              <span className="text-[7px] font-black uppercase text-gray-500 tracking-widest">Neural Link</span>
           </div>
           <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${instances.some(i => i.status === 'CONNECTED') ? 'bg-green-500 animate-pulse' : 'bg-orange-500'}`} />
              <span className="text-[7px] font-black uppercase text-gray-500 tracking-widest">Evolution</span>
           </div>
        </div>

        <nav className="flex-1 space-y-1">
          <SidebarBtn id="overview" icon={LayoutDashboard} label="Overview" />
          <SidebarBtn id="atendimento" icon={MessageSquare} label="Atendimento CRM" />
          <SidebarBtn id="evolution" icon={Smartphone} label="Canais Evolution" />
          <SidebarBtn id="admin" icon={Crown} label="Painel Master" isAdmin={true} />
          <div className="h-px bg-white/5 my-6 mx-2" />
          <SidebarBtn id="financeiro" icon={CreditCard} label="Financeiro" />
          <button onClick={() => setActiveTab('n8n' as any)} className="w-full flex items-center gap-3 px-5 py-3 rounded-xl text-gray-500 hover:text-white transition-all">
            <TerminalIcon size={16} className="opacity-40" />
            <span className="text-[9px] font-bold uppercase tracking-widest">Logs de Sistema</span>
          </button>
        </nav>
        
        <button onClick={onLogout} className="mt-6 flex items-center gap-3 px-5 py-4 text-gray-700 hover:text-red-500 transition-colors uppercase text-[9px] font-bold tracking-widest border-t border-white/5">
            <LogOut size={16} /> Logout Engine
        </button>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col relative overflow-hidden bg-[#070707]">
        
        {/* QR CODE MODAL */}
        <AnimatePresence>
          {qrCodeModal.isOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl">
              <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-[#0a0a0a] border border-white/10 p-8 rounded-3xl max-w-sm w-full text-center space-y-6">
                <div className="flex justify-center mb-2">
                   <div className="p-4 bg-orange-500/10 rounded-full">
                      <QrCode className="text-orange-500" size={32} />
                   </div>
                </div>
                <h3 className="text-xl font-black uppercase italic tracking-tighter text-orange-500">Pareamento de Chip</h3>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Escaneie o QR Code abaixo com o seu WhatsApp para ativar a instância {qrCodeModal.name.replace(`${userPrefix}_`, '')}.</p>
                <div className="bg-white p-4 rounded-2xl mx-auto inline-block border-4 border-orange-500/20 shadow-2xl overflow-hidden">
                   <img src={qrCodeModal.code} className="w-48 h-48 object-contain" alt="QR Code" />
                </div>
                <NeonButton onClick={() => { setQrCodeModal({ ...qrCodeModal, isOpen: false }); fetchInstances(); }} className="w-full">Já Escaneei / Sincronizar</NeonButton>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {activeTab === 'atendimento' ? (
          <div className="flex h-full w-full overflow-hidden">
            {/* COLUNA 1: LEADS */}
            <div className="w-[360px] border-r border-white/5 flex flex-col bg-black/30 backdrop-blur-xl">
              <div className="p-4 space-y-4 border-b border-white/5">
                <div className="flex items-center justify-between">
                   <div className="flex items-center gap-2">
                      <div className="bg-orange-500 p-1.5 rounded-lg"><Hash size={14} className="text-black"/></div>
                      <span className="text-[10px] font-black uppercase tracking-widest italic">Leads Sincronizados</span>
                   </div>
                   <button onClick={() => fetchChatsFromInstance(selectedInstanceName)} className="p-2 glass rounded-lg hover:text-orange-500 transition-all">
                      <RefreshCw size={14} className={isLoadingChats ? 'animate-spin' : ''} />
                   </button>
                </div>

                <select 
                  value={selectedInstanceName}
                  onChange={(e) => setSelectedInstanceName(e.target.value)}
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-2.5 px-4 text-[10px] font-black uppercase outline-none focus:border-orange-500/40"
                >
                  <option value="">Escolher Chip Conectado...</option>
                  {instances.map(inst => (
                    <option key={inst.id} value={inst.name} disabled={inst.status !== 'CONNECTED'}>
                      {inst.status === 'CONNECTED' ? '🟢 ' : '🔴 '} {inst.name.replace(`${userPrefix}_`, '')}
                    </option>
                  ))}
                </select>

                <div className="relative">
                   <Search size={14} className="absolute left-3 top-2.5 text-gray-600" />
                   <input 
                     value={searchTerm}
                     onChange={e => setSearchTerm(e.target.value)}
                     placeholder="Buscar lead no cluster..." 
                     className="w-full bg-white/[0.03] border border-white/5 rounded-xl py-2.5 px-10 text-[10px] uppercase font-bold outline-none focus:border-orange-500/40" 
                   />
                </div>

                <div className="flex gap-1">
                   {(['aberto', 'pendente', 'resolvido'] as const).map(f => (
                     <button 
                       key={f}
                       onClick={() => setActiveFilter(f)}
                       className={`flex-1 py-3 text-[9px] font-black uppercase rounded-xl transition-all ${activeFilter === f ? 'bg-orange-600/10 text-orange-500 border border-orange-500/20' : 'text-gray-500 hover:text-gray-300'}`}
                     >
                       {f}s ({tickets.filter(t => t.status === f).length})
                     </button>
                   ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
                {isLoadingChats ? (
                  <div className="flex flex-col items-center justify-center py-20 opacity-30 gap-4">
                    <Loader2 className="animate-spin text-orange-500" />
                    <span className="text-[8px] font-black uppercase tracking-widest italic">Capturando Sinais...</span>
                  </div>
                ) : filteredTickets.length === 0 ? (
                  <div className="text-center py-20 px-6 opacity-10 border-2 border-dashed border-white/5 rounded-3xl m-2">
                    <AlertCircle size={32} className="mx-auto mb-4" />
                    <p className="text-[10px] font-black uppercase tracking-widest italic">Nenhum sinal detectado.</p>
                  </div>
                ) : filteredTickets.map(ticket => (
                  <div 
                    key={ticket.id} 
                    onClick={() => { setSelectedTicket(ticket); fetchMessagesForTicket(ticket); }}
                    className={`p-4 rounded-2xl cursor-pointer transition-all border ${selectedTicket?.id === ticket.id ? 'bg-orange-600/10 border-orange-500/20 shadow-xl' : 'bg-transparent border-transparent hover:bg-white/[0.02]'}`}
                  >
                    <div className="flex gap-4">
                      <img src={ticket.avatar} className="w-12 h-12 rounded-2xl object-cover border border-white/10" />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <h4 className="text-[11px] font-black uppercase truncate italic">{ticket.contactName}</h4>
                          <span className="text-[8px] text-gray-600 font-bold">{ticket.time}</span>
                        </div>
                        <p className="text-[9px] text-gray-500 font-medium truncate mt-1 leading-none italic">"{ticket.lastMessage}"</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* COLUNA 2: CHAT CENTRAL */}
            <div className="flex-1 flex flex-col relative bg-[#090909]">
              {selectedTicket ? (
                <>
                  <header className="h-20 border-b border-white/5 flex items-center justify-between px-8 bg-black/40 backdrop-blur-md z-10">
                    <div className="flex items-center gap-4">
                       <img src={selectedTicket.avatar} className="w-12 h-12 rounded-2xl border border-white/10" />
                       <div>
                          <h3 className="text-[14px] font-black uppercase italic tracking-tighter">{selectedTicket.contactName}</h3>
                          <div className="flex items-center gap-2 mt-1">
                             <span className="text-[8px] text-gray-500 font-bold uppercase tracking-widest italic">#{selectedTicket.protocol}</span>
                             <span className="w-1 h-1 bg-orange-500 rounded-full" />
                             <span className="text-[8px] text-orange-500 font-black uppercase tracking-widest italic">Agente: {userPrefix}</span>
                          </div>
                       </div>
                    </div>
                    <div className="flex items-center gap-3">
                       <button onClick={() => fetchMessagesForTicket(selectedTicket)} className="p-3 glass rounded-xl hover:text-orange-500 transition-all">
                        {isLoadingMessages ? <Loader2 size={16} className="animate-spin text-orange-500"/> : <RefreshCw size={16}/>}
                       </button>
                       <NeonButton className="!px-5 !py-2.5 !text-[9px] !rounded-xl">Resolver</NeonButton>
                    </div>
                  </header>

                  <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar" style={{ backgroundImage: `url('https://qonrpzlkjhdmswjfxvtu.supabase.co/storage/v1/object/public/WayIAFlow/whatsapp-bg.png')`, backgroundSize: '400px', backgroundRepeat: 'repeat' }}>
                    {selectedTicket.messages.map((msg, i) => (
                      <div key={msg.id || i} className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] p-4 rounded-3xl shadow-2xl relative ${msg.sender === 'me' ? 'bg-orange-600/90 text-white rounded-tr-none' : 'bg-white/5 text-gray-200 border border-white/5 rounded-tl-none backdrop-blur-xl'}`}>
                          <p className="text-[12px] font-medium leading-relaxed tracking-tight">{msg.text}</p>
                          <div className={`text-[8px] mt-2 flex items-center gap-1.5 ${msg.sender === 'me' ? 'text-orange-200 justify-end' : 'text-gray-500'}`}>
                            {msg.time}
                            {msg.sender === 'me' && <CheckCircle2 size={10} className="text-blue-400" />}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>

                  <div className="p-5 border-t border-white/5 bg-black/60 backdrop-blur-2xl">
                    <div className="flex items-center gap-4 bg-white/[0.03] border border-white/10 rounded-2xl p-2 px-5 focus-within:border-orange-500/40 transition-all">
                       <button className="text-gray-600 hover:text-orange-500 p-2"><Paperclip size={20} /></button>
                       <input 
                         value={messageInput}
                         onChange={e => setMessageInput(e.target.value)}
                         onKeyPress={e => e.key === 'Enter' && handleSendMessage()}
                         placeholder="Escreva sua resposta..." 
                         className="flex-1 bg-transparent border-none outline-none text-[12px] font-bold py-3 text-white" 
                       />
                       <button onClick={handleSendMessage} disabled={!messageInput.trim()} className="bg-orange-600 text-black p-3 rounded-xl hover:scale-110 active:scale-95 transition-all shadow-lg disabled:opacity-50">
                         <Send size={20} />
                       </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center opacity-10">
                   <MessageCircle size={100} className="mb-8 text-orange-500" />
                   <h2 className="text-3xl font-black uppercase italic tracking-tighter">Escolha um lead para começar.</h2>
                </div>
              )}
            </div>

            {/* COLUNA 3: INFO DO LEAD */}
            <div className="w-[320px] border-l border-white/5 bg-black/40 p-6 overflow-y-auto custom-scrollbar space-y-8 backdrop-blur-2xl">
              <h2 className="text-[12px] font-black uppercase italic tracking-widest text-gray-500">Dados do Contato</h2>
              <div className="text-center space-y-4">
                <img src={selectedTicket?.avatar || `https://ui-avatars.com/api/?name=?&background=111&color=555`} className="w-32 h-32 rounded-[2.5rem] object-cover border-2 border-orange-500/20 shadow-2xl mx-auto" />
                <div>
                  <h3 className="text-xl font-black uppercase italic leading-tight">{selectedTicket?.contactName || '---'}</h3>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] mt-1">+{selectedTicket?.contactPhone || 'Sincronizando...'}</p>
                </div>
              </div>
              <div className="space-y-4 pt-4 border-t border-white/5">
                 <div className="flex items-center gap-3 text-[9px] font-black text-orange-500 uppercase tracking-widest italic">
                   <History size={14}/> Histórico Logs
                 </div>
                 <GlassCard className="!p-4 space-y-3 !bg-white/[0.01] border-white/5">
                    <div className="flex justify-between items-center text-[9px]">
                       <span className="text-gray-600 uppercase font-black">Status DB</span>
                       <span className={isSupabaseConfigured ? 'text-green-500 font-bold italic' : 'text-red-500 font-bold italic'}>
                          {isSupabaseConfigured ? 'Sincronizado' : 'Modo Demo'}
                       </span>
                    </div>
                    <div className="flex justify-between items-center text-[9px]">
                       <span className="text-gray-600 uppercase font-black">Protocolo</span>
                       <span className="text-white font-black">#{selectedTicket?.protocol || '---'}</span>
                    </div>
                 </GlassCard>
              </div>
            </div>
          </div>
        ) : activeTab === 'evolution' ? (
          <div className="flex-1 p-8 md:p-12 overflow-y-auto custom-scrollbar bg-[#050505]">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-16 gap-8">
               <div className="space-y-2">
                  <div className="flex items-center gap-3 text-orange-500">
                     <SignalHigh size={20} />
                     <span className="text-[10px] font-black uppercase tracking-[0.4em] italic">Gerenciamento de Frota</span>
                  </div>
                  <h2 className="text-5xl md:text-6xl font-black uppercase italic tracking-tighter leading-none">Canais <span className="text-orange-500">Evolution.</span></h2>
                  <p className="text-[11px] text-gray-600 font-bold uppercase tracking-widest italic max-w-lg">
                    Monitore a saúde das suas instâncias, gerencie leads por canal e controle o fluxo de mensagens em escala industrial.
                  </p>
               </div>
               <div className="flex gap-4 w-full md:w-auto">
                  <GlassButton onClick={fetchInstances} className="!px-6 group hover:!text-orange-500 flex items-center gap-2">
                    <RefreshCw size={14} className="group-hover:rotate-180 transition-transform duration-500" /> Sincronizar
                  </GlassButton>
                  <NeonButton onClick={createInstance} disabled={isCreatingInstance} className="!px-8 !py-4 flex-1 md:flex-none">
                    {isCreatingInstance ? <Loader2 size={16} className="animate-spin" /> : <><Plus size={16} className="mr-2"/> Instalar Novo Canal</>}
                  </NeonButton>
               </div>
            </header>

            {/* INSTANCE GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-8">
               {instances.length === 0 ? (
                 <motion.div 
                   initial={{ opacity: 0, scale: 0.95 }}
                   animate={{ opacity: 1, scale: 1 }}
                   className="col-span-full py-32 text-center opacity-20 border-2 border-dashed border-white/5 rounded-[3rem] flex flex-col items-center justify-center space-y-6"
                 >
                    <div className="p-8 bg-white/5 rounded-full">
                       <Smartphone size={64} className="text-gray-500" />
                    </div>
                    <div className="space-y-2">
                       <p className="text-xl font-black uppercase italic">Vazio Neural</p>
                       <p className="text-[10px] font-bold uppercase tracking-widest">Nenhuma instância detectada no seu cluster.</p>
                    </div>
                 </motion.div>
               ) : instances.map((inst, index) => (
                 <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    key={inst.id}
                 >
                    <GlassCard className="!p-0 h-full flex flex-col relative group overflow-hidden border-white/5 hover:border-orange-500/40 transition-all duration-500 bg-white/[0.01]">
                       {/* Card Header Background */}
                       <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-orange-500/20 via-orange-500 to-orange-500/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                       
                       <div className="p-8 flex-1 space-y-8">
                          <div className="flex justify-between items-start">
                             <div className={`p-5 rounded-[1.5rem] relative transition-all duration-500 ${inst.status === 'CONNECTED' ? 'bg-green-500/10 text-green-500 shadow-[0_0_30px_rgba(34,197,94,0.1)]' : 'bg-red-500/10 text-red-500'}`}>
                                <Smartphone size={28} />
                                {inst.status === 'CONNECTED' && (
                                  <motion.div 
                                    animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                    className="absolute inset-0 border-2 border-green-500/30 rounded-[1.5rem]"
                                  />
                                )}
                             </div>
                             <div className="flex gap-2">
                                <button onClick={() => deleteInstance(inst.name)} className="p-3 text-gray-700 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"><Trash size={18}/></button>
                             </div>
                          </div>

                          <div className="space-y-1">
                             <h3 className="text-2xl font-black uppercase italic tracking-tighter truncate leading-none">{inst.name.replace(`${userPrefix}_`, '')}</h3>
                             <div className="flex items-center gap-2 text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                                <Phone size={12} className="text-orange-500/50" />
                                {inst.phone}
                             </div>
                          </div>

                          {/* Stats Grid */}
                          <div className="grid grid-cols-2 gap-4">
                             <div className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl space-y-1">
                                <div className="text-[8px] font-black text-gray-600 uppercase tracking-widest flex items-center gap-1.5">
                                   <Database size={10} /> Leads Sync
                                </div>
                                <div className="text-xl font-black italic text-white">{instanceLeadsCount[inst.name] || 0}</div>
                             </div>
                             <div className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl space-y-1">
                                <div className="text-[8px] font-black text-gray-600 uppercase tracking-widest flex items-center gap-1.5">
                                   <Activity size={10} /> Latência
                                </div>
                                <div className="text-xl font-black italic text-orange-500">24<span className="text-[10px]">ms</span></div>
                             </div>
                          </div>
                       </div>

                       {/* Action Footer */}
                       <div className="p-6 border-t border-white/5 bg-white/[0.01] flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                             <div className={`w-2.5 h-2.5 rounded-full ${inst.status === 'CONNECTED' ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]'}`} />
                             <span className={`text-[9px] font-black uppercase tracking-widest ${inst.status === 'CONNECTED' ? 'text-green-500' : 'text-red-500'}`}>
                                {inst.status}
                             </span>
                          </div>
                          
                          {inst.status !== 'CONNECTED' ? (
                             <NeonButton onClick={() => connectInstance(inst.name)} className="!px-6 !py-2.5 !text-[9px] shadow-none">Parear Chip</NeonButton>
                          ) : (
                             <div className="flex gap-2">
                                <GlassButton onClick={() => connectInstance(inst.name)} className="!px-4 !py-2 !text-[8px] flex items-center gap-2 hover:!border-orange-500/40">
                                  <QrCode size={14} /> Link
                                </GlassButton>
                                <GlassButton className="!px-4 !py-2 !text-[8px] flex items-center gap-2">
                                  <Settings2 size={14} /> Conf
                                </GlassButton>
                             </div>
                          )}
                       </div>
                    </GlassCard>
                 </motion.div>
               ))}
            </div>
          </div>
        ) : activeTab === ('n8n' as any) ? (
          <div className="flex-1 p-10 flex flex-col h-full bg-black">
             <header className="mb-8">
                <h2 className="text-2xl font-black uppercase italic tracking-tighter flex items-center gap-3">
                   <TerminalIcon className="text-orange-500" /> Terminal de <span className="text-orange-500">Logs Neural</span>
                </h2>
                {!isSupabaseConfigured && (
                  <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3">
                     <ShieldAlert className="text-red-500" size={20} />
                     <p className="text-[10px] font-black uppercase tracking-widest text-red-500">
                        Supabase Offline: Verifique as variáveis de ambiente NEXT_PUBLIC_SUPABASE_URL e ANON_KEY.
                     </p>
                  </div>
                )}
             </header>
             <div className="flex-1 bg-black/60 border border-white/5 rounded-2xl p-6 font-mono text-[10px] overflow-y-auto custom-scrollbar">
                {systemLogs.length === 0 ? (
                  <div className="text-gray-700 italic">Nenhuma atividade registrada no buffer neural...</div>
                ) : systemLogs.map((log, i) => (
                  <div key={i} className={`mb-2 flex gap-4 ${log.type === 'error' ? 'text-red-500' : log.type === 'success' ? 'text-green-500' : 'text-blue-400'}`}>
                    <span className="opacity-30">[{log.time}]</span>
                    <span className="font-bold uppercase tracking-widest">[{log.type}]</span>
                    <span>{log.msg}</span>
                  </div>
                ))}
             </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center opacity-10">
             <Brain size={80} className="mb-6 text-orange-500" />
             <h2 className="text-3xl font-black uppercase italic tracking-tighter">Engine {activeTab}</h2>
          </div>
        )}
      </main>
    </div>
  );
}
