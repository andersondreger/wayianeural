
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, MessageSquare, CreditCard, 
  LogOut, Smartphone, User as UserIcon, Activity, 
  Crown, Info, ShieldCheck, Zap, Send, Search, Filter,
  Plus, QrCode, Brain, MoreVertical, Clock, Loader2, 
  RefreshCw, Trash2, CheckCircle2, Paperclip, Smile,
  Mic, UserCircle, Bot, Phone, MessageCircle, ChevronDown,
  ChevronUp, History, ClipboardList, Star, AlertCircle
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
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [evolutionUrl] = useState('https://evo2.wayiaflow.com.br'); 
  const [evolutionApiKey] = useState('d86920ba398e31464c46401214779885');

  const userPrefix = useMemo(() => user.email.split('@')[0].toUpperCase().replace(/[^A-Z0-9]/g, ''), [user.email]);
  const isAdminMaster = user.email.toLowerCase() === ADMIN_MASTER.toLowerCase();

  const getHeaders = () => ({ 'apikey': evolutionApiKey, 'Content-Type': 'application/json' });
  const getBaseUrl = () => evolutionUrl.endsWith('/') ? evolutionUrl.slice(0, -1) : evolutionUrl;

  // BUSCA DE INSTÂNCIAS (CHIPS)
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
          phone: inst.ownerJid?.split('@')[0] || 'Desconectado'
        })).filter((inst: any) => isAdminMaster || inst.name.startsWith(`${userPrefix}_`));
        
        setInstances(mapped);
        
        if (!selectedInstanceName || !mapped.find(i => i.name === selectedInstanceName)) {
          const firstConnected = mapped.find(i => i.status === 'CONNECTED');
          if (firstConnected) setSelectedInstanceName(firstConnected.name);
        }
      }
    } catch (err) { console.error("Erro ao carregar instâncias:", err); }
  };

  // BUSCA DE CHATS REAIS (IMPORTAR CONTATOS) - MOTOR DE SINCRONIZAÇÃO CORRIGIDO
  const fetchChatsFromInstance = async (instanceName: string) => {
    if (!instanceName) return;
    setIsLoadingChats(true);
    try {
      // Endpoint Evolution v2 para buscar conversas
      const res = await fetch(`${getBaseUrl()}/chat/fetchChats/${instanceName}`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        
        // Suporte a múltiplas estruturas de retorno da Evolution API
        let chatsRaw = [];
        if (Array.isArray(data)) {
          chatsRaw = data;
        } else if (data.chats && Array.isArray(data.chats)) {
          chatsRaw = data.chats;
        } else if (data.instance && data.instance.chats) {
          chatsRaw = data.instance.chats;
        } else if (typeof data === 'object' && data !== null) {
          // Tenta encontrar qualquer propriedade que seja um array (fallback extremo)
          const possibleArray = Object.values(data).find(v => Array.isArray(v));
          if (possibleArray) chatsRaw = possibleArray as any[];
        }

        const mappedTickets: Ticket[] = chatsRaw
          .filter((chat: any) => chat.id || chat.remoteJid)
          .map((chat: any) => {
            const jid = chat.id || chat.remoteJid;
            const phone = jid.split('@')[0];
            const name = chat.pushName || chat.name || phone;
            
            return {
              id: jid,
              contactName: name,
              contactPhone: phone,
              lastMessage: chat.lastMessage?.message?.conversation || chat.lastMessage?.content || 'Mídia ou Mensagem do Sistema',
              sentiment: 'neutral',
              time: chat.updatedAt ? new Date(chat.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--',
              status: 'aberto',
              unreadCount: chat.unreadCount || 0,
              assignedTo: instanceName,
              protocol: `WA-${Math.floor(Math.random() * 90000) + 10000}`,
              avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=ff7300&color=fff`,
              messages: []
            };
          });

        setTickets(mappedTickets);
        
        // Se houver contatos e nada selecionado, seleciona o primeiro
        if (mappedTickets.length > 0 && (!selectedTicket || !mappedTickets.find(t => t.id === selectedTicket.id))) {
          setSelectedTicket(mappedTickets[0]);
        }
      }
    } catch (err) {
      console.error("Erro ao sincronizar contatos:", err);
    } finally {
      setIsLoadingChats(false);
    }
  };

  // CARREGAR HISTÓRICO REAL
  const fetchMessagesForTicket = async (ticket: Ticket) => {
    if (!selectedInstanceName || !ticket.id) return;
    setIsLoadingMessages(true);
    try {
      const res = await fetch(`${getBaseUrl()}/chat/fetchMessages/${selectedInstanceName}`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ remoteJid: ticket.id, count: 20 })
      });

      if (res.ok) {
        const data = await res.json();
        const messagesRaw = Array.isArray(data) ? data : (data.messages || []);
        
        const mappedMessages: Message[] = messagesRaw.reverse().map((m: any) => ({
          id: m.key.id,
          text: m.message?.conversation || m.message?.extendedTextMessage?.text || m.message?.imageMessage?.caption || "Mídia ou Tipo não suportado",
          sender: m.key.fromMe ? 'me' : 'contact',
          time: new Date(m.messageTimestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: 'read',
          type: 'text'
        }));

        const updatedTicket = { ...ticket, messages: mappedMessages };
        setSelectedTicket(updatedTicket);
        setTickets(prev => prev.map(t => t.id === ticket.id ? updatedTicket : t));
      }
    } catch (err) {
      console.error("Erro ao carregar mensagens:", err);
    } finally {
      setIsLoadingMessages(false);
    }
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
    if (selectedTicket && selectedTicket.messages.length === 0) {
      fetchMessagesForTicket(selectedTicket);
    }
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedTicket?.id]);

  // ENVIO DE MENSAGEM
  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedTicket || !selectedInstanceName) return;

    const currentMsg = messageInput;
    setMessageInput('');

    try {
      const res = await fetch(`${getBaseUrl()}/message/sendText/${selectedInstanceName}`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          number: selectedTicket.id,
          text: currentMsg,
          delay: 1000
        })
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
    } catch (err) {
      console.error("Erro ao enviar mensagem:", err);
    }
  };

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
        <div className="text-[8px] font-black text-gray-700 uppercase tracking-[0.3em] mb-4 px-2">Operacional</div>
        <nav className="flex-1 space-y-1">
          <SidebarBtn id="overview" icon={LayoutDashboard} label="Dashboard Central" />
          <SidebarBtn id="atendimento" icon={MessageSquare} label="Atendimento CRM" />
          <SidebarBtn id="evolution" icon={Smartphone} label="Canais Evolution" />
          <SidebarBtn id="config-neural" icon={Brain} label="WayIA Neural" />
          <div className="h-px bg-white/5 my-6 mx-2" />
          <SidebarBtn id="financeiro" icon={CreditCard} label="Faturamento" />
          <SidebarBtn id="admin" icon={Crown} label="Admin Master" isAdmin={true} />
        </nav>
        <button onClick={onLogout} className="mt-6 flex items-center gap-3 px-5 py-4 text-gray-700 hover:text-red-500 transition-colors uppercase text-[9px] font-bold tracking-widest border-t border-white/5">
            <LogOut size={16} /> Encerrar Sessão
        </button>
      </aside>

      {/* MAIN AREA */}
      <main className="flex-1 flex flex-col relative overflow-hidden bg-[#070707]">
        {activeTab === 'atendimento' ? (
          <div className="flex h-full w-full overflow-hidden">
            {/* COLUNA 1: LISTA DE TICKETS */}
            <div className="w-80 border-r border-white/5 flex flex-col bg-black/20">
              <div className="p-4 space-y-4">
                <div className="space-y-1.5">
                   <label className="text-[7px] font-black text-gray-600 uppercase tracking-widest px-1">Canal de Sincronização</label>
                   <div className="relative group">
                      <select 
                        value={selectedInstanceName}
                        onChange={(e) => setSelectedInstanceName(e.target.value)}
                        className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-2.5 px-4 text-[10px] font-black uppercase appearance-none outline-none focus:border-orange-500/40"
                      >
                        <option value="">Selecione o Chip...</option>
                        {instances.map(inst => (
                          <option key={inst.id} value={inst.name} disabled={inst.status !== 'CONNECTED'}>
                            {inst.status !== 'CONNECTED' ? '🔴 ' : '🟢 '}
                            {inst.name.replace(`${userPrefix}_`, '')}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={12} className="absolute right-3 top-3 text-gray-500 pointer-events-none" />
                   </div>
                </div>

                <div className="flex items-center justify-between">
                  <GlassButton onClick={() => fetchChatsFromInstance(selectedInstanceName)} className="!px-3 !py-2 hover:!text-orange-500">
                    <RefreshCw size={14} className={isLoadingChats ? 'animate-spin text-orange-500' : ''} />
                  </GlassButton>
                  <NeonButton className="!px-3 !py-2"><Plus size={14} /></NeonButton>
                </div>
                
                <div className="relative">
                  <input placeholder="Buscar contatos..." className="w-full bg-white/[0.03] border border-white/5 rounded-xl py-2.5 px-10 text-[10px] uppercase font-bold outline-none focus:border-orange-500/40" />
                  <Search size={14} className="absolute left-3 top-2.5 text-gray-600" />
                </div>

                <div className="flex border-b border-white/5">
                  {(['aberto', 'pendente', 'resolvido'] as const).map(f => (
                    <button 
                      key={f}
                      onClick={() => setActiveFilter(f)}
                      className={`flex-1 py-3 text-[9px] font-black uppercase tracking-tighter relative ${activeFilter === f ? 'text-orange-500' : 'text-gray-500'}`}
                    >
                      {f}s
                      {activeFilter === f && <motion.div layoutId="filter-active" className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-500" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
                {isLoadingChats ? (
                  <div className="flex flex-col items-center justify-center py-12 opacity-30 gap-4">
                    <Loader2 className="animate-spin text-orange-500" />
                    <span className="text-[8px] font-black uppercase tracking-widest italic">Pulsando Sincronização...</span>
                  </div>
                ) : tickets.length === 0 ? (
                  <div className="text-center py-12 px-6 space-y-3 opacity-30">
                    <AlertCircle className="mx-auto text-gray-700" size={32} />
                    <p className="text-[9px] font-black uppercase leading-tight italic">Nenhum contato encontrado nesta instância.</p>
                    <GlassButton onClick={() => fetchChatsFromInstance(selectedInstanceName)} className="!px-4 !py-2 !text-[8px]">Forçar Atualização</GlassButton>
                  </div>
                ) : tickets.filter(t => t.status === activeFilter).map(ticket => (
                  <div 
                    key={ticket.id} 
                    onClick={() => {
                      setSelectedTicket(ticket);
                      fetchMessagesForTicket(ticket);
                    }}
                    className={`p-4 rounded-2xl cursor-pointer transition-all border ${selectedTicket?.id === ticket.id ? 'bg-orange-600/10 border-orange-500/20 shadow-lg' : 'bg-transparent border-transparent hover:bg-white/[0.02]'}`}
                  >
                    <div className="flex gap-3">
                      <div className="relative">
                        <img src={ticket.avatar} className="w-10 h-10 rounded-full object-cover border border-white/10" />
                        <div className="absolute -bottom-1 -right-1 bg-green-500 border-2 border-[#070707] w-3 h-3 rounded-full" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1">
                          <h4 className="text-[11px] font-black uppercase truncate italic">{ticket.contactName}</h4>
                          <span className="text-[8px] text-gray-500 font-bold">{ticket.time}</span>
                        </div>
                        <p className="text-[9px] text-gray-400 font-medium truncate mb-2">{ticket.lastMessage}</p>
                        <div className="flex items-center justify-between">
                           <span className="text-[8px] px-2 py-0.5 bg-blue-500/10 text-blue-500 rounded-full font-black uppercase tracking-widest italic">Conectado</span>
                           {ticket.unreadCount > 0 && <span className="bg-green-500 text-black text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center">{ticket.unreadCount}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* COLUNA 2: CHAT AREA */}
            <div className="flex-1 flex flex-col relative bg-[#0a0a0a]">
              {selectedTicket ? (
                <>
                  <header className="h-16 border-b border-white/5 flex items-center justify-between px-6 bg-black/40 backdrop-blur-md z-10">
                    <div className="flex items-center gap-3">
                       <img src={selectedTicket.avatar} className="w-10 h-10 rounded-full border border-white/10" />
                       <div>
                          <h3 className="text-[12px] font-black uppercase italic tracking-tighter">{selectedTicket.contactName}</h3>
                          <p className="text-[8px] text-gray-500 font-bold uppercase tracking-widest italic">Canal: {selectedInstanceName.replace(`${userPrefix}_`, '')} | {selectedTicket.id}</p>
                       </div>
                    </div>
                    <div className="flex items-center gap-4">
                       <GlassButton onClick={() => fetchMessagesForTicket(selectedTicket)} className="!p-2 hover:!text-orange-500">
                        {isLoadingMessages ? <Loader2 size={14} className="animate-spin text-orange-500"/> : <RefreshCw size={14}/>}
                       </GlassButton>
                       <GlassButton className="!p-2"><Bot size={14}/></GlassButton>
                       <NeonButton className="!px-3 !py-1.5 !text-[8px]">Concluir</NeonButton>
                    </div>
                  </header>

                  <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar" style={{ backgroundImage: `url('https://qonrpzlkjhdmswjfxvtu.supabase.co/storage/v1/object/public/WayIAFlow/whatsapp-bg.png')`, backgroundSize: '400px', backgroundRepeat: 'repeat', opacity: 1 }}>
                    {isLoadingMessages ? (
                      <div className="flex flex-col items-center justify-center h-full opacity-20 space-y-4">
                        <Loader2 className="animate-spin text-orange-500" size={32} />
                        <p className="text-[10px] font-black uppercase tracking-widest italic">Recuperando trilhas de conversa...</p>
                      </div>
                    ) : selectedTicket.messages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full opacity-20 space-y-4">
                        <History size={48} />
                        <p className="text-[10px] font-black uppercase tracking-widest italic">Sem histórico recente.</p>
                      </div>
                    ) : (
                      selectedTicket.messages.map((msg, i) => (
                        <div key={msg.id || i} className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[70%] p-3 rounded-2xl shadow-xl relative ${msg.sender === 'me' ? 'bg-orange-600/90 text-white rounded-tr-none' : 'bg-white/5 text-gray-200 border border-white/5 rounded-tl-none backdrop-blur-md'}`}>
                            <p className="text-[11px] font-medium leading-relaxed">{msg.text}</p>
                            <div className={`text-[7px] mt-1 flex items-center gap-1 ${msg.sender === 'me' ? 'text-orange-200 justify-end' : 'text-gray-500'}`}>
                              {msg.time}
                              {msg.sender === 'me' && <CheckCircle2 size={8} className="text-orange-200" />}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  <div className="p-4 border-t border-white/5 bg-black/40 backdrop-blur-xl">
                    <div className="flex items-center gap-3 bg-white/[0.03] border border-white/10 rounded-2xl p-2 px-4 shadow-inner">
                       <button className="text-gray-500 hover:text-orange-500 transition-all"><Paperclip size={18} /></button>
                       <button className="text-gray-500 hover:text-orange-500 transition-all"><Smile size={18} /></button>
                       <input 
                         value={messageInput}
                         onChange={e => setMessageInput(e.target.value)}
                         onKeyPress={e => e.key === 'Enter' && handleSendMessage()}
                         placeholder="Escreva uma resposta neural..." 
                         className="flex-1 bg-transparent border-none outline-none text-[11px] font-bold py-2" 
                       />
                       <button className="text-gray-500 hover:text-orange-500 transition-all"><Mic size={18} /></button>
                       <button 
                         onClick={handleSendMessage}
                         disabled={!messageInput.trim()}
                         className="bg-orange-600 p-2.5 rounded-xl hover:scale-105 active:scale-95 transition-all shadow-lg shadow-orange-600/20 disabled:opacity-50 disabled:grayscale"
                       >
                         <Send size={16} />
                       </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center opacity-20 p-12">
                   <MessageCircle size={80} className="mb-6 text-orange-500" />
                   <h2 className="text-2xl font-black uppercase italic tracking-tighter">Cluster de CRM</h2>
                   <p className="text-[10px] uppercase font-bold tracking-[0.3em] mt-2">Escolha uma conversa para iniciar o processamento.</p>
                </div>
              )}
            </div>

            {/* COLUNA 3: DETALHES DO CONTATO */}
            <div className="w-[340px] border-l border-white/5 bg-black/40 p-6 overflow-y-auto custom-scrollbar space-y-6">
              <div className="text-center space-y-4">
                <div className="relative w-24 h-24 mx-auto">
                   <img src={selectedTicket?.avatar} className="w-full h-full rounded-3xl object-cover border-2 border-orange-500/20 shadow-2xl" />
                   <span className="absolute -top-2 -right-2 bg-blue-600 text-[7px] font-black px-2 py-0.5 rounded-full uppercase italic shadow-lg shadow-blue-500/20">Verified</span>
                </div>
                <div>
                  <h3 className="text-lg font-black uppercase italic tracking-tighter">{selectedTicket?.contactName}</h3>
                  <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">+{selectedTicket?.contactPhone}</p>
                </div>
                <GlassButton className="w-full !py-2 !text-[9px]">Histórico do Lead</GlassButton>
              </div>

              <div className="space-y-4">
                 <div className="flex items-center gap-2 text-[8px] font-black text-orange-500 uppercase tracking-widest italic"><Info size={12}/> Metadados Neurais</div>
                 <GlassCard className="!p-4 space-y-3 !bg-white/[0.01]">
                    <div className="flex justify-between items-center text-[9px]">
                       <span className="text-gray-500 uppercase font-black">Status Global</span>
                       <span className="text-green-500 font-black uppercase italic">Sincronizado</span>
                    </div>
                    <div className="flex justify-between items-center text-[9px]">
                       <span className="text-gray-500 uppercase font-black">Protocolo</span>
                       <span className="text-white font-black italic">#{selectedTicket?.protocol}</span>
                    </div>
                 </GlassCard>

                 <div className="flex items-center gap-2 text-[8px] font-black text-orange-500 uppercase tracking-widest italic"><Star size={12}/> Humor do Lead</div>
                 <GlassCard className="!p-4 !bg-white/[0.01]">
                    <div className="flex justify-center gap-2 text-gray-700">
                       {[1,2,3,4,5].map(s => <Star key={s} size={14} className={s <= 4 ? 'text-orange-500 fill-orange-500' : ''} />)}
                    </div>
                 </GlassCard>
              </div>
            </div>
          </div>
        ) : (
          <>
            <header className="h-16 flex items-center justify-between px-10 border-b border-white/5 backdrop-blur-md z-10">
              <div className="flex items-center gap-3">
                 <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                 <span className="text-[10px] font-black uppercase text-orange-500 tracking-widest italic">
                   {isAdminMaster ? 'ADMIN CONSOLE MASTER' : 'Node v3.14 Ativo'}
                 </span>
              </div>
              <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="text-[10px] font-black uppercase italic leading-none">{user.name}</div>
                      <div className="text-[7px] text-gray-500 font-bold uppercase tracking-widest mt-1 italic italic">
                        {isAdminMaster ? 'Controle Total' : 'Sessão Ativa'}
                      </div>
                    </div>
                    <div className="w-10 h-10 bg-rajado rounded-xl border border-white/10 flex items-center justify-center">
                      <UserIcon size={18} />
                    </div>
              </div>
            </header>

            <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
              <AnimatePresence mode="wait">
                <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="h-full">
                  {activeTab === 'evolution' && (
                    <div className="space-y-10">
                       <div className="flex justify-between items-end">
                          <div>
                            <h2 className="text-4xl font-black uppercase italic tracking-tighter">
                              Frota de <span className="text-orange-500">Nodes.</span>
                            </h2>
                            <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest italic mt-1">
                              {isAdminMaster ? 'Monitorando instâncias globais do sistema.' : 'Gerencie seus canais de comunicação exclusivos.'}
                            </p>
                          </div>
                          <GlassButton onClick={fetchInstances} className="!px-4 hover:!text-orange-500"><RefreshCw size={14} /></GlassButton>
                       </div>

                       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {instances.map((inst) => (
                            <GlassCard key={inst.id} className="!p-6 relative group border-white/5 hover:border-orange-500/40">
                               <div className="flex justify-between items-start mb-6">
                                  <div className={`p-3 rounded-xl ${inst.status === 'CONNECTED' ? 'bg-green-500/10 text-green-500' : 'bg-orange-500/10 text-orange-500'}`}>
                                     <Smartphone size={20} />
                                  </div>
                               </div>
                               <div className="space-y-1">
                                  <h3 className="text-lg font-black uppercase italic tracking-tighter truncate">
                                    {isAdminMaster ? inst.name : inst.name.replace(`${userPrefix}_`, '')}
                                  </h3>
                                  <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">{inst.phone}</p>
                               </div>
                               <div className="mt-6 pt-6 border-t border-white/5 flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                     <div className={`w-2 h-2 rounded-full ${inst.status === 'CONNECTED' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                                     <span className={`text-[8px] font-black uppercase tracking-widest ${inst.status === 'CONNECTED' ? 'text-green-500' : 'text-red-500'}`}>{inst.status}</span>
                                  </div>
                               </div>
                            </GlassCard>
                          ))}
                       </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
