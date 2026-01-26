
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
  CheckCircle, ListFilter, UserPlus, Hash
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

  // --- BUSCA DE INSTÂNCIAS ---
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
          phone: inst.ownerJid?.split('@')[0] || 'Aguardando...',
          instanceKey: inst.token || inst.instanceKey
        })).filter((inst: any) => isAdminMaster || inst.name.startsWith(`${userPrefix}_`));
        
        setInstances(mapped);
        
        if (activeTab === 'atendimento' && (!selectedInstanceName || !mapped.find(i => i.name === selectedInstanceName))) {
          const firstConnected = mapped.find(i => i.status === 'CONNECTED');
          if (firstConnected) setSelectedInstanceName(firstConnected.name);
        }
      }
    } catch (err) { console.error("Erro instâncias:", err); }
  };

  // --- MOTOR DE SINCRONIZAÇÃO CRM (GREEDY SYNC) ---
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
      // Busca exaustiva: Chats Ativos + Agenda de Contatos
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
            lastMessage: item.lastMessage?.message?.conversation || item.lastMessage?.content || 'Sincronizado via Neural Flow',
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
      
      if (uniqueTickets.length > 0 && !selectedTicket) {
        // Não selecionar automaticamente para evitar carregamento pesado, ou seleciona o primeiro
        // setSelectedTicket(uniqueTickets[0]);
      }
    } catch (err) {
      console.error("Erro Sincronização:", err);
    } finally {
      setIsLoadingChats(false);
    }
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
          text: m.message?.conversation || m.message?.extendedTextMessage?.text || m.message?.imageMessage?.caption || "Mídia/Arquivo Recebido",
          sender: m.key?.fromMe ? 'me' : 'contact',
          time: m.messageTimestamp ? new Date(m.messageTimestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--',
          status: 'read',
          type: 'text'
        }));

        const updatedTicket = { ...ticket, messages: mappedMessages };
        setSelectedTicket(updatedTicket);
        setTickets(prev => prev.map(t => t.id === ticket.id ? updatedTicket : t));
      }
    } catch (err) { console.error("Erro Mensagens:", err); } finally { setIsLoadingMessages(false); }
  };

  useEffect(() => {
    fetchInstances();
    const timer = setInterval(fetchInstances, 20000);
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
    } catch (err) { console.error("Erro Envio:", err); }
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

      {/* SIDEBAR NAVIGATION (RESTANTE ATUAL) */}
      <aside className="w-[260px] border-r border-white/5 flex flex-col p-6 bg-black/40 backdrop-blur-2xl z-50">
        <Logo size="sm" className="mb-10 px-2" />
        <div className="text-[8px] font-black text-gray-700 uppercase tracking-[0.3em] mb-4 px-2">Navegação Principal</div>
        <nav className="flex-1 space-y-1">
          <SidebarBtn id="overview" icon={LayoutDashboard} label="Visão Geral" />
          <SidebarBtn id="atendimento" icon={MessageSquare} label="Atendimento CRM" />
          <SidebarBtn id="evolution" icon={Smartphone} label="Canais Conexão" />
          <SidebarBtn id="config-neural" icon={Brain} label="Fluxo Neural" />
          <div className="h-px bg-white/5 my-6 mx-2" />
          <SidebarBtn id="financeiro" icon={CreditCard} label="Faturamento" />
          <SidebarBtn id="admin" icon={Crown} label="Admin Master" isAdmin={true} />
        </nav>
        <button onClick={onLogout} className="mt-6 flex items-center gap-3 px-5 py-4 text-gray-700 hover:text-red-500 transition-colors uppercase text-[9px] font-bold tracking-widest border-t border-white/5">
            <LogOut size={16} /> Logout Sistema
        </button>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col relative overflow-hidden bg-[#070707]">
        
        {activeTab === 'atendimento' ? (
          <div className="flex h-full w-full overflow-hidden">
            
            {/* COLUNA ESQUERDA: LISTA DE LEADS (ESTILO ZDG) */}
            <div className="w-[350px] border-r border-white/5 flex flex-col bg-black/30 backdrop-blur-xl">
              <div className="p-4 space-y-4 border-b border-white/5">
                <div className="flex items-center justify-between mb-2">
                   <div className="flex items-center gap-2">
                      <div className="bg-orange-500 p-1.5 rounded-lg"><Hash size={14} className="text-black"/></div>
                      <span className="text-[10px] font-black uppercase tracking-tighter italic">Engine CRM</span>
                   </div>
                   <div className="flex items-center gap-2">
                      <button onClick={() => fetchChatsFromInstance(selectedInstanceName)} className="p-2 glass rounded-lg hover:text-orange-500 transition-all">
                        <RefreshCw size={14} className={isLoadingChats ? 'animate-spin' : ''} />
                      </button>
                      <button className="p-2 glass rounded-lg hover:text-orange-500 transition-all"><Plus size={14}/></button>
                   </div>
                </div>

                <div className="space-y-3">
                   <select 
                     value={selectedInstanceName}
                     onChange={(e) => setSelectedInstanceName(e.target.value)}
                     className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-2.5 px-4 text-[10px] font-black uppercase outline-none focus:border-orange-500/40 transition-all"
                   >
                     <option value="">Selecione o Canal...</option>
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
                       placeholder="Buscar contato ou ticket..." 
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
                       <span className="ml-1.5 opacity-40">({tickets.filter(t => t.status === f).length})</span>
                       {activeFilter === f && <motion.div layoutId="filter-indicator" className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-orange-500 rounded-full" />}
                     </button>
                   ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
                {isLoadingChats ? (
                  <div className="flex flex-col items-center justify-center py-12 opacity-30 gap-4">
                    <Loader2 className="animate-spin text-orange-500" />
                    <span className="text-[8px] font-black uppercase tracking-[0.2em] italic">Varrendo Trilha Neural...</span>
                  </div>
                ) : filteredTickets.length === 0 ? (
                  <div className="text-center py-20 px-6 opacity-20 border-2 border-dashed border-white/5 rounded-3xl m-2">
                    <AlertCircle size={32} className="mx-auto mb-4" />
                    <p className="text-[10px] font-black uppercase tracking-widest italic">Nenhum lead detectado.</p>
                  </div>
                ) : filteredTickets.map(ticket => (
                  <div 
                    key={ticket.id} 
                    onClick={() => {
                      setSelectedTicket(ticket);
                      fetchMessagesForTicket(ticket);
                    }}
                    className={`p-4 rounded-2xl cursor-pointer transition-all border group ${selectedTicket?.id === ticket.id ? 'bg-orange-600/10 border-orange-500/20 shadow-xl' : 'bg-transparent border-transparent hover:bg-white/[0.02]'}`}
                  >
                    <div className="flex gap-4">
                      <div className="relative">
                        <img src={ticket.avatar} className="w-12 h-12 rounded-2xl object-cover border border-white/10 group-hover:scale-105 transition-transform" />
                        <div className="absolute -bottom-1 -right-1 bg-green-500 border-2 border-[#070707] w-3 h-3 rounded-full" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1">
                          <h4 className="text-[11px] font-black uppercase truncate italic tracking-tighter">{ticket.contactName}</h4>
                          <span className="text-[8px] text-gray-600 font-bold">{ticket.time}</span>
                        </div>
                        <div className="flex items-center gap-1.5 mb-2">
                           <span className="text-[7px] text-orange-500 font-black uppercase tracking-widest">Ticket: {ticket.protocol}</span>
                           <span className="w-1 h-1 bg-white/10 rounded-full"/>
                           <span className="text-[7px] text-gray-600 font-bold truncate">Usuário: {userPrefix}</span>
                        </div>
                        <p className="text-[9px] text-gray-500 font-medium truncate italic leading-none">"{ticket.lastMessage}"</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* COLUNA CENTRAL: CHAT (ESTILO ZDG) */}
            <div className="flex-1 flex flex-col relative bg-[#090909]">
              {selectedTicket ? (
                <>
                  <header className="h-20 border-b border-white/5 flex items-center justify-between px-8 bg-black/40 backdrop-blur-md z-10">
                    <div className="flex items-center gap-4">
                       <img src={selectedTicket.avatar} className="w-12 h-12 rounded-2xl border border-white/10" />
                       <div>
                          <h3 className="text-[14px] font-black uppercase italic tracking-tighter leading-tight">{selectedTicket.contactName}</h3>
                          <div className="flex items-center gap-2 mt-1">
                             <span className="text-[8px] text-gray-500 font-bold uppercase tracking-widest italic">Atribuído a: {userPrefix}</span>
                             <span className="w-1 h-1 bg-orange-500 rounded-full" />
                             <span className="text-[8px] text-orange-500 font-black uppercase tracking-widest italic">Ticket: {selectedTicket.protocol}</span>
                          </div>
                       </div>
                    </div>
                    <div className="flex items-center gap-2">
                       <button onClick={() => fetchMessagesForTicket(selectedTicket)} className="p-3 glass rounded-xl hover:text-orange-500 transition-all">
                        {isLoadingMessages ? <Loader2 size={16} className="animate-spin text-orange-500"/> : <RefreshCw size={16}/>}
                       </button>
                       <button className="p-3 glass rounded-xl hover:text-orange-500 transition-all"><Bot size={16}/></button>
                       <button className="p-3 glass rounded-xl hover:text-orange-500 transition-all"><Power size={16}/></button>
                       <div className="w-px h-8 bg-white/5 mx-2" />
                       <NeonButton className="!px-5 !py-2.5 !text-[9px] !rounded-xl">Resolver</NeonButton>
                    </div>
                  </header>

                  <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar" style={{ backgroundImage: `url('https://qonrpzlkjhdmswjfxvtu.supabase.co/storage/v1/object/public/WayIAFlow/whatsapp-bg.png')`, backgroundSize: '400px', backgroundRepeat: 'repeat', opacity: 1 }}>
                    <div className="flex justify-center mb-8">
                       <span className="bg-black/60 backdrop-blur-md border border-white/10 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest text-gray-500 italic">Início do Atendimento #{selectedTicket.protocol}</span>
                    </div>

                    {selectedTicket.messages.map((msg, i) => {
                       // Lógica simples de separador de data
                       const isNewDay = i === 0 || i % 10 === 0; 
                       return (
                        <React.Fragment key={msg.id || i}>
                          {isNewDay && (
                            <div className="flex justify-center my-8">
                               <div className="h-px bg-white/5 flex-1 max-w-[100px]" />
                               <span className="mx-4 text-[8px] font-black uppercase tracking-widest text-gray-600 italic">Atendimento {selectedTicket.protocol}</span>
                               <div className="h-px bg-white/5 flex-1 max-w-[100px]" />
                            </div>
                          )}
                          <div className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[75%] p-4 rounded-3xl shadow-2xl relative transition-all hover:scale-[1.01] ${msg.sender === 'me' ? 'bg-orange-600/90 text-white rounded-tr-none border border-orange-500/20' : 'bg-white/5 text-gray-200 border border-white/5 rounded-tl-none backdrop-blur-xl'}`}>
                              <p className="text-[12px] font-medium leading-relaxed tracking-tight">{msg.text}</p>
                              <div className={`text-[8px] mt-2 flex items-center gap-1.5 ${msg.sender === 'me' ? 'text-orange-200 justify-end' : 'text-gray-500'}`}>
                                {msg.time}
                                {msg.sender === 'me' && <CheckCircle2 size={10} className="text-blue-400" />}
                              </div>
                            </div>
                          </div>
                        </React.Fragment>
                       );
                    })}
                    <div ref={chatEndRef} />
                  </div>

                  <div className="p-5 border-t border-white/5 bg-black/60 backdrop-blur-2xl">
                    <div className="flex items-center gap-4 bg-white/[0.03] border border-white/10 rounded-2xl p-2 px-5 shadow-inner group focus-within:border-orange-500/40 transition-all">
                       <button className="text-gray-600 hover:text-orange-500 transition-all p-2"><Paperclip size={20} /></button>
                       <button className="text-gray-600 hover:text-orange-500 transition-all p-2"><Smile size={20} /></button>
                       <input 
                         value={messageInput}
                         onChange={e => setMessageInput(e.target.value)}
                         onKeyPress={e => e.key === 'Enter' && handleSendMessage()}
                         placeholder="Digite aqui para processar resposta..." 
                         className="flex-1 bg-transparent border-none outline-none text-[12px] font-bold py-3 text-white placeholder:text-gray-700" 
                       />
                       <button className="text-gray-600 hover:text-orange-500 transition-all p-2"><Mic size={20} /></button>
                       <button 
                         onClick={handleSendMessage}
                         disabled={!messageInput.trim()}
                         className="bg-orange-600 text-black p-3 rounded-xl hover:scale-110 active:scale-95 transition-all shadow-lg shadow-orange-600/30 disabled:opacity-50 disabled:grayscale"
                       >
                         <Send size={20} />
                       </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-12 relative overflow-hidden">
                   <div className="absolute inset-0 grid-engine opacity-5"></div>
                   <MessageCircle size={100} className="mb-8 text-orange-500/20 animate-pulse" />
                   <h2 className="text-3xl font-black uppercase italic tracking-tighter leading-none">Hub de <span className="text-orange-500">Atendimento.</span></h2>
                   <p className="text-[10px] uppercase font-bold tracking-[0.4em] mt-4 text-gray-700 italic">Selecione um lead no painel lateral para iniciar o fluxo neural.</p>
                </div>
              )}
            </div>

            {/* COLUNA DIREITA: DADOS DO CONTATO (ESTILO ZDG) */}
            <div className="w-[320px] border-l border-white/5 bg-black/40 p-6 overflow-y-auto custom-scrollbar space-y-8 backdrop-blur-2xl">
              <div className="flex justify-between items-center mb-4">
                 <h2 className="text-[12px] font-black uppercase italic tracking-widest text-gray-500">Dados do Contato</h2>
                 <button className="text-[8px] font-black uppercase tracking-widest text-orange-500 hover:underline">Reduzir Menu</button>
              </div>

              <div className="text-center space-y-6">
                <div className="relative group inline-block">
                   <img src={selectedTicket?.avatar || `https://ui-avatars.com/api/?name=?&background=111&color=555`} className="w-32 h-32 rounded-[2.5rem] object-cover border-2 border-orange-500/20 shadow-2xl transition-all group-hover:scale-105" />
                   <span className="absolute -top-2 -right-2 bg-orange-600 text-black text-[8px] font-black px-3 py-1 rounded-full uppercase italic shadow-xl">Handshake</span>
                </div>
                <div>
                  <h3 className="text-xl font-black uppercase italic tracking-tighter leading-tight">{selectedTicket?.contactName || '---'}</h3>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] mt-1 italic">+{selectedTicket?.contactPhone || 'Sincronizando...'}</p>
                </div>
                <div className="flex gap-2">
                   <GlassButton className="flex-1 !py-2 !text-[8px] !rounded-xl">Editar</GlassButton>
                </div>
              </div>

              <div className="space-y-6">
                 <div className="flex items-center gap-3 text-[9px] font-black text-orange-500 uppercase tracking-widest italic border-b border-white/5 pb-2">
                   <History size={14}/> Logs & Metadados
                 </div>
                 
                 <div className="space-y-4">
                    <GlassCard className="!p-4 space-y-3 !bg-white/[0.01] border-white/5">
                       <div className="flex justify-between items-center text-[9px]">
                          <span className="text-gray-600 uppercase font-black tracking-widest">Protocolo</span>
                          <span className="text-white font-black italic">#{selectedTicket?.protocol || '---'}</span>
                       </div>
                       <div className="flex justify-between items-center text-[9px]">
                          <span className="text-gray-600 uppercase font-black tracking-widest">Iniciado em</span>
                          <span className="text-white font-black italic">{selectedTicket?.time || '---'}</span>
                       </div>
                       <div className="flex justify-between items-center text-[9px]">
                          <span className="text-gray-600 uppercase font-black tracking-widest">Status Fluxo</span>
                          <span className="text-green-500 font-black uppercase italic tracking-tighter">Sincronizado</span>
                       </div>
                    </GlassCard>

                    <div className="grid grid-cols-2 gap-2">
                       <GlassButton className="!py-3 !px-2 flex flex-col items-center gap-2 !bg-white/[0.02]">
                          <MessageCircle size={14} className="text-blue-500"/>
                          <span className="text-[7px] font-black">Conversas</span>
                       </GlassButton>
                       <GlassButton className="!py-3 !px-2 flex flex-col items-center gap-2 !bg-white/[0.02]">
                          <ClipboardList size={14} className="text-orange-500"/>
                          <span className="text-[7px] font-black">Logs Oper.</span>
                       </GlassButton>
                    </div>
                 </div>

                 <div className="flex items-center gap-3 text-[9px] font-black text-orange-500 uppercase tracking-widest italic border-b border-white/5 pb-2">
                   <Star size={14}/> Avaliação IA
                 </div>
                 <GlassCard className="!p-4 !bg-white/[0.01] border-white/5 text-center">
                    <div className="flex justify-center gap-1.5 text-gray-800 mb-2">
                       {[1,2,3,4,5].map(s => <Star key={s} size={16} className={s <= 4 ? 'text-orange-500 fill-orange-500' : ''} />)}
                    </div>
                    <p className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">Lead de Alta Conversão</p>
                 </GlassCard>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
             <div className="text-center py-20 opacity-20">
                <Brain size={60} className="mx-auto mb-4 text-orange-500" />
                <h2 className="text-2xl font-black uppercase italic">Cluster {activeTab} em Integração Neural</h2>
                <p className="text-sm font-bold uppercase tracking-widest mt-2">Nesta versão, foque no Atendimento CRM.</p>
             </div>
          </div>
        )}
      </main>
    </div>
  );
}
