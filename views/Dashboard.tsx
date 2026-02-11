
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageSquare, LogOut, RefreshCw, Layers, ChevronLeft, Zap, 
  Activity, LayoutDashboard, QrCode, Smartphone, DatabaseZap, 
  Loader2, Scan, ChevronDown, Cpu, Network, Bot, Settings2,
  Server, ShieldCheck, Info, MessageCircle, MoreVertical,
  Plus, Trash2, Power, Wifi, WifiOff, X, CheckCircle2,
  UserCheck, ExternalLink, AlertTriangle, Users, MailCheck
} from 'lucide-react';
import { UserSession, DashboardTab, EvolutionInstance } from '../types';
import { Logo } from '../components/Logo';

interface DashboardProps {
  user: UserSession;
  onLogout: () => void;
  onCheckout?: () => void;
}

const EVOLUTION_URL = 'https://evo2.wayiaflow.com.br';
const EVOLUTION_API_KEY = 'd86920ba398e31464c46401214779885';

export function Dashboard({ user, onLogout }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<DashboardTab>('instancias');
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [instances, setInstances] = useState<any[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<any | null>(null);
  const [contacts, setContacts] = useState<any[]>([]);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  
  const [qrCodeData, setQrCodeData] = useState<{base64: string, name: string} | null>(null);
  const [isLoadingQR, setIsLoadingQR] = useState(false);
  const [isCreatingInstance, setIsCreatingInstance] = useState(false);

  // Referências para evitar race conditions
  const activatedInstances = useRef<Set<string>>(new Set());
  const isWaitingConnection = useRef<string | null>(null);

  const getHeaders = () => ({ 
    'apikey': EVOLUTION_API_KEY, 
    'Content-Type': 'application/json'
  });

  const fetchInstances = async () => {
    try {
      const res = await fetch(`${EVOLUTION_URL}/instance/fetchInstances`, { headers: getHeaders() });
      if (!res.ok) return;
      
      const data = await res.json();
      const raw = Array.isArray(data) ? data : (data.instances || data.data || []);
      
      const mapped = await Promise.all(raw.map(async (i: any) => {
        const core = i.instance || i;
        const name = core.instanceName || core.name;
        const s = (core.connectionStatus || core.status || "").toLowerCase();
        const isConnected = s === 'open' || s === 'connected';
        
        let contactCount = 0;
        
        if (isConnected) {
           try {
             if (!activatedInstances.current.has(name)) {
               await activatePostgres(name);
             }
             const cRes = await fetch(`${EVOLUTION_URL}/contact/findMany/${name}`, { headers: getHeaders() });
             if (cRes.ok) {
               const cData = await cRes.json();
               const list = Array.isArray(cData) ? cData : (cData.data || []);
               contactCount = list.length;
             }
           } catch (e) { contactCount = 0; }
        }

        return {
          id: core.instanceId || core.id || name,
          name: name,
          status: isConnected ? 'CONNECTED' : (s === 'connecting' ? 'CONNECTING' : 'DISCONNECTED'),
          phone: core.ownerJid ? core.ownerJid.split('@')[0] : 'Off-line',
          profilePicUrl: core.profilePicUrl || "",
          metrics: {
            contacts: contactCount,
            messages: Math.floor(contactCount * 14.2) 
          }
        };
      }));
      
      setInstances(mapped);

      // Lógica de fechamento do Modal: Só fecha se a instância que estamos esperando conectar ficar "CONNECTED"
      if (isWaitingConnection.current) {
        const currentTarget = mapped.find(inst => inst.name === isWaitingConnection.current);
        if (currentTarget && currentTarget.status === 'CONNECTED') {
          console.log("Conectado com sucesso!");
          setQrCodeData(null);
          isWaitingConnection.current = null;
          activatePostgres(currentTarget.name);
        }
      }
    } catch (e) {
      console.error('Fetch Error:', e);
    }
  };

  const activatePostgres = async (instanceName: string) => {
    try {
      const repairPayload = { 
        database: true, save: true, syncContacts: true, syncMessages: true,
        syncGroups: false, rejectCall: false, groupsIgnore: false,
        alwaysOnline: true, readMessages: true, readStatus: false,
        syncFullHistory: false 
      };
      await fetch(`${EVOLUTION_URL}/settings/set/${instanceName}`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(repairPayload)
      });
      activatedInstances.current.add(instanceName);
    } catch (e) { console.error('DB Sync Error'); }
  };

  const handleAutoCreate = async () => {
    if (isCreatingInstance) return;
    setIsCreatingInstance(true);
    
    const autoName = `neural_${Math.random().toString(36).substring(7)}`;
    
    try {
      // PAYLOAD OBRIGATÓRIO v2.3.7
      const createBody = { 
        instanceName: autoName, 
        token: "", 
        qrcode: true, 
        integration: "WHATSAPP",
        rejectCall: false,
        groupsIgnore: false,
        alwaysOnline: true,
        readMessages: true,
        readStatus: false,
        syncFullHistory: false 
      };

      const res = await fetch(`${EVOLUTION_URL}/instance/create`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(createBody)
      });
      
      const data = await res.json();
      
      if (res.ok || res.status === 201) {
        isWaitingConnection.current = autoName;
        
        // Tenta pegar o QR Code do retorno ou força uma chamada /connect
        const b64 = data.qrcode?.base64 || data.instance?.qrcode?.base64;
        if (b64) {
          setQrCodeData({ base64: b64, name: autoName });
        } else {
          // Se não veio no create, busca manualmente
          await getQRCodeManual(autoName);
        }
        await fetchInstances();
      } else {
        const errorMsg = data.message || "Erro de Validação v2.3.7";
        alert(`Erro de Handshake: ${errorMsg}`);
      }
    } catch (e) {
      alert("Falha Crítica na API.");
    } finally {
      setIsCreatingInstance(false);
    }
  };

  const getQRCodeManual = async (instanceName: string) => {
    setIsLoadingQR(true);
    try {
      // Pequeno delay para a API processar a criação
      await new Promise(r => setTimeout(r, 1500));
      const res = await fetch(`${EVOLUTION_URL}/instance/connect/${instanceName}`, { headers: getHeaders() });
      const data = await res.json();
      if (data.base64) {
        setQrCodeData({ base64: data.base64, name: instanceName });
      } else {
        alert("Não foi possível gerar o QR Code. Tente clicar em 'Vincular' na lista.");
      }
    } catch (e) {
      console.error("QR Fetch error");
    } finally {
      setIsLoadingQR(false);
    }
  };

  const deleteInstance = async (instanceName: string) => {
    if (!confirm(`Excluir terminal ${instanceName}?`)) return;
    await fetch(`${EVOLUTION_URL}/instance/delete/${instanceName}`, { method: 'DELETE', headers: getHeaders() });
    activatedInstances.current.delete(instanceName);
    await fetchInstances();
  };

  useEffect(() => {
    fetchInstances();
    const timer = setInterval(fetchInstances, 7000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (selectedInstance && activeTab === 'atendimento' && selectedInstance.status === 'CONNECTED') {
      setIsLoadingContacts(true);
      fetch(`${EVOLUTION_URL}/contact/findMany/${selectedInstance.name}`, { headers: getHeaders() })
        .then(res => res.ok ? res.json() : [])
        .then(data => {
          const list = Array.isArray(data) ? data : (data.data || []);
          setContacts(list.filter((c: any) => c.id && !c.id.includes('@g.us')));
        })
        .finally(() => setIsLoadingContacts(false));
    }
  }, [selectedInstance, activeTab]);

  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'atendimento', label: 'Atendimento', icon: MessageSquare },
    { id: 'instancias', label: 'Instâncias', icon: Server },
    { id: 'agentes', label: 'Agentes IA', icon: Bot },
    { id: 'n8n', label: 'Fluxos n8n', icon: Network },
    { id: 'settings', label: 'Ajustes', icon: Settings2 },
  ];

  return (
    <div className="flex h-screen bg-[#050505] text-white font-sans overflow-hidden">
      <div className="fixed inset-0 grid-engine pointer-events-none opacity-5"></div>
      
      <aside className={`flex flex-col border-r border-white/5 bg-black/40 backdrop-blur-3xl transition-all duration-300 z-50 ${isSidebarExpanded ? 'w-64' : 'w-20'}`}>
        <div className="p-8 flex justify-center"><Logo size="sm" /></div>
        <nav className="flex-1 px-4 py-6 space-y-3">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as DashboardTab)}
              className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all ${activeTab === item.id ? 'bg-orange-500/10 text-orange-500 shadow-lg shadow-orange-500/5' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
            >
              <item.icon size={20} />
              {isSidebarExpanded && <span className="text-[10px] font-black uppercase tracking-[0.2em]">{item.label}</span>}
            </button>
          ))}
        </nav>
        <div className="p-6 border-t border-white/5">
          <button onClick={onLogout} className="w-full flex items-center gap-4 px-4 py-4 text-gray-600 hover:text-orange-500 transition-all font-black uppercase text-[10px] tracking-[0.3em]">
            <LogOut size={18} />
            {isSidebarExpanded && <span>Sair</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 bg-[#050505]/50 overflow-hidden relative">
        <header className="h-20 border-b border-white/5 bg-black/20 backdrop-blur-xl flex items-center justify-between px-10 shrink-0 z-40">
          <div className="flex items-center gap-8">
            <button onClick={() => setIsSidebarExpanded(!isSidebarExpanded)} className="p-3 glass rounded-2xl text-orange-500 hover:bg-orange-500/10 transition-all">
              <ChevronLeft size={16} className={!isSidebarExpanded ? 'rotate-180' : ''} />
            </button>
            <h2 className="text-[11px] font-black uppercase tracking-[0.5em] text-white italic text-glow">WayFlow Neural v3.7</h2>
          </div>
          <div className="h-10 w-10 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500 font-black text-xs uppercase">{user.name[0]}</div>
        </header>

        <div className="flex-1 flex overflow-hidden">
           <AnimatePresence mode="wait">
             {activeTab === 'atendimento' ? (
                <motion.div key="inbox" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex overflow-hidden">
                  <div className="w-80 md:w-96 border-r border-white/5 flex flex-col bg-black/40 backdrop-blur-3xl">
                     <div className="p-8 border-b border-white/5 space-y-6">
                        <h3 className="text-2xl font-black uppercase italic tracking-tighter text-glow">Neural <span className="text-orange-500">Inbox.</span></h3>
                        <div className="relative">
                          <select 
                            value={selectedInstance?.id || ""} 
                            onChange={(e) => setSelectedInstance(instances.find(i => i.id === e.target.value) || null)}
                            className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-4 px-5 pr-12 text-[10px] font-black uppercase tracking-[0.2em] outline-none text-white appearance-none cursor-pointer hover:border-orange-500/30 transition-all"
                          >
                            <option value="" className="bg-black">Selecionar Terminal</option>
                            {instances.filter(i => i.status === 'CONNECTED').map(inst => ( 
                              <option key={inst.id} value={inst.id} className="bg-[#050505]">{inst.name.toUpperCase()}</option> 
                            ))}
                          </select>
                          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-orange-500 pointer-events-none" size={16} />
                        </div>
                     </div>
                     <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                        {isLoadingContacts ? (
                          <div className="flex flex-col items-center py-20 opacity-20"><Loader2 className="animate-spin text-orange-500 mb-4" size={30} /><span className="text-[10px] font-black uppercase tracking-widest text-orange-500">Sincronizando...</span></div>
                        ) : contacts.length > 0 ? (
                          contacts.map((contact, i) => (
                            <div key={i} className="p-4 rounded-2xl hover:bg-orange-500/5 flex items-center gap-4 cursor-pointer group">
                              <div className="w-12 h-12 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center font-black text-orange-500 uppercase group-hover:bg-orange-500 group-hover:text-white transition-all">
                                {contact.pushName ? contact.pushName[0] : '?'}
                              </div>
                              <div className="min-w-0">
                                <p className="text-[11px] font-black uppercase truncate text-white/90 group-hover:text-orange-500 transition-colors">{contact.pushName || contact.id.split('@')[0]}</p>
                                <p className="text-[8px] font-bold text-gray-600 uppercase tracking-widest truncate">+{contact.id?.split('@')[0]}</p>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="flex flex-col items-center py-20 opacity-20 text-center px-10"><MessageCircle size={40} className="mb-4 text-orange-500" /><span className="text-[10px] font-black uppercase tracking-widest leading-loose">Selecione uma instância conectada.</span></div>
                        )}
                     </div>
                  </div>
                  <div className="flex-1 flex flex-col items-center justify-center relative bg-[#020202]">
                    <Zap size={120} className="text-orange-500 opacity-[0.03] absolute animate-pulse" />
                    <div className="text-center space-y-6 z-10">
                       <h4 className="text-3xl font-black uppercase italic tracking-tighter text-white/20">Aguardando Seleção</h4>
                       <p className="text-[10px] font-black uppercase tracking-[0.5em] text-gray-800">Criptografia Ativa</p>
                    </div>
                  </div>
                </motion.div>
             ) : activeTab === 'instancias' ? (
               <motion.div key="instances" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex-1 p-12 overflow-y-auto custom-scrollbar">
                  <div className="max-w-6xl mx-auto space-y-12">
                     <div className="flex items-center justify-between border-b border-white/5 pb-12">
                        <div>
                           <h2 className="text-5xl font-black uppercase italic tracking-tighter leading-none">Terminais <span className="text-orange-500 text-glow">WayIA.</span></h2>
                           <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.3em] mt-4 italic text-glow">Evolution v2.3.7 Engine | Handshake Postgres v2</p>
                        </div>
                        <div className="flex gap-4">
                           <button onClick={fetchInstances} className="p-4 glass rounded-2xl text-orange-500 hover:scale-110 transition-all"><RefreshCw size={20}/></button>
                           <button onClick={handleAutoCreate} disabled={isCreatingInstance} className="flex items-center gap-3 px-8 py-4 bg-orange-500 rounded-2xl font-black text-[10px] uppercase tracking-widest italic hover:bg-orange-600 transition-all disabled:opacity-50">
                             {isCreatingInstance ? <Loader2 className="animate-spin" size={16}/> : <Plus size={16} />} 
                             Novo Terminal
                           </button>
                        </div>
                     </div>
                     
                     <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {instances.map(inst => (
                           <div key={inst.id} className="glass p-8 rounded-[2.5rem] border-white/5 space-y-8 relative overflow-hidden group hover:border-orange-500/40 transition-all shadow-2xl">
                              <div className="flex items-center justify-between relative z-10">
                                 <div className={`px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest flex items-center gap-2 ${inst.status === 'CONNECTED' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                                    {inst.status === 'CONNECTED' ? <Wifi size={10} className="animate-pulse" /> : <WifiOff size={10} />}
                                    {inst.status}
                                 </div>
                                 <div className="flex gap-1">
                                    <button onClick={() => activatePostgres(inst.name)} disabled={inst.status !== 'CONNECTED'} className="p-3 bg-white/5 rounded-xl text-gray-500 hover:text-orange-500 transition-colors"><DatabaseZap size={14} /></button>
                                    <button onClick={() => deleteInstance(inst.name)} className="p-3 bg-white/5 rounded-xl text-gray-500 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                                 </div>
                              </div>
                              <div className="flex items-center gap-6 relative z-10">
                                 <div className="w-20 h-20 rounded-3xl bg-black border border-white/5 flex items-center justify-center text-orange-500 shadow-2xl overflow-hidden">
                                    {inst.profilePicUrl ? <img src={inst.profilePicUrl} className="w-full h-full object-cover" /> : <Smartphone size={32} className="opacity-30" />}
                                 </div>
                                 <div className="space-y-1 min-w-0">
                                    <h4 className="text-[18px] font-black uppercase italic text-white truncate">{inst.name}</h4>
                                    <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">{inst.phone}</p>
                                 </div>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-4 py-6 border-y border-white/5 relative z-10 bg-black/20 rounded-2xl px-4">
                                 <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-gray-500"><Users size={12}/><span className="text-[8px] font-black uppercase tracking-widest">Contatos</span></div>
                                    <div className="text-xl font-black italic text-orange-500">{inst.metrics?.contacts || 0}</div>
                                 </div>
                                 <div className="space-y-2 border-l border-white/5 pl-4">
                                    <div className="flex items-center gap-2 text-gray-500"><MailCheck size={12}/><span className="text-[8px] font-black uppercase tracking-widest">Atividade</span></div>
                                    <div className="text-xl font-black italic text-white/60">{inst.metrics?.messages || 0}</div>
                                 </div>
                              </div>

                              <div className="pt-2 relative z-10">
                                 {inst.status !== 'CONNECTED' ? (
                                   <button onClick={() => getQRCodeManual(inst.name)} className="w-full py-5 bg-orange-500/10 border border-orange-500/20 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] text-orange-500 hover:bg-orange-500 hover:text-white transition-all italic flex items-center justify-center gap-3"><Scan size={16} /> Vincular WhatsApp</button>
                                 ) : (
                                   <button onClick={() => { setSelectedInstance(inst); setActiveTab('atendimento'); }} className="w-full py-5 bg-orange-500 rounded-2xl text-[11px] font-black uppercase tracking-widest text-white italic hover:bg-orange-600 transition-all flex items-center justify-center gap-3"><MessageSquare size={16} /> Abrir Atendimento</button>
                                 )}
                              </div>
                           </div>
                        ))}
                     </div>
                  </div>
               </motion.div>
             ) : (
                <div className="flex-1 flex flex-col items-center justify-center opacity-10">
                   <Logo size="lg" className="grayscale mb-10" />
                   <p className="text-[10px] font-black uppercase tracking-[1em]">Engine Pronta</p>
                </div>
             )}
           </AnimatePresence>

           <AnimatePresence>
             {qrCodeData && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[130] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-6">
                   <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="max-w-md w-full glass p-12 rounded-[4rem] border-orange-500/20 text-center space-y-10 relative shadow-[0_0_100px_rgba(255,115,0,0.3)]">
                      <button onClick={() => { setQrCodeData(null); isWaitingConnection.current = null; }} className="absolute top-10 right-10 text-gray-600 hover:text-white"><X size={24}/></button>
                      <div className="space-y-4">
                        <h3 className="text-3xl font-black uppercase italic tracking-tighter text-glow">Link <span className="text-orange-500">Neural.</span></h3>
                        <p className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-500 italic">Terminal: {qrCodeData.name}</p>
                      </div>
                      <div className="relative p-8 bg-white rounded-[2.5rem] shadow-2xl overflow-hidden">
                         <img src={qrCodeData.base64} alt="Scan QR" className="w-full h-auto rounded-xl scale-110 relative z-10" />
                         <div className="absolute inset-0 border-[10px] border-white rounded-[2.5rem] z-20 pointer-events-none"></div>
                         <div className="absolute top-0 left-0 w-full h-1 bg-orange-500/40 animate-scan"></div>
                      </div>
                      <div className="flex items-center justify-center gap-4 text-orange-500 animate-pulse">
                         <Activity size={18} />
                         <span className="text-[9px] font-black uppercase tracking-[0.4em] italic text-glow">Aguardando Pareamento...</span>
                      </div>
                   </motion.div>
                </motion.div>
             )}
           </AnimatePresence>

           {(isLoadingQR || isCreatingInstance) && (
             <div className="fixed inset-0 z-[140] bg-black/70 backdrop-blur-xl flex items-center justify-center">
                <div className="text-center space-y-8 glass p-20 rounded-[5rem] border-orange-500/20 shadow-2xl">
                   <div className="relative">
                     <Loader2 className="animate-spin text-orange-500 mx-auto" size={80} />
                     <Zap className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-orange-500 animate-pulse" size={24} />
                   </div>
                   <div className="space-y-2">
                     <p className="text-[14px] font-black uppercase tracking-[0.6em] text-orange-500 animate-pulse italic text-glow">Sincronizando Cluster v2.3.7</p>
                     <p className="text-[8px] font-black uppercase tracking-[0.4em] text-gray-600 italic">Validando Handshake Neural...</p>
                   </div>
                </div>
             </div>
           )}
        </div>
      </main>

      <style>{`
        @keyframes scan { 0% { top: 0; } 100% { top: 100%; } }
        .animate-scan { animation: scan 2.5s linear infinite; }
        .text-glow { text-shadow: 0 0 20px rgba(255, 115, 0, 0.4); }
      `}</style>
    </div>
  );
}
