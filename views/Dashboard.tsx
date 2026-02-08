
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
  FolderTree, FileJson, FileText, Globe, Eye, ShieldX, Network, DatabaseIcon,
  MousePointer2, Cable, Keyboard, CheckCircle
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
  const [selectedInstanceForChat, setSelectedInstanceForChat] = useState<EvolutionInstance | null>(null);
  const [contacts, setContacts] = useState<any[]>([]);
  const [isFetchingContacts, setIsFetchingContacts] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);
  const [dbStatus, setDbStatus] = useState<'IDLE' | 'CHECKING' | 'FAIL' | 'READY'>('IDLE');
  const [showPortainerGuide, setShowPortainerGuide] = useState(false);
  const [guideStep, setGuideStep] = useState<'sql' | 'recreate'>('sql');
  const [copied, setCopied] = useState('');

  const chatEndRef = useRef<HTMLDivElement>(null);

  const getHeaders = (instanceName?: string) => {
    const headers: any = { 'apikey': EVOLUTION_API_KEY, 'Content-Type': 'application/json' };
    if (instanceName) headers['instance'] = instanceName;
    return headers;
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
      await fetch(`${EVOLUTION_URL}/instance/setSettings/${instance.name}`, {
        method: 'POST',
        headers: getHeaders(instance.name),
        body: JSON.stringify({ syncFullHistory: true, readMessages: true, readStatus: true, syncContacts: true, syncGroups: false })
      });
      await fetch(`${EVOLUTION_URL}/contact/sync/${instance.name}`, { method: 'POST', headers: getHeaders(instance.name) });
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
    try {
      const res = await fetch(`${EVOLUTION_URL}/contact/findMany?instanceName=${instance.name}`, { headers: getHeaders(instance.name) });
      if (res.ok) {
        const json = await res.json();
        const list = json.data || json.contacts || json;
        if (Array.isArray(list) && list.length > 0) {
          setContacts(list);
          setDbStatus('READY');
          setIsFetchingContacts(false);
          return;
        }
      }
      setDbStatus('FAIL');
      setContactError("POSTGRES VAZIO");
    } catch (e) { setDbStatus('FAIL'); } finally { setIsFetchingContacts(false); }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(''), 2000);
  };

  useEffect(() => {
    fetchInstances();
    const interval = setInterval(fetchInstances, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activeTab === 'atendimento' && selectedInstanceForChat) fetchContacts(selectedInstanceForChat);
  }, [activeTab, selectedInstanceForChat]);

  return (
    <div className="flex h-screen bg-[#050505] text-white overflow-hidden relative font-sans">
      <div className="fixed inset-0 grid-engine pointer-events-none opacity-5"></div>
      
      <aside className={`flex flex-col border-r border-white/5 bg-black/40 backdrop-blur-3xl transition-all duration-300 z-50 ${isSidebarExpanded ? 'w-56' : 'w-20'}`}>
        <div className="p-6 flex justify-center"><Logo size="sm" /></div>
        <div className="flex-1 px-4 py-6 space-y-2">
          <button onClick={() => setActiveTab('overview')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${activeTab === 'overview' ? 'bg-orange-500/10 text-orange-500' : 'text-gray-500'}`}>
             <LayoutDashboard size={16} /> {isSidebarExpanded && <span className="text-[10px] font-black uppercase tracking-widest">Overview</span>}
          </button>
          <button onClick={() => setActiveTab('atendimento')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${activeTab === 'atendimento' ? 'bg-orange-500/10 text-orange-500' : 'text-gray-500'}`}>
             <MessageSquare size={16} /> {isSidebarExpanded && <span className="text-[10px] font-black uppercase tracking-widest">Chats</span>}
          </button>
        </div>
        <div className="p-4 border-t border-white/5">
          <button onClick={onLogout} className="w-full flex items-center gap-4 px-4 py-4 text-gray-600 hover:text-orange-500 transition-all font-black uppercase text-[10px] tracking-[0.3em]">
            <LogOut size={16} />
            {isSidebarExpanded && <span>Sair</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 bg-[#050505]/50 overflow-hidden">
        <header className="h-16 border-b border-white/5 bg-black/20 backdrop-blur-xl flex items-center justify-between px-8 shrink-0 z-40">
          <div className="flex items-center gap-6">
            <button onClick={() => setIsSidebarExpanded(!isSidebarExpanded)} className="p-2.5 glass rounded-xl text-orange-500"><ChevronLeft size={14} className={!isSidebarExpanded ? 'rotate-180' : ''} /></button>
            <div className="flex flex-col">
              <h2 className="text-[10px] font-black uppercase tracking-[0.6em] text-white/40 italic leading-none">Neural Core v21.0</h2>
              <span className="text-[8px] font-bold text-orange-500/50 uppercase tracking-widest mt-1 italic italic">Activation Hub</span>
            </div>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
           {activeTab === 'atendimento' && (
             <div className="flex-1 flex overflow-hidden bg-black/40 backdrop-blur-3xl">
                <div className="w-80 md:w-96 border-r border-white/5 flex flex-col bg-black/10">
                   <div className="p-6 border-b border-white/5 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xl font-black uppercase italic tracking-tighter text-white">Neural <span className="text-orange-500">Inbox.</span></h3>
                        <div className="flex gap-2">
                          <div title="Fix Connection" className="p-1.5 glass rounded-lg text-blue-500 cursor-pointer transition-all hover:scale-110 shadow-lg" onClick={() => setShowPortainerGuide(true)}>
                             <Zap size={14} />
                          </div>
                          <div title="Force Sync" className="p-1.5 glass rounded-lg text-orange-500 cursor-pointer transition-all hover:scale-110" onClick={() => { if(selectedInstanceForChat) forcePostgresInjection(selectedInstanceForChat); }}>
                             <RefreshCw size={14} className={isIndexing ? 'animate-spin' : ''} />
                          </div>
                        </div>
                      </div>
                      <select value={selectedInstanceForChat?.id || ""} onChange={(e) => { const inst = instances.find(i => i.id === e.target.value); if (inst) setSelectedInstanceForChat(inst); }} className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-3 px-4 text-[10px] font-black uppercase tracking-widest outline-none appearance-none focus:border-orange-500/40 transition-all text-white/80">
                        {instances.map(inst => ( <option key={inst.id} value={inst.id} className="bg-[#050505]">{inst.name.toUpperCase()}</option> ))}
                      </select>
                   </div>

                   <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1.5">
                      {isFetchingContacts || isIndexing ? (
                        <div className="py-20 text-center space-y-4">
                           <Loader2 className="animate-spin text-orange-500 mx-auto" size={40} />
                           <p className="text-[9px] font-black uppercase text-orange-500 animate-pulse italic">Sincronizando com Postgres...</p>
                        </div>
                      ) : (
                        <>
                          {contactError && (
                            <div className="p-8 m-3 rounded-[2rem] bg-orange-500/5 border border-orange-500/10 text-center space-y-4 shadow-2xl">
                               <DatabaseZap className="mx-auto text-orange-500 animate-bounce" size={32}/>
                               <div className="space-y-1">
                                  <p className="text-[11px] font-black uppercase text-white italic">Banco Criado com Sucesso!</p>
                                  <p className="text-[8px] font-bold text-gray-500 uppercase leading-relaxed italic">Agora você precisa dar o "Recreate" para a API começar a salvar os dados lá.</p>
                               </div>
                               <NeonButton onClick={() => { setGuideStep('recreate'); setShowPortainerGuide(true); }} className="!py-4 !text-[9px] !rounded-xl">FAZER O RECREATE AGORA</NeonButton>
                            </div>
                          )}
                          {contacts.length === 0 && !contactError && ( <div className="py-20 text-center opacity-20 flex flex-col items-center gap-4"> <Activity size={48} /> <span className="text-[10px] font-black uppercase italic">Neural Frequency Standby</span> </div> )}
                          {contacts.map((contact, i) => (
                            <div key={contact.id || i} className="p-4 rounded-2xl flex items-center gap-4 cursor-pointer transition-all border border-transparent hover:bg-white/[0.02]">
                               <div className="w-12 h-12 rounded-full bg-black border border-white/10 flex items-center justify-center font-black text-gray-700">{(contact.pushName || "?")[0]}</div>
                               <div className="flex-1 min-w-0">
                                  <span className="text-[11px] font-black uppercase text-white truncate italic block">{contact.pushName || contact.name || contact.id}</span>
                                  <p className="text-[9px] font-bold text-gray-700 truncate uppercase mt-0.5">{contact.id}</p>
                               </div>
                            </div>
                          ))}
                        </>
                      )}
                   </div>
                </div>

                <div className="flex-1 flex flex-col items-center justify-center p-20 text-center space-y-10">
                   <div className="w-40 h-40 rounded-full border-4 border-orange-500/5 flex items-center justify-center animate-pulse"><Zap size={64} className="text-orange-500/20" /></div>
                   <h3 className="text-4xl font-black uppercase italic tracking-tighter text-white/40 italic">Sync <span className="text-orange-500/60">Pending.</span></h3>
                   <p className="text-[10px] font-bold text-gray-800 uppercase tracking-[0.4em] max-w-xs leading-loose italic">Aguardando ativação final via Portainer para início do tráfego de dados.</p>
                </div>
             </div>
           )}
        </div>
      </main>

      <AnimatePresence>
        {showPortainerGuide && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/98 backdrop-blur-3xl">
             <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-[#050505] border border-orange-500/30 w-full max-w-4xl rounded-[3rem] overflow-hidden shadow-[0_0_150px_rgba(255,115,0,0.15)] flex flex-col max-h-[90vh]">
                <div className="p-10 border-b border-white/5 flex items-center justify-between bg-orange-600/5">
                   <div className="flex items-center gap-4">
                      <div className="p-3 bg-orange-500/10 rounded-2xl text-orange-500"><RotateCw size={24}/></div>
                      <div>
                         <h3 className="text-2xl font-black uppercase italic tracking-tighter">PASSO FINAL: <span className="text-orange-500">RECREATE</span></h3>
                         <p className="text-[9px] font-black text-gray-700 uppercase tracking-widest italic mt-2">Você já criou o banco! Agora vamos ligar a API nele.</p>
                      </div>
                   </div>
                   <button onClick={() => setShowPortainerGuide(false)} className="p-3 glass rounded-2xl text-gray-500 hover:text-white transition-all"><X size={20}/></button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-10 custom-scrollbar space-y-12">
                   <div className="grid md:grid-cols-2 gap-10">
                      {/* PASSO 1 */}
                      <div className="p-8 glass rounded-[2.5rem] border-orange-500/10 space-y-6 relative overflow-hidden group">
                         <div className="w-10 h-10 rounded-xl bg-orange-600 flex items-center justify-center text-xs font-black">1</div>
                         <h4 className="text-[11px] font-black uppercase tracking-widest text-white italic">RECREATE NA API</h4>
                         <ul className="space-y-4 text-[10px] text-gray-500 font-bold uppercase tracking-tight italic">
                            <li className="flex items-start gap-3"><CheckCircle size={14} className="text-orange-500 shrink-0 mt-0.5" /> Vá no container da <span className="text-white">Evolution API</span>.</li>
                            <li className="flex items-start gap-3"><CheckCircle size={14} className="text-orange-500 shrink-0 mt-0.5" /> Clique no botão <span className="text-orange-500">RECREATE</span> (no menu superior).</li>
                            <li className="flex items-start gap-3"><CheckCircle size={14} className="text-orange-500 shrink-0 mt-0.5" /> Marque a caixa <span className="text-white italic">"Pull latest image"</span>.</li>
                            <li className="flex items-start gap-3"><CheckCircle size={14} className="text-orange-500 shrink-0 mt-0.5" /> Clique no botão azul <span className="text-white">Recreate</span>.</li>
                         </ul>
                      </div>

                      {/* PASSO 2 */}
                      <div className="p-8 glass rounded-[2.5rem] border-white/5 space-y-6 relative overflow-hidden group">
                         <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-xs font-black">2</div>
                         <h4 className="text-[11px] font-black uppercase tracking-widest text-white italic">VERIFICAR REDE (DICA)</h4>
                         <p className="text-[9px] text-gray-600 font-bold uppercase leading-relaxed italic">Se após o Recreate não funcionar, verifique se ambos os containers (API e Postgres) estão na mesma rede Docker (Ex: <span className="text-blue-500">bridge</span> ou <span className="text-blue-500">wayia-net</span>).</p>
                         <div className="flex items-center gap-3 p-4 bg-blue-500/5 rounded-2xl border border-blue-500/10">
                            <Network size={20} className="text-blue-500" />
                            <span className="text-[8px] font-black uppercase text-gray-700 italic">Containers em redes diferentes não se enxergam.</span>
                         </div>
                      </div>
                   </div>

                   <div className="p-10 bg-orange-600/5 border border-orange-500/10 rounded-[3rem] space-y-8">
                      <div className="flex items-center gap-6">
                         <div className="p-4 bg-orange-600/20 rounded-full text-orange-500 animate-pulse"><Info size={32}/></div>
                         <div>
                            <h5 className="text-xl font-black uppercase italic tracking-tighter">Quase Lá!</h5>
                            <p className="text-[10px] font-black text-gray-700 uppercase tracking-widest italic leading-relaxed">
                               O banco `evolution` já existe, mas a API precisa de um "reboot" para começar a usá-lo. O Recreate faz exatamente isso: reinicia a API e força ela a ler o banco de novo.
                            </p>
                         </div>
                      </div>
                      <div className="flex gap-4">
                        <NeonButton onClick={() => setShowPortainerGuide(false)} className="flex-1 !py-5">JÁ FIZ O RECREATE, PODE ATUALIZAR!</NeonButton>
                      </div>
                   </div>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
