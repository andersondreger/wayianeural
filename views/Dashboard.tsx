
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
  FolderTree, FileJson, FileText, Globe
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
    } catch(e) { return null; }
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
      }
    } catch (e) { console.error('Cluster Offline.'); }
  };

  const forcePostgresInjection = async (instance: EvolutionInstance) => {
    setIsIndexing(true);
    setContactError(null);
    setDbStatus('CHECKING');
    
    try {
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

      await fetch(`${EVOLUTION_URL}/contact/sync/${instance.name}`, {
        method: 'POST',
        headers: getHeaders(instance.name)
      });

      await new Promise(r => setTimeout(r, 10000));
      await fetchContacts(instance);

    } catch (e) {
      setContactError("FALHA DE SINCRONIZAÇÃO.");
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
    
    const targets = [instance.name, instance.id];
    let success = false;

    for (const target of targets) {
      try {
        const res = await fetch(`${EVOLUTION_URL}/contact/findMany?instanceName=${target}`, { headers: getHeaders(target) });
        if (res.ok) {
          const json = await res.json();
          const list = json.data || json.contacts || (Array.isArray(json) ? json : null);
          if (list && Array.isArray(list) && list.length > 0) {
            const normalized = list.map(normalizeContact).filter((c: any) => c !== null);
            const unique = Array.from(new Map(normalized.map(item => [item.id, item])).values());
            setContacts(unique);
            setIsIndexing(false);
            setDbStatus('READY');
            success = true;
            break;
          }
        }
      } catch (e) { continue; }
    }

    if (!success) {
      setIsIndexing(true);
      setDbStatus('FAIL');
      setContactError(`POSTGRES VAZIO.`);
    }
    setIsFetchingContacts(false);
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

  const createInstance = async (name?: string) => {
    const instanceName = name || newInstanceName;
    if (!instanceName.trim()) return;
    setIsCreatingInstance(true);
    const sanitizedName = instanceName.replace(/[^a-zA-Z0-9-]/g, '');
    setQrModal({ isOpen: true, name: sanitizedName, code: '', status: 'Preparando Cluster...', connected: false, timestamp: Date.now(), isResetting: false });

    try {
      await fetch(`${EVOLUTION_URL}/instance/create`, {
        method: 'POST', 
        headers: getHeaders(), 
        body: JSON.stringify({ 
          instanceName: sanitizedName, 
          qrcode: true, 
          integration: "WHATSAPP-BAILEYS", 
          alwaysOnline: true,
          syncFullHistory: true
        })
      });

      if (poolingRef.current) clearInterval(poolingRef.current);
      poolingRef.current = setInterval(async () => {
        try {
          const res = await fetch(`${EVOLUTION_URL}/instance/connect/${sanitizedName}`, { headers: getHeaders() });
          const data = await res.json();
          const code = data.base64 || data.qrcode?.base64 || data.code?.base64 || data.qrcode || data.code;
          if (code && typeof code === 'string' && code.length > 50) {
            setQrModal(p => ({ ...p, code, status: 'Escanear QR Neural...' }));
          } else if (data.status === 'open' || data.connectionStatus === 'open') {
            setQrModal(p => ({ ...p, connected: true, status: 'Sincronizado!' }));
            clearInterval(poolingRef.current);
            fetchInstances();
          }
        } catch (e) {}
      }, 4500);
    } catch (e) { setQrModal(p => ({ ...p, status: 'Erro' })); }
    finally { setIsCreatingInstance(false); fetchInstances(); setNewInstanceName(''); }
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

  const copyEnvToClipboard = () => {
    const envContent = `# CONFIGURAÇÃO NEURAL POSTGRES\nDATABASE_ENABLED=true\nDATABASE_TYPE=postgresql\nDATABASE_CONNECTION_URI=postgresql://postgres:suasenha@postgres:5432/evolution?schema=public\nDATABASE_SAVE_DATA_INSTANCE=true\nDATABASE_SAVE_DATA_NEW_MESSAGE=true\nDATABASE_SAVE_DATA_CONTACTS=true\nDATABASE_SAVE_DATA_CHATS=true\nDATABASE_SAVE_DATA_LABELS=true\nDATABASE_SAVE_DATA_HISTORIC=true`;
    navigator.clipboard.writeText(envContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const ProjectFile = ({ name, icon: Icon, type = 'file' }: any) => (
    <div className="flex items-center gap-3 py-1.5 px-4 rounded-lg hover:bg-white/[0.03] transition-all cursor-default group">
       <Icon size={14} className={type === 'folder' ? 'text-orange-500' : 'text-gray-600 group-hover:text-white transition-colors'} />
       <span className={`text-[10px] font-bold uppercase tracking-widest ${type === 'folder' ? 'text-white' : 'text-gray-500 group-hover:text-white transition-colors'}`}>{name}</span>
    </div>
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
              <h2 className="text-[10px] font-black uppercase tracking-[0.6em] text-white/40 italic leading-none italic">Neural Core v15.0</h2>
              <span className="text-[8px] font-bold text-orange-500/50 uppercase tracking-widest mt-1 italic">System Mapper Active</span>
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
                      <h1 className="text-5xl font-black uppercase italic tracking-tighter leading-none">Neural <span className="text-orange-500">Engines.</span></h1>
                      <p className="text-[10px] font-black uppercase tracking-[0.5em] text-gray-700 italic">Mapeamento de clusters de escala</p>
                    </div>
                    <div className="flex gap-4 w-full md:w-auto">
                      <input value={newInstanceName} onChange={e => setNewInstanceName(e.target.value)} onKeyDown={e => e.key === 'Enter' && createInstance()} placeholder="ID do Motor..." className="flex-1 md:w-64 bg-white/[0.03] border border-white/10 rounded-xl py-4 px-6 text-[11px] font-black uppercase outline-none focus:border-orange-500/40 transition-all placeholder:text-gray-800" />
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
                                   <div className={`absolute -bottom-1.5 -right-1.5 w-4 h-4 rounded-full border-[3px] border-[#050505] ${inst.status === 'CONNECTED' ? 'bg-green-500 shadow-[0_0_10px_#22c55e]' : 'bg-red-500'}`} />
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
                                <button onClick={() => { setShowSystemMapper(true) }} title="Neural System Map" className="p-3 rounded-xl bg-blue-600/5 text-blue-500 hover:bg-blue-600 hover:text-white border border-blue-500/10 transition-all"><FolderTree size={16}/></button>
                                <button onClick={() => { setShowEnvLab(true) }} title="Neural Config Lab" className="p-3 rounded-xl bg-orange-600/5 text-orange-500/40 hover:bg-orange-600 hover:text-white border border-orange-500/10 transition-all"><Settings2 size={16}/></button>
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
                               title="Mapa do Sistema"
                               className="p-1.5 glass rounded-lg text-blue-500 cursor-pointer transition-all hover:scale-110" 
                               onClick={() => setShowSystemMapper(true)}
                            >
                               <FolderTree size={14} />
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
                          <div className={`absolute left-4 top-1/2 -translate-y-1/2 z-10 w-2 h-2 rounded-full ${selectedInstanceForChat?.status === 'CONNECTED' ? 'bg-green-500 shadow-[0_0_10px_#22c55e]' : 'bg-red-500'}`} />
                          <select 
                            value={selectedInstanceForChat?.id || ""}
                            onChange={(e) => {
                              const inst = instances.find(i => i.id === e.target.value);
                              if (inst) setSelectedInstanceForChat(inst);
                            }}
                            className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-3 pl-10 pr-10 text-[10px] font-black uppercase tracking-widest outline-none appearance-none focus:border-orange-500/40 transition-all text-white/80 cursor-pointer"
                          >
                            <option value="" disabled className="bg-[#050505]">Selecione um Cluster...</option>
                            {instances.map(inst => (
                              <option key={inst.id} value={inst.id} className="bg-[#050505]">
                                {inst.name.toUpperCase()} {inst.status === 'CONNECTED' ? '🟢' : '🔴'}
                              </option>
                            ))}
                          </select>
                          <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-orange-500 pointer-events-none" />
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
                        <div className="py-20 text-center px-6 opacity-30">
                           <Smartphone className="mx-auto mb-4 animate-pulse" size={32} />
                           <p className="text-[9px] font-black uppercase tracking-widest italic">Aguardando Seleção de Motor</p>
                        </div>
                      ) : isFetchingContacts || isIndexing ? (
                        <div className="py-20 text-center space-y-4 px-6">
                           <div className="relative inline-block">
                              <Loader2 className="animate-spin text-orange-500 mx-auto" size={44} strokeWidth={3} />
                              <Cpu className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/40" size={14}/>
                           </div>
                           <div className="space-y-1">
                              <p className="text-[10px] font-black uppercase tracking-widest italic text-orange-500 animate-pulse">{isIndexing ? 'Injetando no Postgres...' : 'Sincronizando...'}</p>
                           </div>
                        </div>
                      ) : (
                        <>
                          {contactError && contacts.length === 0 && (
                            <div className="p-8 mx-3 mb-2 rounded-[2rem] bg-orange-500/[0.02] border border-orange-500/10 text-center space-y-4 shadow-xl">
                               <ServerCrash className="mx-auto text-red-500/30" size={36}/>
                               <div className="space-y-2">
                                  <p className="text-[10px] font-black uppercase text-red-500 italic">Postgres Desvinculado</p>
                                  <p className="text-[8px] font-bold uppercase tracking-tight text-gray-600 leading-relaxed italic">O banco está funcionando mas a agenda está vazia. Verifique seu arquivo .env.</p>
                               </div>
                               <div className="flex flex-col gap-3 pt-2">
                                  <NeonButton onClick={() => setShowEnvLab(true)} className="!py-4 !text-[9px] !rounded-xl !bg-orange-600 shadow-orange-500/20">CONFIGURAR .ENV AGORA</NeonButton>
                                  <NeonButton onClick={() => forcePostgresInjection(selectedInstanceForChat)} className="!py-4 !text-[9px] !rounded-xl !bg-blue-600/50 !border-blue-500/20 !shadow-none">Reparar via API</NeonButton>
                               </div>
                            </div>
                          )}
                          {contacts.length === 0 && !isFetchingContacts && !contactError && !isIndexing && (
                            <div className="py-20 text-center opacity-10 flex flex-col items-center gap-4">
                               <Database size={48} />
                               <span className="text-[10px] font-black uppercase">Postgres Standby</span>
                               <button onClick={() => forcePostgresInjection(selectedInstanceForChat)} className="text-[8px] text-orange-500 underline font-black uppercase tracking-widest">Ativar Escrita</button>
                            </div>
                          )}
                          {contacts.filter(c => (c.displayName || "").toLowerCase().includes(searchQuery.toLowerCase())).map((contact, i) => (
                            <div 
                               key={contact.id || i} 
                               onClick={() => loadChat(contact)}
                               className={`p-4 rounded-2xl flex items-center gap-4 cursor-pointer transition-all border ${selectedContact?.id === contact.id ? 'bg-orange-500/10 border-orange-500/20 shadow-[0_0_25px_rgba(255,115,0,0.03)]' : 'bg-transparent border-transparent hover:bg-white/[0.02]'}`}
                            >
                               <div className="relative shrink-0">
                                  <div className="w-12 h-12 rounded-full bg-black border border-white/10 flex items-center justify-center overflow-hidden shadow-inner">
                                     {contact.displayAvatar ? <img src={contact.displayAvatar} className="w-full h-full object-cover" /> : <div className="text-[14px] font-black italic text-gray-700">{(contact.displayName || "?")[0].toUpperCase()}</div>}
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

                <div className="flex-1 flex flex-col relative bg-black/50">
                   {selectedContact ? (
                     <>
                        <div className="h-20 border-b border-white/5 bg-black/20 flex items-center justify-between px-8 backdrop-blur-xl z-20">
                           <div className="flex items-center gap-5">
                              <div className="w-12 h-12 rounded-full bg-black border border-white/10 flex items-center justify-center overflow-hidden relative shadow-lg">
                                 {selectedContact.displayAvatar ? <img src={selectedContact.displayAvatar} className="w-full h-full object-cover" /> : <div className="text-[16px] font-black italic text-gray-700">{(selectedContact.displayName || "?")[0].toUpperCase()}</div>}
                              </div>
                              <div>
                                 <h4 className="text-lg font-black uppercase italic tracking-tighter text-white leading-none mb-1">{selectedContact.displayName}</h4>
                                 <span className="text-[9px] font-black text-orange-500/50 uppercase italic tracking-widest flex items-center gap-2"><Wifi size={10}/> Conexão Neural Wayia</span>
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
                                <span className="text-[10px] font-black uppercase tracking-widest italic">Recuperando Pacotes...</span>
                             </div>
                           ) : (
                             chatMessages.map((msg: any, i) => (
                               <motion.div initial={{ opacity: 0, x: msg.key?.fromMe ? 20 : -20 }} animate={{ opacity: 1, x: 0 }} key={msg.key?.id || i} className={`flex ${msg.key?.fromMe ? 'justify-end' : 'justify-start'}`}>
                                  <div className={`p-5 rounded-[2rem] text-sm font-bold shadow-2xl max-w-[70%] ${msg.key?.fromMe ? 'bg-orange-500 text-white rounded-tr-none border-orange-600' : 'glass text-gray-200 rounded-tl-none border-white/10'}`}>
                                     {msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.content || ""}
                                  </div>
                               </motion.div>
                             ))
                           )}
                           <div ref={chatEndRef} />
                        </div>

                        <div className="p-8 border-t border-white/5 bg-black/60 backdrop-blur-2xl">
                           <form onSubmit={handleSendMessage} className="flex items-center gap-6 max-w-5xl mx-auto">
                              <input value={messageInput} onChange={e => setMessageInput(e.target.value)} placeholder="Digite sua mensagem neural..." className="w-full bg-white/[0.04] border border-white/10 rounded-3xl py-5 px-8 text-sm font-bold outline-none focus:border-orange-500/50 transition-all shadow-inner shadow-black" />
                              <button type="submit" className="p-5 bg-orange-500 rounded-2xl text-white hover:scale-105 transition-all shadow-xl shadow-orange-600/40"><Send size={24} fill="currentColor" /></button>
                           </form>
                        </div>
                     </>
                   ) : (
                     <div className="h-full flex flex-col items-center justify-center p-20 text-center space-y-10">
                        <div className="w-40 h-40 rounded-full border-4 border-orange-500/5 flex items-center justify-center animate-pulse"><MessageSquare size={64} className="text-orange-500/20" /></div>
                        <h3 className="text-4xl font-black uppercase italic tracking-tighter italic text-white/40">Selecione um <span className="text-orange-500/60">Canal.</span></h3>
                        <p className="text-[10px] font-bold text-gray-800 uppercase tracking-[0.4em] max-w-xs leading-loose">Aguardando decodificação de transmissão neural.</p>
                     </div>
                   )}
                </div>
             </div>
           )}
        </div>
      </main>

      <AnimatePresence>
        {showSystemMapper && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/95 backdrop-blur-3xl">
             <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-[#050505] border border-blue-500/30 w-full max-w-4xl rounded-[3rem] overflow-hidden shadow-[0_0_150px_rgba(30,58,138,0.2)] flex flex-col max-h-[90vh]">
                <div className="p-10 border-b border-white/5 flex items-center justify-between bg-black/40">
                   <div className="flex items-center gap-4">
                      <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-500"><FolderTree size={24}/></div>
                      <div>
                         <h3 className="text-2xl font-black uppercase italic italic tracking-tighter">Neural System <span className="text-blue-500">Mapper.</span></h3>
                         <p className="text-[9px] font-black text-gray-700 uppercase tracking-widest">Arquitetura de Diretórios v15.0</p>
                      </div>
                   </div>
                   <button onClick={() => setShowSystemMapper(false)} className="p-3 glass rounded-2xl text-gray-500 hover:text-white transition-all"><X size={20}/></button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-10 custom-scrollbar space-y-10">
                   <div className="grid md:grid-cols-2 gap-10">
                      <div className="space-y-6">
                         <div className="text-[10px] font-black uppercase tracking-widest text-blue-500 italic">Estrutura de Arquivos (Root)</div>
                         <GlassCard className="!p-6 bg-black/40 border-white/5 space-y-1">
                            <ProjectFile name="/" icon={FolderTree} type="folder" />
                            <div className="ml-6 space-y-1 border-l border-white/5">
                               <ProjectFile name="views/" icon={FolderTree} type="folder" />
                               <div className="ml-6 space-y-1 border-l border-white/5">
                                  <ProjectFile name="Dashboard.tsx" icon={FileCode} />
                                  <ProjectFile name="LandingPage.tsx" icon={FileCode} />
                                  <ProjectFile name="LoginPage.tsx" icon={FileCode} />
                                  <ProjectFile name="OnboardingPage.tsx" icon={FileCode} />
                                  <ProjectFile name="ThankYouPage.tsx" icon={FileCode} />
                               </div>
                               <ProjectFile name="components/" icon={FolderTree} type="folder" />
                               <div className="ml-6 space-y-1 border-l border-white/5">
                                  <ProjectFile name="Buttons.tsx" icon={FileCode} />
                                  <ProjectFile name="GlassCard.tsx" icon={FileCode} />
                                  <ProjectFile name="Logo.tsx" icon={FileCode} />
                               </div>
                               <ProjectFile name="lib/" icon={FolderTree} type="folder" />
                               <div className="ml-6 space-y-1 border-l border-white/5">
                                  <ProjectFile name="supabase.ts" icon={Binary} />
                               </div>
                               <ProjectFile name="App.tsx" icon={FileCode} />
                               <ProjectFile name="index.tsx" icon={Binary} />
                               <ProjectFile name="index.html" icon={Globe} />
                               <ProjectFile name="package.json" icon={FileJson} />
                               <ProjectFile name=".env" icon={FileType} />
                            </div>
                         </GlassCard>
                      </div>

                      <div className="space-y-8">
                         <div className="space-y-4">
                            <h4 className="text-[11px] font-black uppercase tracking-widest text-orange-500 italic">Onde está o meu projeto?</h4>
                            <p className="text-[10px] font-bold text-gray-500 leading-relaxed uppercase">
                               Se você está usando este ambiente, os arquivos estão no <span className="text-white italic">diretório raiz virtual</span> deste projeto. Se você quer salvá-los no seu computador físico, você deve copiar o conteúdo de cada arquivo e salvá-los em uma pasta local.
                            </p>
                         </div>
                         <div className="p-6 bg-blue-600/5 border border-blue-500/10 rounded-2xl space-y-4">
                            <div className="flex items-center gap-3 text-blue-500">
                               <Settings2 size={16}/>
                               <span className="text-[10px] font-black uppercase">Dica Pro: Portainer</span>
                            </div>
                            <p className="text-[8px] font-black uppercase text-gray-600 leading-relaxed italic">
                               No Portainer, seu código vive dentro de um container Docker. Para ver os arquivos lá, você usaria o console do container. O que você editou aqui é o código-fonte, o que está lá é a versão compilada (Build).
                            </p>
                         </div>
                         <NeonButton onClick={() => setShowSystemMapper(false)} className="w-full !py-4 !text-[10px]">Entendido!</NeonButton>
                      </div>
                   </div>
                </div>
             </motion.div>
          </div>
        )}

        {showEnvLab && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/95 backdrop-blur-3xl">
             <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-[#050505] border border-orange-500/30 w-full max-w-4xl rounded-[3rem] overflow-hidden shadow-[0_0_150px_rgba(255,115,0,0.15)] flex flex-col max-h-[90vh]">
                <div className="p-10 border-b border-white/5 flex items-center justify-between bg-black/40">
                   <div className="flex items-center gap-4">
                      <div className="p-3 bg-orange-500/10 rounded-2xl text-orange-500"><Terminal size={24}/></div>
                      <div>
                         <h3 className="text-2xl font-black uppercase italic italic tracking-tighter">Guia de Criação <span className="text-orange-500">.env</span></h3>
                         <p className="text-[9px] font-black text-gray-700 uppercase tracking-widest">Protocolo de Implantação v14.0</p>
                      </div>
                   </div>
                   <button onClick={() => setShowEnvLab(false)} className="p-3 glass rounded-2xl text-gray-500 hover:text-white transition-all"><X size={20}/></button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-10 custom-scrollbar space-y-12">
                   <div className="grid md:grid-cols-2 gap-12">
                      <div className="space-y-6">
                         <div className="flex items-center justify-between">
                            <h4 className="text-[11px] font-black uppercase tracking-widest text-orange-500 italic">1. Conteúdo do .env</h4>
                            <button onClick={copyEnvToClipboard} className="text-[10px] font-black uppercase text-gray-500 hover:text-white flex items-center gap-2 transition-all">
                               {copied ? <Check size={14} className="text-green-500"/> : <Copy size={14}/>} {copied ? 'Copiado!' : 'Copiar'}
                            </button>
                         </div>
                         <div className="bg-black border border-white/10 rounded-2xl p-6 font-mono text-[10px] text-gray-400 relative group overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-rajado opacity-20"></div>
                            <div className="space-y-1">
                               <p className="text-gray-700"># Persistence Core</p>
                               <p><span className="text-orange-500/60">DATABASE_ENABLED</span>=true</p>
                               <p><span className="text-orange-500/60">DATABASE_TYPE</span>=postgresql</p>
                               <p className="text-white/40 font-black"><span className="text-orange-500/60">DATABASE_CONNECTION_URI</span>=postgresql://postgres:suasenha@postgres:5432/evolution?schema=public</p>
                               <p className="text-gray-700 mt-4"># Flags de Salvamento</p>
                               <p><span className="text-orange-500/60">DATABASE_SAVE_DATA_INSTANCE</span>=true</p>
                               <p><span className="text-orange-500/60">DATABASE_SAVE_DATA_NEW_MESSAGE</span>=true</p>
                               <p><span className="text-orange-500/60">DATABASE_SAVE_DATA_CONTACTS</span>=true</p>
                               <p><span className="text-orange-500/60">DATABASE_SAVE_DATA_CHATS</span>=true</p>
                            </div>
                         </div>
                         <div className="p-4 bg-orange-500/5 border border-orange-500/10 rounded-xl flex gap-4 items-start">
                            <AlertTriangle size={24} className="text-orange-500 shrink-0 mt-1" />
                            <p className="text-[9px] font-bold text-gray-500 leading-relaxed uppercase">
                               Troque <span className="text-white italic">"suasenha"</span> no Postgres do Portainer.
                            </p>
                         </div>
                      </div>

                      <div className="space-y-6">
                         <h4 className="text-[11px] font-black uppercase tracking-widest text-blue-500 italic">2. Como salvar (.env)</h4>
                         <div className="bg-[#f0f0f0] rounded-xl overflow-hidden shadow-2xl border border-white/10">
                            <div className="bg-[#e0e0e0] px-4 py-2 flex items-center justify-between text-[#333] border-b border-gray-300">
                               <div className="flex items-center gap-3">
                                  <div className="w-3 h-3 bg-blue-500 rounded-sm"></div>
                                  <span className="text-[10px] font-bold italic">notepad.exe</span>
                                </div>
                            </div>
                            <div className="p-6 space-y-5 text-[#333]">
                               <div className="space-y-1.5">
                                  <label className="text-[9px] font-black text-gray-500 uppercase">Nome:</label>
                                  <div className="bg-white border border-gray-400 p-2 text-[11px] font-mono text-blue-600 font-black">.env</div>
                               </div>
                               <div className="space-y-1.5">
                                  <label className="text-[9px] font-black text-gray-500 uppercase italic">Tipo:</label>
                                  <div className="bg-blue-600 border border-blue-700 p-2 text-[10px] font-black text-white flex justify-between items-center">
                                     <span>Todos os arquivos (*.*)</span>
                                     <ChevronDown size={14}/>
                                  </div>
                               </div>
                               <div className="flex justify-end pt-2">
                                  <div className="px-6 py-2 bg-[#e1e1e1] border border-gray-400 text-[10px] font-bold shadow-sm">Salvar</div>
                               </div>
                            </div>
                         </div>
                      </div>
                   </div>
                   <NeonButton onClick={() => setShowEnvLab(false)} className="w-full !py-4 !text-[10px]">Criar Agora!</NeonButton>
                </div>
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
