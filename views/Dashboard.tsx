
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageSquare, LogOut, RefreshCw, Layers, ChevronLeft, Zap, 
  Activity, LayoutDashboard, QrCode, Smartphone, DatabaseZap, 
  Loader2, Scan, ChevronDown, Cpu, Network, Bot, Settings2,
  Server, ShieldCheck, Info, MessageCircle, MoreVertical,
  Plus, Trash2, Power, Wifi, WifiOff, X, CheckCircle2,
  UserCheck, ExternalLink, AlertTriangle, Users, MailCheck,
  Terminal, ShieldAlert, Filter, Database, Search, Link2,
  ShieldQuestion, Bug, Radio, RotateCcw, Fingerprint, HardDrive,
  Link, Shield, Cable, Braces, Unplug, LifeBuoy, ZapOff,
  Stethoscope, Waves, HeartPulse, Edit3
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
  const [lastRouteUsed, setLastRouteUsed] = useState<string>('');
  
  const [qrCodeData, setQrCodeData] = useState<{base64: string, name: string} | null>(null);
  const [isLoadingQR, setIsLoadingQR] = useState(false);
  const [isCreatingInstance, setIsCreatingInstance] = useState(false);
  const [isNamingInstance, setIsNamingInstance] = useState(false);
  const [newInstanceName, setNewInstanceName] = useState('');
  const [apiError, setApiError] = useState<string | null>(null);

  // v5.7: Neural Overdrive Headers - Força o Router a ignorar cache de proxy e DB estagnado
  const getHeaders = (instanceName?: string) => ({ 
    'apikey': EVOLUTION_API_KEY, 
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'X-Force-Instance-Sync': 'true',
    'X-Neural-Pulse': Date.now().toString(),
    ...(instanceName ? { 
      'instance': instanceName,
      'X-Instance-Name': instanceName 
    } : {}) 
  });

  const fetchInstances = async () => {
    try {
      const res = await fetch(`${EVOLUTION_URL}/instance/fetchInstances?v=${Date.now()}`, { 
        headers: getHeaders(),
        mode: 'cors'
      });
      if (!res.ok) return;
      const data = await res.json();
      const raw = Array.isArray(data) ? data : (data.instances || data.data || []);
      const mapped = raw.map((i: any) => {
        const core = i.instance || i;
        const name = core.instanceName || core.name;
        const s = (core.connectionStatus || core.status || "").toLowerCase();
        const isConnected = s === 'open' || s === 'connected';
        return {
          id: core.instanceId || core.id || name, 
          name: name,
          status: isConnected ? 'CONNECTED' : (s === 'connecting' ? 'CONNECTING' : 'DISCONNECTED'),
          phone: core.ownerJid ? core.ownerJid.split('@')[0] : 'Off-line',
          profilePicUrl: core.profilePicUrl || "",
        };
      });
      setInstances(mapped);
      
      if (selectedInstance) {
        const updated = mapped.find(i => i.id === selectedInstance.id);
        if (updated && updated.status !== selectedInstance.status) {
          setSelectedInstance(updated);
        }
      }
    } catch (e) {
      console.error('Polling Error:', e);
    }
  };

  const neuralOverdriveRepair = async (name: string) => {
    setLastRouteUsed('Overdrive: Forçando Re-sincronização...');
    try {
      await fetch(`${EVOLUTION_URL}/instance/connectionState/${name}`, { headers: getHeaders(name) });
      await fetch(`${EVOLUTION_URL}/instance/connect/${name}`, { 
        method: 'POST', 
        headers: getHeaders(name),
        body: JSON.stringify({ qrcode: false, qrcodeFull: false })
      });
      await new Promise(r => setTimeout(r, 3500));
      return true;
    } catch (e) {
      return false;
    }
  };

  const recycleInstance = async (name: string) => {
    setIsLoadingContacts(true);
    setLastRouteUsed('Neural-Reset: Executando Overdrive...');
    await neuralOverdriveRepair(name);
    await fetchInstances();
    if (activeTab === 'atendimento') loadContacts();
  };

  const loadContacts = async (retryCount = 0) => {
    if (!selectedInstance || selectedInstance.status !== 'CONNECTED') return;
    
    setIsLoadingContacts(true);
    setApiError(null);
    const name = selectedInstance.name;
    const uuid = selectedInstance.id;

    try {
      setLastRouteUsed('Neural-Bridge v5.6: Ativa');
      if (retryCount > 0) {
        setLastRouteUsed(`Overdrive Repair [${retryCount}/3]...`);
        await neuralOverdriveRepair(name);
      }

      const routes = [
        `/contact/fetchContacts/${name}`,
        `/contact/findMany?instanceName=${name}`,
        `/contact/findMany/${uuid}`,
        `/contact/getContacts/${name}`
      ];

      let successfulData = null;
      let usedRoute = '';

      for (const route of routes) {
        try {
          const res = await fetch(`${EVOLUTION_URL}${route}${route.includes('?') ? '&' : '?'}v=${Date.now()}`, { 
            headers: getHeaders(name),
            mode: 'cors'
          });
          if (res.ok) {
            const data = await res.json();
            const list = Array.isArray(data) ? data : (data.data || data.contacts);
            if (list !== null && list !== undefined) { 
              successfulData = list;
              usedRoute = route;
              break;
            }
          }
        } catch (e) { continue; }
      }

      if (successfulData === null) {
        if (retryCount < 2) { 
          await new Promise(r => setTimeout(r, 1500 * (retryCount + 1)));
          return loadContacts(retryCount + 1);
        }
        throw new Error("Ponte Rompida: O terminal está ativo mas o acesso ao banco de dados foi negado. Clique em 'RECICLAR'.");
      }

      setLastRouteUsed(`Overdrive Stable: ${usedRoute.includes('fetch') ? 'BAILEYS-CACHE' : 'SQL-LINK'}`);

      const filtered = successfulData.filter((c: any) => {
        const jid = c.id || c.remoteJid || c.jid || "";
        return jid && jid.includes('@s.whatsapp.net');
      }).map((c: any) => ({
        ...c,
        id: c.id || c.remoteJid || c.jid,
        name: c.pushName || c.name || c.verifiedName || (c.id || "").split('@')[0]
      }));

      setContacts(filtered);
    } catch (e: any) {
      setApiError(e.message);
      setLastRouteUsed('Falha de Túnel');
    } finally {
      setIsLoadingContacts(false);
    }
  };

  const handleOpenNamingModal = () => {
    setNewInstanceName('');
    setIsNamingInstance(true);
  };

  const confirmCreateInstance = async () => {
    if (isCreatingInstance || !newInstanceName) return;
    setIsCreatingInstance(true);
    setApiError(null);
    try {
      const res = await fetch(`${EVOLUTION_URL}/instance/create`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ 
          instanceName: newInstanceName, 
          token: "wayflow_" + Math.random().toString(36).substring(5), 
          integration: "WHATSAPP-BAILEYS", 
          qrcode: true 
        })
      });
      if (res.ok) {
        setIsNamingInstance(false);
        await fetchInstances();
        await forceQRGeneration(newInstanceName);
      } else {
        const err = await res.json();
        setApiError(err.message || "Erro ao criar instância.");
      }
    } catch (e) { 
      setApiError("Falha na criação do cluster."); 
    } finally { 
      setIsCreatingInstance(false); 
    }
  };

  const forceQRGeneration = async (instanceName: string) => {
    setIsLoadingQR(true);
    try {
      const res = await fetch(`${EVOLUTION_URL}/instance/connect/${instanceName}`, { headers: getHeaders(instanceName) });
      const data = await res.json();
      const base64 = data.base64 || data.qrcode?.base64;
      if (base64) setQrCodeData({ base64: base64, name: instanceName });
      else setTimeout(() => forceQRGeneration(instanceName), 4000);
    } catch (e) { console.error("QR Sync Error"); }
    finally { setIsLoadingQR(false); }
  };

  const deleteInstance = async (name: string) => {
    if (!confirm(`Remover terminal ${name}?`)) return;
    await fetch(`${EVOLUTION_URL}/instance/delete/${name}`, { method: 'DELETE', headers: getHeaders() });
    await fetchInstances();
  };

  useEffect(() => {
    fetchInstances();
    const timer = setInterval(fetchInstances, 25000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (activeTab === 'atendimento' && selectedInstance) loadContacts();
  }, [selectedInstance?.id, activeTab]);

  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'atendimento', label: 'Atendimento', icon: MessageSquare },
    { id: 'instancias', label: 'Instâncias', icon: Server },
    { id: 'agentes', label: 'Agentes IA', icon: Bot },
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
            <div className="flex flex-col">
              <h2 className="text-[11px] font-black uppercase tracking-[0.5em] text-glow">WayFlow Neural v5.7</h2>
              <span className="text-[7px] font-bold text-orange-500 uppercase tracking-widest italic text-glow">Neural-Controller: ACTIVE</span>
            </div>
          </div>
          <div className="h-10 w-10 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500 font-black text-xs shadow-lg">{user.name[0]}</div>
        </header>

        <div className="flex-1 flex overflow-hidden">
           <AnimatePresence mode="wait">
             {activeTab === 'atendimento' ? (
                <motion.div key="inbox" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex overflow-hidden">
                  <div className="w-80 md:w-96 border-r border-white/5 flex flex-col bg-black/40 backdrop-blur-3xl">
                     <div className="p-8 border-b border-white/5 space-y-6">
                        <div className="flex items-center justify-between">
                          <h3 className="text-2xl font-black uppercase italic tracking-tighter text-glow">Neural <span className="text-orange-500">Inbox.</span></h3>
                          <button onClick={() => loadContacts()} disabled={isLoadingContacts} className="p-2 text-orange-500 hover:bg-orange-500/10 rounded-xl transition-all shadow-sm">
                            <RefreshCw size={16} className={isLoadingContacts ? 'animate-spin' : ''} />
                          </button>
                        </div>
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
                        
                        {lastRouteUsed && (
                          <div className={`px-4 py-3 rounded-xl flex items-center gap-3 border transition-all ${lastRouteUsed.includes('Falha') || lastRouteUsed.includes('Repair') || lastRouteUsed.includes('Zumbi') ? 'bg-red-500/5 border-red-500/10 animate-pulse' : 'bg-orange-500/5 border-orange-500/10'}`}>
                            <div className={`p-1.5 rounded-lg ${lastRouteUsed.includes('Falha') || lastRouteUsed.includes('Repair') ? 'bg-red-500/10 text-red-500' : 'bg-orange-500/10 text-orange-500'}`}>
                               {lastRouteUsed.includes('Overdrive') ? <HeartPulse size={12} className="animate-pulse" /> : <Network size={12} className={isLoadingContacts ? 'animate-pulse' : ''} />}
                            </div>
                            <div className="flex flex-col overflow-hidden">
                              <span className="text-[6px] font-black uppercase text-gray-600 tracking-widest">Estado da Ponte</span>
                              <span className="text-[8px] font-mono text-white truncate font-bold uppercase">{lastRouteUsed}</span>
                            </div>
                          </div>
                        )}
                     </div>

                     <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                        {isLoadingContacts ? (
                          <div className="flex flex-col items-center py-20 opacity-40 text-center">
                            <Loader2 className="animate-spin text-orange-500 mb-4" size={32} />
                            <span className="text-[10px] font-black uppercase tracking-widest text-orange-500 italic px-10">Neural Overdrive v5.7...</span>
                          </div>
                        ) : contacts.length > 0 ? (
                          contacts.map((contact, i) => (
                            <div key={i} className="p-4 rounded-2xl hover:bg-orange-500/5 flex items-center gap-4 cursor-pointer group mb-2 border border-transparent hover:border-orange-500/20 transition-all">
                              <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center font-black text-orange-500 uppercase group-hover:bg-orange-500 group-hover:text-white transition-all">
                                {contact.name ? contact.name[0] : '?'}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-[11px] font-black uppercase truncate text-white/90 group-hover:text-orange-500 transition-colors">{contact.name || "Desconhecido"}</p>
                                <p className="text-[8px] font-bold text-gray-600 uppercase tracking-widest truncate">+{ (contact.id || "").split('@')[0] }</p>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="flex flex-col items-center py-24 opacity-30 text-center px-10">
                            <Database size={44} className="mb-6 text-orange-500" />
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] leading-relaxed">
                              {selectedInstance ? 'Negociando Ponte...' : 'Selecione um terminal.'}
                            </span>
                            {apiError && (
                              <div className="mt-8 p-6 rounded-3xl bg-red-500/5 border border-red-500/10 space-y-4">
                                <p className="text-[8px] text-red-500 font-black uppercase tracking-widest flex items-center gap-2 justify-center"><ZapOff size={10}/> Ponte Zumbi</p>
                                <p className="text-[9px] text-gray-500 lowercase leading-tight italic text-center">{apiError}</p>
                                <button 
                                  onClick={() => selectedInstance && recycleInstance(selectedInstance.name)}
                                  className="w-full py-3 bg-orange-500/10 border border-orange-500/20 rounded-xl text-[8px] font-black uppercase tracking-widest text-orange-500 hover:bg-orange-500 hover:text-white transition-all flex items-center justify-center gap-2"
                                >
                                  <RotateCcw size={10} /> Forçar Neural-Overdrive
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                     </div>
                  </div>
                  <div className="flex-1 flex flex-col items-center justify-center relative bg-[#020202]">
                    <Zap size={140} className="text-orange-500 opacity-[0.02] absolute animate-pulse" />
                    <div className="text-center space-y-6 z-10 p-12 glass border-white/5 rounded-[4rem]">
                       <h4 className="text-3xl font-black uppercase italic tracking-tighter text-white/10">Neural Hub Ready</h4>
                       <p className="text-[10px] font-black uppercase tracking-[0.5em] text-gray-800 italic">WayFlow Overdrive v5.7</p>
                    </div>
                  </div>
                </motion.div>
             ) : activeTab === 'instancias' ? (
                <motion.div key="instances" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex-1 p-12 overflow-y-auto custom-scrollbar">
                  <div className="max-w-6xl mx-auto space-y-12">
                     <div className="flex items-center justify-between border-b border-white/5 pb-12">
                        <div>
                           <h2 className="text-5xl font-black uppercase italic tracking-tighter leading-none">Terminais <span className="text-orange-500 text-glow">WayIA.</span></h2>
                           <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.3em] mt-4 italic">Evolution Engine v2.3.7 | Overdrive v5.7</p>
                        </div>
                        <div className="flex gap-4">
                           <button onClick={handleOpenNamingModal} className="flex items-center gap-3 px-8 py-4 bg-orange-500 rounded-2xl font-black text-[10px] uppercase tracking-widest italic hover:bg-orange-600 transition-all shadow-[0_0_30px_rgba(255,115,0,0.3)]">
                             <Plus size={16} /> Nova Instância
                           </button>
                        </div>
                     </div>
                     <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {instances.map(inst => (
                           <div key={inst.id} className="glass p-8 rounded-[2.5rem] border-white/5 space-y-8 relative overflow-hidden group hover:border-orange-500/40 transition-all shadow-xl">
                              <div className="flex items-center justify-between relative z-10">
                                 <div className={`px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest flex items-center gap-2 ${inst.status === 'CONNECTED' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                                    {inst.status === 'CONNECTED' ? <Wifi size={10} className="animate-pulse" /> : <WifiOff size={10} />} {inst.status}
                                 </div>
                                 <div className="flex gap-2">
                                    <button onClick={() => recycleInstance(inst.name)} title="Neural-Overdrive Recovery" className="p-3 bg-white/5 rounded-xl text-gray-500 hover:text-orange-500 transition-colors"><RotateCcw size={14} /></button>
                                    <button onClick={() => deleteInstance(inst.name)} className="p-3 bg-white/5 rounded-xl text-gray-500 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                                 </div>
                              </div>
                              <div className="flex items-center gap-6 relative z-10">
                                 <div className="w-16 h-16 rounded-3xl bg-black border border-white/5 flex items-center justify-center text-orange-500 overflow-hidden shadow-inner">
                                    {inst.profilePicUrl ? <img src={inst.profilePicUrl} className="w-full h-full object-cover" /> : <Smartphone size={24} className="opacity-40" />}
                                 </div>
                                 <div className="min-w-0">
                                    <h4 className="text-[16px] font-black uppercase italic text-white truncate">{inst.name}</h4>
                                    <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest truncate">{inst.phone}</p>
                                    <div className="flex items-center gap-2 mt-1 opacity-20">
                                       <Fingerprint size={10} />
                                       <span className="text-[6px] font-mono truncate max-w-[100px] uppercase italic">{inst.id}</span>
                                    </div>
                                 </div>
                              </div>
                              <div className="pt-2">
                                 {inst.status !== 'CONNECTED' ? (
                                   <button onClick={() => forceQRGeneration(inst.name)} className="w-full py-5 bg-orange-500/10 border border-orange-500/20 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] text-orange-500 hover:bg-orange-500 hover:text-white transition-all italic flex items-center justify-center gap-3"><Scan size={16} /> Vincular Terminal</button>
                                 ) : (
                                   <button onClick={() => { setSelectedInstance(inst); setActiveTab('atendimento'); }} className="w-full py-5 bg-orange-500 rounded-2xl text-[11px] font-black uppercase tracking-widest text-white italic hover:bg-orange-600 transition-all flex items-center justify-center gap-3 shadow-lg shadow-orange-500/30"><MessageSquare size={16} /> Abrir Atendimento</button>
                                 )}
                              </div>
                           </div>
                        ))}
                     </div>
                  </div>
                </motion.div>
             ) : null}
           </AnimatePresence>

           {/* NAMING MODAL */}
           <AnimatePresence>
             {isNamingInstance && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-6">
                   <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="max-w-md w-full glass p-10 rounded-[3rem] border-orange-500/20 space-y-8 relative shadow-2xl">
                      <button onClick={() => setIsNamingInstance(false)} className="absolute top-8 right-8 text-gray-500 hover:text-white transition-all"><X size={20}/></button>
                      <div className="text-center space-y-2">
                        <h3 className="text-3xl font-black uppercase italic tracking-tighter text-white">Identificar <span className="text-orange-500">Terminal</span></h3>
                        <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest text-center">Defina um nome exclusivo para este cluster neural</p>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[8px] font-black uppercase text-orange-500 tracking-[0.3em] ml-2 flex items-center gap-2"><Edit3 size={10}/> Nome da Instância</label>
                        <input 
                          autoFocus
                          type="text" 
                          value={newInstanceName}
                          onChange={(e) => setNewInstanceName(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                          placeholder="EX: ATENDIMENTO_SUL"
                          className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-5 px-6 outline-none focus:border-orange-500/40 font-black text-sm text-white transition-all uppercase placeholder:opacity-20"
                        />
                      </div>
                      <button 
                        onClick={confirmCreateInstance}
                        disabled={!newInstanceName || isCreatingInstance}
                        className="w-full py-5 bg-orange-500 rounded-2xl text-[11px] font-black uppercase tracking-widest text-white italic hover:bg-orange-600 transition-all flex items-center justify-center gap-3 shadow-lg shadow-orange-500/30 disabled:opacity-50 disabled:grayscale"
                      >
                        {isCreatingInstance ? <Loader2 className="animate-spin" size={16}/> : <><Zap size={16}/> Iniciar Tunelamento</>}
                      </button>
                   </motion.div>
                </motion.div>
             )}
           </AnimatePresence>

           {/* QR MODAL */}
           <AnimatePresence>
             {qrCodeData && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] bg-black/98 backdrop-blur-3xl flex items-center justify-center p-6">
                   <motion.div initial={{ scale: 0.85, y: 30 }} animate={{ scale: 1, y: 0 }} className="max-w-md w-full glass p-12 rounded-[4rem] border-orange-500/30 text-center space-y-10 relative shadow-[0_0_120px_rgba(255,115,0,0.5)]">
                      <button onClick={() => setQrCodeData(null)} className="absolute top-10 right-10 text-gray-500 hover:text-orange-500 transition-all"><X size={28}/></button>
                      <h3 className="text-4xl font-black uppercase italic tracking-tighter text-orange-500">Neural Sync</h3>
                      <div className="relative p-10 bg-white rounded-[3rem] shadow-[0_0_60px_rgba(255,255,255,0.1)] mx-auto max-w-[320px]">
                         <img src={qrCodeData.base64} alt="Scan QR" className="w-full h-auto rounded-2xl relative z-10" />
                         <div className="absolute top-0 left-0 w-full h-1.5 bg-orange-500/80 animate-scan z-30"></div>
                      </div>
                      <div className="flex items-center gap-4 text-orange-500 animate-pulse justify-center">
                        <Activity size={20} />
                        <span className="text-[10px] font-black uppercase tracking-[0.5em] italic">Aguardando Neural-Link...</span>
                      </div>
                   </motion.div>
                </motion.div>
             )}
           </AnimatePresence>

           {/* LOADINGS GLOBAIS */}
           {(isLoadingQR || isCreatingInstance) && (
             <div className="fixed inset-0 z-[210] bg-black/90 backdrop-blur-3xl flex items-center justify-center">
                <div className="text-center space-y-8 glass p-24 rounded-[6rem] border-orange-500/20 shadow-2xl">
                   <Loader2 className="animate-spin text-orange-500 mx-auto" size={100} strokeWidth={1.5} />
                   <p className="text-[18px] font-black uppercase tracking-[0.8em] text-orange-500 animate-pulse italic text-glow text-center px-10">Sincronizando Clusters</p>
                </div>
             </div>
           )}
        </div>
      </main>

      <style>{`
        @keyframes scan { 0% { top: 0%; opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { top: 100%; opacity: 0; } }
        .animate-scan { animation: scan 4s linear infinite; }
        .text-glow { text-shadow: 0 0 30px rgba(255, 115, 0, 0.4); }
      `}</style>
    </div>
  );
}
