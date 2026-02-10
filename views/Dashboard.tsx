
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageSquare, LogOut, RefreshCw, Layers, ChevronLeft, Zap, 
  Activity, LayoutDashboard, QrCode, Smartphone, DatabaseZap, 
  Loader2, Scan, ChevronDown, Cpu, Network, Bot, Settings2,
  Server, ShieldCheck, Info, MessageCircle, MoreVertical,
  Plus, Trash2, Power, Wifi, WifiOff, X, CheckCircle2,
  UserCheck, ExternalLink, AlertTriangle
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

  // FETCH INSTANCES - PARSER RESILIENTE V2
  const fetchInstances = async () => {
    try {
      const res = await fetch(`${EVOLUTION_URL}/instance/fetchInstances`, { headers: getHeaders() });
      if (!res.ok) throw new Error("API Offline");
      
      const data = await res.json();
      const raw = Array.isArray(data) ? data : (data.instances || data.data || []);
      
      const mapped: EvolutionInstance[] = raw.map((i: any) => {
        const core = i.instance || i;
        const name = core.instanceName || core.name;
        // Na v2 o status pode vir em connectionStatus ou status
        const s = (core.connectionStatus || core.status || "").toLowerCase();
        
        return {
          id: core.instanceId || core.id || name,
          name: name,
          status: s === 'open' ? 'CONNECTED' : (s === 'connecting' ? 'CONNECTING' : 'DISCONNECTED'),
          phone: core.ownerJid ? core.ownerJid.split('@')[0] : 'Desconectado',
          profilePicUrl: core.profilePicUrl || ""
        };
      });
      
      setInstances(mapped);
      
      // Atualiza seleção se necessário
      if (selectedInstance) {
        const up = mapped.find(inst => inst.name === selectedInstance.name);
        if (up && up.status !== selectedInstance.status) setSelectedInstance(up);
      }
    } catch (e) {
      console.error('Fetch Error:', e);
    }
  };

  // CREATE INSTANCE - CORREÇÃO DA CAUSA RAIZ (TRAVAMENTO)
  const createInstance = async () => {
    if (!newInstanceName.trim() || isCreatingInstance) return;
    
    setIsCreatingInstance(true);
    const targetName = newInstanceName.toLowerCase().trim().replace(/[^a-z0-9]/g, '_');
    
    try {
      const res = await fetch(`${EVOLUTION_URL}/instance/create`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ 
          instanceName: targetName, 
          token: "", 
          qrcode: true,
          number: "" // Alguns servidores v2 exigem campo vazio
        })
      });
      
      const data = await res.json();

      // INDEPENDENTE DE QUALQUER COISA, FECHA O MODAL DE NOME
      setIsCreateModalOpen(false);
      setNewInstanceName('');

      if (res.ok || res.status === 201) {
        // Tenta extrair QR do retorno imediato (v2 costuma mandar aqui)
        const b64 = data.qrcode?.base64 || data.base64 || data.instance?.qrcode?.base64;
        
        if (b64) {
          setQrCodeData({ base64: b64, name: targetName });
        } else {
          // Se não veio no create, chama o connect explicitamente
          await getQRCode(targetName);
        }
        await fetchInstances();
      } else {
        alert(`Erro Evolution: ${data.message || 'Falha no Cluster'}`);
      }
    } catch (e) {
      alert("Erro Crítico: Verifique a conexão com a Evolution API.");
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
      } else if (data.status === 'open' || data.instance?.status === 'open') {
        alert("Aparelho já conectado!");
        fetchInstances();
      }
    } catch (e) {
      console.error('QR Connect Error');
    } finally {
      setIsLoadingQR(false);
    }
  };

  const syncDatabase = async (instanceName?: string) => {
    const target = instanceName || selectedInstance?.name;
    if (!target) return;
    setIsSyncing(true);
    try {
      // 1. Garante que o Postgres está ATIVO para este terminal (SaaS Mode)
      await fetch(`${EVOLUTION_URL}/settings/set/${target}`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ database: true, save: true, syncContacts: true })
      });
      // 2. Dispara Sincronia de Contatos
      await fetch(`${EVOLUTION_URL}/contact/sync/${target}`, { method: 'POST', headers: getHeaders() });
      
      // Aguarda o cluster processar
      await new Promise(r => setTimeout(r, 5000));
      fetchInstances();
    } catch (e) {
      console.error('Sync Error');
    } finally {
      setIsSyncing(false);
    }
  };

  const deleteInstance = async (instanceName: string) => {
    if (!confirm(`Confirmar exclusão definitiva de ${instanceName}?`)) return;
    try {
      await fetch(`${EVOLUTION_URL}/instance/delete/${instanceName}`, { method: 'DELETE', headers: getHeaders() });
      await fetchInstances();
    } catch (e) { console.error('Delete error'); }
  };

  // Monitoramento de Conexão (Auto-fechar QR ao conectar)
  useEffect(() => {
    fetchInstances();
    const timer = setInterval(() => {
      fetchInstances();
      if (qrCodeData) {
        const inst = instances.find(i => i.name === qrCodeData.name);
        if (inst && inst.status === 'CONNECTED') {
          setQrCodeData(null);
          syncDatabase(inst.name);
        }
      }
    }, 10000);
    return () => clearInterval(timer);
  }, [qrCodeData?.name, instances.length]);

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
      
      {/* SIDEBAR ORIGINAL */}
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
            <h2 className="text-[11px] font-black uppercase tracking-[0.5em] text-white italic text-glow">WayFlow Neural v28.8</h2>
          </div>
          <div className="h-10 w-10 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500 font-black text-xs uppercase">{user.name[0]}</div>
        </header>

        <div className="flex-1 flex overflow-hidden">
           <AnimatePresence mode="wait">
             {activeTab === 'instancias' ? (
               <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex-1 p-12 overflow-y-auto custom-scrollbar">
                  <div className="max-w-6xl mx-auto space-y-12">
                     <div className="flex items-center justify-between border-b border-white/5 pb-12">
                        <div>
                           <h2 className="text-5xl font-black uppercase italic tracking-tighter leading-none">Terminais <span className="text-orange-500">WayIA.</span></h2>
                           <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.3em] mt-4 italic text-glow">Controle de Cluster v2.0</p>
                        </div>
                        <div className="flex gap-4">
                           <button onClick={fetchInstances} className="p-4 glass rounded-2xl text-orange-500 hover:scale-105 transition-all"><RefreshCw size={20}/></button>
                           <button onClick={() => setIsCreateModalOpen(true)} className="flex items-center gap-3 px-8 py-4 bg-orange-500 rounded-2xl font-black text-[10px] uppercase tracking-widest italic hover:bg-orange-600 shadow-xl shadow-orange-500/20 transition-all active:scale-95"><Plus size={16} /> Novo Terminal</button>
                        </div>
                     </div>
                     
                     <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {instances.map(inst => (
                           <div key={inst.id} className="glass p-8 rounded-[2.5rem] border-white/5 space-y-8 relative overflow-hidden group hover:border-orange-500/40 transition-all shadow-2xl">
                              <div className="flex items-center justify-between">
                                 <div className={`px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest flex items-center gap-2 ${inst.status === 'CONNECTED' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                                    {inst.status === 'CONNECTED' ? <Wifi size={10} className="animate-pulse" /> : <WifiOff size={10} />}
                                    {inst.status}
                                 </div>
                                 <div className="flex gap-1">
                                    <button onClick={() => syncDatabase(inst.name)} disabled={inst.status !== 'CONNECTED' || isSyncing} className="p-3 bg-white/5 rounded-xl text-gray-500 hover:text-orange-500 transition-colors disabled:opacity-30"><DatabaseZap size={14} className={isSyncing ? 'animate-bounce text-orange-500' : ''} /></button>
                                    <button onClick={() => deleteInstance(inst.name)} className="p-3 bg-white/5 rounded-xl text-gray-500 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                                 </div>
                              </div>
                              <div className="flex items-center gap-6">
                                 <div className="w-20 h-20 rounded-3xl bg-black border border-white/5 flex items-center justify-center text-orange-500 shadow-2xl overflow-hidden relative group-hover:border-orange-500/20 transition-all">
                                    {inst.profilePicUrl ? <img src={inst.profilePicUrl} className="w-full h-full object-cover" /> : <Smartphone size={32} className="opacity-30" />}
                                 </div>
                                 <div className="space-y-1 min-w-0">
                                    <h4 className="text-[18px] font-black uppercase italic text-white tracking-tight truncate">{inst.name}</h4>
                                    <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest italic">{inst.phone}</p>
                                 </div>
                              </div>
                              <div className="pt-4 border-t border-white/5">
                                 {inst.status === 'DISCONNECTED' ? (
                                   <button onClick={() => getQRCode(inst.name)} className="w-full py-5 bg-orange-500/10 border border-orange-500/20 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] text-orange-500 hover:bg-orange-500 hover:text-white transition-all italic flex items-center justify-center gap-3"><Scan size={16} /> Conectar Terminal</button>
                                 ) : (
                                   <button onClick={() => setActiveTab('atendimento')} className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl text-[9px] font-black uppercase tracking-widest text-white italic hover:bg-white/10 transition-all flex items-center justify-center gap-2 font-black"><MessageSquare size={14} /> Abrir Neural Inbox</button>
                                 )}
                              </div>
                           </div>
                        ))}
                     </div>
                  </div>
               </motion.div>
             ) : (
                <div className="flex-1 flex flex-col items-center justify-center opacity-10">
                   <h2 className="text-5xl font-black uppercase italic tracking-[1em] text-white">Neural <span className="text-orange-500">WayIA.</span></h2>
                   <p className="text-[10px] font-black uppercase tracking-[0.5em] mt-8">Aba em Desenvolvimento Neural</p>
                </div>
             )}
           </AnimatePresence>

           {/* QR CODE MODAL - O TÚNEL DE ACESSO */}
           <AnimatePresence>
             {qrCodeData && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[130] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-6">
                   <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="max-w-md w-full glass p-12 rounded-[4rem] border-orange-500/20 text-center space-y-10 relative shadow-[0_0_100px_rgba(255,115,0,0.1)]">
                      <button onClick={() => setQrCodeData(null)} className="absolute top-10 right-10 text-gray-600 hover:text-white"><X size={24}/></button>
                      <h3 className="text-3xl font-black uppercase italic tracking-tighter leading-none">Túnel de <span className="text-orange-500">Acesso.</span></h3>
                      <div className="relative p-8 bg-white rounded-[2.5rem] shadow-[0_0_80px_rgba(255,115,0,0.2)]">
                         <img src={qrCodeData.base64} alt="Scan QR" className="w-full h-auto rounded-xl scale-110" />
                         <div className="absolute inset-0 border-[10px] border-white rounded-[2.5rem]"></div>
                      </div>
                      <div className="flex items-center justify-center gap-4 text-orange-500 animate-pulse">
                         <Activity size={18} />
                         <span className="text-[9px] font-black uppercase tracking-[0.4em] italic">Handshake ativo. Escaneie agora.</span>
                      </div>
                   </motion.div>
                </motion.div>
             )}
           </AnimatePresence>

           {/* CREATE MODAL - ONDE ESTAVA O ERRO */}
           <AnimatePresence>
             {isCreateModalOpen && (
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-3xl flex items-center justify-center p-6">
                  <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="max-w-sm w-full glass p-12 rounded-[3.5rem] border-orange-500/20 space-y-10 text-center relative shadow-2xl">
                     <button onClick={() => setIsCreateModalOpen(false)} className="absolute top-8 right-8 text-gray-600 hover:text-white"><X size={20}/></button>
                     <div className="space-y-4">
                        <div className="w-20 h-20 bg-orange-500/10 rounded-3xl flex items-center justify-center text-orange-500 mx-auto mb-6 shadow-2xl ring-1 ring-orange-500/20"><Plus size={40}/></div>
                        <h3 className="text-3xl font-black uppercase italic tracking-tighter">Provisionar <span className="text-orange-500">Cluster.</span></h3>
                        <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest italic">Defina a ID do novo Terminal.</p>
                     </div>
                     <div className="space-y-6">
                        <input 
                          autoFocus
                          placeholder="ex: vendas_pro"
                          value={newInstanceName}
                          onChange={e => setNewInstanceName(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && createInstance()}
                          className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-5 px-6 text-sm font-bold outline-none focus:border-orange-500/40 text-center uppercase tracking-[0.3em] transition-all text-white"
                        />
                        <button 
                          disabled={isCreatingInstance || !newInstanceName.trim()}
                          onClick={createInstance}
                          className="w-full py-6 bg-orange-500 rounded-2xl font-black text-[12px] uppercase tracking-widest italic hover:bg-orange-600 shadow-2xl shadow-orange-500/30 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                        >
                           {isCreatingInstance ? <Loader2 className="animate-spin" size={18}/> : <CheckCircle2 size={18}/>}
                           {isCreatingInstance ? 'Sincronizando...' : 'Confirmar Terminal'}
                        </button>
                     </div>
                  </motion.div>
               </motion.div>
             )}
           </AnimatePresence>

           {/* BRIDGE OVERLAY (CARREGAMENTO GLOBAL) */}
           {(isSyncing || isLoadingQR) && (
             <div className="fixed inset-0 z-[140] bg-black/70 backdrop-blur-xl flex items-center justify-center">
                <div className="text-center space-y-8 glass p-20 rounded-[5rem] border-orange-500/20 shadow-[0_0_100px_rgba(255,115,0,0.1)]">
                   <Loader2 className="animate-spin text-orange-500 mx-auto" size={80} />
                   <p className="text-[14px] font-black uppercase tracking-[0.6em] text-orange-500 animate-pulse italic">Neural Bridge Active...</p>
                </div>
             </div>
           )}
        </div>
      </main>
    </div>
  );
}
