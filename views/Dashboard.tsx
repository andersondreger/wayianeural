
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
  ShieldQuestion, Bug, Radio
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
  const [apiError, setApiError] = useState<string | null>(null);

  const getHeaders = (nocache = false) => ({ 
    'apikey': EVOLUTION_API_KEY, 
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(nocache ? { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' } : {})
  });

  const fetchInstances = async () => {
    try {
      const res = await fetch(`${EVOLUTION_URL}/instance/fetchInstances?v=${Date.now()}`, { headers: getHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      const raw = Array.isArray(data) ? data : (data.instances || data.data || []);
      const mapped = raw.map((i: any) => {
        const core = i.instance || i;
        const name = core.instanceName || core.name;
        const s = (core.connectionStatus || core.status || "").toLowerCase();
        const isConnected = s === 'open' || s === 'connected';
        return {
          id: core.id || core.instanceId || name,
          name: name,
          status: isConnected ? 'CONNECTED' : (s === 'connecting' ? 'CONNECTING' : 'DISCONNECTED'),
          phone: core.ownerJid ? core.ownerJid.split('@')[0] : 'Off-line',
          profilePicUrl: core.profilePicUrl || "",
        };
      });
      setInstances(mapped);
      if (mapped.length > 0 && !selectedInstance) {
        const conn = mapped.find((i: any) => i.status === 'CONNECTED');
        if (conn) setSelectedInstance(conn);
      }
    } catch (e) {
      console.error('Polling Error:', e);
    }
  };

  const loadContacts = async (retryCount = 0) => {
    if (!selectedInstance || selectedInstance.status !== 'CONNECTED') return;
    
    setIsLoadingContacts(true);
    setApiError(null);
    const instanceName = selectedInstance.name;

    try {
      // 1. WARM-UP: Verificar status real para "acordar" a rota no cache da Evolution
      setLastRouteUsed('Acordando Instância...');
      await fetch(`${EVOLUTION_URL}/instance/connectionStatus/${instanceName}`, { headers: getHeaders(true) });

      // 2. SILENT SETTINGS: Tenta mas não se importa se der 400
      try {
        await fetch(`${EVOLUTION_URL}/settings/set/${instanceName}`, {
          method: 'POST',
          headers: getHeaders(true),
          body: JSON.stringify({ database: true, save: true }),
          signal: AbortSignal.timeout(2000)
        });
      } catch (e) {}

      await new Promise(resolve => setTimeout(resolve, 500));

      // 3. SCANNER HÍBRIDO (Path vs Query)
      const routes = [
        `/contact/fetchContacts/${instanceName}`,
        `/contact/findMany/${instanceName}`,
        `/contact/findAll/${instanceName}`,
        `/contact/findMany?instanceName=${instanceName}` // Variação estável v2.3.7
      ];

      let successfulData = null;
      let finalRoute = '';

      for (const route of routes) {
        setLastRouteUsed(`Escaneando: ${route.includes('?') ? 'QueryParam' : route.split('/')[2]}`);
        try {
          const res = await fetch(`${EVOLUTION_URL}${route}${route.includes('?') ? '&' : '?'}v=${Date.now()}`, { 
            headers: getHeaders(true) 
          });
          
          if (res.ok) {
            successfulData = await res.json();
            finalRoute = route;
            break; 
          }
        } catch (e) { continue; }
      }

      if (!successfulData) {
        if (retryCount < 1) {
          setLastRouteUsed(`Re-sincronizando Core...`);
          await new Promise(resolve => setTimeout(resolve, 1500));
          return loadContacts(retryCount + 1);
        }
        throw new Error("Instância sem Banco Ativo ou cache 404. Tente Reiniciar o terminal.");
      }

      setLastRouteUsed(`Conectado: ${finalRoute.split('/')[2].split('?')[0]}`);

      // 4. PARSING RESILIENTE
      let rawList = [];
      if (Array.isArray(successfulData)) rawList = successfulData;
      else if (successfulData.data) rawList = Array.isArray(successfulData.data) ? successfulData.data : (successfulData.data.contacts || []);
      else if (successfulData.contacts) rawList = successfulData.contacts;

      const filtered = rawList.filter((c: any) => {
        const jid = c.id || c.remoteJid || c.jid || "";
        return jid && !jid.includes('@g.us');
      }).map((c: any) => ({
        ...c,
        id: c.id || c.remoteJid || c.jid,
        name: c.pushName || c.name || c.verifiedName || (c.id || "").split('@')[0]
      }));

      setContacts(filtered);
    } catch (e: any) {
      console.error("[Fatal Handshake]", e);
      setApiError(e.message);
      setLastRouteUsed('Handshake Rejeitado');
    } finally {
      setIsLoadingContacts(false);
    }
  };

  const handleAutoCreate = async () => {
    if (isCreatingInstance) return;
    setIsCreatingInstance(true);
    const autoName = `neural_${Math.random().toString(36).substring(7)}`;
    try {
      const res = await fetch(`${EVOLUTION_URL}/instance/create`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ instanceName: autoName, token: "wayflow_" + Math.random().toString(36).substring(5), integration: "WHATSAPP-BAILEYS", qrcode: true })
      });
      const data = await res.json();
      if (res.ok || res.status === 201) {
        const b64 = data.qrcode?.base64 || data.instance?.qrcode?.base64;
        if (b64) setQrCodeData({ base64: b64, name: autoName });
        else await forceQRGeneration(autoName);
        await fetchInstances();
      }
    } catch (e) { setApiError("Erro de conexão."); }
    finally { setIsCreatingInstance(false); }
  };

  const forceQRGeneration = async (instanceName: string) => {
    setIsLoadingQR(true);
    try {
      const res = await fetch(`${EVOLUTION_URL}/instance/connect/${instanceName}`, { headers: getHeaders() });
      const data = await res.json();
      const base64 = data.base64 || data.qrcode?.base64;
      if (base64) setQrCodeData({ base64: base64, name: instanceName });
      else setTimeout(() => forceQRGeneration(instanceName), 4000);
    } catch (e) { console.error("QR Error"); }
    finally { setIsLoadingQR(false); }
  };

  const deleteInstance = async (name: string) => {
    if (!confirm(`Remover terminal ${name}?`)) return;
    await fetch(`${EVOLUTION_URL}/instance/delete/${name}`, { method: 'DELETE', headers: getHeaders() });
    await fetchInstances();
  };

  useEffect(() => {
    fetchInstances();
    const timer = setInterval(fetchInstances, 12000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (activeTab === 'atendimento' && selectedInstance) loadContacts();
  }, [selectedInstance?.name, activeTab]);

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
              <h2 className="text-[11px] font-black uppercase tracking-[0.5em] text-white italic text-glow">WayFlow Neural v3.9</h2>
              <span className="text-[7px] font-bold text-orange-500 uppercase tracking-widest italic text-glow">Hybrid Scanner: v2.3.7-STABLE</span>
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
                          <div className={`px-4 py-3 rounded-xl flex items-center gap-3 border transition-all ${lastRouteUsed.includes('Rejeitado') ? 'bg-red-500/5 border-red-500/10' : 'bg-orange-500/5 border-orange-500/10'}`}>
                            <div className={`p-1.5 rounded-lg ${lastRouteUsed.includes('Rejeitado') ? 'bg-red-500/10 text-red-500' : 'bg-orange-500/10 text-orange-500'}`}>
                               {lastRouteUsed.includes('Handshake') ? <ShieldAlert size={12} /> : <Radio size={12} className={isLoadingContacts ? 'animate-pulse' : ''} />}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[6px] font-black uppercase text-gray-600 tracking-widest">Sincronia Neural</span>
                              <span className="text-[8px] font-mono text-white truncate font-bold uppercase">{lastRouteUsed}</span>
                            </div>
                          </div>
                        )}
                     </div>

                     <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                        {isLoadingContacts ? (
                          <div className="flex flex-col items-center py-20 opacity-40 text-center">
                            <Loader2 className="animate-spin text-orange-500 mb-4" size={32} />
                            <span className="text-[10px] font-black uppercase tracking-widest text-orange-500 italic">Varrendo Banco Postgres...</span>
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
                              {selectedInstance ? 'Aguardando Sincronia de Banco...' : 'Selecione um terminal para iniciar.'}
                            </span>
                            {apiError && (
                              <div className="mt-6 p-4 rounded-xl bg-red-500/5 border border-red-500/10">
                                <p className="text-[8px] text-red-500 font-black uppercase tracking-widest mb-2 flex items-center gap-2 justify-center"><Bug size={10}/> Report</p>
                                <p className="text-[9px] text-gray-500 lowercase leading-tight">{apiError}</p>
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
                       <p className="text-[10px] font-black uppercase tracking-[0.5em] text-gray-800 italic">WayFlow Engine v3.9</p>
                    </div>
                  </div>
                </motion.div>
             ) : activeTab === 'instancias' ? (
                <motion.div key="instances" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex-1 p-12 overflow-y-auto custom-scrollbar">
                  <div className="max-w-6xl mx-auto space-y-12">
                     <div className="flex items-center justify-between border-b border-white/5 pb-12">
                        <div>
                           <h2 className="text-5xl font-black uppercase italic tracking-tighter leading-none">Terminais <span className="text-orange-500 text-glow">WayIA.</span></h2>
                           <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.3em] mt-4 italic">Evolution Engine v2.3.7 | Neural Fix v3.9</p>
                        </div>
                        <div className="flex gap-4">
                           <button onClick={handleAutoCreate} disabled={isCreatingInstance} className="flex items-center gap-3 px-8 py-4 bg-orange-500 rounded-2xl font-black text-[10px] uppercase tracking-widest italic hover:bg-orange-600 transition-all shadow-[0_0_30px_rgba(255,115,0,0.3)]">
                             {isCreatingInstance ? <Loader2 className="animate-spin" size={16}/> : <Plus size={16} />} Nova Instância
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
                                 <button onClick={() => deleteInstance(inst.name)} className="p-3 bg-white/5 rounded-xl text-gray-500 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                              </div>
                              <div className="flex items-center gap-6 relative z-10">
                                 <div className="w-16 h-16 rounded-3xl bg-black border border-white/5 flex items-center justify-center text-orange-500 overflow-hidden shadow-inner">
                                    {inst.profilePicUrl ? <img src={inst.profilePicUrl} className="w-full h-full object-cover" /> : <Smartphone size={24} className="opacity-40" />}
                                 </div>
                                 <div className="min-w-0">
                                    <h4 className="text-[16px] font-black uppercase italic text-white truncate">{inst.name}</h4>
                                    <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">{inst.phone}</p>
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
                        <span className="text-[10px] font-black uppercase tracking-[0.5em] italic">Aguardando Handshake...</span>
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
