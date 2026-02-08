
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageSquare, LogOut, RefreshCw, Layers, ChevronLeft, Zap, 
  Activity, LayoutDashboard, QrCode, Smartphone, DatabaseZap, 
  Loader2, Scan, ChevronDown, Cpu, Network, Bot, Settings2,
  Server, ShieldCheck, Info, MessageCircle, MoreVertical,
  Plus, Trash2, Power, Wifi, WifiOff, X, CheckCircle2
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
  const [activeTab, setActiveTab] = useState<DashboardTab>('atendimento');
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [instances, setInstances] = useState<EvolutionInstance[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<EvolutionInstance | null>(null);
  const [contacts, setContacts] = useState<any[]>([]);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const [qrCodeData, setQrCodeData] = useState<{base64: string, name: string} | null>(null);
  const [isLoadingQR, setIsLoadingQR] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newInstanceName, setNewInstanceName] = useState('');
  const [isCreatingInstance, setIsCreatingInstance] = useState(false);

  const getHeaders = () => ({ 
    'apikey': EVOLUTION_API_KEY, 
    'Content-Type': 'application/json'
  });

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
          phone: instData.ownerJid ? instData.ownerJid.split('@')[0] : 'Não Conectado',
          profilePicUrl: instData.profilePicUrl || ""
        };
      });
      setInstances(mapped);
      
      if (selectedInstance) {
        const updated = mapped.find(i => i.id === selectedInstance.id);
        if (updated && updated.status !== selectedInstance.status) {
          setSelectedInstance(updated);
        }
      } else if (mapped.length > 0) {
        const firstConnected = mapped.find(i => i.status === 'CONNECTED');
        setSelectedInstance(firstConnected || mapped[0]);
      }
    } catch (e) {
      console.error('Falha no cluster Evolution.');
    }
  };

  const createInstance = async () => {
    if (!newInstanceName.trim()) return;
    setIsCreatingInstance(true);
    try {
      const res = await fetch(`${EVOLUTION_URL}/instance/create`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          instanceName: newInstanceName.toLowerCase().replace(/\s/g, '_'),
          token: "", 
          qrcode: true
        })
      });
      if (res.ok) {
        setNewInstanceName('');
        setIsCreateModalOpen(false);
        await fetchInstances();
      }
    } catch (e) {
      console.error('Erro ao criar terminal.');
    } finally {
      setIsCreatingInstance(false);
    }
  };

  const getQRCode = async (instanceName: string) => {
    setIsLoadingQR(true);
    setQrCodeData(null);
    try {
      const res = await fetch(`${EVOLUTION_URL}/instance/connect/${instanceName}`, { headers: getHeaders() });
      const data = await res.json();
      if (data.base64) {
        setQrCodeData({ base64: data.base64, name: instanceName });
      }
    } catch (e) {
      console.error('Erro ao gerar QR Code.');
    } finally {
      setIsLoadingQR(false);
    }
  };

  const fetchContacts = async (instance: EvolutionInstance) => {
    if (instance.status !== 'CONNECTED') {
      setContacts([]);
      return;
    }
    setIsLoadingContacts(true);
    try {
      // ENDPOINT CORRIGIDO: fetchContacts recupera do banco de dados persistente
      const res = await fetch(`${EVOLUTION_URL}/contact/fetchContacts/${instance.name}`, { headers: getHeaders() });
      const json = await res.json();
      
      let list = [];
      // Evolution v2 retorna dentro de data ou direto no array
      if (Array.isArray(json)) list = json;
      else if (json.data && Array.isArray(json.data)) list = json.data;
      else if (json.contacts && Array.isArray(json.contacts)) list = json.contacts;
      
      // Filtro para garantir apenas contatos humanos (remove grupos e entradas vazias)
      const filtered = list.filter((c: any) => c.id && !c.id.includes('@g.us'));
      
      setContacts(filtered);
      console.log(`[Postgres Logic] ${filtered.length} registros encontrados.`);
    } catch (e) {
      console.error('Erro ao ler Postgres.');
    } finally {
      setIsLoadingContacts(false);
    }
  };

  const syncDatabase = async (instanceName?: string) => {
    const targetName = instanceName || selectedInstance?.name;
    if (!targetName) return;
    
    setIsSyncing(true);
    try {
      // 1. Forçar a Evolution a ligar os gatilhos de gravação no Postgres
      await fetch(`${EVOLUTION_URL}/instance/setSettings/${targetName}`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ 
          syncContacts: true, 
          syncFullHistory: true,
          readStatus: true,
          readMessages: true,
          timeSync: 0
        })
      });

      // 2. Disparar a sincronização forçada (Dump do Celular -> API -> Postgres)
      await fetch(`${EVOLUTION_URL}/contact/sync/${targetName}`, { 
        method: 'POST', 
        headers: getHeaders() 
      });

      // 3. Delay necessário para o Postgres processar os buffers (conforme seus logs)
      await new Promise(r => setTimeout(r, 10000));
      
      if (selectedInstance && targetName === selectedInstance.name) {
        await fetchContacts(selectedInstance);
      }
    } catch (e) {
      console.error('Falha no Handshake de Sincronia.');
    } finally {
      setIsSyncing(false);
    }
  };

  const logoutInstance = async (instanceName: string) => {
    if (!confirm(`Deseja realmente desconectar a instância ${instanceName}?`)) return;
    try {
      await fetch(`${EVOLUTION_URL}/instance/logout/${instanceName}`, { 
        method: 'DELETE', 
        headers: getHeaders() 
      });
      await fetchInstances();
    } catch (e) {
      console.error('Erro ao desconectar.');
    }
  };

  useEffect(() => {
    fetchInstances();
    const interval = setInterval(() => {
      fetchInstances();
      if (qrCodeData) {
        const inst = instances.find(i => i.name === qrCodeData.name);
        if (inst && inst.status === 'CONNECTED') setQrCodeData(null);
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [qrCodeData?.name, instances.length]);

  useEffect(() => {
    if (selectedInstance && activeTab === 'atendimento') {
      fetchContacts(selectedInstance);
    }
  }, [selectedInstance?.id, selectedInstance?.status, activeTab]);

  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'atendimento', label: 'Atendimento', icon: MessageSquare },
    { id: 'instancias', label: 'Instâncias', icon: Server },
    { id: 'agentes', label: 'Agentes IA', icon: Bot },
    { id: 'n8n', label: 'Fluxos n8n', icon: Network },
    { id: 'settings', label: 'Ajustes', icon: Settings2 },
  ];

  return (
    <div className="flex h-screen bg-[#050505] text-white overflow-hidden font-sans selection:bg-orange-500/30">
      <div className="fixed inset-0 grid-engine pointer-events-none opacity-5"></div>
      
      {/* SIDEBAR NEURAL */}
      <aside className={`flex flex-col border-r border-white/5 bg-black/40 backdrop-blur-3xl transition-all duration-300 z-50 ${isSidebarExpanded ? 'w-64' : 'w-20'}`}>
        <div className="p-8 flex justify-center"><Logo size="sm" /></div>
        <nav className="flex-1 px-4 py-6 space-y-3">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as DashboardTab)}
              className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all group ${activeTab === item.id ? 'bg-orange-500/10 text-orange-500 shadow-lg shadow-orange-500/5' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
            >
              <item.icon size={20} className={activeTab === item.id ? 'text-orange-500' : 'group-hover:text-white'} />
              {isSidebarExpanded && <span className="text-[10px] font-black uppercase tracking-[0.2em]">{item.label}</span>}
            </button>
          ))}
        </nav>
        <div className="p-6 border-t border-white/5">
          <button onClick={onLogout} className="w-full flex items-center gap-4 px-4 py-4 text-gray-600 hover:text-orange-500 transition-all font-black uppercase text-[10px] tracking-[0.3em] group">
            <LogOut size={18} className="group-hover:-translate-x-1 transition-transform" />
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
              <h2 className="text-[11px] font-black uppercase tracking-[0.5em] text-white italic leading-none">Neural Core v28.1</h2>
              <span className="text-[8px] font-bold text-orange-500/50 uppercase tracking-widest mt-1 italic italic text-glow">Postgres Bridge Active</span>
            </div>
          </div>
          <div className="flex items-center gap-6">
             <div className="h-10 w-10 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500 font-black text-xs">
               {user.name[0]}
             </div>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden relative">
           <AnimatePresence mode="wait">
             {activeTab === 'atendimento' ? (
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex overflow-hidden">
                  <div className="w-80 md:w-96 border-r border-white/5 flex flex-col bg-black/40 backdrop-blur-3xl">
                     <div className="p-8 border-b border-white/5 space-y-6">
                        <div className="flex items-center justify-between">
                          <h3 className="text-2xl font-black uppercase italic tracking-tighter text-white">Neural <span className="text-orange-500">Inbox.</span></h3>
                          <button 
                            disabled={!selectedInstance || selectedInstance.status !== 'CONNECTED' || isSyncing}
                            onClick={() => syncDatabase()}
                            className={`p-2 glass rounded-xl text-orange-500 hover:scale-110 transition-all ${isSyncing ? 'animate-spin' : ''}`}
                            title="Sincronizar no Postgres"
                          >
                             <RefreshCw size={16} />
                          </button>
                        </div>
                        <div className="relative group">
                          <select 
                            value={selectedInstance?.id || ""} 
                            onChange={(e) => setSelectedInstance(instances.find(i => i.id === e.target.value) || null)}
                            className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-4 px-5 text-[10px] font-black uppercase tracking-[0.2em] outline-none appearance-none focus:border-orange-500/40 transition-all text-white/80 cursor-pointer"
                          >
                            {instances.map(inst => ( 
                              <option key={inst.id} value={inst.id} className="bg-[#050505]">
                                {inst.name.toUpperCase()} {inst.status === 'CONNECTED' ? '● ONLINE' : '○ OFFLINE'}
                              </option> 
                            ))}
                          </select>
                          <ChevronDown size={14} className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" />
                        </div>
                     </div>

                     <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
                        {selectedInstance?.status === 'DISCONNECTED' ? (
                          <div className="p-10 rounded-[2.5rem] bg-red-500/5 border border-red-500/10 text-center space-y-6">
                             <QrCode className="mx-auto text-red-500 animate-pulse" size={48}/>
                             <p className="text-[10px] font-black uppercase text-white italic tracking-widest">Aguardando Conexão</p>
                             <button 
                               onClick={() => setActiveTab('instancias')}
                               className="w-full py-3 glass rounded-xl text-[9px] font-black uppercase tracking-widest text-orange-500"
                             >
                               Ir para Instâncias
                             </button>
                          </div>
                        ) : (
                          <>
                            {isLoadingContacts || isSyncing ? (
                              <div className="py-20 text-center space-y-6">
                                 <Loader2 className="animate-spin text-orange-500 mx-auto" size={40} />
                                 <p className="text-[9px] font-black uppercase text-orange-500 animate-pulse italic">Acessando Postgres...</p>
                              </div>
                            ) : (
                              <>
                                {contacts.length === 0 && (
                                  <div className="p-10 rounded-[2rem] bg-orange-500/5 border border-orange-500/10 text-center space-y-4">
                                     <DatabaseZap className="mx-auto text-orange-500 animate-bounce" size={40}/>
                                     <p className="text-[11px] font-black uppercase text-white italic">Fila Vazia</p>
                                     <p className="text-[8px] font-bold text-gray-600 uppercase italic">Use o ícone de Sincronia acima para carregar o banco de dados.</p>
                                  </div>
                                )}
                                {contacts.map((contact, i) => (
                                  <motion.div 
                                    initial={{ opacity: 0, x: -10 }} 
                                    animate={{ opacity: 1, x: 0 }} 
                                    transition={{ delay: i * 0.01 }}
                                    key={contact.id || i} 
                                    className="p-4 rounded-2xl flex items-center gap-4 cursor-pointer transition-all border border-transparent hover:bg-white/[0.03] group"
                                  >
                                     <div className="w-12 h-12 rounded-full bg-black border border-white/5 flex items-center justify-center font-black text-gray-800 text-lg group-hover:text-orange-500 transition-all">
                                       {(contact.pushName || contact.name || "?")[0]}
                                     </div>
                                     <div className="flex-1 min-w-0">
                                        <span className="text-[11px] font-black uppercase text-white truncate italic block group-hover:text-orange-500">
                                          {contact.pushName || contact.name || contact.id.split('@')[0]}
                                        </span>
                                        <p className="text-[8px] font-bold text-gray-700 truncate uppercase mt-0.5 tracking-widest italic">
                                          {contact.id.split('@')[0]}
                                        </p>
                                     </div>
                                  </motion.div>
                                ))}
                              </>
                            )}
                          </>
                        )}
                     </div>
                  </div>

                  <div className="flex-1 flex flex-col items-center justify-center p-20 text-center space-y-12 bg-black/20 relative">
                     <div className="absolute inset-0 grid-engine opacity-5"></div>
                     <Zap size={100} className="text-orange-500/10 animate-pulse" />
                     <div className="space-y-4">
                        <h3 className="text-4xl font-black uppercase italic tracking-tighter text-white/30 leading-none">Neural <span className="text-orange-500/50 italic italic">Terminal.</span></h3>
                        <p className="text-[10px] font-bold text-gray-800 uppercase tracking-[0.5em] max-w-sm mx-auto leading-loose italic italic">Abra uma transmissão para visualizar os dados sincronizados.</p>
                     </div>
                  </div>
               </motion.div>
             ) : activeTab === 'instancias' ? (
               <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex-1 p-12 overflow-y-auto custom-scrollbar">
                  <div className="max-w-6xl mx-auto space-y-12">
                     <div className="flex items-center justify-between">
                        <div>
                           <h2 className="text-5xl font-black uppercase italic tracking-tighter leading-none">Terminais <span className="text-orange-500">WayIA.</span></h2>
                           <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.3em] mt-4 italic italic">Controle de Cluster em Tempo Real.</p>
                        </div>
                        <div className="flex gap-4">
                           <button onClick={fetchInstances} className="p-4 glass rounded-2xl text-orange-500 hover:scale-105 transition-all"><RefreshCw size={20}/></button>
                           <button 
                             onClick={() => setIsCreateModalOpen(true)}
                             className="flex items-center gap-3 px-8 py-4 bg-orange-500 rounded-2xl font-black text-[10px] uppercase tracking-widest italic italic hover:bg-orange-600 shadow-xl shadow-orange-500/20 transition-all"
                           >
                             <Plus size={16} /> Nova Instância
                           </button>
                        </div>
                     </div>

                     <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {instances.map(inst => (
                           <div key={inst.id} className="glass p-8 rounded-[2.5rem] border-white/5 space-y-8 relative overflow-hidden group hover:border-orange-500/20 transition-all">
                              <div className="flex items-center justify-between">
                                 <div className={`px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest italic italic flex items-center gap-2 ${inst.status === 'CONNECTED' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                                    {inst.status === 'CONNECTED' ? <Wifi size={10} /> : <WifiOff size={10} />}
                                    {inst.status}
                                 </div>
                                 <div className="flex gap-2">
                                    <button 
                                      onClick={() => syncDatabase(inst.name)}
                                      disabled={inst.status !== 'CONNECTED' || isSyncing}
                                      className="p-2 text-gray-700 hover:text-orange-500 transition-colors"
                                      title="Forçar Sincronia no Banco"
                                    >
                                       <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                                    </button>
                                    <button onClick={() => logoutInstance(inst.name)} className="p-2 text-gray-700 hover:text-red-500 transition-colors">
                                      <Power size={14} />
                                    </button>
                                 </div>
                              </div>

                              <div className="flex items-center gap-6">
                                 <div className="w-20 h-20 rounded-3xl bg-black border border-white/5 flex items-center justify-center text-orange-500 shadow-2xl group-hover:scale-110 transition-transform relative overflow-hidden">
                                    {inst.profilePicUrl ? (
                                      <img src={inst.profilePicUrl} className="w-full h-full object-cover opacity-60" />
                                    ) : (
                                      <Smartphone size={32}/>
                                    )}
                                 </div>
                                 <div className="space-y-1">
                                    <h4 className="text-[16px] font-black uppercase italic text-white tracking-tight">{inst.name}</h4>
                                    <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest italic italic">{inst.phone}</p>
                                 </div>
                              </div>

                              <div className="space-y-3 pt-4">
                                 {inst.status === 'DISCONNECTED' ? (
                                   <button 
                                     onClick={() => getQRCode(inst.name)}
                                     className="w-full py-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-orange-500 hover:bg-orange-500 hover:text-white transition-all italic italic"
                                   >
                                     Conectar WhatsApp
                                   </button>
                                 ) : (
                                   <div className="flex gap-3">
                                      <button 
                                        onClick={() => { setSelectedInstance(inst); setActiveTab('atendimento'); }}
                                        className="flex-1 py-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white italic italic hover:bg-white/10 transition-all"
                                      >
                                        Abrir Inbox
                                      </button>
                                      <button className="p-4 glass rounded-2xl text-gray-500 hover:text-white transition-all"><Settings2 size={16}/></button>
                                   </div>
                                 )}
                              </div>
                           </div>
                        ))}
                     </div>
                  </div>
               </motion.div>
             ) : (
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col items-center justify-center opacity-10 space-y-12">
                  <div className="p-12 glass rounded-full border-orange-500/20 animate-pulse"><Bot size={80} className="text-orange-500" /></div>
                  <div className="text-center space-y-4">
                    <h2 className="text-5xl font-black uppercase italic tracking-[1em] text-white">Neural <span className="text-orange-500">WayIA.</span></h2>
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.6em] italic italic italic">Neural Operation v28.1</p>
                  </div>
               </motion.div>
             )}
           </AnimatePresence>

           <AnimatePresence>
             {isCreateModalOpen && (
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-3xl flex items-center justify-center p-6">
                  <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="max-w-sm w-full glass p-10 rounded-[3rem] border-orange-500/20 space-y-8 text-center relative">
                     <button onClick={() => setIsCreateModalOpen(false)} className="absolute top-8 right-8 text-gray-600 hover:text-white"><X size={20}/></button>
                     <div className="space-y-3">
                        <div className="w-16 h-16 bg-orange-500/10 rounded-3xl flex items-center justify-center text-orange-500 mx-auto mb-6"><Plus size={32}/></div>
                        <h3 className="text-2xl font-black uppercase italic tracking-tighter">Novo <span className="text-orange-500">Terminal.</span></h3>
                        <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest italic italic">Nome identificador no cluster.</p>
                     </div>
                     <input 
                       autoFocus
                       placeholder="ex: vendas_suporte"
                       value={newInstanceName}
                       onChange={e => setNewInstanceName(e.target.value)}
                       className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-4 px-6 text-sm font-bold outline-none focus:border-orange-500/40 text-center uppercase tracking-widest transition-all"
                     />
                     <button 
                       disabled={isCreatingInstance || !newInstanceName}
                       onClick={createInstance}
                       className="w-full py-5 bg-orange-500 rounded-2xl font-black text-[11px] uppercase tracking-widest italic italic hover:bg-orange-600 shadow-2xl shadow-orange-500/20 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                     >
                        {isCreatingInstance ? <Loader2 className="animate-spin" size={16}/> : <CheckCircle2 size={16}/>}
                        {isCreatingInstance ? 'Provisionando...' : 'Confirmar'}
                     </button>
                  </motion.div>
               </motion.div>
             )}
           </AnimatePresence>

           <AnimatePresence>
             {qrCodeData && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[130] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-6">
                   <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="max-w-md w-full glass p-12 rounded-[3.5rem] border-orange-500/20 text-center space-y-10 relative">
                      <button onClick={() => setQrCodeData(null)} className="absolute top-10 right-10 text-gray-600 hover:text-white"><X size={24}/></button>
                      <div className="space-y-4">
                         <h3 className="text-3xl font-black uppercase italic tracking-tighter leading-none">Conectar <span className="text-orange-500">WhatsApp.</span></h3>
                         <p className="text-[9px] font-black text-gray-600 uppercase tracking-[0.3em] italic">Cluster: {qrCodeData.name.toUpperCase()}</p>
                      </div>
                      <div className="relative p-8 bg-white rounded-[2.5rem] shadow-[0_0_80px_rgba(255,115,0,0.15)] group">
                         <img src={qrCodeData.base64} alt="Scan QR" className="w-full h-auto rounded-xl" />
                         <div className="absolute inset-0 border-[12px] border-black rounded-[2.5rem] pointer-events-none group-hover:border-black/80 transition-all"></div>
                      </div>
                      <div className="space-y-6">
                         <p className="text-[10px] font-black text-gray-400 uppercase leading-relaxed tracking-widest italic italic">Aponte o scanner do WhatsApp para abrir o túnel WayIA.</p>
                         <div className="flex items-center justify-center gap-4 text-orange-500 animate-pulse">
                            <Activity size={18} />
                            <span className="text-[9px] font-black uppercase tracking-[0.4em] italic italic">Escutando Handshake...</span>
                         </div>
                      </div>
                   </motion.div>
                </motion.div>
             )}
           </AnimatePresence>

           {isSyncing && (
             <div className="fixed inset-0 z-[140] bg-black/60 backdrop-blur-md flex items-center justify-center">
                <div className="text-center space-y-6 glass p-16 rounded-[4rem] border-orange-500/20">
                   <Loader2 className="animate-spin text-orange-500 mx-auto" size={64} />
                   <div className="space-y-2">
                     <p className="text-[12px] font-black uppercase tracking-[0.5em] text-orange-500 animate-pulse italic">Neural Sync v28.1</p>
                     <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest italic">Forçando persistência no banco Postgres...</p>
                   </div>
                </div>
             </div>
           )}
        </div>
      </main>
    </div>
  );
}
