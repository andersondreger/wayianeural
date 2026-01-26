
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  CheckCircle, ListFilter, UserPlus, Hash, FileText, SendHorizontal
} from 'lucide-react';
import { UserSession, DashboardTab, EvolutionInstance, Ticket, Message } from '../types';
import { GlassCard } from '../components/GlassCard';
import { NeonButton, GlassButton } from '../components/Buttons';
import { Logo } from '../components/Logo';
import { supabase } from '../lib/supabase';

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
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [evolutionUrl] = useState('https://evo2.wayiaflow.com.br'); 
  const [evolutionApiKey] = useState('d86920ba398e31464c46401214779885');

  const userPrefix = useMemo(() => user.email.split('@')[0].toUpperCase().replace(/[^A-Z0-9]/g, ''), [user.email]);
  const isAdminMaster = user.email.toLowerCase() === ADMIN_MASTER.toLowerCase();

  const getHeaders = () => ({ 'apikey': evolutionApiKey, 'Content-Type': 'application/json' });
  const getBaseUrl = () => evolutionUrl.endsWith('/') ? evolutionUrl.slice(0, -1) : evolutionUrl;

  // --- GESTÃO DE INSTÂNCIAS (EVOLUTION) ---

  const fetchInstances = async () => {
    try {
      const res = await fetch(`${getBaseUrl()}/instance/fetchInstances`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.instances || []);
        const mapped = list.map((inst: any) => ({
          id: inst.instanceId || inst.name,
          name: inst.instanceName || inst.name,
          status: (inst.status === 'open' || inst.connectionStatus === 'open' || inst.state === 'open' || inst.connectionStatus === 'CONNECTED') ? 'CONNECTED' : 'DISCONNECTED',
          phone: inst.ownerJid?.split('@')[0] || 'Desconectado',
          instanceKey: inst.token || inst.instanceKey
        })).filter((inst: any) => isAdminMaster || inst.name.startsWith(`${userPrefix}_`));
        
        setInstances(mapped);
        
        if (activeTab === 'atendimento' && (!selectedInstanceName || !mapped.find(i => i.name === selectedInstanceName))) {
          const firstConnected = mapped.find(i => i.status === 'CONNECTED');
          if (firstConnected) setSelectedInstanceName(firstConnected.name);
        }
      }
    } catch (err) { console.error("Erro fetch instances:", err); }
  };

  const createInstance = async () => {
    const name = `${userPrefix}_CH_${instances.length + 1}`;
    setIsCreatingInstance(true);
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
        await fetchInstances();
        setActiveTab('evolution');
      }
    } catch (err) { console.error("Erro create instance:", err); } finally { setIsCreatingInstance(false); }
  };

  const deleteInstance = async (name: string) => {
    if (!confirm(`Confirmar REMOÇÃO da instância ${name}?`)) return;
    try {
      const res = await fetch(`${getBaseUrl()}/instance/delete/${name}`, { method: 'DELETE', headers: getHeaders() });
      if (res.ok) fetchInstances();
    } catch (err) { console.error("Erro delete instance:", err); }
  };

  const connectInstance = async (name: string) => {
    try {
      const res = await fetch(`${getBaseUrl()}/instance/connect/${name}`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (data.base64) {
          setQrCodeModal({ isOpen: true, code: data.base64, name });
        } else {
          alert("Instância já conectada.");
          fetchInstances();
        }
      }
    } catch (err) { console.error("Erro connect:", err); }
  };

  // --- MOTOR DE SINCRONIZAÇÃO CRM ---

  const extractArray = (data: any): any[] => {
    if (Array.isArray(data)) return data;
    if (!data || typeof data !== 'object') return [];
    const keys = ['chats', 'contacts', 'data', 'conversations', 'instances', 'messages'];
    for (const key of keys) {
      if (Array.isArray(data[key])) return data[key];
      if (data.instance && Array.isArray(data.instance[key])) return data.instance[key];
      if (data.data && Array.isArray(data.data[key])) return data.data[key];
    }
    for (const k in data) if (Array.isArray(data[k])) return data[k];
    return [];
  };

  const fetchChatsFromInstance = async (instanceName: string) => {
    if (!instanceName) return;
    setIsLoadingChats(true);
    
    const tryFetch = async (endpoint: string) => {
      try {
        const res = await fetch(`${getBaseUrl()}${endpoint}/${instanceName}`, { headers: getHeaders() });
        if (res.ok) {
          const json = await res.json();
          return extractArray(json);
        }
      } catch (e) {}
      return [];
    };

    try {
      const [chats, contacts] = await Promise.all([
        tryFetch('/chat/fetchChats'),
        tryFetch('/contact/fetchContacts')
      ]);

      const allRawData = [...chats, ...contacts];

      const mappedTickets: Ticket[] = allRawData
        .filter((item: any) => {
          const jid = item.id || item.remoteJid || item.jid || item.key?.remoteJid;
          return jid && (jid.includes('@s.whatsapp.net') || jid.includes('@g.us'));
        })
        .map((item: any) => {
          const jid = item.id || item.remoteJid || item.jid || item.key?.remoteJid;
          const phone = jid.split('@')[0];
          const name = item.pushName || item.name || item.verifiedName || item.id || phone;
          
          return {
            id: jid,
            contactName: name,
            contactPhone: phone,
            lastMessage: item.lastMessage?.message?.conversation || item.lastMessage?.content || 'Pronto para atendimento',
            sentiment: 'neutral',
            time: item.updatedAt ? new Date(item.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            status: 'aberto',
            unreadCount: item.unreadCount || 0,
            assignedTo: instanceName,
            protocol: String(Math.floor(Math.random() * 90000) + 10000),
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=ff7300&color=fff&bold=true`,
            messages: []
          };
        });

      const uniqueTickets = mappedTickets.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
      setTickets(uniqueTickets);
    } catch (err) { console.error("Sync Error:", err); } finally { setIsLoadingChats(false); }
  };

  const fetchMessagesForTicket = async (ticket: Ticket) => {
    if (!selectedInstanceName || !ticket.id) return;
    setIsLoadingMessages(true);
    try {
      const res = await fetch(`${getBaseUrl()}/chat/fetchMessages/${selectedInstanceName}`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ remoteJid: ticket.id, count: 40 })
      });

      if (res.ok) {
        const json = await res.json();
        const messagesRaw = extractArray(json);
        
        const mappedMessages: Message[] = messagesRaw.reverse().map((m: any) => ({
          id: m.key?.id || Math.random().toString(),
          text: m.message?.conversation || m.message?.extendedTextMessage?.text || m.message?.imageMessage?.caption || "Mídia recebida",
          sender: m.key?.fromMe ? 'me' : 'contact',
          time: m.messageTimestamp ? new Date(m.messageTimestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--',
          status: 'read',
          type: 'text'
        }));

        const updatedTicket = { ...ticket, messages: mappedMessages };
        setSelectedTicket(updatedTicket);
        setTickets(prev => prev.map(t => t.id === ticket.id ? updatedTicket : t));
      }
    } catch (err) { console.error("Messages Error:", err); } finally { setIsLoadingMessages(false); }
  };

  useEffect(() => {
    fetchInstances();
    const timer = setInterval(fetchInstances, 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (selectedInstanceName && activeTab === 'atendimento') {
      fetchChatsFromInstance(selectedInstanceName);
    }
  }, [selectedInstanceName, activeTab]);

  useEffect(() => {
    if (selectedTicket) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedTicket?.messages.length]);

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
    } catch (err) { console.error("Send Error:", err); }
  };

  const filteredTickets = useMemo(() => {
    return tickets
      .filter(t => t.status === activeFilter)
      .filter(t => t.contactName.toLowerCase().includes(searchTerm.toLowerCase()) || t.contactPhone.includes(searchTerm));
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
        <Logo size="sm" className="mb-10 px-2" />
        <div className="text-[8px] font-black text-gray-700 uppercase tracking-[0.3em] mb-4 px-2">Operação Digital</div>
        <nav className="flex-1 space-y-1">
          <SidebarBtn id="overview" icon={LayoutDashboard} label="Overview" />
          <SidebarBtn id="atendimento" icon={MessageSquare} label="Atendimento CRM" />
          <SidebarBtn id="evolution" icon={Smartphone} label="Canais Evolution" />
          <SidebarBtn id="config-neural" icon={Brain} label="WayIA Neural" />
          <div className="h-px bg-white/5 my-6 mx-2" />
          <SidebarBtn id="financeiro" icon={CreditCard} label="Financeiro" />
          <SidebarBtn id="admin" icon={Crown} label="Painel Master" isAdmin={true} />
        </nav>
        <button onClick={onLogout} className="mt-6 flex items-center gap-3 px-5 py-4 text-gray-700 hover:text-red-500 transition-colors uppercase text-[9px] font-bold tracking-widest border-t border-white/5">
            <LogOut size={16} /> Encerrar
        </button>
      </aside>

      {/* MAIN AREA */}
      <main className="flex-1 flex flex-col relative overflow-hidden bg-[#070707]">
        
        {/* QR CODE MODAL */}
        <AnimatePresence>
          {qrCodeModal.isOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl">
              <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-[#0a0a0a] border border-white/10 p-8 rounded-3xl max-w-sm w-full text-center space-y-6">
                <div className="space-y-2">
                  <h3 className="text-xl font-black uppercase italic tracking-tighter text-orange-500">Conectar Canal</h3>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{qrCodeModal.name}</p>
                </div>
                <div className="bg-white p-4 rounded-2xl mx-auto inline-block border-4 border-orange-500/20 shadow-2xl">
                   <img src={qrCodeModal.code} className="w-48 h-48 object-contain" alt="QR Code" />
                </div>
                <p className="text-[9px] text-gray-400 font-medium leading-relaxed uppercase tracking-wider italic">Escaneie o QR Code no seu WhatsApp para sincronizar com a WayFlow.</p>
                <NeonButton onClick={() => setQrCodeModal({ ...qrCodeModal, isOpen: false })} className="w-full">Concluído</NeonButton>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {activeTab === 'atendimento' ? (
          <div className="flex h-full w-full overflow-hidden">
            
            {/* COL 1: LEADS (ZDG STYLE) */}
            <div className="w-[360px] border-r border-white/5 flex flex-col bg-black/30 backdrop-blur-xl">
              <div className="p-4 space-y-4 border-b border-white/5">
                <div className="flex items-center justify-between">
                   <div className="flex items-center gap-2">
                      <div className="bg-orange-500 p-1.5 rounded-lg"><Hash size={14} className="text-black"/></div>
                      <span className="text-[10px] font-black uppercase tracking-widest italic">Hub Atendimento</span>
                   </div>
                   <div className="flex items-center gap-2">
                      <button onClick={() => fetchChatsFromInstance(selectedInstanceName)} className="p-2 glass rounded-lg hover:text-orange-500 transition-all">
                        <RefreshCw size={14} className={isLoadingChats ? 'animate-spin' : ''} />
                      </button>
                      <button onClick={createInstance} className="p-2 glass rounded-lg hover:text-orange-500 transition-all"><Plus size={14}/></button>
                   </div>
                </div>

                <div className="space-y-2">
                   <div className="relative group">
                      <select 
                        value={selectedInstanceName}
                        onChange={(e) => setSelectedInstanceName(e.target.value)}
                        className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-2.5 px-4 text-[10px] font-black uppercase appearance-none outline-none focus:border-orange-500/40 transition-all"
                      >
                        <option value="">Selecione o Canal Ativo...</option>
                        {instances.map(inst => (
                          <option key={inst.id} value={inst.name} disabled={inst.status !== 'CONNECTED'}>
                            {inst.status === 'CONNECTED' ? '🟢 ' : '🔴 '} {inst.name.replace(`${userPrefix}_`, '')}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={12} className="absolute right-3 top-3.5 text-gray-500 pointer-events-none" />
                   </div>

                   <div className="relative">
                     <Search size={14} className="absolute left-3 top-2.5 text-gray-600" />
                     <input 
                       value={searchTerm}
                       onChange={e => setSearchTerm(e.target.value)}
                       placeholder="Buscar por nome ou fone..." 
                       className="w-full bg-white/[0.03] border border-white/5 rounded-xl py-2.5 px-10 text-[10px] uppercase font-bold outline-none focus:border-orange-500/40 transition-all" 
                     />
                     <button className="absolute right-3 top-2.5 text-orange-500"><ListFilter size={14}/></button>
                   </div>
                </div>

                <div className="flex gap-1">
                   {(['aberto', 'pendente', 'resolvido'] as const).map(f => (
                     <button 
                       key={f}
                       onClick={() => setActiveFilter(f)}
                       className={`flex-1 py-3 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all relative ${activeFilter === f ? 'bg-orange-600/10 text-orange-500 border border-orange-500/20' : 'text-gray-500 hover:text-gray-300'}`}
                     >
                       {f}s
                       <span className="ml-1 opacity-40">({tickets.filter(t => t.status === f).length})</span>
                       {activeFilter === f && <motion.div layoutId="filter-active" className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-orange-500 rounded-full" />}
                     </button>
                   ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
                {isLoadingChats ? (
                  <div className="flex flex-col items-center justify-center py-20 opacity-30 gap-4">
                    <Loader2 className="animate-spin text-orange-500" />
                    <span className="text-[8px] font-black uppercase tracking-widest italic">Sincronizando trilhas...</span>
                  </div>
                ) : filteredTickets.length === 0 ? (
                  <div className="text-center py-20 px-6 opacity-10 border-2 border-dashed border-white/5 rounded-3xl m-2">
                    <AlertCircle size={32} className="mx-auto mb-4" />
                    <p className="text-[10px] font-black uppercase tracking-widest italic">Fila Vazia.</p>
                  </div>
                ) : filteredTickets.map(ticket => (
                  <div 
                    key={ticket.id} 
                    onClick={() => { setSelectedTicket(ticket); fetchMessagesForTicket(ticket); }}
                    className={`p-4 rounded-2xl cursor-pointer transition-all border ${selectedTicket?.id === ticket.id ? 'bg-orange-600/10 border-orange-500/20 shadow-xl' : 'bg-transparent border-transparent hover:bg-white/[0.02]'}`}
                  >
                    <div className="flex gap-4">
                      <div className="relative">
                        <img src={ticket.avatar} className="w-12 h-12 rounded-2xl object-cover border border-white/10" />
                        <div className="absolute -bottom-1 -right-1 bg-green-500 border-2 border-[#070707] w-3 h-3 rounded-full" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <h4 className="text-[11px] font-black uppercase truncate italic tracking-tighter">{ticket.contactName}</h4>
                          <span className="text-[8px] text-gray-600 font-bold">{ticket.time}</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 mb-2">
                           <span className="text-[7px] text-orange-500 font-black uppercase tracking-widest">#{ticket.protocol}</span>
                        </div>
                        <p className="text-[9px] text-gray-500 font-medium truncate italic leading-none">"{ticket.lastMessage}"</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* COL 2: CHAT */}
            <div className="flex-1 flex flex-col relative bg-[#090909]">
              {selectedTicket ? (
                <>
                  <header className="h-20 border-b border-white/5 flex items-center justify-between px-8 bg-black/40 backdrop-blur-md z-10">
                    <div className="flex items-center gap-4">
                       <img src={selectedTicket.avatar} className="w-12 h-12 rounded-2xl border border-white/10" />
                       <div>
                          <h3 className="text-[14px] font-black uppercase italic tracking-tighter leading-tight">{selectedTicket.contactName}</h3>
                          <div className="flex items-center gap-2 mt-1">
                             <span className="text-[8px] text-gray-500 font-bold uppercase tracking-widest italic">ID: {selectedTicket.protocol}</span>
                             <span className="w-1 h-1 bg-orange-500 rounded-full" />
                             <span className="text-[8px] text-orange-500 font-black uppercase tracking-widest italic">Atribuído: {userPrefix}</span>
                          </div>
                       </div>
                    </div>
                    <div className="flex items-center gap-3">
                       <button onClick={() => fetchMessagesForTicket(selectedTicket)} className="p-3 glass rounded-xl hover:text-orange-500 transition-all">
                        {isLoadingMessages ? <Loader2 size={16} className="animate-spin text-orange-500"/> : <RefreshCw size={16}/>}
                       </button>
                       <button className="p-3 glass rounded-xl hover:text-orange-500 transition-all"><Bot size={16}/></button>
                       <NeonButton className="!px-5 !py-2.5 !text-[9px] !rounded-xl">Resolver</NeonButton>
                    </div>
                  </header>

                  <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar" style={{ backgroundImage: `url('https://qonrpzlkjhdmswjfxvtu.supabase.co/storage/v1/object/public/WayIAFlow/whatsapp-bg.png')`, backgroundSize: '400px', backgroundRepeat: 'repeat', opacity: 1 }}>
                    {selectedTicket.messages.map((msg, i) => (
                      <div key={msg.id || i} className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] p-4 rounded-3xl shadow-2xl relative ${msg.sender === 'me' ? 'bg-orange-600/90 text-white rounded-tr-none border border-orange-500/20' : 'bg-white/5 text-gray-200 border border-white/5 rounded-tl-none backdrop-blur-xl'}`}>
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
                    <div className="flex items-center gap-4 bg-white/[0.03] border border-white/10 rounded-2xl p-2 px-5 group focus-within:border-orange-500/40 transition-all">
                       <button className="text-gray-600 hover:text-orange-500 transition-all p-2"><Paperclip size={20} /></button>
                       <button className="text-gray-600 hover:text-orange-500 transition-all p-2"><Smile size={20} /></button>
                       <input 
                         value={messageInput}
                         onChange={e => setMessageInput(e.target.value)}
                         onKeyPress={e => e.key === 'Enter' && handleSendMessage()}
                         placeholder="Resposta neural..." 
                         className="flex-1 bg-transparent border-none outline-none text-[12px] font-bold py-3 text-white" 
                       />
                       <button className="text-gray-600 hover:text-orange-500 transition-all p-2"><Mic size={20} /></button>
                       <button onClick={handleSendMessage} disabled={!messageInput.trim()} className="bg-orange-600 text-black p-3 rounded-xl hover:scale-110 active:scale-95 transition-all shadow-lg disabled:opacity-50">
                         <Send size={20} />
                       </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center opacity-10">
                   <MessageCircle size={100} className="mb-8 text-orange-500" />
                   <h2 className="text-3xl font-black uppercase italic">Hub Atendimento</h2>
                   <p className="text-[10px] uppercase font-bold tracking-[0.4em] mt-4">Escolha um lead para começar.</p>
                </div>
              )}
            </div>

            {/* COL 3: INFO */}
            <div className="w-[320px] border-l border-white/5 bg-black/40 p-6 overflow-y-auto custom-scrollbar space-y-8 backdrop-blur-2xl">
              <div className="flex justify-between items-center">
                 <h2 className="text-[12px] font-black uppercase italic tracking-widest text-gray-500">Dados Lead</h2>
                 <button className="text-[8px] font-black uppercase tracking-widest text-orange-500">Ocultar</button>
              </div>

              <div className="text-center space-y-6">
                <div className="relative group inline-block">
                   <img src={selectedTicket?.avatar || `https://ui-avatars.com/api/?name=?&background=111&color=555`} className="w-32 h-32 rounded-[2.5rem] object-cover border-2 border-orange-500/20 shadow-2xl" />
                   <span className="absolute -top-2 -right-2 bg-orange-600 text-black text-[8px] font-black px-3 py-1 rounded-full uppercase italic">Vip Flow</span>
                </div>
                <div>
                  <h3 className="text-xl font-black uppercase italic tracking-tighter leading-tight">{selectedTicket?.contactName || '---'}</h3>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] mt-1">+{selectedTicket?.contactPhone || 'Sincronizando...'}</p>
                </div>
                <div className="flex gap-2">
                   <GlassButton className="flex-1 !py-2 !text-[8px] !rounded-xl">Editar Contato</GlassButton>
                </div>
              </div>

              <div className="space-y-6 pt-4 border-t border-white/5">
                 <div className="flex items-center gap-3 text-[9px] font-black text-orange-500 uppercase tracking-widest italic pb-2">
                   <History size={14}/> Histórico Logs
                 </div>
                 
                 <div className="space-y-4">
                    <GlassCard className="!p-4 space-y-3 !bg-white/[0.01] border-white/5">
                       <div className="flex justify-between items-center text-[9px]">
                          <span className="text-gray-600 uppercase font-black">Protocolo</span>
                          <span className="text-white font-black italic">#{selectedTicket?.protocol || '---'}</span>
                       </div>
                       <div className="flex justify-between items-center text-[9px]">
                          <span className="text-gray-600 uppercase font-black">Abertura</span>
                          <span className="text-white font-black italic">{selectedTicket?.time || '---'}</span>
                       </div>
                       <div className="flex justify-between items-center text-[9px]">
                          <span className="text-gray-600 uppercase font-black">Status IA</span>
                          <span className="text-green-500 font-black uppercase italic">Monitorado</span>
                       </div>
                    </GlassCard>
                 </div>

                 <div className="flex items-center gap-3 text-[9px] font-black text-orange-500 uppercase tracking-widest italic pb-2">
                   <Star size={14}/> Sentimento
                 </div>
                 <GlassCard className="!p-4 !bg-white/[0.01] border-white/5 text-center">
                    <div className="flex justify-center gap-1.5 text-orange-500 mb-2">
                       {[1,2,3,4,5].map(s => <Star key={s} size={16} fill={s <= 4 ? '#ff7300' : 'transparent'} />)}
                    </div>
                    <p className="text-[8px] font-bold text-gray-500 uppercase tracking-widest italic">Interação de Alta Conversão</p>
                 </GlassCard>
              </div>
            </div>
          </div>
        ) : activeTab === 'evolution' ? (
          <div className="flex-1 p-10 overflow-y-auto custom-scrollbar">
            <header className="flex justify-between items-end mb-12">
               <div>
                  <h2 className="text-4xl font-black uppercase italic tracking-tighter leading-none">Canais <span className="text-orange-500">Evolution.</span></h2>
                  <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest italic mt-1">Gestão de frota e instâncias de mensageria neural.</p>
               </div>
               <div className="flex gap-4">
                  <GlassButton onClick={fetchInstances} className="!px-4 hover:!text-orange-500"><RefreshCw size={14} /></GlassButton>
                  <NeonButton onClick={createInstance} disabled={isCreatingInstance} className="!px-6 !py-3">
                    {isCreatingInstance ? <Loader2 size={14} className="animate-spin" /> : <><Plus size={14} className="mr-2"/> Instalar Canal</>}
                  </NeonButton>
               </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {instances.length === 0 ? (
                 <div className="col-span-full py-20 text-center opacity-10 border-2 border-dashed border-white/5 rounded-3xl">
                    <Smartphone size={48} className="mx-auto mb-4" />
                    <p className="text-sm font-black uppercase italic">Nenhum canal ativo no cluster.</p>
                 </div>
               ) : instances.map(inst => (
                 <GlassCard key={inst.id} className="!p-6 space-y-6 relative group">
                    <div className="flex justify-between items-start">
                       <div className={`p-4 rounded-2xl ${inst.status === 'CONNECTED' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                          <Smartphone size={24} />
                       </div>
                       <div className="flex gap-2">
                          <button onClick={() => deleteInstance(inst.name)} className="p-2 text-gray-700 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"><Trash size={16}/></button>
                       </div>
                    </div>

                    <div className="space-y-1">
                       <h3 className="text-lg font-black uppercase italic tracking-tighter truncate">{inst.name.replace(`${userPrefix}_`, '')}</h3>
                       <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{inst.phone}</p>
                    </div>

                    <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                       <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${inst.status === 'CONNECTED' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                          <span className={`text-[8px] font-black uppercase tracking-widest ${inst.status === 'CONNECTED' ? 'text-green-500' : 'text-red-500'}`}>{inst.status}</span>
                       </div>
                       {inst.status !== 'CONNECTED' ? (
                          <NeonButton onClick={() => connectInstance(inst.name)} className="!px-3 !py-1.5 !text-[8px] shadow-none">Conectar</NeonButton>
                       ) : (
                          <div className="text-[8px] font-black uppercase tracking-widest text-gray-700">Canal Ativo</div>
                       )}
                    </div>
                 </GlassCard>
               ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-20 text-center opacity-10">
             <Brain size={80} className="mb-6 text-orange-500" />
             <h2 className="text-3xl font-black uppercase italic">Engine {activeTab}</h2>
             <p className="text-[10px] uppercase font-bold tracking-[0.4em] mt-4 italic">Sincronizando com cluster neural v3.1...</p>
          </div>
        )}
      </main>
    </div>
  );
}
