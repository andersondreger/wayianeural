
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
  Signal, SignalHigh, Globe, HardDrive, Cpu
} from 'lucide-react';
import { UserSession, DashboardTab, EvolutionInstance, Ticket, Message } from '../types';
import { GlassCard } from '../components/GlassCard';
import { NeonButton, GlassButton } from '../components/Buttons';
import { Logo } from '../components/Logo';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const ADMIN_MASTER = 'dregerr.anderson@gmail.com';

export function Dashboard({ user, onLogout, onCheckout }: { user: UserSession; onLogout: () => void; onCheckout: () => void }) {
  const [activeTab, setActiveTab] = useState<DashboardTab>('evolution');
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

  const userPrefix = useMemo(() => {
    if (!user?.email) return 'GUEST';
    return user.email.split('@')[0].toUpperCase().replace(/[^A-Z0-9]/g, '');
  }, [user.email]);

  const isAdminMaster = user.email.toLowerCase() === ADMIN_MASTER.toLowerCase();
  const getHeaders = () => ({ 'apikey': evolutionApiKey, 'Content-Type': 'application/json' });
  const getBaseUrl = () => evolutionUrl.endsWith('/') ? evolutionUrl.slice(0, -1) : evolutionUrl;

  // --- CORE EVOLUTION API ---
  const fetchInstances = async () => {
    try {
      const res = await fetch(`${getBaseUrl()}/instance/fetchInstances`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.instances || []);
        const mapped = list.map((inst: any) => ({
          id: inst.instanceId || inst.name || inst.instanceName,
          name: inst.instanceName || inst.name,
          status: (inst.status === 'open' || inst.connectionStatus === 'open' || inst.state === 'open' || inst.connectionStatus === 'CONNECTED' || inst.status === 'CONNECTED') ? 'CONNECTED' : 'DISCONNECTED',
          phone: inst.ownerJid?.split('@')[0] || inst.number || 'Aguardando Link',
          instanceKey: inst.token || inst.instanceKey
        })).filter((inst: any) => isAdminMaster || inst.name.startsWith(`${userPrefix}_`));
        
        setInstances(mapped);
        mapped.forEach((inst: any) => { if (inst.status === 'CONNECTED') updateLeadCount(inst.name); });
        
        // Auto selecionar primeira instância conectada para o CRM
        if (activeTab === 'atendimento' && !selectedInstanceName) {
           const connected = mapped.find(i => i.status === 'CONNECTED');
           if (connected) setSelectedInstanceName(connected.name);
        }
      }
    } catch (err) {
      console.error("Fetch Instances Error", err);
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
    setIsCreatingInstance(true);
    const name = `${userPrefix}_CH_${instances.length + 1}`;
    addLog(`Implantando engine: ${name}`, "info");
    try {
      const res = await fetch(`${getBaseUrl()}/instance/create`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ instanceName: name, token: Math.random().toString(36).substring(7), qrcode: true })
      });
      if (res.ok) {
        addLog(`Engine ${name} configurada. Preparando sinal neural...`, "success");
        await fetchInstances();
        // Delay para garantir que a instância existe no cache do servidor Evolution
        setTimeout(() => connectInstance(name), 2000);
      } else {
        const err = await res.json();
        addLog(`Falha na criação: ${err.message || 'Erro Desconhecido'}`, "error");
      }
    } catch (err: any) {
      addLog(`Erro crítico na Engine: ${err.message}`, "error");
    } finally { setIsCreatingInstance(false); }
  };

  const connectInstance = async (name: string) => {
    addLog(`Solicitando QR Code de pareamento...`, "info");
    try {
      const res = await fetch(`${getBaseUrl()}/instance/connect/${name}`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (data.base64 || data.code) {
          const rawCode = data.base64 || data.code;
          const code = rawCode.startsWith('data:image') ? rawCode : `data:image/png;base64,${rawCode}`;
          setQrCodeModal({ isOpen: true, code, name });
          addLog("Link neural gerado. Aguardando leitura.", "success");
        } else {
          addLog("Canal já sincronizado ou erro na resposta.", "info");
          fetchInstances();
        }
      }
    } catch (err: any) { addLog(`Falha no Handshake: ${err.message}`, "error"); }
  };

  const deleteInstance = async (name: string) => {
    if (!confirm(`Deseja desintegrar permanentemente o canal ${name}?`)) return;
    try {
      const res = await fetch(`${getBaseUrl()}/instance/delete/${name}`, { method: 'DELETE', headers: getHeaders() });
      if (res.ok) { 
        fetchInstances(); 
        addLog(`Canal ${name} removido com sucesso.`, "success"); 
      }
    } catch (e) {}
  };

  // --- CRM LOGIC ---
  const fetchChatsFromInstance = async (instanceName: string) => {
    if (!instanceName) return;
    setIsLoadingChats(true);
    try {
      const res = await fetch(`${getBaseUrl()}/chat/fetchChats/${instanceName}`, { headers: getHeaders() });
      if (res.ok) {
        const json = await res.json();
        const chatsRaw = Array.isArray(json) ? json : (json.chats || []);
        const mapped = chatsRaw.filter((i: any) => i.id?.includes('@s.whatsapp.net')).map((item: any) => ({
          id: item.id,
          contactName: item.pushName || item.name || item.id.split('@')[0],
          contactPhone: item.id.split('@')[0],
          lastMessage: item.lastMessage?.message?.conversation || 'Sem mensagens recentes',
          sentiment: 'neutral',
          time: 'Sinc',
          status: 'aberto',
          unreadCount: item.unreadCount || 0,
          assignedTo: instanceName,
          protocol: String(Math.floor(Math.random() * 90000) + 10000),
          avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(item.pushName || 'U')}&background=ff7300&color=fff&bold=true`,
          messages: []
        }));
        setTickets(mapped);
      }
    } catch (e) {
      console.error("CRM Fetch Error", e);
    } finally { setIsLoadingChats(false); }
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
        const mapped: Message[] = messagesRaw.reverse().map((m: any) => ({
          id: m.key?.id || Math.random().toString(),
          text: m.message?.conversation || m.message?.extendedTextMessage?.text || "Mídia não suportada no painel",
          sender: m.key?.fromMe ? 'me' : 'contact',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: 'read',
          type: 'text'
        }));
        setSelectedTicket({ ...ticket, messages: mapped });
        
        // Scroll to bottom
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      }
    } catch (e) {} finally { setIsLoadingMessages(false); }
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedTicket || !selectedInstanceName) return;
    const msg = messageInput;
    setMessageInput('');
    try {
      const res = await fetch(`${getBaseUrl()}/message/sendText/${selectedInstanceName}`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ number: selectedTicket.id, text: msg })
      });
      if (res.ok) {
        const newMsg: Message = { id: Date.now().toString(), text: msg, sender: 'me', time: 'Agora', status: 'sent', type: 'text' };
        setSelectedTicket(prev => prev ? { ...prev, messages: [...prev.messages, newMsg] } : null);
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      }
    } catch (e) {}
  };

  // Polling Connection Status quando o modal de QR está aberto
  useEffect(() => {
    let poll: any;
    if (qrCodeModal.isOpen) {
      poll = setInterval(async () => {
        try {
          const res = await fetch(`${getBaseUrl()}/instance/connectionState/${qrCodeModal.name}`, { headers: getHeaders() });
          if (res.ok) {
            const data = await res.json();
            const state = data.instance?.state || data.state || data.status;
            if (state === 'open' || state === 'CONNECTED') {
              setQrCodeModal(p => ({ ...p, isOpen: false }));
              clearInterval(poll);
              addLog(`Canal ${qrCodeModal.name} conectado!`, "success");
              fetchInstances();
            }
          }
        } catch (e) {}
      }, 3000);
    }
    return () => clearInterval(poll);
  }, [qrCodeModal.isOpen, qrCodeModal.name]);

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

  const SidebarBtn = ({ id, icon: Icon, label, isAdmin = false }: { id: DashboardTab, icon: any, label: string, isAdmin?: boolean }) => {
    if (isAdmin && !user.isAdmin) return null;
    return (
      <button 
        onClick={() => setActiveTab(id)}
        className={`w-full flex items-center gap-3 px-5 py-3 rounded-xl transition-all relative group ${
          activeTab === id ? 'bg-orange-600/10 text-orange-500 border border-orange-500/10' : 'text-gray-500 hover:text-white hover:bg-white/[0.02]'
        }`}
      >
        <Icon size={16} className={activeTab === id ? 'text-orange-500' : 'opacity-40'} />
        <span className="text-[9px] font-bold uppercase tracking-widest">{label}</span>
      </button>
    );
  };

  return (
    <div className="flex h-screen bg-[#050505] overflow-hidden text-white font-sans selection:bg-orange-500/30">
      <div className="fixed inset-0 grid-engine pointer-events-none opacity-5"></div>

      {/* SIDEBAR */}
      <aside className="w-[260px] border-r border-white/5 flex flex-col p-6 bg-black/40 backdrop-blur-2xl z-50">
        <Logo size="sm" className="mb-8 px-2" />
        <div className="mb-6 px-2 flex flex-col gap-2">
           <div className="flex items-center justify-between text-[7px] font-black uppercase text-gray-500 tracking-[0.2em]">
              <span>Sincronização Ativa</span>
              <div className={`w-1.5 h-1.5 rounded-full ${instances.some(i => i.status === 'CONNECTED') ? 'bg-green-500 animate-pulse' : 'bg-orange-500'}`} />
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
            <span className="text-[9px] font-bold uppercase tracking-widest">Logs de Sinais</span>
          </button>
        </nav>
        <button onClick={onLogout} className="mt-6 flex items-center gap-3 px-5 py-4 text-gray-700 hover:text-red-500 transition-colors uppercase text-[9px] font-bold tracking-widest border-t border-white/5">
            <LogOut size={16} /> Encerrar Sessão
        </button>
      </aside>

      {/* MAIN */}
      <main className="flex-1 flex flex-col relative overflow-hidden bg-[#070707]">
        
        {/* QR CODE MODAL - RE-CONFIGURADO */}
        <AnimatePresence>
          {qrCodeModal.isOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/95 backdrop-blur-xl">
              <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-[#0a0a0a] border border-white/10 p-10 rounded-[3rem] max-w-sm w-full text-center space-y-8 shadow-[0_0_80px_rgba(255,115,0,0.2)]">
                <div className="flex justify-center">
                   <div className="p-5 bg-orange-500/10 rounded-full">
                      <QrCode className="text-orange-500" size={40} />
                   </div>
                </div>
                <div>
                   <h3 className="text-2xl font-black uppercase italic tracking-tighter text-white">Pareamento Neural</h3>
                   <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mt-1">Escaneie para ativar o canal {qrCodeModal.name.replace(`${userPrefix}_`, '')}</p>
                </div>
                
                <div className="bg-white p-6 rounded-[2rem] mx-auto inline-block border-8 border-orange-500/10 shadow-2xl">
                   {qrCodeModal.code ? (
                      <img src={qrCodeModal.code} className="w-56 h-56 object-contain" alt="Evolution QR Code" />
                   ) : (
                      <div className="w-56 h-56 flex flex-col items-center justify-center text-black">
                         <Loader2 className="animate-spin text-orange-500 mb-2" size={32} />
                         <span className="text-[8px] font-black uppercase">Sincronizando...</span>
                      </div>
                   )}
                </div>

                <div className="space-y-4">
                   <div className="flex items-center justify-center gap-3 text-orange-500 animate-pulse text-[10px] font-black uppercase tracking-widest">
                      <Loader2 size={16} className="animate-spin" /> Aguardando Leitura
                   </div>
                   <NeonButton onClick={() => setQrCodeModal({ ...qrCodeModal, isOpen: false })} className="w-full !rounded-2xl !py-4">
                      Fechar Janela
                   </NeonButton>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {activeTab === 'atendimento' ? (
          <div className="flex h-full w-full overflow-hidden">
            {/* COLUNA 1: LEADS DO WHATSAPP */}
            <div className="w-[360px] border-r border-white/5 flex flex-col bg-black/30 backdrop-blur-xl">
              <div className="p-5 space-y-4 border-b border-white/5">
                <div className="flex items-center justify-between">
                   <h3 className="text-[10px] font-black uppercase tracking-widest italic text-orange-500">Chats Ativos no Cluster</h3>
                   <button onClick={() => fetchChatsFromInstance(selectedInstanceName)} className="p-2 glass rounded-lg hover:text-orange-500 transition-all">
                      <RefreshCw size={14} className={isLoadingChats ? 'animate-spin' : ''} />
                   </button>
                </div>
                <select 
                   value={selectedInstanceName} 
                   onChange={e => setSelectedInstanceName(e.target.value)} 
                   className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-3 px-4 text-[10px] font-black uppercase outline-none focus:border-orange-500/40"
                >
                  <option value="">Escolher Canal Conectado...</option>
                  {instances.map(i => (
                    <option key={i.id} value={i.name} disabled={i.status !== 'CONNECTED'}>
                      {i.status === 'CONNECTED' ? '🟢' : '🔴'} {i.name.replace(`${userPrefix}_`, '')}
                    </option>
                  ))}
                </select>
                <div className="relative">
                   <Search size={14} className="absolute left-4 top-3.5 text-gray-600" />
                   <input 
                     value={searchTerm} 
                     onChange={e => setSearchTerm(e.target.value)} 
                     placeholder="Buscar contato..." 
                     className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-3 px-10 text-[10px] uppercase font-bold outline-none" 
                   />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
                {isLoadingChats ? (
                   <div className="text-center py-20 opacity-30 flex flex-col items-center gap-4">
                      <Loader2 className="animate-spin text-orange-500" />
                      <span className="text-[10px] font-black uppercase tracking-widest italic">Pulsando Sinal Neural...</span>
                   </div>
                ) : tickets.length === 0 ? (
                   <div className="text-center py-20 opacity-20 text-[10px] font-bold uppercase italic">Nenhum chat detectado neste canal.</div>
                ) : (
                  tickets.filter(t => t.contactName.toLowerCase().includes(searchTerm.toLowerCase())).map(t => (
                    <div 
                      key={t.id} 
                      onClick={() => { setSelectedTicket(t); fetchMessagesForTicket(t); }} 
                      className={`p-4 rounded-2xl cursor-pointer transition-all border ${selectedTicket?.id === t.id ? 'bg-orange-600/10 border-orange-500/20 shadow-xl' : 'bg-transparent border-transparent hover:bg-white/[0.02]'}`}
                    >
                      <div className="flex gap-4">
                        <img src={t.avatar} className="w-12 h-12 rounded-2xl border border-white/10 shadow-lg" />
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start">
                             <h4 className="text-[11px] font-black uppercase truncate italic text-white">{t.contactName}</h4>
                          </div>
                          <p className="text-[9px] text-gray-500 truncate mt-1 leading-none italic">"{t.lastMessage}"</p>
                        </div>
                        {t.unreadCount > 0 && (
                           <div className="w-5 h-5 bg-orange-600 rounded-lg flex items-center justify-center text-[8px] font-black">{t.unreadCount}</div>
                        )}
                      </div>
                    </div>
                  ))
                )}
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
                          <span className="text-[8px] text-orange-500 font-black uppercase tracking-[0.3em] italic">Pareamento em Tempo Real</span>
                       </div>
                    </div>
                    <div className="flex items-center gap-3">
                       <GlassButton onClick={() => fetchMessagesForTicket(selectedTicket)} className="!px-6 !py-2.5 !text-[9px]">
                          {isLoadingMessages ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16}/>}
                       </GlassButton>
                       <NeonButton className="!px-6 !py-2.5 !text-[9px] !rounded-xl shadow-lg">Arquivar</NeonButton>
                    </div>
                  </header>

                  <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar" style={{ backgroundImage: `url('https://qonrpzlkjhdmswjfxvtu.supabase.co/storage/v1/object/public/WayIAFlow/whatsapp-bg.png')`, backgroundSize: '400px', backgroundRepeat: 'repeat', opacity: 0.9 }}>
                    {selectedTicket.messages.map((m, i) => (
                      <div key={i} className={`flex ${m.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] p-4 rounded-2xl shadow-2xl backdrop-blur-md relative ${m.sender === 'me' ? 'bg-orange-600/90 text-white rounded-tr-none' : 'bg-white/5 text-gray-200 border border-white/5 rounded-tl-none'}`}>
                          <p className="text-[12px] font-medium leading-relaxed">{m.text}</p>
                          <div className={`text-[8px] mt-2 opacity-50 flex items-center gap-1.5 ${m.sender === 'me' ? 'justify-end' : ''}`}>
                             {m.time} {m.sender === 'me' && <CheckCircle2 size={10} className="text-blue-400" />}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>

                  <div className="p-5 border-t border-white/5 bg-black/60 backdrop-blur-2xl">
                    <div className="flex gap-4 bg-white/[0.03] border border-white/10 rounded-2xl p-2 px-5 focus-within:border-orange-500/40 transition-all">
                       <input 
                         value={messageInput} 
                         onChange={e => setMessageInput(e.target.value)} 
                         onKeyPress={e => e.key === 'Enter' && handleSendMessage()} 
                         placeholder="Escreva sua resposta..." 
                         className="flex-1 bg-transparent border-none outline-none text-[12px] font-bold py-3 text-white" 
                       />
                       <button onClick={handleSendMessage} disabled={!messageInput.trim()} className="bg-orange-600 text-black p-3 rounded-xl hover:scale-110 active:scale-95 transition-all shadow-xl disabled:opacity-50">
                         <Send size={20} />
                       </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center opacity-10">
                   <MessageCircle size={100} className="mb-8 text-orange-500" />
                   <h2 className="text-3xl font-black uppercase italic tracking-tighter">Cluster de Atendimento CRM</h2>
                   <p className="text-[10px] font-black uppercase tracking-[0.5em] mt-4 italic">Selecione um canal e um chat para iniciar</p>
                </div>
              )}
            </div>

            {/* COLUNA 3: INFO */}
            <div className="w-[320px] border-l border-white/5 bg-black/40 p-8 space-y-8 backdrop-blur-2xl overflow-y-auto custom-scrollbar">
               <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-600 italic">Análise de Perfil</h3>
               <div className="text-center space-y-4">
                  <img src={selectedTicket?.avatar || `https://ui-avatars.com/api/?background=111&color=555`} className="w-32 h-32 rounded-[2.5rem] border-2 border-orange-500/20 mx-auto shadow-2xl object-cover" />
                  <div className="space-y-1">
                    <h3 className="text-xl font-black uppercase italic tracking-tighter text-white">{selectedTicket?.contactName || 'Aguardando Sinc'}</h3>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest italic">+{selectedTicket?.contactPhone || '00 00000-0000'}</p>
                  </div>
               </div>
               
               <div className="space-y-4 pt-8 border-t border-white/5">
                  <div className="flex items-center gap-3 text-[10px] font-black text-orange-500 uppercase italic">
                    <History size={16}/> Logs de Interação Neural
                  </div>
                  <GlassCard className="!p-4 space-y-3 !bg-white/[0.01]">
                    <div className="flex justify-between items-center text-[9px]">
                       <span className="text-gray-600 uppercase font-black">Status do Lead</span>
                       <span className="text-green-500 font-black italic uppercase">Engajado</span>
                    </div>
                    <div className="flex justify-between items-center text-[9px]">
                       <span className="text-gray-600 uppercase font-black">Canal de Origem</span>
                       <span className="text-white font-black truncate max-w-[120px]">{selectedInstanceName.replace(`${userPrefix}_`, '')}</span>
                    </div>
                    <div className="flex justify-between items-center text-[9px]">
                       <span className="text-gray-600 uppercase font-black">Protocolo Ativo</span>
                       <span className="text-orange-500 font-black italic">#{selectedTicket?.protocol || '---'}</span>
                    </div>
                  </GlassCard>
               </div>
            </div>
          </div>
        ) : activeTab === 'evolution' ? (
          <div className="flex-1 p-10 lg:p-16 overflow-y-auto custom-scrollbar bg-[#050505]">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-16 gap-8">
               <div className="space-y-3">
                  <SignalHigh size={24} className="text-orange-500" />
                  <h2 className="text-5xl md:text-7xl font-black uppercase italic tracking-tighter leading-none">Minha <span className="text-orange-500">Frota.</span></h2>
                  <p className="text-[11px] text-gray-600 font-bold uppercase tracking-widest italic max-w-lg leading-relaxed">
                    Instale novos canais, gerencie o pareamento de sinal e monitore a integridade da sua frota de atendimento Evolution.
                  </p>
               </div>
               <div className="flex gap-4 w-full md:w-auto">
                  <GlassButton onClick={fetchInstances} className="!px-8 !py-5 flex items-center gap-3 !rounded-2xl transition-all hover:!text-orange-500">
                    <RefreshCw size={18} /> Sincronizar Canais
                  </GlassButton>
                  <NeonButton onClick={createInstance} disabled={isCreatingInstance} className="!px-10 !py-5 !rounded-2xl flex-1 md:flex-none">
                    {isCreatingInstance ? <Loader2 size={18} className="animate-spin" /> : <><Plus size={20} className="mr-3"/> Instalar Novo Canal</>}
                  </NeonButton>
               </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-10">
               {instances.length === 0 ? (
                 <div className="col-span-full py-40 text-center opacity-20 border-2 border-dashed border-white/5 rounded-[4rem] flex flex-col items-center justify-center space-y-6">
                    <Smartphone size={80} className="text-gray-500" />
                    <p className="text-3xl font-black uppercase italic tracking-tighter">Nenhum canal instalado no cluster</p>
                 </div>
               ) : (
                 instances.map(inst => (
                   <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} key={inst.id}>
                     <GlassCard className="!p-0 h-full flex flex-col relative group rounded-[3rem] bg-white/[0.01] hover:border-orange-500/40 transition-all duration-700">
                        <div className="p-10 flex-1 space-y-10">
                           <div className="flex justify-between items-start">
                              <div className={`p-6 rounded-[2rem] transition-all duration-700 ${inst.status === 'CONNECTED' ? 'bg-green-500/10 text-green-500 shadow-[0_0_40px_rgba(34,197,94,0.1)]' : 'bg-red-500/10 text-red-500'}`}>
                                 <Cpu size={32} />
                              </div>
                              <button onClick={() => deleteInstance(inst.name)} className="p-4 text-gray-700 hover:text-red-500 hover:bg-red-500/10 rounded-2xl transition-all">
                                 <Trash2 size={22}/>
                              </button>
                           </div>

                           <div className="space-y-2">
                              <h3 className="text-3xl font-black uppercase italic tracking-tighter truncate text-white">{inst.name.replace(`${userPrefix}_`, '')}</h3>
                              <div className="flex items-center gap-2 text-[11px] text-gray-500 font-black uppercase tracking-widest italic">
                                 <Globe size={14} className="text-orange-500/60" />
                                 {inst.phone === 'Aguardando Link' ? 'SEM TELEFONE VINCULADO' : `+${inst.phone}`}
                              </div>
                           </div>

                           <div className="grid grid-cols-2 gap-5">
                              <div className="bg-white/[0.03] border border-white/5 p-5 rounded-3xl space-y-2">
                                 <div className="text-[9px] font-black text-gray-600 uppercase tracking-widest">Leads Sync</div>
                                 <div className="text-3xl font-black italic text-white">{instanceLeadsCount[inst.name] || 0}</div>
                              </div>
                              <div className="bg-white/[0.03] border border-white/5 p-5 rounded-3xl space-y-2">
                                 <div className="text-[9px] font-black text-gray-600 uppercase tracking-widest">Latência</div>
                                 <div className={`text-3xl font-black italic ${inst.status === 'CONNECTED' ? 'text-green-500' : 'text-red-500'}`}>{inst.status === 'CONNECTED' ? '12ms' : '0ms'}</div>
                              </div>
                           </div>
                        </div>

                        <div className="p-8 border-t border-white/5 bg-black/40 flex items-center justify-between">
                           <div className="flex items-center gap-3">
                              <div className={`w-3 h-3 rounded-full ${inst.status === 'CONNECTED' ? 'bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.6)] animate-pulse' : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.4)]'}`} />
                              <span className={`text-[10px] font-black uppercase tracking-widest italic ${inst.status === 'CONNECTED' ? 'text-green-500' : 'text-red-500'}`}>{inst.status}</span>
                           </div>
                           <NeonButton onClick={() => connectInstance(inst.name)} className="!px-8 !py-3 !text-[10px] !rounded-2xl">
                              <QrCode size={14} className="mr-2" /> {inst.status === 'CONNECTED' ? 'Refazer Pareamento' : 'Parear Chip'}
                           </NeonButton>
                        </div>
                     </GlassCard>
                   </motion.div>
                 ))
               )}
            </div>
          </div>
        ) : activeTab === ('n8n' as any) ? (
          <div className="flex-1 p-10 flex flex-col h-full bg-black">
             <header className="mb-8 flex justify-between items-center">
                <h2 className="text-3xl font-black uppercase italic tracking-tighter flex items-center gap-4">
                   <TerminalIcon className="text-orange-500" /> Terminal de <span className="text-orange-500">Sinais</span>
                </h2>
             </header>
             <div className="flex-1 bg-black/60 border border-white/5 rounded-[2.5rem] p-10 font-mono text-[11px] overflow-y-auto custom-scrollbar shadow-inner">
                {systemLogs.length === 0 ? (
                  <div className="text-gray-800 italic uppercase font-black">Escaneando tráfego de rede...</div>
                ) : systemLogs.map((log, i) => (
                  <div key={i} className={`mb-3 flex gap-6 p-2 rounded-lg transition-colors hover:bg-white/[0.02] ${log.type === 'error' ? 'text-red-500' : log.type === 'success' ? 'text-green-500' : 'text-blue-400'}`}>
                    <span className="opacity-30">[{log.time}]</span>
                    <span className="font-black uppercase w-20">[{log.type}]</span>
                    <span>{log.msg}</span>
                  </div>
                ))}
             </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center opacity-10">
             <Brain size={80} className="mb-6 text-orange-500" />
             <h2 className="text-3xl font-black uppercase italic tracking-tighter">Módulo em Integração</h2>
          </div>
        )}
      </main>
    </div>
  );
}
