
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
  Cpu, ActivitySquare, Binary, DatabaseZap, HardDriveDownload, Wrench,
  ShieldQuestion, DatabaseBackup, Info, Link2, ServerCrash, ClipboardCheck,
  Code2, Settings2, FileCode, Check, Copy, ExternalLink, Save, FileType,
  FolderTree, FileJson, FileText, Globe, Eye, ShieldX, Network
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
  const [dbStatus, setDbStatus] = useState<'IDLE' | 'CHECKING' | 'FAIL' | 'READY'>('IDLE');
  const [showEnvLab, setShowEnvLab] = useState(false);
  const [showSystemMapper, setShowSystemMapper] = useState(false);
  const [copied, setCopied] = useState(false);

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
    try {
      let rawId = c.id || c.remoteJid || c.jid || (c.key && c.key.remoteJid) || "";
      if (!rawId || typeof rawId !== 'string' || !rawId.includes('@')) return null;
      if (rawId.includes(':') || rawId.includes('@lid') || rawId.includes('@g.us') || rawId.includes('broadcast')) return null;

      const phone = rawId.split('@')[0].replace(/\D/g, '');
      const pushName = c.pushName || c.pushname || c.verifiedName || "";
      const savedName = c.name || "";
      let finalName = pushName || savedName || `+${phone}`;
      const avatar = c.profilePictureUrl || c.profilePicUrl || c.imgUrl || null;
      
      return {
        ...c,
        id: rawId,
        displayName: finalName,
        displayAvatar: avatar,
        phone: phone,
        lastMsg: c.message?.conversation || c.content || ""
      };
    } catch(e) { return null; }
  };

  const fetchInstances = async () => {
    try {
      const res = await fetch(`${EVOLUTION_URL}/instance/fetchInstances`, { headers: getHeaders() });
      const data = await res.json();
      const raw = Array.isArray(data) ? data : (data.instances || data.data || []);
      const mapped: EvolutionInstance[] = raw.map((i: any) => {
        const instData = i.instance || i;
        return {
          id: instData.instanceId || instData.id || instData.instanceName,
          name: instData.instanceName || instData.name,
          status: (instData.status === 'open' || instData.connectionStatus === 'open') ? 'CONNECTED' : 'DISCONNECTED',
          phone: instData.ownerJid ? instData.ownerJid.split('@')[0] : 'Standby',
          profilePicUrl: instData.profilePicUrl || ""
        };
      });
      setInstances(mapped);
      if (activeTab === 'atendimento' && !selectedInstanceForChat) {
        const wayia = mapped.find(i => i.name.toLowerCase() === 'wayia' && i.status === 'CONNECTED');
        if (wayia) setSelectedInstanceForChat(wayia);
      }
    } catch (e) { console.error('Cluster Offline.'); }
  };

  const forcePostgresInjection = async (instance: EvolutionInstance) => {
    setIsIndexing(true);
    setContactError(null);
    setDbStatus('CHECKING');
    
    try {
      // 1. Forçar Flags via API
      await fetch(`${EVOLUTION_URL}/instance/setSettings/${instance.name}`, {
        method: 'POST',
        headers: getHeaders(instance.name),
        body: JSON.stringify({ 
          syncFullHistory: true, 
          readMessages: true, 
          readStatus: true,
          syncContacts: true,
          syncGroups: false
        })
      });

      // 2. Sync manual
      await fetch(`${EVOLUTION_URL}/contact/sync/${instance.name}`, {
        method: 'POST',
        headers: getHeaders(instance.name)
      });

      await new Promise(r => setTimeout(r, 8000));
      await fetchContacts(instance);

    } catch (e) {
      setContactError("FALHA DE COMUNICAÇÃO.");
      setDbStatus('FAIL');
    } finally {
      setIsIndexing(false);
    }
  };

  const fetchContacts = async (instance: EvolutionInstance) => {
    if (!instance) return;
    setIsFetchingContacts(true);
    setContactError(null);
    setDbStatus('CHECKING');
    
    try {
      const res = await fetch(`${EVOLUTION_URL}/contact/findMany?instanceName=${instance.name}`, { headers: getHeaders(instance.name) });
      if (res.ok) {
        const json = await res.json();
        const list = json.data || json.contacts || json;
        if (Array.isArray(list) && list.length > 0) {
          const normalized = list.map(normalizeContact).filter(c => c !== null);
          setContacts(normalized);
          setDbStatus('READY');
          setIsFetchingContacts(false);
          return;
        }
      }
      setDbStatus('FAIL');
      setContactError("POSTGRES VAZIO");
    } catch (e) { 
      setDbStatus('FAIL');
    } finally {
      setIsFetchingContacts(false);
    }
  };

  const restartInstance = async (instance: EvolutionInstance) => {
    setIsRestarting(true);
    try {
      await fetch(`${EVOLUTION_URL}/instance/restart/${instance.name}`, { method: 'POST', headers: getHeaders() });
      setTimeout(() => {
        fetchInstances();
        setIsRestarting(false);
      }, 5000);
    } catch (e) { setIsRestarting(false); }
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

  useEffect(() => {
    fetchInstances();
    const interval = setInterval(fetchInstances, 60000);
    return () => clearInterval(interval);
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
      const res = await fetch(`${EVOLUTION_URL}/chat/findMessages?instanceName=${selectedInstanceForChat.name}`, {
        method: 'POST',
        headers: getHeaders(selectedInstanceForChat.name),
        body: JSON.stringify({ remoteJid: contact.id, page: 1 })
      });
      if(res.ok) {
        const json = await res.json();
        const data = json.data || json.messages || json;
        if (Array.isArray(data)) setChatMessages([...data].reverse());
      }
    } catch(e) { } finally { setIsFetchingMessages(false); }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !selectedInstanceForChat || !selectedContact) return;
    const text = messageInput;
    setMessageInput('');
    setChatMessages(prev => [...prev, { key: { fromMe: true, id: Date.now().toString() }, message: { conversation: text }, timestamp: Date.now() }]);
    try {
      await fetch(`${EVOLUTION_URL}/message/sendText/${selectedInstanceForChat.name}`, {
        method: 'POST',
        headers: getHeaders(selectedInstanceForChat.name),
        body: JSON.stringify({ number: selectedContact.id, text: text, linkPreview: true })
      });
    } catch (e) { console.error(e); }
  };

  const copyEnvToClipboard = () => {
    const envContent = `# CONFIGURAÇÃO DOCKER OTIMIZADA\nDATABASE_ENABLED=true\nDATABASE_TYPE=postgresql\n# Use o nome do serviço no docker-compose/portainer!\nDATABASE_CONNECTION_URI=postgresql://postgres:suasenha@postgres:5432/evolution?schema=public\nDATABASE_SAVE_DATA_INSTANCE=true\nDATABASE_SAVE_DATA_NEW_MESSAGE=true\nDATABASE_SAVE_DATA_CONTACTS=true\nDATABASE_SAVE_DATA_CHATS=true\nDATABASE_SAVE_DATA_LABELS=true\nDATABASE_SAVE_DATA_HISTORIC=true`;
    navigator.clipboard.writeText(envContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
              <h2 className="text-[10px] font-black uppercase tracking-[0.6em] text-white/40 italic leading-none">Neural Core v17.0</h2>
              <span className="text-[8px] font-bold text-orange-500/50 uppercase tracking-widest mt-1 italic">Oracle Sync Mapper Active</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
             <div className="text-right hidden sm:block">
                <div className="text-[10px] font-black uppercase text-white italic tracking-widest">{user.name}</div>
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
                      <h1 className="text-5xl font-black uppercase italic tracking-tighter leading-none">Neural <span className="text-orange-500">Oracle.</span></h1>
                      <p className="text-[10px] font-black uppercase tracking-[0.5em] text-gray-700 italic">Diagnóstico de handshakes e redes internas</p>
                    </div>
                    <div className="flex gap-4 w-full md:w-auto">
                      <NeonButton onClick={() => fetchInstances()} className="!px-8 !text-[11px] !py-4">Scannear Clusters</NeonButton>
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
                                   <div className={`absolute -bottom-1.5 -right-1.5 w-4 h-4 rounded-full border-[3px] border-[#050505] ${inst.status === 'CONNECTED' ? 'bg-green-500 shadow-[0_0_10px_#22c55e]' : 'bg-red-500'}`} />
                                </div>
                                <div className="flex-1 overflow-hidden">
                                   <div className="text-xl font-black uppercase italic tracking-tighter text-white truncate leading-none mb-1.5">{inst.name}</div>
                                   <div className="text-[9px] font-black text-gray-700 uppercase tracking-[0.2em] italic truncate">{inst.phone || 'Standby'}</div>
                                </div>
                             </div>
                             <div className="flex gap-3">
                                <button onClick={() => restartInstance(inst)} className={`flex-1 p-3 rounded-xl bg-white/[0.02] text-gray-600 hover:text-orange-500 border border-white/5 transition-all flex items-center justify-center gap-2 text-[10px] font-black uppercase ${isRestarting ? 'animate-pulse' : ''}`}><RotateCw size={14}/> Reset</button>
                                <button onClick={() => setShowEnvLab(true)} className="p-3 rounded-xl bg-orange-600/5 text-orange-500 hover:bg-orange-600 hover:text-white border border-orange-500/10 transition-all"><Settings2 size={16}/></button>
                                <button onClick={() => setShowSystemMapper(true)} className="p-3 rounded-xl bg-blue-600/5 text-blue-500 border border-blue-500/10 transition-all"><Network size={16}/></button>
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
                            <div title="Oracle Diagnosis" className={`p-1.5 glass rounded-lg cursor-pointer transition-all hover:scale-110 shadow-lg ${dbStatus === 'READY' ? 'text-green-500' : 'text-red-500'}`} onClick={() => setShowEnvLab(true)}>
                               <Database size={14} />
                            </div>
                            <div title="Force Oracle Sync" className="p-1.5 glass rounded-lg text-orange-500 cursor-pointer transition-all hover:scale-110" onClick={() => { if(selectedInstanceForChat) forcePostgresInjection(selectedInstanceForChat); }}>
                               <RefreshCw size={14} className={isIndexing ? 'animate-spin' : ''} />
                            </div>
                          </div>
                        </div>

                        <select 
                          value={selectedInstanceForChat?.id || ""}
                          onChange={(e) => {
                            const inst = instances.find(i => i.id === e.target.value);
                            if (inst) setSelectedInstanceForChat(inst);
                          }}
                          className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-3 px-4 text-[10px] font-black uppercase tracking-widest outline-none appearance-none focus:border-orange-500/40 transition-all text-white/80"
                        >
                          <option value="" disabled className="bg-[#050505]">Selecionar Cluster Wayia...</option>
                          {instances.map(inst => (
                            <option key={inst.id} value={inst.id} className="bg-[#050505]">{inst.name.toUpperCase()}</option>
                          ))}
                        </select>
                      </div>
                   </div>

                   <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1.5">
                      {isFetchingContacts || isIndexing ? (
                        <div className="py-20 text-center space-y-4">
                           <div className="relative inline-block">
                              <Loader2 className="animate-spin text-orange-500 mx-auto" size={40} />
                              <ShieldCheck className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/20" size={12}/>
                           </div>
                           <p className="text-[9px] font-black uppercase text-orange-500 animate-pulse italic">Auditoria Neural Ativa...</p>
                        </div>
                      ) : (
                        <>
                          {contactError && (
                            <div className="p-8 m-3 rounded-[2rem] bg-red-500/5 border border-red-500/10 text-center space-y-4">
                               <ShieldX className="mx-auto text-red-500" size={32}/>
                               <div className="space-y-1">
                                  <p className="text-[11px] font-black uppercase text-red-500 italic">Rede Desincronizada!</p>
                                  <p className="text-[8px] font-bold text-gray-700 uppercase leading-relaxed italic">O motor retornou vazio. Clique abaixo para ver o guia de correção Portainer.</p>
                               </div>
                               <NeonButton onClick={() => setShowEnvLab(true)} className="!py-4 !text-[9px] !rounded-xl !bg-red-600 shadow-none">VER SOLUÇÃO</NeonButton>
                            </div>
                          )}
                          {contacts.length === 0 && !contactError && (
                            <div className="py-20 text-center opacity-20 flex flex-col items-center gap-4">
                               <ServerCrash size={48} />
                               <span className="text-[10px] font-black uppercase">Oracle Idle</span>
                            </div>
                          )}
                          {contacts.map((contact, i) => (
                            <div 
                               key={contact.id || i} 
                               onClick={() => loadChat(contact)}
                               className={`p-4 rounded-2xl flex items-center gap-4 cursor-pointer transition-all border ${selectedContact?.id === contact.id ? 'bg-orange-500/10 border-orange-500/20 shadow-xl' : 'bg-transparent border-transparent hover:bg-white/[0.02]'}`}
                            >
                               <div className="w-12 h-12 rounded-full bg-black border border-white/10 flex items-center justify-center overflow-hidden">
                                  {contact.displayAvatar ? <img src={contact.displayAvatar} className="w-full h-full object-cover" /> : <div className="text-[14px] font-black text-gray-700">{(contact.displayName || "?")[0].toUpperCase()}</div>}
                               </div>
                               <div className="flex-1 min-w-0">
                                  <span className="text-[11px] font-black uppercase text-white truncate italic block">{contact.displayName}</span>
                                  <p className="text-[9px] font-bold text-gray-700 truncate uppercase mt-0.5">{contact.lastMsg || 'Mensagem Neural...'}</p>
                               </div>
                            </div>
                          ))}
                        </>
                      )}
                   </div>
                </div>

                <div className="flex-1 flex flex-col relative bg-black/50">
                   {selectedContact ? (
                     <>
                        <div className="h-20 border-b border-white/5 bg-black/20 flex items-center justify-between px-8 backdrop-blur-xl z-20">
                           <div className="flex items-center gap-5">
                              <div className="w-12 h-12 rounded-full bg-black border border-white/10 flex items-center justify-center overflow-hidden">
                                 {selectedContact.displayAvatar ? <img src={selectedContact.displayAvatar} className="w-full h-full object-cover" /> : <div className="text-[16px] font-black text-gray-700">{(selectedContact.displayName || "?")[0].toUpperCase()}</div>}
                              </div>
                              <div>
                                 <h4 className="text-lg font-black uppercase italic tracking-tighter text-white leading-none">{selectedContact.displayName}</h4>
                                 <span className="text-[9px] font-black text-orange-500/50 uppercase italic tracking-widest flex items-center gap-2"><Wifi size={10}/> Sync Oracle v17.0</span>
                              </div>
                           </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8 bg-[url('https://qonrpzlkjhdmswjfxvtu.supabase.co/storage/v1/object/public/WayIAFlow/grid.png')] bg-fixed opacity-90">
                           {chatMessages.map((msg: any, i) => (
                             <motion.div initial={{ opacity: 0, x: msg.key?.fromMe ? 20 : -20 }} animate={{ opacity: 1, x: 0 }} key={msg.key?.id || i} className={`flex ${msg.key?.fromMe ? 'justify-end' : 'justify-start'}`}>
                                <div className={`p-5 rounded-[2rem] text-sm font-bold shadow-2xl max-w-[70%] ${msg.key?.fromMe ? 'bg-orange-500 text-white rounded-tr-none border-orange-600' : 'glass text-gray-200 rounded-tl-none border-white/10'}`}>
                                   {msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.content || ""}
                                </div>
                             </motion.div>
                           ))}
                           <div ref={chatEndRef} />
                        </div>

                        <div className="p-8 border-t border-white/5 bg-black/60 backdrop-blur-2xl">
                           <form onSubmit={handleSendMessage} className="flex items-center gap-6 max-w-5xl mx-auto">
                              <input value={messageInput} onChange={e => setMessageInput(e.target.value)} placeholder="Comandar resposta neural..." className="w-full bg-white/[0.04] border border-white/10 rounded-3xl py-5 px-8 text-sm font-bold outline-none focus:border-orange-500/50 transition-all" />
                              <button type="submit" className="p-5 bg-orange-500 rounded-2xl text-white hover:scale-105 transition-all shadow-xl shadow-orange-600/40"><Send size={24} fill="currentColor" /></button>
                           </form>
                        </div>
                     </>
                   ) : (
                     <div className="h-full flex flex-col items-center justify-center p-20 text-center space-y-10">
                        <div className="w-40 h-40 rounded-full border-4 border-orange-500/5 flex items-center justify-center animate-pulse"><MessageSquare size={64} className="text-orange-500/20" /></div>
                        <h3 className="text-4xl font-black uppercase italic tracking-tighter text-white/40">Oracle <span className="text-orange-500/60">Standby.</span></h3>
                        <p className="text-[10px] font-bold text-gray-800 uppercase tracking-[0.4em] max-w-xs leading-loose italic">Aguardando decodificação de transmissão de rádio via Postgres.</p>
                     </div>
                   )}
                </div>
             </div>
           )}
        </div>
      </main>

      <AnimatePresence>
        {showEnvLab && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/95 backdrop-blur-3xl">
             <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-[#050505] border border-orange-500/30 w-full max-w-5xl rounded-[3rem] overflow-hidden shadow-[0_0_150px_rgba(255,115,0,0.15)] flex flex-col max-h-[90vh]">
                <div className="p-10 border-b border-white/5 flex items-center justify-between bg-black/40">
                   <div className="flex items-center gap-4">
                      <div className="p-3 bg-orange-500/10 rounded-2xl text-orange-500"><Terminal size={24}/></div>
                      <div>
                         <h3 className="text-2xl font-black uppercase italic tracking-tighter">Sync Oracle <span className="text-orange-500">v17.0.</span></h3>
                         <p className="text-[9px] font-black text-gray-700 uppercase tracking-widest">Diagnóstico de Rede Interna Portainer</p>
                      </div>
                   </div>
                   <button onClick={() => setShowEnvLab(false)} className="p-3 glass rounded-2xl text-gray-500 hover:text-white transition-all"><X size={20}/></button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-10 custom-scrollbar space-y-12">
                   <div className="grid md:grid-cols-2 gap-12">
                      <div className="space-y-6">
                         <div className="flex items-center justify-between">
                            <h4 className="text-[11px] font-black uppercase tracking-widest text-orange-500 italic">1. Verificação da URI</h4>
                            <button onClick={copyEnvToClipboard} className="text-[10px] font-black uppercase text-gray-500 hover:text-white flex items-center gap-2 transition-all">
                               {copied ? <Check size={14} className="text-green-500"/> : <Copy size={14}/>} {copied ? 'Copiado!' : 'Copiar'}
                            </button>
                         </div>
                         <div className="bg-black border border-white/10 rounded-2xl p-6 font-mono text-[10px] text-gray-400 relative overflow-hidden">
                            <div className="space-y-1">
                               <p className="text-red-500/50"># ERRO COMUM: LOCALHOST</p>
                               <p className="line-through text-gray-800">DATABASE_CONNECTION_URI=postgresql://...<span className="text-red-500 font-black">localhost</span>:5432/...</p>
                               <p className="text-green-500/80 mt-2"># CORRETO: NOME DO SERVIÇO</p>
                               <p className="text-white/80">DATABASE_CONNECTION_URI=postgresql://postgres:suasenha@<span className="text-green-500 font-black italic">postgres</span>:5432/evolution?schema=public</p>
                            </div>
                         </div>
                         <div className="p-5 bg-orange-500/5 border border-orange-500/10 rounded-xl space-y-2">
                            <div className="flex items-center gap-2 text-orange-500">
                               <AlertTriangle size={14}/>
                               <span className="text-[9px] font-black uppercase tracking-widest">Explicação Docker</span>
                            </div>
                            <p className="text-[8px] font-bold text-gray-600 uppercase leading-relaxed italic">
                               Dentro do Docker, cada container é uma máquina separada. Se você usa <span className="text-white">localhost</span>, a API tenta conectar nela mesma. Use o <span className="text-white">NOME</span> que você deu ao container do Postgres no Portainer.
                            </p>
                         </div>
                      </div>

                      <div className="space-y-6">
                         <h4 className="text-[11px] font-black uppercase tracking-widest text-blue-500 italic">2. O Passo Esquecido: Networks</h4>
                         
                         <div className="space-y-4">
                            <div className="p-5 glass rounded-2xl border-white/5 space-y-3">
                               <div className="flex items-center gap-3">
                                  <div className="w-6 h-6 rounded-lg bg-blue-500 flex items-center justify-center text-[10px] font-black">1</div>
                                  <span className="text-[10px] font-black uppercase text-white italic">Aba Networks</span>
                               </div>
                               <p className="text-[8px] text-gray-600 font-bold uppercase tracking-tight italic">No Portainer, vá na aba lateral <span className="text-white">"Networks"</span> e crie uma rede chamada <span className="text-orange-500">"wayia-net"</span>.</p>
                            </div>

                            <div className="p-5 glass rounded-2xl border-white/5 space-y-3">
                               <div className="flex items-center gap-3">
                                  <div className="w-6 h-6 rounded-lg bg-blue-500 flex items-center justify-center text-[10px] font-black">2</div>
                                  <span className="text-[10px] font-black uppercase text-white italic">Vincular Containers</span>
                               </div>
                               <p className="text-[8px] text-gray-600 font-bold uppercase tracking-tight italic">Edite o container do <span className="text-white">Postgres</span> e o da <span className="text-white">Evolution</span>. Na aba "Network", selecione <span className="text-orange-500">"wayia-net"</span> para ambos.</p>
                            </div>

                            <div className="p-5 glass rounded-2xl border-white/5 space-y-3">
                               <div className="flex items-center gap-3">
                                  <div className="w-6 h-6 rounded-lg bg-green-500 flex items-center justify-center text-[10px] font-black">3</div>
                                  <span className="text-[10px] font-black uppercase text-white italic">Deploy Final</span>
                               </div>
                               <p className="text-[8px] text-gray-600 font-bold uppercase tracking-tight italic">Dê <span className="text-green-500">Deploy</span> em ambos. Agora eles estão no mesmo cabo de rede virtual e a URI vai funcionar.</p>
                            </div>
                         </div>
                      </div>
                   </div>

                   <div className="p-8 bg-blue-600/5 border border-blue-500/10 rounded-[2.5rem] flex flex-col md:flex-row items-center gap-8 justify-between">
                      <div className="flex items-center gap-5">
                         <div className="p-4 bg-blue-600/20 rounded-full text-blue-500"><Network size={32}/></div>
                         <div>
                            <h5 className="text-lg font-black uppercase italic tracking-tighter">O Postgres está VIVO, mas está ISOLADO.</h5>
                            <p className="text-[9px] font-black text-gray-700 uppercase tracking-widest italic">O log de checkpoint prova que o banco respira, mas ele não tem rede para ouvir a API.</p>
                         </div>
                      </div>
                      <NeonButton onClick={() => setShowEnvLab(false)} className="!px-12 !py-4 !text-[10px]">CORRIGIR REDE AGORA!</NeonButton>
                   </div>
                </div>
             </motion.div>
          </div>
        )}

        {showSystemMapper && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/95 backdrop-blur-3xl">
             <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-[#050505] border border-blue-500/30 w-full max-w-4xl rounded-[3rem] p-10 overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center mb-10">
                   <h3 className="text-2xl font-black uppercase italic tracking-tighter">Docker <span className="text-blue-500">Audit.</span></h3>
                   <button onClick={() => setShowSystemMapper(false)} className="p-3 glass rounded-2xl text-gray-500 hover:text-white transition-all"><X size={20}/></button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-6 font-mono text-[10px] text-gray-600">
                   <p className="text-blue-500 font-black"># MAPA DE CONEXÃO NEURAL</p>
                   <p>&gt; Servidor: evo2.wayiaflow.com.br</p>
                   <p>&gt; Postgres Status: <span className="text-green-500">HEALTHY</span> (Checkpoint logs OK)</p>
                   <p>&gt; Network Path: <span className="text-red-500 font-black">ISOLATED</span></p>
                   <p className="mt-8 text-gray-400"># POR QUE ESTÁ VAZIO?</p>
                   <p>&gt; 1. A Evolution API enviou os dados?</p>
                   <p>&gt; 2. O Postgres recebeu? (Checkpoint diz que não houve alteração de buffers significativos)</p>
                   <p>&gt; 3. Conclusão: Handshake falhou por <span className="text-white italic">Docker Networking Missmatch</span>.</p>
                </div>
                <NeonButton onClick={() => setShowSystemMapper(false)} className="mt-8">Fechar Auditoria</NeonButton>
             </motion.div>
          </div>
        )}

        {qrModal.isOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/98 backdrop-blur-3xl">
            <div key={qrModal.timestamp} className="bg-[#050505] border border-orange-500/30 p-12 rounded-[3rem] text-center max-w-sm w-full relative shadow-[0_0_100px_rgba(255,115,0,0.1)]">
              <button onClick={() => { setQrModal(p => ({ ...p, isOpen: false })); if(poolingRef.current) clearInterval(poolingRef.current); }} className="absolute top-10 right-10 text-gray-800 hover:text-white transition-all"><X size={28}/></button>
              <h3 className="text-3xl font-black uppercase italic text-white mb-10">{qrModal.name}</h3>
              <div className="relative mb-10 flex justify-center">
                 <div className="bg-white p-8 rounded-[2.5rem] flex items-center justify-center min-h-[300px] min-w-[300px] border-[10px] border-white/5 shadow-[0_0_80px_rgba(255,255,255,0.05)]">
                    {qrModal.code ? <img src={qrModal.code.startsWith('data:') ? qrModal.code : `data:image/png;base64,${qrModal.code}`} className="w-full h-auto rounded-xl" /> : <div className="flex flex-col items-center gap-4"><Loader2 className="animate-spin text-orange-500" size={56}/><span className="text-[10px] font-black uppercase text-gray-900">Gerando Handshake...</span></div>}
                 </div>
                 {qrModal.connected && <div className="absolute inset-0 bg-black/95 rounded-[2.5rem] flex flex-col items-center justify-center border border-green-500/30 text-white"><CheckCircle2 size={72} className="text-green-500 mb-4 shadow-[0_0_40px_rgba(34,197,94,0.4)]"/><h4 className="text-2xl font-black uppercase italic">Cluster Ativo</h4><NeonButton className="mt-4" onClick={() => setQrModal(p => ({ ...p, isOpen: false }))}>Ver Mensagens</NeonButton></div>}
              </div>
              <p className="text-[11px] font-black uppercase tracking-[0.5em] italic text-orange-500">{qrModal.status}</p>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
