
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageSquare, LogOut, Plus, Loader2, RefreshCw, 
  Trash2, X, Layers, Search, Send, CheckCircle2, 
  Smartphone, ShieldCheck, ChevronLeft, Bot, Zap, 
  Activity, User, Smile, Mic, ArrowRight,
  Database, QrCode, LayoutDashboard, Power,
  Paperclip, MoreVertical, Phone, Video, Users, AlertTriangle,
  RotateCw, ChevronDown, Wifi, WifiOff, ShieldAlert, Eraser, Bomb, Terminal,
  Cpu, ActivitySquare, Binary
} from 'lucide-react';
import { UserSession, DashboardTab, EvolutionInstance } from '../types';
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

export function Dashboard({ user, onLogout }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<DashboardTab>('atendimento');
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [instances, setInstances] = useState<EvolutionInstance[]>([]);
  const [newInstanceName, setNewInstanceName] = useState('');
  const [isCreatingInstance, setIsCreatingInstance] = useState(false);
  
  const [selectedInstanceForChat, setSelectedInstanceForChat] = useState<EvolutionInstance | null>(null);
  const [contacts, setContacts] = useState<any[]>([]);
  const [isFetchingContacts, setIsFetchingContacts] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);
  const [isRestarting, setIsRestarting] = useState(false);
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

  const getHeaders = (instanceName?: string) => {
    const headers: any = { 
      'apikey': EVOLUTION_API_KEY, 
      'Content-Type': 'application/json'
    };
    if (instanceName) headers['instance'] = instanceName;
    return headers;
  };

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (chatMessages.length) scrollToBottom();
  }, [chatMessages]);

  const normalizeContact = (c: any) => {
    let rawId = c.id || c.remoteJid || c.jid || (c.key && c.key.remoteJid) || "";
    if (!rawId || typeof rawId !== 'string' || !rawId.includes('@')) return null;
    if (rawId.includes(':') || rawId.includes('@lid') || rawId.includes('@g.us') || rawId.includes('broadcast')) return null;

    const phone = rawId.split('@')[0].replace(/\D/g, '');
    if (!phone) return null;

    const pushName = c.pushName || c.pushname || c.verifiedName || c.contact?.pushName || "";
    const savedName = c.name || c.contact?.name || "";
    
    let finalName = "";
    if (pushName && !pushName.includes('@')) finalName = pushName;
    else if (savedName && !savedName.includes('@')) finalName = savedName;
    else finalName = `+${phone}`;

    const avatar = c.profilePictureUrl || c.profilePicUrl || c.imgUrl || c.profileUrl || c.contact?.profilePictureUrl || null;
    
    return {
      ...c,
      id: rawId,
      displayName: finalName,
      displayAvatar: (avatar && typeof avatar === 'string' && avatar.length > 10) ? avatar : null,
      phone: phone,
      lastMsg: c.message?.conversation || c.content || (c.message?.extendedTextMessage?.text) || ""
    };
  };

  const fetchInstances = async () => {
    try {
      const res = await fetch(`${EVOLUTION_URL}/instance/fetchInstances`, { headers: getHeaders() });
      const data = await res.json();
      const raw = Array.isArray(data) ? data : (data.instances || data.data || []);
      const mapped: EvolutionInstance[] = raw.map((i: any) => {
        const instData = i.instance || i;
        const name = (instData.instanceName || instData.name || instData.id || "").trim();
        return {
          id: instData.id || instData.instanceId || name,
          name: name,
          status: (instData.status === 'open' || instData.connectionStatus === 'open') ? 'CONNECTED' : 'DISCONNECTED',
          phone: instData.ownerJid ? instData.ownerJid.split('@')[0] : 'Standby',
          profilePicUrl: instData.profilePicUrl || ""
        };
      });
      setInstances(mapped);

      if (activeTab === 'atendimento' && !selectedInstanceForChat) {
        const wayia = mapped.find(i => i.name.toLowerCase() === 'wayia' && i.status === 'CONNECTED');
        if (wayia) setSelectedInstanceForChat(wayia);
        else {
          const firstConnected = mapped.find(i => i.status === 'CONNECTED');
          if (firstConnected) setSelectedInstanceForChat(firstConnected);
        }
      }
    } catch (e) {
      console.error('Falha crítica no Cluster.');
    }
  };

  const fetchContacts = async (instance: EvolutionInstance) => {
    if (isFetchingContacts || !instance) return;
    setIsFetchingContacts(true);
    setContactError(null);
    setIsIndexing(false);
    
    // Força o Indexer a trabalhar (Comando de Sincronização v5.0)
    await fetch(`${EVOLUTION_URL}/instance/setSettings/${instance.name}`, {
      method: 'POST',
      headers: getHeaders(instance.name),
      body: JSON.stringify({ syncFullHistory: true, readMessages: true, readStatus: true })
    }).catch(() => {});

    const targets = [instance.name, instance.id];
    let foundList = null;

    for (const target of targets) {
      try {
        const res = await fetch(`${EVOLUTION_URL}/contact/findMany?instanceName=${target}`, { 
          method: 'GET', 
          headers: getHeaders(target) 
        });
        
        if (res.ok) {
          const json = await res.json();
          const list = json.data || json.contacts || (Array.isArray(json) ? json : null);
          if (list && Array.isArray(list)) {
            if (list.length === 0) {
              setIsIndexing(true); // Servidor respondeu 200 mas lista vazia = INDEXANDO
            } else {
              const normalized = list.map(normalizeContact).filter((c: any) => c !== null);
              const unique = Array.from(new Map(normalized.map(item => [item.id, item])).values());
              setContacts(unique);
              foundList = list;
              break;
            }
          }
        }
      } catch (e) { continue; }
    }

    if (!foundList && !isIndexing) {
      setContactError(`O motor '${instance.name}' está Online, mas o banco de dados Baileys ainda não liberou o acesso aos contatos. Clique em "Forçar Sincronização".`);
    }
    
    setIsFetchingContacts(false);
  };

  const neuralReset = async (instance: EvolutionInstance) => {
    const confirmation = confirm(`🚨 RESET ATÔMICO v5.0 (Deep Clean):\n\nDeseja desintegrar o motor '${instance.name}'?\n\nEste comando limpa o banco de dados SQL e a sessão Redis. Use isso se o motor estiver travado mesmo após a limpeza no Portainer.`);
    if (!confirmation) return;
    
    setIsRestarting(true);
    setQrModal({ isOpen: true, name: instance.name, code: '', status: 'Purgando Registros SQL...', connected: false, timestamp: Date.now(), isResetting: true });

    try {
      // Limpa Tudo
      const targets = [instance.name, instance.id];
      for (const t of targets) {
        await fetch(`${EVOLUTION_URL}/instance/logout/${t}`, { method: 'DELETE', headers: getHeaders() }).catch(() => {});
        await fetch(`${EVOLUTION_URL}/instance/delete/${t}`, { method: 'DELETE', headers: getHeaders() }).catch(() => {});
      }
      setContacts([]);
      setSelectedContact(null);
      await new Promise(r => setTimeout(r, 4000));
      createInstance(instance.name);
    } catch (e) {
      setQrModal(p => ({ ...p, status: 'Erro no Deep Clean' }));
    } finally {
      setIsRestarting(false);
    }
  };

  const createInstance = async (name?: string) => {
    const instanceName = name || newInstanceName;
    if (!instanceName.trim()) return;
    setIsCreatingInstance(true);
    const sanitizedName = instanceName.replace(/[^a-zA-Z0-9-]/g, '');

    setQrModal({ isOpen: true, name: sanitizedName, code: '', status: 'Injetando Parâmetros...', connected: false, timestamp: Date.now(), isResetting: false });

    try {
      await fetch(`${EVOLUTION_URL}/instance/create`, {
        method: 'POST', 
        headers: getHeaders(), 
        body: JSON.stringify({ instanceName: sanitizedName, qrcode: true, integration: "WHATSAPP-BAILEYS", alwaysOnline: true })
      });

      if (poolingRef.current) clearInterval(poolingRef.current);
      poolingRef.current = setInterval(async () => {
        try {
          const res = await fetch(`${EVOLUTION_URL}/instance/connect/${sanitizedName}`, { headers: getHeaders() });
          const data = await res.json();
          const code = data.base64 || data.qrcode?.base64 || data.code?.base64 || data.qrcode || data.code;
          if (code && typeof code === 'string' && code.length > 50) {
            setQrModal(p => ({ ...p, code, status: 'Escanear QR Code' }));
          } else if (data.status === 'open' || data.connectionStatus === 'open') {
            setQrModal(p => ({ ...p, connected: true, status: 'Motor Ativado!' }));
            clearInterval(poolingRef.current);
            fetchInstances();
          }
        } catch (e) {}
      }, 4500);
    } catch (e) {
      setQrModal(p => ({ ...p, status: 'Falha no Cluster' }));
    } finally {
      setIsCreatingInstance(false);
      fetchInstances();
      setNewInstanceName('');
    }
  };

  const restartInstance = async (instance: EvolutionInstance) => {
    setIsRestarting(true);
    try {
      await fetch(`${EVOLUTION_URL}/instance/restart/${instance.id}`, { method: 'POST', headers: getHeaders() });
      setTimeout(() => {
        if (selectedInstanceForChat?.id === instance.id) fetchContacts(instance);
        setIsRestarting(false);
        fetchInstances();
      }, 6000);
    } catch (e) { setIsRestarting(false); }
  };

  useEffect(() => {
    fetchInstances();
    const interval = setInterval(fetchInstances, 60000);
    return () => { clearInterval(interval); if (poolingRef.current) clearInterval(poolingRef.current); };
  }, []);

  useEffect(() => {
    if (activeTab === 'atendimento' && selectedInstanceForChat) {
      fetchContacts(selectedInstanceForChat);
    }
  }, [activeTab, selectedInstanceForChat]);

  const loadChat = async (contact: any) => {
    if (!selectedInstanceForChat) return;
    setSelectedContact(contact);
    setIsFetchingMessages(true);
    setChatMessages([]);
    try {
      const res = await fetch(`${EVOLUTION_URL}/chat/findMessages?instanceName=${selectedInstanceForChat.id}`, {
        method: 'POST',
        headers: getHeaders(selectedInstanceForChat.id),
        body: JSON.stringify({ remoteJid: contact.id, page: 1 })
      });
      if(res.ok) {
        const json = await res.json();
        const data = json.data || json.messages || json;
        if (Array.isArray(data)) setChatMessages([...data].reverse());
      }
    } catch(e) { } finally { setIsFetchingMessages(false); }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!messageInput.trim() || !selectedContact || !selectedInstanceForChat) return;
    const text = messageInput;
    setMessageInput('');
    setChatMessages(prev => [...prev, { key: { id: Date.now().toString(), fromMe: true }, message: { conversation: text }, messageTimestamp: Math.floor(Date.now() / 1000) }]);
    try {
      await fetch(`${EVOLUTION_URL}/message/sendText/${selectedInstanceForChat.id}`, {
        method: 'POST',
        headers: getHeaders(selectedInstanceForChat.id),
        body: JSON.stringify({ number: selectedContact.id, textMessage: { text } })
      });
    } catch (e) {}
  };

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
              <span className="text-[8px] font-bold text-orange-500/50 uppercase tracking-widest mt-1">Deep Sync v5.0</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
             <div className="text-right hidden sm:block">
                <div className="text-[10px] font-black uppercase text-white italic tracking-widest">{user.name}</div>
                <div className="text-[8px] font-bold text-orange-500/50 uppercase tracking-tighter italic">Admin Principal</div>
             </div>
             <div className="w-10 h-10 rounded-xl bg-rajado p-0.5 shadow-xl shadow-orange-500/10">
                <div className="w-full h-full bg-black rounded-[9px] flex items-center justify-center text-[12px] font-black italic">{user.name?.[0]}</div>
             </div>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
           {activeTab === 'integracoes' && (
             <div className="flex-1 overflow-auto p-8 md:p-12 custom-scrollbar">
                <div className="max-w-6xl mx-auto space-y-12">
                  <div className="flex flex-col md:flex-row justify-between items-end gap-6 border-b border-white/5 pb-10">
                    <div className="space-y-2">
                      <h1 className="text-5xl font-black uppercase italic tracking-tighter leading-none">Neural <span className="text-orange-500">Engines.</span></h1>
                      <p className="text-[10px] font-black uppercase tracking-[0.5em] text-gray-700 italic">Ativação de clusters de processamento</p>
                    </div>
                    <div className="flex gap-4 w-full md:w-auto">
                      <input value={newInstanceName} onChange={e => setNewInstanceName(e.target.value)} onKeyDown={e => e.key === 'Enter' && createInstance()} placeholder="ID do Motor..." className="flex-1 md:w-64 bg-white/[0.03] border border-white/5 rounded-xl py-4 px-6 text-[11px] font-black uppercase outline-none focus:border-orange-500/40 transition-all placeholder:text-gray-800" />
                      <NeonButton onClick={() => createInstance()} className="!px-8 !text-[11px] !py-4">{isCreatingInstance ? <Loader2 className="animate-spin" size={16}/> : 'Ativar Cluster'}</NeonButton>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                     {instances.map(inst => (
                       <GlassCard key={inst.id} className="!p-8 group relative overflow-hidden shadow-xl border-white/5 hover:border-orange-500/20 transition-all">
                          <div className="flex flex-col gap-8 relative z-10">
                             <div className="flex items-center gap-6">
                                <div className="relative">
                                   <div className="w-14 h-14 rounded-2xl bg-black border border-white/10 flex items-center justify-center overflow-hidden">
                                      {inst.profilePicUrl ? <img src={inst.profilePicUrl} className="w-full h-full object-cover" /> : <Smartphone size={24} className="text-gray-800" />}
                                   </div>
                                   <div className={`absolute -bottom-1.5 -right-1.5 w-4 h-4 rounded-full border-[3px] border-[#050505] ${inst.status === 'CONNECTED' ? 'bg-green-500' : 'bg-red-500'}`} />
                                </div>
                                <div className="flex-1 overflow-hidden">
                                   <div className="text-xl font-black uppercase italic tracking-tighter text-white truncate leading-none mb-1.5">{inst.name}</div>
                                   <div className="text-[9px] font-black text-gray-700 uppercase tracking-[0.2em] italic truncate">{inst.phone || 'Standby'}</div>
                                </div>
                             </div>
                             <div className="flex gap-3">
                                {inst.status === 'DISCONNECTED' ? (
                                  <NeonButton onClick={() => createInstance(inst.name)} className="flex-1 !py-3 !text-[10px] !rounded-xl">Sincronizar</NeonButton>
                                ) : (
                                  <div className="flex-1 py-3 border border-green-500/10 rounded-xl text-green-500 text-[10px] font-black uppercase text-center bg-green-500/5">Operacional</div>
                                )}
                                <button onClick={() => { restartInstance(inst) }} className={`p-3 rounded-xl bg-white/[0.02] text-gray-600 hover:text-orange-500 border border-white/5 transition-all ${isRestarting ? 'animate-spin opacity-50' : ''}`}><RotateCw size={16}/></button>
                                <button onClick={() => { neuralReset(inst) }} title="Atomic Reset v5.0" className="p-3 rounded-xl bg-orange-600/5 text-orange-500/40 hover:bg-orange-600 hover:text-white border border-orange-500/10 transition-all"><Bomb size={16}/></button>
                                <button onClick={() => { if(confirm('Remover motor?')) fetch(`${EVOLUTION_URL}/instance/delete/${inst.id}`, {method:'DELETE', headers:getHeaders()}).then(()=>fetchInstances()) }} className="p-3 rounded-xl bg-red-600/5 text-red-500/40 hover:bg-red-600 hover:text-white border border-red-500/10 transition-all"><Trash2 size={16}/></button>
                             </div>
                          </div>
                       </GlassCard>
                     ))}
                  </div>
                </div>
             </div>
           )}

           {activeTab === 'atendimento' && (
             <div className="flex-1 flex overflow-hidden bg-black/40 backdrop-blur-3xl">
                <div className="w-80 md:w-96 border-r border-white/5 flex flex-col bg-black/10">
                   <div className="p-6 border-b border-white/5 space-y-4">
                      <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xl font-black uppercase italic tracking-tighter text-white">Neural <span className="text-orange-500">Inbox.</span></h3>
                          <div className="flex gap-2">
                            <div 
                               title="Forçar Sincronização Baileys"
                               className="p-1.5 glass rounded-lg text-blue-500 cursor-pointer transition-all hover:scale-110" 
                               onClick={() => { if(selectedInstanceForChat) fetchContacts(selectedInstanceForChat); }}
                            >
                               <Binary size={14} className={isFetchingContacts ? 'animate-pulse' : ''} />
                            </div>
                            <div 
                               title="Recarregar"
                               className="p-1.5 glass rounded-lg text-orange-500 cursor-pointer transition-all hover:scale-110" 
                               onClick={() => { if(selectedInstanceForChat) fetchContacts(selectedInstanceForChat); }}
                            >
                               <RefreshCw size={14} className={isFetchingContacts ? 'animate-spin' : ''} />
                            </div>
                          </div>
                        </div>

                        <div className="relative group">
                          <div className={`absolute left-4 top-1/2 -translate-y-1/2 z-10 w-2 h-2 rounded-full ${selectedInstanceForChat?.status === 'CONNECTED' ? 'bg-green-500' : 'bg-red-500'}`} />
                          <select 
                            value={selectedInstanceForChat?.id || ""}
                            onChange={(e) => {
                              const inst = instances.find(i => i.id === e.target.value);
                              if (inst) setSelectedInstanceForChat(inst);
                            }}
                            className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-3 pl-10 pr-10 text-[10px] font-black uppercase tracking-widest outline-none appearance-none focus:border-orange-500/40 transition-all text-white/80 cursor-pointer"
                          >
                            <option value="" disabled className="bg-[#050505]">Selecionar Motor...</option>
                            {instances.map(inst => (
                              <option key={inst.id} value={inst.id} className="bg-[#050505]">
                                {inst.name.toUpperCase()} {inst.status === 'CONNECTED' ? '🟢' : '🔴'}
                              </option>
                            ))}
                          </select>
                          <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-orange-500 pointer-events-none transition-transform" />
                        </div>
                      </div>

                      <div className="relative">
                         <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-700" size={14} />
                         <input 
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Buscar na Agenda..." 
                            className="w-full bg-white/[0.03] border border-white/5 rounded-xl py-3 pl-11 pr-4 text-[10px] font-black uppercase outline-none focus:border-orange-500/30 transition-all placeholder:text-gray-800" 
                          />
                      </div>
                   </div>

                   <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1.5">
                      {!selectedInstanceForChat ? (
                        <div className="py-20 text-center px-6">
                           <Smartphone className="mx-auto mb-4 text-gray-800" size={32} />
                           <p className="text-[9px] font-black uppercase tracking-widest text-gray-600 italic">Selecione um motor operacional acima</p>
                        </div>
                      ) : isFetchingContacts || isIndexing ? (
                        <div className="py-20 text-center space-y-4">
                           <div className="relative inline-block">
                              <Loader2 className="animate-spin text-orange-500 mx-auto" size={32} strokeWidth={3} />
                              <Binary className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/20" size={12}/>
                           </div>
                           <div className="space-y-1">
                              <p className="text-[9px] font-black uppercase tracking-widest italic text-orange-500/50 animate-pulse">{isIndexing ? 'Indexando Agenda Baileys...' : 'Acessando Banco de Dados...'}</p>
                              {isIndexing && <p className="text-[7px] font-black uppercase tracking-widest text-gray-700 italic">O motor está Online. Aguarde a primeira leitura do celular.</p>}
                           </div>
                        </div>
                      ) : (
                        <>
                          {contactError && (
                            <div className="p-6 mx-3 mb-2 rounded-2xl bg-red-500/5 border border-red-500/10 text-center space-y-3">
                               <ShieldAlert className="mx-auto text-red-500/30" size={24}/>
                               <p className="text-[9px] font-black uppercase tracking-tighter text-red-500/60 italic">{contactError}</p>
                               <div className="flex gap-2 justify-center">
                                  <button onClick={() => fetchContacts(selectedInstanceForChat)} className="text-[8px] text-orange-500 font-black uppercase underline">Forçar Sync</button>
                                  <button onClick={() => neuralReset(selectedInstanceForChat)} className="text-[8px] text-red-500 font-black uppercase underline">Reset Deep</button>
                               </div>
                            </div>
                          )}
                          {contacts.filter(c => (c.displayName || "").toLowerCase().includes(searchQuery.toLowerCase())).map((contact, i) => (
                            <div 
                               key={contact.id || i} 
                               onClick={() => loadChat(contact)}
                               className={`p-4 rounded-2xl flex items-center gap-4 cursor-pointer transition-all border ${selectedContact?.id === contact.id ? 'bg-orange-500/10 border-orange-500/20 shadow-[0_0_25px_rgba(255,115,0,0.03)]' : 'bg-transparent border-transparent hover:bg-white/[0.02]'}`}
                            >
                               <div className="relative shrink-0">
                                  <div className="w-12 h-12 rounded-full bg-black border border-white/10 flex items-center justify-center overflow-hidden">
                                     {contact.displayAvatar ? <img src={contact.displayAvatar} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} /> : <div className="text-[14px] font-black italic text-gray-700">{(contact.displayName || "?")[0].toUpperCase()}</div>}
                                  </div>
                               </div>
                               <div className="flex-1 min-w-0">
                                  <span className="text-[11px] font-black uppercase text-white truncate italic block">{contact.displayName}</span>
                                  <p className="text-[9px] font-bold text-gray-700 truncate uppercase mt-0.5 leading-none">{contact.lastMsg || 'Transmissão Ativa'}</p>
                               </div>
                            </div>
                          ))}
                        </>
                      )}
                   </div>
                </div>

                <div className="flex-1 flex flex-col relative">
                   {selectedContact ? (
                     <>
                        <div className="h-20 border-b border-white/5 bg-black/20 flex items-center justify-between px-8 backdrop-blur-xl z-20">
                           <div className="flex items-center gap-5">
                              <div className="w-12 h-12 rounded-full bg-black border border-white/10 flex items-center justify-center overflow-hidden relative">
                                 {selectedContact.displayAvatar ? <img src={selectedContact.displayAvatar} className="w-full h-full object-cover" /> : <div className="text-[16px] font-black italic text-gray-700">{(selectedContact.displayName || "?")[0].toUpperCase()}</div>}
                              </div>
                              <div>
                                 <h4 className="text-lg font-black uppercase italic tracking-tighter text-white leading-none mb-1">{selectedContact.displayName}</h4>
                                 <span className="text-[9px] font-black text-gray-600 uppercase italic tracking-widest">Cluster: {selectedInstanceForChat?.name}</span>
                              </div>
                           </div>
                           <div className="flex items-center gap-4">
                              <button className="p-3 glass rounded-xl text-gray-500 hover:text-orange-500 transition-all"><Phone size={16}/></button>
                              <button className="p-3 glass rounded-xl text-gray-500 hover:text-orange-500 transition-all"><Video size={16}/></button>
                              <button className="p-3 glass rounded-xl text-gray-500 hover:text-orange-500 transition-all"><MoreVertical size={16}/></button>
                           </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8 bg-[url('https://qonrpzlkjhdmswjfxvtu.supabase.co/storage/v1/object/public/WayIAFlow/grid.png')] bg-fixed opacity-90">
                           {isFetchingMessages ? (
                             <div className="h-full flex flex-col items-center justify-center gap-4 opacity-30">
                                <Loader2 className="animate-spin text-orange-500" size={32} />
                                <span className="text-[10px] font-black uppercase tracking-widest italic">Lendo Frequência...</span>
                             </div>
                           ) : (
                             chatMessages.map((msg: any, i) => (
                               <motion.div initial={{ opacity: 0, x: msg.key?.fromMe ? 20 : -20 }} animate={{ opacity: 1, x: 0 }} key={msg.key?.id || i} className={`flex ${msg.key?.fromMe ? 'justify-end' : 'justify-start'}`}>
                                  <div className={`p-5 rounded-[2rem] text-sm font-bold shadow-2xl max-w-[70%] ${msg.key?.fromMe ? 'bg-orange-500 text-white rounded-tr-none' : 'glass text-gray-200 rounded-tl-none border-white/10'}`}>
                                     {msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.content || ""}
                                  </div>
                               </motion.div>
                             ))
                           )}
                           <div ref={chatEndRef} />
                        </div>

                        <div className="p-8 border-t border-white/5 bg-black/40 backdrop-blur-2xl">
                           <form onSubmit={handleSendMessage} className="flex items-center gap-6 max-w-5xl mx-auto">
                              <input value={messageInput} onChange={e => setMessageInput(e.target.value)} placeholder="Neural Handshake v5.0 Ativo..." className="w-full bg-white/[0.04] border border-white/10 rounded-3xl py-5 px-8 text-sm font-bold outline-none focus:border-orange-500/50 transition-all shadow-inner shadow-black/30" />
                              <button type="submit" className="p-5 bg-orange-500 rounded-2xl text-white hover:scale-105 transition-all shadow-xl shadow-orange-600/30"><Send size={24} fill="currentColor" /></button>
                           </form>
                        </div>
                     </>
                   ) : (
                     <div className="h-full flex flex-col items-center justify-center p-20 text-center space-y-10">
                        <div className="w-32 h-32 rounded-full border-2 border-orange-500/20 flex items-center justify-center animate-pulse"><MessageSquare size={48} className="text-orange-500/30" /></div>
                        <h3 className="text-3xl font-black uppercase italic tracking-tighter">Terminal <span className="text-orange-500">Standby.</span></h3>
                     </div>
                   )}
                </div>
             </div>
           )}
        </div>
      </main>

      <AnimatePresence>
        {qrModal.isOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/98 backdrop-blur-3xl">
            <div key={qrModal.timestamp} className="bg-[#050505] border border-orange-500/30 p-12 rounded-[3rem] text-center max-w-sm w-full relative">
              <button onClick={() => { setQrModal(p => ({ ...p, isOpen: false })); if(poolingRef.current) clearInterval(poolingRef.current); }} className="absolute top-10 right-10 text-gray-800 hover:text-white transition-all"><X size={28}/></button>
              <h3 className="text-3xl font-black uppercase italic text-white mb-10">{qrModal.name}</h3>
              <div className="relative mb-10 flex justify-center">
                 <div className="bg-white p-8 rounded-[2.5rem] flex items-center justify-center min-h-[300px] min-w-[300px] border-[10px] border-white/5 shadow-[0_0_80px_rgba(255,255,255,0.05)]">
                    {qrModal.code ? <img src={qrModal.code.startsWith('data:') ? qrModal.code : `data:image/png;base64,${qrModal.code}`} className="w-full h-auto rounded-xl" /> : <div className="flex flex-col items-center gap-4"><Loader2 className="animate-spin text-orange-500" size={56}/><span className="text-[10px] font-black uppercase text-gray-900">Gerando Handshake...</span></div>}
                 </div>
                 {qrModal.connected && <div className="absolute inset-0 bg-black/95 rounded-[2.5rem] flex flex-col items-center justify-center border border-green-500/30 text-white"><CheckCircle2 size={64} className="text-green-500 mb-4 shadow-[0_0_30px_rgba(34,197,94,0.3)]"/><h4 className="text-2xl font-black">Conectado</h4><NeonButton className="mt-4" onClick={() => setQrModal(p => ({ ...p, isOpen: false }))}>Acessar</NeonButton></div>}
              </div>
              <p className="text-[11px] font-black uppercase tracking-[0.5em] italic text-orange-500">{qrModal.status}</p>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
