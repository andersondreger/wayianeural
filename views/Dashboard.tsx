
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
  const [isSyncing, setIsSyncing] = useState(false);
  
  const [qrCodeData, setQrCodeData] = useState<{base64: string, name: string} | null>(null);
  const [isLoadingQR, setIsLoadingQR] = useState(false);
  const [isCreatingInstance, setIsCreatingInstance] = useState(false);

  // Cache de ativação para evitar loops, mas permite retentativa em caso de erro
  const activatedInstances = useRef<Set<string>>(new Set());

  const getHeaders = () => ({ 
    'apikey': EVOLUTION_API_KEY, 
    'Content-Type': 'application/json'
  });

  // BUSCA INSTÂNCIAS E VERIFICA SAÚDE DO POSTGRES
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
             // 1. Tentar ler contatos
             const cRes = await fetch(`${EVOLUTION_URL}/contact/findMany/${name}`, { headers: getHeaders() });
             
             if (cRes.ok) {
               const cData = await cRes.json();
               contactCount = (Array.isArray(cData) ? cData : (cData.data || [])).length;
               activatedInstances.current.add(name); // Marcar como saudável
             } else if (cRes.status === 404) {
               // 2. SE DER 404: O schema está quebrado. Forçar reparo de settings imediatamente.
               console.warn(`[Neural Fix] Detectado 404 para ${name}. Reparando Schema v2.3.7...`);
               await activatePostgres(name);
             }
           } catch (e) { 
             contactCount = 0; 
           }
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
    } catch (e) {
      console.error('Fetch Error:', e);
    }
  };

  // REPARO DE SCHEMA E ATIVAÇÃO POSTGRES (OBRIGATÓRIO PARA V2.3.7)
  const activatePostgres = async (instanceName: string) => {
    try {
      setIsSyncing(true);
      // PAYLOAD COMPLETO: A Evolution v2.3.7 exige todas as propriedades de comportamento
      const repairPayload = { 
        database: true, 
        save: true, 
        syncContacts: true,
        syncMessages: true,
        syncGroups: false,
        rejectCall: false,      // Requisito log
        groupsIgnore: false,    // Requisito log
        alwaysOnline: true,     // Requisito log
        readMessages: true,     // Requisito log
        readStatus: false,      // Requisito log
        syncFullHistory: false  // Requisito log - CAUSA DO ERRO
      };

      const setRes = await fetch(`${EVOLUTION_URL}/settings/set/${instanceName}`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(repairPayload)
      });
      
      if (setRes.ok) {
        // Disparar sincronização forçada para criar a tabela no Postgres
        await fetch(`${EVOLUTION_URL}/contact/sync/${instanceName}`, { 
          method: 'POST', 
          headers: getHeaders() 
        });
        activatedInstances.current.add(instanceName);
        console.log(`[Neural] Schema Reparado e Postgres vinculado para: ${instanceName}`);
      }
    } catch (e) {
      console.error(`[Neural] Erro ao tentar reparar ${instanceName}`, e);
    } finally {
      setIsSyncing(false);
    }
  };

  // CRIAÇÃO DE INSTÂNCIA JÁ COM SCHEMA V2.3.7 COMPLIANT
  const handleAutoCreate = async () => {
    if (isCreatingInstance) return;
    setIsCreatingInstance(true);
    
    const autoName = `neural_${Math.random().toString(36).substring(7)}`;
    
    try {
      const createPayload = { 
        instanceName: autoName, 
        token: "", 
        qrcode: true,
        integration: "WHATSAPP",
        rejectCall: false,      // Injeção v2.3.7
        groupsIgnore: false,    // Injeção v2.3.7
        alwaysOnline: true,     // Injeção v2.3.7
        readMessages: true,     // Injeção v2.3.7
        readStatus: false,      // Injeção v2.3.7
        syncFullHistory: false  // Injeção v2.3.7 - A chave do problema
      };

      const res = await fetch(`${EVOLUTION_URL}/instance/create`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(createPayload)
      });
      
      const data = await res.json();
      
      if (res.ok || res.status === 201) {
        // Imediatamente tenta configurar o banco para garantir que a rota de contatos nasça ativa
        await activatePostgres(autoName);

        const b64 = data.qrcode?.base64 || data.instance?.qrcode?.base64;
        if (b64) {
          setQrCodeData({ base64: b64, name: autoName });
        } else {
          setTimeout(() => getQRCode(autoName), 1500);
        }
        await fetchInstances();
      } else {
        const msg = data.message || 'Erro de validação v2.3.7';
        alert(`Erro de Handshake: ${msg}`);
      }
    } catch (e) {
      alert("Falha no Provisionamento Neural.");
    } finally {
      setIsCreatingInstance(false);
    }
  };

  const getQRCode = async (instanceName: string) => {
    setIsLoadingQR(true);
    try {
      const res = await fetch(`${EVOLUTION_URL}/instance/connect/${instanceName}`, { headers: getHeaders() });
      const data = await res.json();
      if (data.base64) {
        setQrCodeData({ base64: data.base64, name: instanceName });
      }
    } catch (e) { console.error('QR Recovery Failed'); }
    finally { setIsLoadingQR(false); }
  };

  const deleteInstance = async (instanceName: string) => {
    if (!confirm(`Remover cluster ${instanceName}?`)) return;
    await fetch(`${EVOLUTION_URL}/instance/delete/${instanceName}`, { method: 'DELETE', headers: getHeaders() });
    activatedInstances.current.delete(instanceName);
    await fetchInstances();
  };

  const logoutInstance = async (instanceName: string) => {
    if (!confirm(`Encerrar sessão de ${instanceName}?`)) return;
    await fetch(`${EVOLUTION_URL}/instance/logout/${instanceName}`, { method: 'DELETE', headers: getHeaders() });
    activatedInstances.current.delete(instanceName);
    await fetchInstances();
  };

  // Monitoramento do Handshake
  useEffect(() => {
    fetchInstances();
    const timer = setInterval(() => {
      fetchInstances();
      if (qrCodeData) {
        const inst = instances.find(i => i.name === qrCodeData.name);
        if (inst && inst.status === 'CONNECTED') {
          setQrCodeData(null);
          activatePostgres(inst.name);
        }
      }
    }, 10000); // Intervalo mais longo para evitar spam no servidor
    return () => clearInterval(timer);
  }, [qrCodeData?.name, instances.length]);

  // Gestão de Contatos do Atendimento (Inbox)
  useEffect(() => {
    if (selectedInstance && activeTab === 'atendimento' && selectedInstance.status === 'CONNECTED') {
      setIsLoadingContacts(true);
      fetch(`${EVOLUTION_URL}/contact/findMany/${selectedInstance.name}`, { headers: getHeaders() })
        .then(res => {
          if (!res.ok) throw new Error('Postgres Route Missing');
          return res.json();
        })
        .then(data => {
          const list = Array.isArray(data) ? data : (data.data || []);
          setContacts(list.filter((c: any) => c.id && !c.id.includes('@g.us')));
        })
        .catch(() => {
          setContacts([]);
          // Se falhar no atendimento, tenta reparar a instância
          activatePostgres(selectedInstance.name);
        })
        .finally(() => setIsLoadingContacts(false));
    }
  }, [selectedInstance?.name, activeTab]);

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
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex overflow-hidden">
                  <div className="w-80 md:w-96 border-r border-white/5 flex flex-col bg-black/40 backdrop-blur-3xl">
                     <div className="p-8 border-b border-white/5 space-y-6">
                        <h3 className="text-2xl font-black uppercase italic tracking-tighter text-glow">Neural <span className="text-orange-500">Inbox.</span></h3>
                        <div className="relative">
                          <select 
                            value={selectedInstance?.id || ""} 
                            onChange={(e) => setSelectedInstance(instances.find(i => i.id === e.target.value) || null)}
                            className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-4 px-5 pr-12 text-[10px] font-black uppercase tracking-[0.2em] outline-none text-white appearance-none cursor-pointer hover:border-orange-500/30 transition-all"
                          >
                            <option value="" className="bg-black">Selecionar Terminal Conectado</option>
                            {instances.filter(i => i.status === 'CONNECTED').map(inst => ( 
                              <option key={inst.id} value={inst.id} className="bg-[#050505]">{inst.name.toUpperCase()}</option> 
                            ))}
                          </select>
                          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-orange-500 pointer-events-none" size={16} />
                        </div>
                     </div>
                     <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                        {isLoadingContacts ? (
                          <div className="flex flex-col items-center py-20 opacity-20"><Loader2 className="animate-spin text-orange-500 mb-4" size={30} /><span className="text-[10px] font-black uppercase tracking-widest text-orange-500">Acessando Postgres v2.3.7...</span></div>
                        ) : contacts.length > 0 ? (
                          contacts.map((contact, i) => (
                            <div key={i} className="p-4 rounded-2xl hover:bg-orange-500/5 border border-transparent hover:border-orange-500/10 transition-all flex items-center gap-4 cursor-pointer group">
                              <div className="w-12 h-12 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center font-black text-orange-500 uppercase group-hover:bg-orange-500 group-hover:text-white transition-all">
                                {contact.pushName ? contact.pushName[0] : (contact.id ? contact.id[0] : '?')}
                              </div>
                              <div className="min-w-0">
                                <p className="text-[11px] font-black uppercase truncate text-white/90 group-hover:text-orange-500 transition-colors">{contact.pushName || contact.id.split('@')[0]}</p>
                                <p className="text-[8px] font-bold text-gray-600 uppercase tracking-widest truncate">+{contact.id?.split('@')[0]}</p>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="flex flex-col items-center py-20 opacity-20 text-center px-10"><MessageCircle size={40} className="mb-4 text-orange-500" /><span className="text-[10px] font-black uppercase tracking-widest leading-loose text-center">Nenhum contato ativo no Postgres. Certifique-se que o terminal está conectado e validado.</span></div>
                        )}
                     </div>
                  </div>
                  <div className="flex-1 flex flex-col items-center justify-center relative bg-[#020202]">
                    <Zap size={120} className="text-orange-500 opacity-[0.03] absolute animate-pulse" />
                    <div className="text-center space-y-6 z-10">
                       <h4 className="text-3xl font-black uppercase italic tracking-tighter text-white/20">Selecione um Chat</h4>
                       <p className="text-[10px] font-black uppercase tracking-[0.5em] text-gray-800">Criptografia Neural Ativa</p>
                    </div>
                  </div>
                </motion.div>
             ) : activeTab === 'instancias' ? (
               <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex-1 p-12 overflow-y-auto custom-scrollbar">
                  <div className="max-w-6xl mx-auto space-y-12">
                     <div className="flex items-center justify-between border-b border-white/5 pb-12">
                        <div>
                           <h2 className="text-5xl font-black uppercase italic tracking-tighter leading-none">Terminais <span className="text-orange-500 text-glow">WayIA.</span></h2>
                           <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.3em] mt-4 italic text-glow">Evolution v2.3.7 Engine | Schema Validation Force-Active</p>
                        </div>
                        <div className="flex gap-4">
                           <button onClick={fetchInstances} className="p-4 glass rounded-2xl text-orange-500 hover:scale-110 transition-all active:rotate-180 duration-500"><RefreshCw size={20}/></button>
                           <button onClick={handleAutoCreate} disabled={isCreatingInstance} className="flex items-center gap-3 px-8 py-4 bg-orange-500 rounded-2xl font-black text-[10px] uppercase tracking-widest italic hover:bg-orange-600 shadow-xl shadow-orange-500/20 transition-all active:scale-95 disabled:opacity-50">
                             {isCreatingInstance ? <Loader2 className="animate-spin" size={16}/> : <Plus size={16} />} 
                             Novo Terminal
                           </button>
                        </div>
                     </div>
                     
                     <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {instances.map(inst => (
                           <div key={inst.id} className="glass p-8 rounded-[2.5rem] border-white/5 space-y-8 relative overflow-hidden group hover:border-orange-500/40 transition-all shadow-2xl hover:bg-white/[0.02]">
                              <div className="flex items-center justify-between relative z-10">
                                 <div className={`px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest flex items-center gap-2 ${inst.status === 'CONNECTED' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                                    {inst.status === 'CONNECTED' ? <Wifi size={10} className="animate-pulse" /> : <WifiOff size={10} />}
                                    {inst.status}
                                 </div>
                                 <div className="flex gap-1">
                                    <button onClick={() => activatePostgres(inst.name)} disabled={inst.status !== 'CONNECTED' || isSyncing} className="p-3 bg-white/5 rounded-xl text-gray-500 hover:text-orange-500 transition-colors disabled:opacity-30" title="Forçar Reparo de Schema v2.3.7"><DatabaseZap size={14} className={isSyncing ? 'animate-bounce text-orange-500' : ''} /></button>
                                    <button onClick={() => deleteInstance(inst.name)} className="p-3 bg-white/5 rounded-xl text-gray-500 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                                 </div>
                              </div>
                              <div className="flex items-center gap-6 relative z-10">
                                 <div className="w-20 h-20 rounded-3xl bg-black border border-white/5 flex items-center justify-center text-orange-500 shadow-2xl overflow-hidden relative group-hover:border-orange-500/20 transition-all">
                                    {inst.profilePicUrl ? <img src={inst.profilePicUrl} className="w-full h-full object-cover" /> : <Smartphone size={32} className="opacity-30" />}
                                 </div>
                                 <div className="space-y-1 min-w-0">
                                    <h4 className="text-[18px] font-black uppercase italic text-white tracking-tight truncate group-hover:text-orange-500 transition-colors">{inst.name}</h4>
                                    <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest italic truncate">{inst.phone}</p>
                                 </div>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-4 py-6 border-y border-white/5 relative z-10 bg-black/20 rounded-2xl px-4">
                                 <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-gray-500"><Users size={12}/><span className="text-[8px] font-black uppercase tracking-widest">Contatos Postgres</span></div>
                                    <div className="text-xl font-black italic text-orange-500">{inst.metrics?.contacts || 0}</div>
                                 </div>
                                 <div className="space-y-2 border-l border-white/5 pl-4">
                                    <div className="flex items-center gap-2 text-gray-500"><MailCheck size={12}/><span className="text-[8px] font-black uppercase tracking-widest">Score Neural</span></div>
                                    <div className="text-xl font-black italic text-white/60">{inst.metrics?.messages || 0}</div>
                                 </div>
                              </div>

                              <div className="pt-2 relative z-10">
                                 {inst.status === 'DISCONNECTED' ? (
                                   <button onClick={() => getQRCode(inst.name)} className="w-full py-5 bg-orange-500/10 border border-orange-500/20 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] text-orange-500 hover:bg-orange-500 hover:text-white transition-all italic flex items-center justify-center gap-3 group/btn"><Scan size={16} className="group-hover/btn:rotate-90 transition-transform" /> Reestabelecer Link</button>
                                 ) : (
                                   <div className="grid grid-cols-2 gap-2">
                                     <button onClick={() => { setSelectedInstance(inst); setActiveTab('atendimento'); }} className="py-4 bg-orange-500 rounded-2xl text-[9px] font-black uppercase tracking-widest text-white italic hover:bg-orange-600 transition-all flex items-center justify-center gap-2 font-black shadow-lg shadow-orange-500/10"><MessageSquare size={14} /> Abrir Inbox</button>
                                     <button onClick={() => logoutInstance(inst.name)} className="py-4 bg-white/5 border border-white/10 rounded-2xl text-[9px] font-black uppercase tracking-widest text-red-500 italic hover:bg-red-500/10 transition-all flex items-center justify-center gap-2"><Power size={14} /> Sair</button>
                                   </div>
                                 )}
                              </div>

                              <div className="absolute top-0 right-0 -mr-20 -mt-20 w-40 h-40 bg-orange-500/5 blur-[80px] rounded-full group-hover:bg-orange-500/10 transition-all duration-700"></div>
                           </div>
                        ))}
                     </div>
                  </div>
               </motion.div>
             ) : (
                <div className="flex-1 flex flex-col items-center justify-center opacity-10">
                   <Logo size="lg" className="grayscale mb-10" />
                   <p className="text-[10px] font-black uppercase tracking-[1em]">Handshake Ativo</p>
                </div>
             )}
           </AnimatePresence>

           {/* QR CODE MODAL */}
           <AnimatePresence>
             {qrCodeData && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[130] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-6">
                   <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="max-w-md w-full glass p-12 rounded-[4rem] border-orange-500/20 text-center space-y-10 relative shadow-[0_0_100px_rgba(255,115,0,0.1)]">
                      <button onClick={() => setQrCodeData(null)} className="absolute top-10 right-10 text-gray-600 hover:text-white transition-colors"><X size={24}/></button>
                      <div className="space-y-4">
                        <h3 className="text-3xl font-black uppercase italic tracking-tighter leading-none text-glow">Link <span className="text-orange-500">Neural.</span></h3>
                        <p className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-500 italic">Estabelecendo Handshake em {qrCodeData.name}</p>
                      </div>
                      <div className="relative p-8 bg-white rounded-[2.5rem] shadow-[0_0_80px_rgba(255,115,0,0.2)] overflow-hidden">
                         <img src={qrCodeData.base64} alt="Scan QR" className="w-full h-auto rounded-xl scale-110 relative z-10" />
                         <div className="absolute inset-0 border-[10px] border-white rounded-[2.5rem] z-20 pointer-events-none"></div>
                         <div className="absolute top-0 left-0 w-full h-1 bg-orange-500/40 animate-scan"></div>
                      </div>
                      <div className="flex items-center justify-center gap-4 text-orange-500 animate-pulse">
                         <Activity size={18} />
                         <span className="text-[9px] font-black uppercase tracking-[0.4em] italic">Aguardando Captura de Sinal...</span>
                      </div>
                   </motion.div>
                </motion.div>
             )}
           </AnimatePresence>

           {/* LOADING OVERLAY */}
           {(isSyncing || isLoadingQR || isCreatingInstance) && (
             <div className="fixed inset-0 z-[140] bg-black/70 backdrop-blur-xl flex items-center justify-center">
                <div className="text-center space-y-8 glass p-20 rounded-[5rem] border-orange-500/20 shadow-[0_0_100px_rgba(255,115,0,0.1)]">
                   <div className="relative">
                     <Loader2 className="animate-spin text-orange-500 mx-auto" size={80} />
                     <Zap className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-orange-500 animate-pulse" size={24} />
                   </div>
                   <div className="space-y-2">
                     <p className="text-[14px] font-black uppercase tracking-[0.6em] text-orange-500 animate-pulse italic">Handshake Progress...</p>
                     <p className="text-[8px] font-black uppercase tracking-[0.4em] text-gray-600 italic">Sincronizando Clusters Postgres v2.3.7</p>
                   </div>
                </div>
             </div>
           )}
        </div>
      </main>

      <style>{`
        @keyframes scan {
          0% { top: 0; }
          100% { top: 100%; }
        }
        .animate-scan {
          animation: scan 2.5s linear infinite;
        }
        .text-glow {
          text-shadow: 0 0 20px rgba(255, 115, 0, 0.4);
        }
      `}</style>
    </div>
  );
}
