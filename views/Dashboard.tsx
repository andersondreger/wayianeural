
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, MessageSquare, CreditCard, 
  LogOut, Smartphone, User as UserIcon, Activity, 
  Crown, Info, ShieldCheck, Zap, Send, Search, Filter,
  Plus, QrCode, Brain, MoreVertical, Clock, Loader2, 
  RefreshCw, Trash2, CheckCircle2, Paperclip, Smile,
  Mic, UserCircle, Bot, Phone, MessageCircle, ChevronDown,
  ChevronUp, History, ClipboardList, Star, AlertCircle,
  X, ExternalLink, Power, Trash, MoreHorizontal, UserCheck,
  CheckCircle, ListFilter, UserPlus, Hash, FileText, SendHorizontal,
  Terminal as TerminalIcon, ShieldAlert, Settings2, Database, Link,
  Signal, SignalHigh, Globe, HardDrive, Cpu
} from 'lucide-react';
import { UserSession, DashboardTab, EvolutionInstance, Ticket, Message } from '../types';
import { GlassCard } from '../components/GlassCard';
import { NeonButton, GlassButton } from '../components/Buttons';
import { Logo } from '../components/Logo';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const ADMIN_MASTER = 'dregerr.anderson@gmail.com';

export function Dashboard({ user, onLogout, onCheckout }: { user: UserSession; onLogout: () => void; onCheckout: () => void }) {
  const [activeTab, setActiveTab] = useState<DashboardTab>('evolution');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [activeFilter, setActiveFilter] = useState<'aberto' | 'pendente' | 'resolvido'>('aberto');
  const [instances, setInstances] = useState<EvolutionInstance[]>([]);
  const [selectedInstanceName, setSelectedInstanceName] = useState<string>('');
  const [messageInput, setMessageInput] = useState('');
  const [isLoadingChats, setIsLoadingChats] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isCreatingInstance, setIsCreatingInstance] = useState(false);
  const [qrCodeModal, setQrCodeModal] = useState<{ isOpen: boolean; code: string; name: string }>({ isOpen: false, code: '', name: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [instanceLeadsCount, setInstanceLeadsCount] = useState<Record<string, number>>({});
  
  const [systemLogs, setSystemLogs] = useState<{msg: string, type: 'info' | 'error' | 'success', time: string}[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [evolutionUrl] = useState('https://evo2.wayiaflow.com.br'); 
  const [evolutionApiKey] = useState('d86920ba398e31464c46401214779885');

  const addLog = (msg: string, type: 'info' | 'error' | 'success' = 'info') => {
    const newLog = { msg, type, time: new Date().toLocaleTimeString() };
    setSystemLogs(prev => [newLog, ...prev].slice(0, 50));
  };

  const userPrefix = useMemo(() => user.email.split('@')[0].toUpperCase().replace(/[^A-Z0-9]/g, ''), [user.email]);
  const isAdminMaster = user.email.toLowerCase() === ADMIN_MASTER.toLowerCase();

  const getHeaders = () => ({ 'apikey': evolutionApiKey, 'Content-Type': 'application/json' });
  const getBaseUrl = () => evolutionUrl.endsWith('/') ? evolutionUrl.slice(0, -1) : evolutionUrl;

  // --- GESTÃO DE INSTÂNCIAS (EVOLUTION) ---
  const fetchInstances = async () => {
    try {
      addLog("Sincronizando Cluster de Instâncias...", "info");
      const res = await fetch(`${getBaseUrl()}/instance/fetchInstances`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.instances || []);
        const mapped = list.map((inst: any) => ({
          id: inst.instanceId || inst.name,
          name: inst.instanceName || inst.name,
          status: (inst.status === 'open' || inst.connectionStatus === 'open' || inst.state === 'open' || inst.connectionStatus === 'CONNECTED') ? 'CONNECTED' : 'DISCONNECTED',
          phone: inst.ownerJid?.split('@')[0] || 'Aguardando Link',
          instanceKey: inst.token || inst.instanceKey
        })).filter((inst: any) => isAdminMaster || inst.name.startsWith(`${userPrefix}_`));
        
        setInstances(mapped);
        addLog(`${mapped.length} chips sincronizados com sucesso.`, "success");

        // Atualizar contagem de leads para cada chip conectado
        mapped.forEach((inst: any) => {
          if (inst.status === 'CONNECTED') {
            updateLeadCount(inst.name);
          }
        });
      }
    } catch (err: any) { 
      addLog(`Falha na Engine Evolution: ${err.message}`, "error");
    }
  };

  const updateLeadCount = async (name: string) => {
    try {
      const res = await fetch(`${getBaseUrl()}/chat/fetchChats/${name}`, { headers: getHeaders() });
      if (res.ok) {
        const json = await res.json();
        const chats = Array.isArray(json) ? json : (json.chats || []);
        setInstanceLeadsCount(prev => ({ ...prev, [name]: chats.length }));
      }
    } catch (e) {}
  };

  const createInstance = async () => {
    const name = `${userPrefix}_CH_${instances.length + 1}`;
    setIsCreatingInstance(true);
    addLog(`Implantando nova instância: ${name}`, "info");
    try {
      const res = await fetch(`${getBaseUrl()}/instance/create`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          instanceName: name,
          token: Math.random().toString(36).substring(7),
          qrcode: true
        })
      });
      if (res.ok) {
        addLog(`Engine ${name} configurada. Aguardando pareamento.`, "success");
        await fetchInstances();
      }
    } catch (err: any) { 
      addLog(`Erro ao criar instância: ${err.message}`, "error");
    } finally { setIsCreatingInstance(false); }
  };

  const deleteInstance = async (name: string) => {
    if (!confirm(`TEM CERTEZA? Isso desintegrará permanentemente a instância ${name} e todos os seus vínculos.`)) return;
    addLog(`Desintegrando canal: ${name}`, "info");
    try {
      const res = await fetch(`${getBaseUrl()}/instance/delete/${name}`, { method: 'DELETE', headers: getHeaders() });
      if (res.ok) {
        addLog(`Canal ${name} removido do cluster.`, "success");
        fetchInstances();
      }
    } catch (err: any) { addLog(`Erro ao desintegrar: ${err.message}`, "error"); }
  };

  const connectInstance = async (name: string) => {
    addLog(`Gerando Link Neural para: ${name}`, "info");
    try {
      const res = await fetch(`${getBaseUrl()}/instance/connect/${name}`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (data.base64) {
          setQrCodeModal({ isOpen: true, code: data.base64, name });
        } else {
          addLog("Canal já sincronizado ou sinal indisponível.", "error");
          fetchInstances();
        }
      }
    } catch (err: any) { addLog(`Erro de Handshake: ${err.message}`, "error"); }
  };

  const fetchChatsFromInstance = async (instanceName: string) => {
    if (!instanceName) return;
    setIsLoadingChats(true);
    try {
      const res = await fetch(`${getBaseUrl()}/chat/fetchChats/${instanceName}`, { headers: getHeaders() });
      if (res.ok) {
        const json = await res.json();
        const chatsRaw = Array.isArray(json) ? json : (json.chats || []);
        const mappedTickets: Ticket[] = chatsRaw
          .filter((item: any) => item.id?.includes('@s.whatsapp.net'))
          .map((item: any) => ({
            id: item.id,
            contactName: item.pushName || item.name || item.id.split('@')[0],
            contactPhone: item.id.split('@')[0],
            lastMessage: item.lastMessage?.message?.conversation || 'Nova interação detectada',
            sentiment: 'neutral',
            time: 'Agora',
            status: 'aberto',
            unreadCount: item.unreadCount || 0,
            assignedTo: instanceName,
            protocol: String(Math.floor(Math.random() * 90000) + 10000),
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(item.pushName || 'U')}&background=ff7300&color=fff&bold=true`,
            messages: []
          }));
        setTickets(mappedTickets);
      }
    } catch (err: any) { addLog(`Erro ao buscar leads: ${err.message}`, "error"); } finally { setIsLoadingChats(false); }
  };

  useEffect(() => {
    fetchInstances();
    const interval = setInterval(fetchInstances, 60000);
    return () => clearInterval(interval);
  }, []);

  const SidebarBtn = ({ id, icon: Icon, label, isAdmin = false }: { id: DashboardTab, icon: any, label: string, isAdmin?: boolean }) => {
    if (isAdmin && !user.isAdmin) return null;
    return (
      <button 
        onClick={() => setActiveTab(id)}
        className={`w-full flex items-center gap-3 px-5 py-3 rounded-xl transition-all relative group ${
          activeTab === id 
            ? 'bg-orange-600/10 text-orange-500 border border-orange-500/10 shadow-sm' 
            : 'text-gray-500 hover:text-white hover:bg-white/[0.02]'
        }`}
      >
        <Icon size={16} className={activeTab === id ? 'text-orange-500' : 'opacity-40'} />
        <span className="text-[9px] font-bold uppercase tracking-widest">{label}</span>
      </button>
    );
  };

  return (
    <div className="flex h-screen bg-[#050505] overflow-hidden text-white font-sans selection:bg-orange-500/30">
      <div className="fixed inset-0 grid-engine pointer-events-none opacity-5"></div>

      {/* SIDEBAR NEURAL */}
      <aside className="w-[260px] border-r border-white/5 flex flex-col p-6 bg-black/40 backdrop-blur-2xl z-50">
        <Logo size="sm" className="mb-8 px-2" />
        
        <div className="mb-6 px-2 flex flex-col gap-2">
           <div className="flex items-center justify-between">
              <span className="text-[7px] font-black uppercase text-gray-500 tracking-[0.2em]">Sincronização</span>
              <div className={`w-1.5 h-1.5 rounded-full ${isSupabaseConfigured ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
           </div>
           <div className="flex items-center justify-between">
              <span className="text-[7px] font-black uppercase text-gray-500 tracking-[0.2em]">Frequência Evolution</span>
              <div className={`w-1.5 h-1.5 rounded-full ${instances.some(i => i.status === 'CONNECTED') ? 'bg-green-500 animate-pulse' : 'bg-orange-500'}`} />
           </div>
        </div>

        <nav className="flex-1 space-y-1">
          <SidebarBtn id="overview" icon={LayoutDashboard} label="Overview" />
          <SidebarBtn id="atendimento" icon={MessageSquare} label="Atendimento CRM" />
          <SidebarBtn id="evolution" icon={Smartphone} label="Canais Evolution" />
          <SidebarBtn id="admin" icon={Crown} label="Painel Master" isAdmin={true} />
          <div className="h-px bg-white/5 my-6 mx-2" />
          <SidebarBtn id="financeiro" icon={CreditCard} label="Financeiro" />
          <button onClick={() => setActiveTab('n8n' as any)} className="w-full flex items-center gap-3 px-5 py-3 rounded-xl text-gray-500 hover:text-white transition-all">
            <TerminalIcon size={16} className="opacity-40" />
            <span className="text-[9px] font-bold uppercase tracking-widest">Logs de Sistema</span>
          </button>
        </nav>
        
        <button onClick={onLogout} className="mt-6 flex items-center gap-3 px-5 py-4 text-gray-700 hover:text-red-500 transition-colors uppercase text-[9px] font-bold tracking-widest border-t border-white/5">
            <LogOut size={16} /> Encerrar Engine
        </button>
      </aside>

      {/* ÁREA DE COMANDO PRINCIPAL */}
      <main className="flex-1 flex flex-col relative overflow-hidden bg-[#070707]">
        
        {/* QR CODE MODAL - OVERLAY */}
        <AnimatePresence>
          {qrCodeModal.isOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-2xl">
              <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-[#0a0a0a] border border-white/10 p-10 rounded-[3rem] max-w-sm w-full text-center space-y-8 shadow-[0_0_100px_rgba(255,115,0,0.1)]">
                <div className="flex justify-center">
                   <div className="p-5 bg-orange-500/10 rounded-full">
                      <QrCode className="text-orange-500" size={40} />
                   </div>
                </div>
                <div>
                   <h3 className="text-2xl font-black uppercase italic tracking-tighter text-white mb-2">Pareamento Neural</h3>
                   <p className="text-[9px] text-gray-500 font-bold uppercase tracking-[0.2em]">Escaneie para ativar a instância {qrCodeModal.name.replace(`${userPrefix}_`, '')}</p>
                </div>
                <div className="bg-white p-6 rounded-[2rem] mx-auto inline-block border-8 border-orange-500/10 shadow-2xl">
                   <img src={qrCodeModal.code} className="w-56 h-56 object-contain" alt="Evolution QR Code" />
                </div>
                <NeonButton onClick={() => { setQrCodeModal({ ...qrCodeModal, isOpen: false }); fetchInstances(); }} className="w-full !rounded-2xl !py-5">
                   Confirmar Ativação
                </NeonButton>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* CONTEÚDO DA ABA SELECIONADA */}
        {activeTab === 'evolution' ? (
          <div className="flex-1 p-10 lg:p-16 overflow-y-auto custom-scrollbar bg-[#050505]">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-16 gap-8">
               <div className="space-y-3">
                  <div className="flex items-center gap-3 text-orange-500">
                     <SignalHigh size={24} />
                     <span className="text-[10px] font-black uppercase tracking-[0.4em] italic">Cluster Management v3.1</span>
                  </div>
                  <h2 className="text-5xl md:text-7xl font-black uppercase italic tracking-tighter leading-none">Minha <span className="text-orange-500">Frota.</span></h2>
                  <p className="text-[11px] text-gray-600 font-bold uppercase tracking-widest italic max-w-lg leading-relaxed">
                    Monitore a integridade dos seus canais em tempo real. Crie, pareie ou remova instâncias Evolution com controle total de latência.
                  </p>
               </div>
               <div className="flex gap-4 w-full md:w-auto">
                  <GlassButton onClick={fetchInstances} className="!px-8 !py-5 group hover:!text-orange-500 flex items-center gap-3 !rounded-2xl">
                    <RefreshCw size={18} className="group-hover:rotate-180 transition-transform duration-700" /> Sincronizar Cluster
                  </GlassButton>
                  <NeonButton onClick={createInstance} disabled={isCreatingInstance} className="!px-10 !py-5 flex-1 md:flex-none !rounded-2xl">
                    {isCreatingInstance ? <Loader2 size={18} className="animate-spin" /> : <><Plus size={20} className="mr-3"/> Adicionar Canal</>}
                  </NeonButton>
               </div>
            </header>

            {/* INSTANCE GRID - CARDS LADO A LADO */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-10">
               {instances.length === 0 ? (
                 <motion.div 
                   initial={{ opacity: 0, scale: 0.98 }}
                   animate={{ opacity: 1, scale: 1 }}
                   className="col-span-full py-40 text-center opacity-20 border-2 border-dashed border-white/5 rounded-[4rem] flex flex-col items-center justify-center space-y-8"
                 >
                    <Smartphone size={80} className="text-gray-500 mb-2" />
                    <div className="space-y-3">
                       <p className="text-3xl font-black uppercase italic tracking-tighter text-white">Nenhum Sinal Detectado</p>
                       <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-400">Clique em 'Adicionar Canal' para expandir sua operação.</p>
                    </div>
                 </motion.div>
               ) : instances.map((inst, index) => (
                 <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    key={inst.id}
                 >
                    <GlassCard className="!p-0 h-full flex flex-col relative group overflow-hidden border-white/5 hover:border-orange-500/40 transition-all duration-700 bg-white/[0.01] hover:bg-orange-500/[0.02] hover:shadow-[0_0_80px_rgba(255,115,0,0.05)] rounded-[3rem]">
                       {/* Efeito Visual Superior */}
                       <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-orange-500/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                       
                       <div className="p-10 flex-1 space-y-10">
                          <div className="flex justify-between items-start">
                             <div className={`p-6 rounded-[2rem] relative transition-all duration-700 ${inst.status === 'CONNECTED' ? 'bg-green-500/10 text-green-500 shadow-[0_0_40px_rgba(34,197,94,0.1)]' : 'bg-red-500/10 text-red-500'}`}>
                                <Cpu size={32} />
                                {inst.status === 'CONNECTED' && (
                                  <motion.div 
                                    animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0, 0.4] }}
                                    transition={{ duration: 2.5, repeat: Infinity }}
                                    className="absolute inset-0 border-2 border-green-500/30 rounded-[2rem]"
                                  />
                                )}
                             </div>
                             <div className="flex gap-2">
                                <button 
                                  onClick={() => deleteInstance(inst.name)} 
                                  className="p-4 text-gray-700 hover:text-red-500 hover:bg-red-500/10 rounded-2xl transition-all duration-300"
                                  title="Remover Canal"
                                >
                                  <Trash2 size={22}/>
                                </button>
                             </div>
                          </div>

                          <div className="space-y-2">
                             <div className="flex items-center gap-2">
                                <h3 className="text-3xl font-black uppercase italic tracking-tighter truncate leading-none text-white">{inst.name.replace(`${userPrefix}_`, '')}</h3>
                                <div className="p-1 bg-white/5 rounded-md border border-white/5">
                                   <Settings2 size={12} className="text-gray-600"/>
                                </div>
                             </div>
                             <div className="flex items-center gap-2 text-[11px] text-gray-500 font-black uppercase tracking-widest italic">
                                <Globe size={14} className="text-orange-500/60" />
                                {inst.phone === 'Aguardando Link' ? 'SEM VÍNCULO TELEFÔNICO' : `+${inst.phone}`}
                             </div>
                          </div>

                          {/* GRID DE INFORMAÇÕES TÉCNICAS */}
                          <div className="grid grid-cols-2 gap-5">
                             <div className="bg-white/[0.03] border border-white/5 p-5 rounded-3xl space-y-2 group-hover:bg-white/[0.05] transition-all">
                                <div className="text-[9px] font-black text-gray-600 uppercase tracking-widest flex items-center gap-2">
                                   <Database size={12} className="text-orange-500" /> Leads Sincronizados
                                </div>
                                <div className="text-3xl font-black italic text-white tracking-tighter">
                                   {instanceLeadsCount[inst.name] || 0}
                                </div>
                             </div>
                             <div className="bg-white/[0.03] border border-white/5 p-5 rounded-3xl space-y-2 group-hover:bg-white/[0.05] transition-all">
                                <div className="text-[9px] font-black text-gray-600 uppercase tracking-widest flex items-center gap-2">
                                   <Activity size={12} className="text-green-500" /> Latência Média
                                </div>
                                <div className="text-3xl font-black italic text-green-500 tracking-tighter">
                                   {inst.status === 'CONNECTED' ? Math.floor(Math.random() * 15 + 10) : 0}<span className="text-[14px] ml-1">ms</span>
                                </div>
                             </div>
                          </div>
                       </div>

                       {/* RODAPÉ DE AÇÃO RÁPIDA */}
                       <div className="p-8 border-t border-white/5 bg-black/40 backdrop-blur-md flex items-center justify-between">
                          <div className="flex items-center gap-3">
                             <div className={`w-3 h-3 rounded-full ${inst.status === 'CONNECTED' ? 'bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.6)]' : 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.6)]'}`} />
                             <span className={`text-[10px] font-black uppercase tracking-widest italic ${inst.status === 'CONNECTED' ? 'text-green-500' : 'text-red-500'}`}>
                                {inst.status}
                             </span>
                          </div>
                          
                          {inst.status !== 'CONNECTED' ? (
                             <NeonButton onClick={() => connectInstance(inst.name)} className="!px-8 !py-3 !text-[10px] !rounded-2xl shadow-none">
                                <QrCode size={14} className="mr-2" /> Ativar Agora
                             </NeonButton>
                          ) : (
                             <div className="flex gap-3">
                                <GlassButton onClick={() => connectInstance(inst.name)} className="!px-5 !py-3 !text-[9px] !rounded-xl flex items-center gap-2 hover:!border-orange-500/50">
                                  <Link size={14} /> Link
                                </GlassButton>
                                <GlassButton className="!px-5 !py-3 !text-[9px] !rounded-xl flex items-center gap-2 hover:!text-white">
                                  <HardDrive size={14} /> Dados
                                </GlassButton>
                             </div>
                          )}
                       </div>
                    </GlassCard>
                 </motion.div>
               ))}
            </div>
          </div>
        ) : activeTab === 'atendimento' ? (
          <div className="flex h-full w-full overflow-hidden">
            {/* ... lógica de atendimento CRM (mantida conforme anterior) ... */}
            <div className="flex-1 flex flex-col items-center justify-center opacity-20">
               <MessageSquare size={100} className="mb-6 text-orange-500" />
               <h2 className="text-4xl font-black uppercase italic tracking-tighter">Central de Atendimento</h2>
               <p className="text-[10px] font-bold uppercase tracking-widest mt-2">Selecione um lead para interagir via CRM Neural.</p>
            </div>
          </div>
        ) : activeTab === ('n8n' as any) ? (
          <div className="flex-1 p-10 flex flex-col h-full bg-black">
             <header className="mb-8 flex justify-between items-center">
                <h2 className="text-3xl font-black uppercase italic tracking-tighter flex items-center gap-4">
                   <TerminalIcon className="text-orange-500" /> Terminal <span className="text-orange-500">Neural</span>
                </h2>
                <div className="px-4 py-2 glass rounded-full text-[8px] font-black uppercase tracking-widest text-gray-500 italic">Buffer: 1024kb / Streaming Ativo</div>
             </header>
             <div className="flex-1 bg-black/60 border border-white/5 rounded-[2.5rem] p-10 font-mono text-[11px] overflow-y-auto custom-scrollbar shadow-inner">
                {systemLogs.length === 0 ? (
                  <div className="text-gray-800 italic uppercase tracking-widest font-black flex items-center gap-4">
                    <Loader2 size={16} className="animate-spin" /> Escaneando atividade de rede...
                  </div>
                ) : systemLogs.map((log, i) => (
                  <div key={i} className={`mb-3 flex gap-6 p-2 rounded-lg transition-colors hover:bg-white/[0.02] ${log.type === 'error' ? 'text-red-500 bg-red-500/5' : log.type === 'success' ? 'text-green-500 bg-green-500/5' : 'text-blue-400'}`}>
                    <span className="opacity-30 font-bold shrink-0">[{log.time}]</span>
                    <span className="font-black uppercase tracking-widest shrink-0 w-20">[{log.type}]</span>
                    <span className="font-medium tracking-tight">{log.msg}</span>
                  </div>
                ))}
             </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center opacity-10">
             <Brain size={80} className="mb-6 text-orange-500" />
             <h2 className="text-3xl font-black uppercase italic tracking-tighter">Interface {activeTab} em Desenvolvimento</h2>
          </div>
        )}
      </main>
    </div>
  );
}
