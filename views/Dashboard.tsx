
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageSquare, LogOut, Plus, Loader2, RefreshCw, 
  Trash2, X, Layers, Search, Send, CheckCircle2, 
  Smartphone, ShieldCheck, ChevronLeft, Bot, Zap, 
  Activity, User, Smile, Mic, ArrowRight,
  Database, QrCode, LayoutDashboard, Power,
  Paperclip, MoreVertical, Phone, Video
} from 'lucide-react';
import { UserSession, DashboardTab, EvolutionInstance, Ticket, Message, KanbanColumn } from '../types';
import { GlassCard } from '../components/GlassCard';
import { NeonButton } from '../components/Buttons';
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
  const [activeTab, setActiveTab] = useState<DashboardTab>('atendimento');
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [instances, setInstances] = useState<EvolutionInstance[]>([]);
  const [newInstanceName, setNewInstanceName] = useState('');
  const [isCreatingInstance, setIsCreatingInstance] = useState(false);
  
  // Chat States
  const [contacts, setContacts] = useState<any[]>([]);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [isFetchingMessages, setIsFetchingMessages] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [qrModal, setQrModal] = useState({ 
    isOpen: false, 
    code: '', 
    name: '', 
    status: '', 
    connected: false,
    timestamp: 0,
    isResetting: false
  });

  const poolingRef = useRef<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (chatMessages.length) scrollToBottom();
  }, [chatMessages]);

  const fetchInstances = async () => {
    try {
      const res = await fetch(`${EVOLUTION_URL}/instance/fetchInstances`, { headers: HEADERS });
      const data = await res.json();
      const raw = Array.isArray(data) ? data : (data.instances || []);
      const mapped: EvolutionInstance[] = raw.map((i: any) => {
        const instData = i.instance || i;
        const name = instData.instanceName || instData.name || instData.id;
        return {
          id: instData.id || instData.instanceId || name,
          name: name,
          status: (instData.status === 'open' || instData.connectionStatus === 'open') ? 'CONNECTED' : 'DISCONNECTED',
          phone: instData.ownerJid ? instData.ownerJid.split('@')[0] : 'Motor Standby',
          profilePicUrl: instData.profilePicUrl || ""
        };
      });
      setInstances(mapped);
      
      // Se estamos na aba de atendimento, busca contatos do primeiro motor conectado
      if (activeTab === 'atendimento' && mapped.length > 0) {
        const connected = mapped.find(i => i.status === 'CONNECTED');
        if (connected) fetchContacts(connected.name);
      }

      if (qrModal.isOpen && !qrModal.connected) {
        const current = mapped.find(i => i.name === qrModal.name);
        if (current?.status === 'CONNECTED') {
          setQrModal(p => ({ ...p, connected: true, status: 'Motor Sincronizado!' }));
          if (poolingRef.current) clearInterval(poolingRef.current);
        }
      }
    } catch (e) {
      console.error('Falha crítica na busca de instâncias.');
    }
  };

  const fetchContacts = async (instanceName: string) => {
    try {
      const res = await fetch(`${EVOLUTION_URL}/chat/fetchContacts/${instanceName}`, { headers: HEADERS });
      const data = await res.json();
      setContacts(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Erro ao buscar contatos");
    }
  };

  const loadChat = async (contact: any) => {
    const connectedInst = instances.find(i => i.status === 'CONNECTED');
    if (!connectedInst) return;
    
    setSelectedContact(contact);
    setIsFetchingMessages(true);
    setChatMessages([]);

    try {
      const res = await fetch(`${EVOLUTION_URL}/chat/fetchMessages/${connectedInst.name}`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({
          remoteJid: contact.id || contact.remoteJid,
          page: 1
        })
      });
      const data = await res.json();
      setChatMessages(data.messages?.reverse() || []);
    } catch (e) {
      console.error("Erro ao carregar mensagens");
    } finally {
      setIsFetchingMessages(false);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!messageInput.trim() || !selectedContact) return;

    const connectedInst = instances.find(i => i.status === 'CONNECTED');
    if (!connectedInst) return;

    const newMessageText = messageInput;
    setMessageInput('');

    // Optimistic UI
    const tempMsg = {
      key: { id: Date.now().toString(), fromMe: true },
      message: { conversation: newMessageText },
      messageTimestamp: Math.floor(Date.now() / 1000)
    };
    setChatMessages(prev => [...prev, tempMsg]);

    try {
      await fetch(`${EVOLUTION_URL}/message/sendText/${connectedInst.name}`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({
          number: selectedContact.id || selectedContact.remoteJid,
          options: { delay: 1200, presence: "composing" },
          textMessage: { text: newMessageText }
        })
      });
    } catch (e) {
      console.error("Erro ao enviar mensagem");
    }
  };

  const pollQrCode = async (name: string) => {
    try {
      const res = await fetch(`${EVOLUTION_URL}/instance/connect/${name}`, { headers: HEADERS });
      const data = await res.json();

      if (!res.ok || data.message?.includes('invalid') || data.message?.includes('not found')) {
        setQrModal(p => ({ ...p, status: 'Recuperando Engine...', isResetting: true }));
        if (poolingRef.current) clearInterval(poolingRef.current);
        await createInstance(name, true); 
        return;
      }
      
      let qrBase64 = data.base64 || data.qrcode?.base64 || data.code?.base64 || data.qrcode || data.code;
      
      if (typeof qrBase64 === 'string' && qrBase64.length > 50) {
        setQrModal(p => ({ ...p, code: qrBase64, status: 'Pronto para Escanear', isResetting: false }));
      } else if (data.status === 'open' || data.instance?.status === 'open' || data.connectionStatus === 'open') {
        setQrModal(p => ({ ...p, connected: true, status: 'Engine Ativa!' }));
        if (poolingRef.current) clearInterval(poolingRef.current);
        fetchInstances();
      }
    } catch (e) {}
  };

  const createInstance = async (forcedName?: string, isRecovery = false) => {
    const nameToUse = forcedName || newInstanceName.trim();
    if (!nameToUse) return;
    setIsCreatingInstance(true);
    const sanitizedName = nameToUse.toLowerCase().replace(/[^a-z0-9]/g, '-');
    
    if (!isRecovery) {
      setQrModal({ isOpen: true, code: '', name: sanitizedName, status: 'Injetando no Cluster...', connected: false, timestamp: Date.now(), isResetting: false, retryCount: 0 });
    }

    try {
      await fetch(`${EVOLUTION_URL}/instance/logout/${sanitizedName}`, { method: 'DELETE', headers: HEADERS }).catch(() => {});
      await fetch(`${EVOLUTION_URL}/instance/delete/${sanitizedName}`, { method: 'DELETE', headers: HEADERS }).catch(() => {});
      
      await fetch(`${EVOLUTION_URL}/instance/create`, {
        method: 'POST', 
        headers: HEADERS, 
        body: JSON.stringify({ 
          instanceName: sanitizedName, 
          qrcode: true,
          integration: "WHATSAPP-BAILEYS",
          alwaysOnline: true
        })
      });

      setTimeout(() => {
        if (poolingRef.current) clearInterval(poolingRef.current);
        pollQrCode(sanitizedName);
        poolingRef.current = setInterval(() => pollQrCode(sanitizedName), 4500);
      }, isRecovery ? 3000 : 1500);
    } catch (e) {
      setQrModal(p => ({ ...p, status: 'Erro na Injeção' }));
    } finally {
      setIsCreatingInstance(false);
      fetchInstances();
    }
  };

  useEffect(() => {
    fetchInstances();
    const interval = setInterval(fetchInstances, 20000); 
    return () => {
      clearInterval(interval);
      if (poolingRef.current) clearInterval(poolingRef.current);
    };
  }, [activeTab]);

  const SidebarItem = ({ icon: Icon, label, badge, active, onClick }: any) => (
    <button onClick={onClick} className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all group ${active ? 'bg-orange-500/10 text-orange-500 border border-orange-500/20 shadow-lg shadow-orange-500/5' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}>
      <div className="flex items-center gap-3">
        <Icon size={16} className={active ? 'text-orange-500' : 'text-gray-500 group-hover:text-orange-500 transition-colors'} />
        {isSidebarExpanded && <span className="text-[10px] font-black uppercase tracking-[0.2em]">{label}</span>}
      </div>
      {isSidebarExpanded && badge > 0 && <span className="text-[8px] font-black text-white bg-orange-600 px-2 py-0.5 rounded-full">{badge}</span>}
    </button>
  );

  return (
    <div className="flex h-screen bg-[#050505] text-white overflow-hidden relative font-sans">
      <div className="fixed inset-0 grid-engine pointer-events-none opacity-5"></div>
      
      <aside className={`flex flex-col border-r border-white/5 bg-black/40 backdrop-blur-3xl transition-all duration-300 z-50 ${isSidebarExpanded ? 'w-56' : 'w-20'}`}>
        <div className="p-6 flex justify-center"><Logo size="sm" /></div>
        <div className="flex-1 px-4 py-6 space-y-2">
          <SidebarItem icon={LayoutDashboard} label="Overview" active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} />
          <SidebarItem icon={Smartphone} label="Motores" active={activeTab === 'integracoes'} onClick={() => setActiveTab('integracoes')} badge={instances.length} />
          <SidebarItem icon={Layers} label="Pipeline" active={activeTab === 'kanban'} onClick={() => setActiveTab('kanban')} />
          <SidebarItem icon={Bot} label="Agentes" active={activeTab === 'agentes'} onClick={() => setActiveTab('agentes')} />
          <SidebarItem icon={MessageSquare} label="Chats" active={activeTab === 'atendimento'} onClick={() => setActiveTab('atendimento')} />
        </div>
        <div className="p-4 border-t border-white/5">
          <button onClick={onLogout} className="w-full flex items-center gap-4 px-4 py-4 text-gray-600 hover:text-orange-500 transition-all group font-black uppercase text-[10px] tracking-[0.3em]">
            <LogOut size={16} className="group-hover:-translate-x-1 transition-transform" />
            {isSidebarExpanded && <span>Desconectar</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 bg-[#050505]/50 overflow-hidden">
        <header className="h-16 border-b border-white/5 bg-black/20 backdrop-blur-xl flex items-center justify-between px-8 shrink-0 z-40">
          <div className="flex items-center gap-6">
            <button onClick={() => setIsSidebarExpanded(!isSidebarExpanded)} className="p-2.5 glass rounded-xl text-orange-500 hover:scale-110 transition-transform"><ChevronLeft size={14} className={!isSidebarExpanded ? 'rotate-180' : ''} /></button>
            <div className="flex flex-col">
              <h2 className="text-[10px] font-black uppercase tracking-[0.6em] text-white/40 italic leading-none">Neural Cluster Control</h2>
              <span className="text-[8px] font-bold text-orange-500/50 uppercase tracking-widest mt-1">Sincronização Ativa: {instances.filter(i => i.status === 'CONNECTED').length} Ativos</span>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4 border-l border-white/5 pl-6">
               <div className="text-right hidden sm:block">
                  <div className="text-[10px] font-black uppercase text-white italic tracking-widest">{user.name}</div>
                  <div className="text-[8px] font-bold text-orange-500/50 uppercase tracking-tighter">Cluster Administrator</div>
               </div>
               <div className="w-10 h-10 rounded-xl bg-rajado p-0.5 shadow-xl shadow-orange-500/10">
                  <div className="w-full h-full bg-black rounded-[9px] flex items-center justify-center text-[12px] font-black italic">{user.name?.[0]}</div>
               </div>
            </div>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
           {activeTab === 'integracoes' && (
             <div className="flex-1 overflow-auto p-8 md:p-12 custom-scrollbar">
                <div className="max-w-6xl mx-auto space-y-12 animate-in fade-in duration-1000">
                  <div className="flex flex-col md:flex-row justify-between items-end gap-6 border-b border-white/5 pb-10">
                    <div className="space-y-2">
                      <h1 className="text-5xl font-black uppercase italic tracking-tighter leading-none">Neural <span className="text-orange-500">Engines.</span></h1>
                      <p className="text-[10px] font-black uppercase tracking-[0.5em] text-gray-700 italic">Ativação de clusters de processamento WhatsApp</p>
                    </div>
                    <div className="flex gap-4 w-full md:w-auto">
                      <input value={newInstanceName} onChange={e => setNewInstanceName(e.target.value)} onKeyDown={e => e.key === 'Enter' && createInstance()} placeholder="ID do Motor..." className="flex-1 md:w-64 bg-white/[0.03] border border-white/5 rounded-xl py-4 px-6 text-[11px] font-black uppercase outline-none focus:border-orange-500/40 transition-all" />
                      <NeonButton onClick={() => createInstance()} className="!px-8 !text-[11px] !py-4">{isCreatingInstance ? <Loader2 className="animate-spin" size={16}/> : 'Ativar Cluster'}</NeonButton>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                     {instances.map(inst => (
                       <GlassCard key={inst.id} className="!p-8 group relative overflow-hidden shadow-xl border-white/5 hover:border-orange-500/20">
                          <div className="flex flex-col gap-8 relative z-10">
                             <div className="flex items-center gap-6">
                                <div className="relative">
                                   <div className="w-14 h-14 rounded-2xl bg-black border border-white/10 flex items-center justify-center overflow-hidden shadow-2xl">
                                      {inst.profilePicUrl ? <img src={inst.profilePicUrl} className="w-full h-full object-cover" /> : <Smartphone size={24} className="text-gray-800" />}
                                   </div>
                                   <div className={`absolute -bottom-1.5 -right-1.5 w-4 h-4 rounded-full border-[3px] border-[#050505] ${inst.status === 'CONNECTED' ? 'bg-green-500' : 'bg-red-500'}`} />
                                </div>
                                <div className="flex-1 overflow-hidden">
                                   <div className="text-xl font-black uppercase italic tracking-tighter text-white truncate leading-none mb-1.5">{inst.name}</div>
                                   <div className="text-[9px] font-black text-gray-700 uppercase tracking-[0.2em]">{inst.phone || 'Standby'}</div>
                                </div>
                             </div>
                             <div className="flex gap-3">
                                {inst.status === 'DISCONNECTED' ? (
                                  <NeonButton onClick={() => createInstance(inst.name)} className="flex-1 !py-3 !text-[10px] !rounded-xl">Sincronizar</NeonButton>
                                ) : (
                                  <div className="flex-1 py-3 border border-green-500/10 rounded-xl text-green-500 text-[10px] font-black uppercase text-center bg-green-500/5">Operacional</div>
                                )}
                                <button onClick={() => createInstance(inst.name)} className="p-3 rounded-xl bg-white/[0.02] text-gray-600 hover:text-orange-500 border border-white/5 transition-all"><Power size={16}/></button>
                                <button onClick={() => { if(confirm('Remover motor?')) fetch(`${EVOLUTION_URL}/instance/delete/${inst.name}`, {method:'DELETE', headers:HEADERS}).then(()=>fetchInstances()) }} className="p-3 rounded-xl bg-red-600/5 text-red-500/40 hover:bg-red-600 hover:text-white border border-red-500/10 transition-all"><Trash2 size={16}/></button>
                             </div>
                          </div>
                       </GlassCard>
                     ))}
                  </div>
                </div>
             </div>
           )}

           {activeTab === 'atendimento' && (
             <div className="flex-1 flex overflow-hidden bg-black/40 backdrop-blur-3xl animate-in fade-in slide-in-from-bottom-4 duration-700">
                {/* Contatos */}
                <div className="w-80 md:w-96 border-r border-white/5 flex flex-col bg-black/20">
                   <div className="p-6 border-b border-white/5 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xl font-black uppercase italic tracking-tighter italic">Neural <span className="text-orange-500">Inbox.</span></h3>
                        <div className="p-1.5 glass rounded-lg text-orange-500/50 hover:text-orange-500 cursor-pointer" onClick={() => { const conn = instances.find(i=>i.status === 'CONNECTED'); if(conn) fetchContacts(conn.name); }}><RefreshCw size={12}/></div>
                      </div>
                      <div className="relative">
                         <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-700" size={14} />
                         <input 
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Buscar no Cluster..." 
                            className="w-full bg-white/[0.03] border border-white/5 rounded-xl py-3 pl-11 pr-4 text-[10px] font-black uppercase outline-none focus:border-orange-500/30 transition-all" 
                          />
                      </div>
                   </div>
                   <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
                      {contacts.filter(c => (c.name || c.id).toLowerCase().includes(searchQuery.toLowerCase())).map((contact, i) => (
                        <div 
                           key={i} 
                           onClick={() => loadChat(contact)}
                           className={`p-4 rounded-2xl flex items-center gap-4 cursor-pointer transition-all border ${selectedContact?.id === contact.id ? 'bg-orange-500/10 border-orange-500/30 shadow-[0_0_20px_rgba(255,115,0,0.05)]' : 'bg-transparent border-transparent hover:bg-white/[0.02]'}`}
                        >
                           <div className="relative">
                              <div className="w-12 h-12 rounded-xl bg-black border border-white/5 flex items-center justify-center overflow-hidden shrink-0">
                                 {contact.profilePictureUrl ? <img src={contact.profilePictureUrl} className="w-full h-full object-cover" /> : <User size={20} className="text-gray-800" />}
                              </div>
                              <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[#050505] ${i % 3 === 0 ? 'bg-green-500' : 'bg-gray-800'}`} />
                           </div>
                           <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-start mb-0.5">
                                 <span className="text-[11px] font-black uppercase text-white truncate italic">{contact.name || contact.id.split('@')[0]}</span>
                                 <span className="text-[8px] font-bold text-gray-700 shrink-0">14:20</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <p className="text-[9px] font-bold text-gray-600 truncate uppercase tracking-tighter">Handshake de dados ativo...</p>
                                {i === 0 && <div className="w-4 h-4 rounded-full bg-orange-500 flex items-center justify-center text-[8px] font-black">2</div>}
                              </div>
                           </div>
                        </div>
                      ))}
                      {contacts.length === 0 && (
                        <div className="py-20 text-center opacity-20 space-y-4">
                           <Bot size={32} className="mx-auto" />
                           <p className="text-[9px] font-black uppercase tracking-widest italic">Aguardando sinais do motor...</p>
                        </div>
                      )}
                   </div>
                </div>

                {/* Chat Principal */}
                <div className="flex-1 flex flex-col relative">
                   {selectedContact ? (
                     <>
                        <div className="h-20 border-b border-white/5 bg-black/20 flex items-center justify-between px-8 backdrop-blur-xl z-20">
                           <div className="flex items-center gap-5">
                              <div className="w-12 h-12 rounded-xl bg-black border border-white/10 flex items-center justify-center overflow-hidden">
                                 {selectedContact.profilePictureUrl ? <img src={selectedContact.profilePictureUrl} className="w-full h-full object-cover" /> : <User size={20} className="text-gray-700" />}
                              </div>
                              <div>
                                 <h4 className="text-lg font-black uppercase italic tracking-tighter text-white leading-none mb-1">{selectedContact.name || selectedContact.id}</h4>
                                 <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                    <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest italic">Em Sessão Ativa</span>
                                 </div>
                              </div>
                           </div>
                           <div className="flex items-center gap-4">
                              <button className="p-3 glass rounded-xl text-gray-500 hover:text-orange-500 transition-all"><Phone size={16}/></button>
                              <button className="p-3 glass rounded-xl text-gray-500 hover:text-orange-500 transition-all"><Video size={16}/></button>
                              <div className="h-8 w-px bg-white/5 mx-2" />
                              <button className="p-3 glass rounded-xl text-gray-500 hover:text-orange-500 transition-all"><MoreVertical size={16}/></button>
                           </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8 bg-[url('https://qonrpzlkjhdmswjfxvtu.supabase.co/storage/v1/object/public/WayIAFlow/grid.png')] bg-fixed opacity-95">
                           {isFetchingMessages ? (
                             <div className="h-full flex flex-col items-center justify-center gap-4 opacity-30">
                                <Loader2 className="animate-spin text-orange-500" size={32} />
                                <span className="text-[10px] font-black uppercase tracking-widest italic">Puxando histórico do cluster...</span>
                             </div>
                           ) : (
                             chatMessages.map((msg, i) => {
                               const fromMe = msg.key.fromMe;
                               const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";
                               if (!text) return null;
                               
                               return (
                                 <motion.div 
                                    initial={{ opacity: 0, x: fromMe ? 20 : -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    key={i} 
                                    className={`flex ${fromMe ? 'justify-end' : 'justify-start'}`}
                                 >
                                    <div className={`max-w-[70%] group`}>
                                       <div className={`p-5 rounded-[2rem] text-sm font-bold tracking-tight shadow-2xl relative ${fromMe ? 'bg-orange-500 text-white rounded-tr-none' : 'glass text-gray-200 rounded-tl-none border-white/10'}`}>
                                          {text}
                                          <div className={`absolute top-0 ${fromMe ? '-right-2 border-l-orange-500' : '-left-2 border-r-white/5'} border-8 border-transparent`} />
                                       </div>
                                       <div className={`flex items-center gap-2 mt-2 px-2 text-[8px] font-black uppercase text-gray-700 italic tracking-widest ${fromMe ? 'justify-end' : 'justify-start'}`}>
                                          {new Date(msg.messageTimestamp * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                          {fromMe && <CheckCircle2 size={10} className="text-orange-500" />}
                                       </div>
                                    </div>
                                 </motion.div>
                               );
                             })
                           )}
                           <div ref={chatEndRef} />
                        </div>

                        <div className="p-8 border-t border-white/5 bg-black/40 backdrop-blur-2xl">
                           <form onSubmit={handleSendMessage} className="flex items-center gap-6 max-w-5xl mx-auto">
                              <div className="flex items-center gap-3">
                                 <button type="button" className="p-4 glass rounded-2xl text-gray-600 hover:text-orange-500 transition-all"><Smile size={20}/></button>
                                 <button type="button" className="p-4 glass rounded-2xl text-gray-600 hover:text-orange-500 transition-all"><Paperclip size={20}/></button>
                              </div>
                              <div className="flex-1 relative">
                                 <input 
                                    value={messageInput}
                                    onChange={e => setMessageInput(e.target.value)}
                                    placeholder="Comando Neural..." 
                                    className="w-full bg-white/[0.04] border border-white/10 rounded-3xl py-5 px-8 text-sm font-bold outline-none focus:border-orange-500/50 transition-all shadow-inner shadow-black/50" 
                                 />
                                 <div className="absolute right-6 top-1/2 -translate-y-1/2 text-orange-500/20"><Bot size={18}/></div>
                              </div>
                              <div className="flex items-center gap-3">
                                 <button type="button" className="p-4 glass rounded-2xl text-gray-600 hover:text-orange-500 transition-all"><Mic size={20}/></button>
                                 <button type="submit" className="p-5 bg-orange-500 rounded-2xl text-white hover:scale-105 active:scale-95 transition-all shadow-xl shadow-orange-600/20"><Send size={24} fill="currentColor" /></button>
                              </div>
                           </form>
                        </div>
                     </>
                   ) : (
                     <div className="h-full flex flex-col items-center justify-center p-20 text-center space-y-10">
                        <div className="relative">
                          <div className="w-32 h-32 rounded-full border-2 border-orange-500/20 flex items-center justify-center animate-pulse">
                            <MessageSquare size={48} className="text-orange-500/30" />
                          </div>
                          <div className="absolute inset-0 bg-orange-500/10 blur-[60px] rounded-full" />
                        </div>
                        <div className="space-y-4 max-w-xs">
                           <h3 className="text-3xl font-black uppercase italic tracking-tighter">Handshake <span className="text-orange-500">Pendente.</span></h3>
                           <p className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-700 italic leading-relaxed">Selecione um terminal de contato para iniciar a transmissão neural de dados.</p>
                        </div>
                        <div className="flex gap-4">
                           {instances.filter(i=>i.status === 'CONNECTED').map(i => (
                             <div key={i.id} className="px-6 py-2 glass rounded-full flex items-center gap-3 border-orange-500/20">
                                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                                <span className="text-[9px] font-black uppercase tracking-widest">{i.name}</span>
                             </div>
                           ))}
                        </div>
                     </div>
                   )}
                </div>
             </div>
           )}
        </div>
      </main>

      {/* Modal QR Sync */}
      <AnimatePresence>
        {qrModal.isOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/98 backdrop-blur-3xl">
            <div key={qrModal.timestamp} className="bg-[#050505] border border-orange-500/30 p-12 rounded-[3rem] text-center max-w-sm w-full relative shadow-[0_0_120px_rgba(255,115,0,0.2)] animate-in zoom-in-95 duration-500">
              <button onClick={() => { setQrModal(p => ({ ...p, isOpen: false })); if(poolingRef.current) clearInterval(poolingRef.current); }} className="absolute top-10 right-10 text-gray-800 hover:text-white p-2.5 hover:bg-white/5 rounded-full transition-all"><X size={28}/></button>
              <div className="mb-10 space-y-2">
                <h3 className="text-3xl font-black uppercase italic tracking-tighter text-white leading-none">{qrModal.name}</h3>
                <div className="flex items-center justify-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${qrModal.isResetting ? 'bg-red-500' : 'bg-orange-500'} animate-ping`} />
                  <p className={`text-[11px] font-black uppercase ${qrModal.isResetting ? 'text-red-500' : 'text-orange-500'} tracking-[0.5em] italic`}>{qrModal.status}</p>
                </div>
              </div>
              <div className="relative mb-10 flex justify-center">
                 <div className="bg-white p-8 rounded-[2.5rem] flex items-center justify-center min-h-[300px] min-w-[300px] border-[10px] border-white/5 overflow-hidden shadow-2xl">
                    {qrModal.code ? (
                      <motion.img initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} src={qrModal.code.startsWith('data:') ? qrModal.code : `data:image/png;base64,${qrModal.code}`} className="w-full h-auto block rounded-xl" />
                    ) : (
                      <div className="flex flex-col items-center gap-8 p-10">
                        <Loader2 className={`animate-spin ${qrModal.isResetting ? 'text-red-500' : 'text-orange-500'}`} size={56} strokeWidth={3} />
                        <span className="text-[10px] font-black text-gray-900 uppercase tracking-widest italic block">Sincronizando Cluster...</span>
                      </div>
                    )}
                 </div>
                 {qrModal.connected && (
                   <div className="absolute inset-0 bg-black/95 backdrop-blur-3xl rounded-[2.5rem] flex flex-col items-center justify-center z-20 border border-green-500/30">
                      <CheckCircle2 size={64} className="text-green-500 mb-8" />
                      <h4 className="text-3xl font-black uppercase italic text-white mb-2 tracking-tighter">Sincronizado</h4>
                      <NeonButton onClick={() => setQrModal(p => ({ ...p, isOpen: false }))} className="!px-12 !py-5 !text-[12px]">Acessar Painel</NeonButton>
                   </div>
                 )}
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
