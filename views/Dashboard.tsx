
import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, MessageSquare, LogOut, Plus, 
  Loader2, RefreshCw, Trash2, X, Layers, Activity, 
  Search, Send, User, CheckCircle2, Terminal, 
  Database, Bot, Kanban as KanbanIcon, Clock, Zap
} from 'lucide-react';
import { UserSession, DashboardTab, EvolutionInstance, Ticket, Message } from '../types';
import { GlassCard } from '../components/GlassCard';
import { NeonButton, GlassButton } from '../components/Buttons';
import { Logo } from '../components/Logo';

interface DashboardProps {
  user: UserSession;
  onLogout: () => void;
  onCheckout?: () => void;
}

export function Dashboard({ user, onLogout, onCheckout }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<DashboardTab>('integracoes');
  const [instances, setInstances] = useState<(EvolutionInstance & { leadCount?: number })[]>([]);
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [newInstanceName, setNewInstanceName] = useState('');
  const [isCreatingInstance, setIsCreatingInstance] = useState(false);
  const [logs, setLogs] = useState<string[]>(['> WayFlow Neural System v3.1 Booted', '> Cluster: Sincronizado com Evolution API']);
  
  // Terminal de Atendimento
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal de Conexão - 'code' agora é persistente
  const [qrCodeModal, setQrCodeModal] = useState({ 
    isOpen: false, code: '', name: '', status: 'Iniciando...', isBooting: true 
  });

  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPollingRef = useRef(false);

  const evolutionUrl = 'https://evo2.wayiaflow.com.br'; 
  const evolutionApiKey = 'd86920ba398e31464c46401214779885';

  const getHeaders = () => ({ 'apikey': evolutionApiKey, 'Content-Type': 'application/json' });
  const getBaseUrl = () => evolutionUrl.replace(/\/$/, '');

  const addLog = (msg: string) => {
    setLogs(prev => [`> ${msg}`, ...prev.slice(0, 5)]);
  };

  const fetchInstances = async () => {
    try {
      const res = await fetch(`${getBaseUrl()}/instance/fetchInstances`, { headers: getHeaders() });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data?.instances || []);
      
      const mapped = list.map((inst: any) => ({
        id: inst.instanceId || inst.instanceName || inst.name,
        name: inst.instanceName || inst.name,
        status: (inst.status === 'open' || inst.connectionStatus === 'CONNECTED' || inst.state === 'open') ? 'CONNECTED' : 'DISCONNECTED' as any,
        phone: inst.ownerJid?.split('@')[0] || inst.number || '---'
      }));

      setInstances(mapped);
      setApiStatus('online');
    } catch (err) {
      setApiStatus('offline');
      addLog("ERRO: Falha ao conectar com Evolution API.");
    }
  };

  const startQrPolling = (name: string) => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    isPollingRef.current = true;
    
    const poll = async () => {
      if (!isPollingRef.current) return;
      try {
        const res = await fetch(`${getBaseUrl()}/instance/connect/${name}`, { headers: getHeaders() });
        const data = await res.json();
        
        const state = data?.instance?.state || data?.state || data?.status || data?.instance?.status;
        
        if (state === 'open' || state === 'CONNECTED') {
          setQrCodeModal(p => ({ ...p, status: 'Engine Conectada!', code: 'CONNECTED', isBooting: false }));
          isPollingRef.current = false;
          addLog(`Engine ${name} ONLINE.`);
          setTimeout(() => {
            setQrCodeModal(p => ({ ...p, isOpen: false }));
            fetchInstances();
          }, 2500);
          return;
        }

        const qr = data?.base64 || data?.qrcode?.base64 || data?.code;
        if (qr) {
          const qrData = qr.startsWith('data') ? qr : `data:image/png;base64,${qr}`;
          // CRITICAL: Somente atualiza se tivermos um novo código, caso contrário mantém o antigo na tela
          setQrCodeModal(p => ({ 
            ...p, 
            code: qrData, 
            isBooting: false, 
            status: 'Escaneie o QR Code para ativar.' 
          }));
        } else {
          // Mantém o QR Code anterior (p.code) mas muda o status se necessário
          setQrCodeModal(p => ({ ...p, status: 'Aguardando Sincronização...' }));
        }
        
        pollTimerRef.current = setTimeout(poll, 4000);
      } catch (err) {
        pollTimerRef.current = setTimeout(poll, 5000);
      }
    };
    poll();
  };

  const connectInstance = async (name: string) => {
    // Abre o modal preservando o nome e limpando apenas se necessário
    setQrCodeModal(prev => ({ 
      ...prev, 
      isOpen: true, 
      name, 
      status: 'Solicitando QR Code...', 
      isBooting: true 
    }));

    try {
      addLog(`Handshake: Tentando conectar cluster ${name}...`);
      // Forçamos a requisição de conexão
      await fetch(`${getBaseUrl()}/instance/connect/${name}`, { headers: getHeaders() });
      startQrPolling(name);
    } catch (err) {
      startQrPolling(name);
    }
  };

  const handleProvisionInstance = async () => {
    if (!newInstanceName.trim() || isCreatingInstance) return;
    
    const name = newInstanceName.toUpperCase().replace(/\s+/g, '_');
    setIsCreatingInstance(true);
    addLog(`Cluster: Iniciando provisionamento de ${name}`);

    // Feedback visual imediato
    setQrCodeModal({ isOpen: true, code: '', name, status: 'Preparando Cluster...', isBooting: true });

    try {
      const res = await fetch(`${getBaseUrl()}/instance/create`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ instanceName: name, qrcode: true })
      });
      
      const resData = await res.json();

      // Sucesso ou "Já existe"
      if (res.status === 201 || res.status === 409 || resData?.message?.includes('already exists')) {
        addLog(`Cluster: ${name} pronto ou já existente. Conectando...`);
        setNewInstanceName('');
        fetchInstances();
        // Delay técnico para garantir que a Evolution API processe a requisição
        setTimeout(() => connectInstance(name), 1500);
      } else {
        // Se deu erro, mas a mensagem sugere que já existe, tentamos conectar mesmo assim
        if (JSON.stringify(resData).toLowerCase().includes('exists')) {
           connectInstance(name);
        } else {
           addLog(`Erro: ${resData.message || 'Falha técnica'}`);
           setQrCodeModal(p => ({ ...p, status: 'Erro ao criar. Tente outro nome.', isBooting: false }));
        }
      }
    } catch (err) {
      addLog("Erro de Conexão. Tentando fallback para conexão direta.");
      connectInstance(name); // Tenta conectar mesmo em erro de rede no create
    } finally {
      setIsCreatingInstance(false);
    }
  };

  const deleteInstance = async (name: string) => {
    if (!confirm(`Remover permanentemente a engine ${name}?`)) return;
    try {
      await fetch(`${getBaseUrl()}/instance/delete/${name}`, { method: 'DELETE', headers: getHeaders() });
      fetchInstances();
      addLog(`Cluster: Engine ${name} removida.`);
    } catch (err) {
      alert("Falha ao deletar.");
    }
  };

  useEffect(() => {
    fetchInstances();
    const inv = setInterval(fetchInstances, 60000);
    return () => {
      clearInterval(inv);
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      isPollingRef.current = false;
    };
  }, []);

  return (
    <div className="flex h-screen bg-[#070707] overflow-hidden text-white font-sans selection:bg-orange-500/30">
      <div className="fixed inset-0 grid-engine pointer-events-none opacity-[0.03]"></div>

      {/* Sidebar - Garantindo que não fique preto puro */}
      <aside className="w-[280px] border-r border-white/5 flex flex-col p-8 bg-black/60 backdrop-blur-3xl z-50">
        <Logo size="sm" className="mb-12" />
        <nav className="flex-1 space-y-3">
          {[
            { id: 'overview', icon: LayoutDashboard, label: 'Resumo' },
            { id: 'atendimento', icon: MessageSquare, label: 'Terminal Ativo' },
            { id: 'integracoes', icon: Layers, label: 'Engines' },
            { id: 'agentes', icon: Bot, label: 'Agentes IA' }
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as DashboardTab)}
              className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all border ${activeTab === tab.id ? 'bg-orange-600/10 text-orange-500 border-orange-500/20 shadow-lg' : 'text-gray-500 border-transparent hover:text-white hover:bg-white/[0.02]'}`}
            >
              <tab.icon size={18} /> <span className="text-[10px] font-black uppercase tracking-[0.2em]">{tab.label}</span>
            </button>
          ))}
        </nav>
        <div className="mt-auto pt-8 border-t border-white/5 space-y-4">
          <div className="px-4 py-3 bg-white/[0.02] rounded-xl border border-white/5 flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${apiStatus === 'online' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            <span className="text-[8px] font-black uppercase tracking-widest text-gray-400 italic">Core {apiStatus.toUpperCase()}</span>
          </div>
          <button onClick={onLogout} className="w-full flex items-center gap-3 px-6 py-4 text-gray-600 hover:text-red-500 transition-colors uppercase text-[9px] font-black tracking-widest">
            <LogOut size={18} /> Sair
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative overflow-hidden bg-[#080808]">
        
        {activeTab === 'integracoes' && (
          <div className="flex-1 p-12 lg:p-20 overflow-y-auto custom-scrollbar relative z-10">
             <header className="mb-20">
                <h2 className="text-6xl md:text-8xl font-black uppercase italic tracking-tighter leading-none italic">Cluster <span className="text-orange-500">Engines.</span></h2>
                <p className="text-[12px] font-black uppercase tracking-[0.5em] text-gray-500 mt-5 italic">Infraestrutura Evolution v2</p>
             </header>

             <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                <GlassCard className="!p-12 border-white/10 bg-white/[0.02] shadow-2xl">
                   <div className="flex items-center gap-6 mb-12">
                      <div className="p-6 bg-orange-500/10 rounded-[2rem] text-orange-500 shadow-xl shadow-orange-500/5"><Plus size={32} /></div>
                      <div>
                         <h3 className="text-4xl font-black uppercase italic tracking-tight mb-2">Novo Cluster</h3>
                         <p className="text-[12px] text-gray-600 font-bold uppercase tracking-widest">Ativação de Engine Neural</p>
                      </div>
                   </div>
                   
                   <div className="flex gap-4 mb-16">
                      <input 
                        value={newInstanceName} 
                        onChange={e => setNewInstanceName(e.target.value)} 
                        onKeyDown={e => e.key === 'Enter' && handleProvisionInstance()}
                        placeholder="NOME DA ENGINE..." 
                        className="flex-1 bg-black/60 border border-white/10 rounded-[1.5rem] py-6 px-8 text-[16px] font-black uppercase outline-none focus:border-orange-500 transition-all font-mono placeholder:text-gray-800" 
                      />
                      <NeonButton onClick={handleProvisionInstance} disabled={!newInstanceName.trim() || isCreatingInstance} className="!px-10 !rounded-[1.5rem] shadow-orange-500/20 shadow-xl">
                        {isCreatingInstance ? <Loader2 className="animate-spin" size={24} /> : "Ativar"}
                      </NeonButton>
                   </div>

                   <div className="space-y-4">
                      {instances.map(inst => (
                        <div key={inst.id} className="group flex items-center justify-between p-8 bg-white/[0.01] border border-white/5 rounded-[2.5rem] hover:border-orange-500/40 transition-all hover:bg-white/[0.03]">
                           <div className="flex items-center gap-6">
                              <div className={`w-3 h-3 rounded-full ${inst.status === 'CONNECTED' ? 'bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.6)] animate-pulse' : 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]'}`} />
                              <div>
                                 <div className="text-xl font-black uppercase italic leading-none mb-1">{inst.name}</div>
                                 <div className="text-[10px] text-gray-600 font-bold font-mono italic">{inst.status === 'CONNECTED' ? inst.phone : 'CONEXÃO PENDENTE'}</div>
                              </div>
                           </div>
                           <div className="flex gap-4 opacity-0 group-hover:opacity-100 transition-all">
                              <button onClick={() => connectInstance(inst.name)} className="p-3 glass rounded-xl text-orange-500 hover:bg-orange-500 hover:text-white transition-all"><RefreshCw size={16} /></button>
                              <button onClick={() => deleteInstance(inst.name)} className="p-3 glass rounded-xl text-red-500/30 hover:text-red-500 transition-all"><Trash2 size={16} /></button>
                           </div>
                        </div>
                      ))}
                      {instances.length === 0 && (
                        <div className="text-center py-20 opacity-20 uppercase font-black italic tracking-widest text-xs">Aguardando provisionamento de cluster...</div>
                      )}
                   </div>
                </GlassCard>

                <div className="space-y-12">
                   <GlassCard className="!p-12 border-blue-500/10 bg-blue-500/[0.02] flex flex-col items-center justify-center text-center shadow-blue-500/5 shadow-2xl">
                      <Database size={64} className="text-blue-500 mb-8" />
                      <h3 className="text-4xl font-black uppercase italic tracking-tighter mb-4 italic">Evolution Core</h3>
                      <div className="text-green-500 text-[10px] font-black uppercase italic animate-pulse tracking-[0.4em] bg-green-500/5 px-8 py-4 rounded-full border border-green-500/10">Neural Panel Active v2.3</div>
                   </GlassCard>
                   <GlassCard className="!p-10 border-white/5 bg-black/40 shadow-inner">
                      <div className="flex items-center gap-4 mb-6">
                        <Terminal size={18} className="text-gray-700" />
                        <span className="text-[10px] font-black uppercase text-gray-500">Neural Sync Logs</span>
                      </div>
                      <div className="w-full bg-black/40 p-6 rounded-2xl font-mono text-[10px] text-green-500/40 space-y-2 h-[200px] overflow-hidden border border-white/5">
                         {logs.map((log, i) => <div key={i}>{log}</div>)}
                      </div>
                   </GlassCard>
                </div>
             </div>
          </div>
        )}

        {/* Fallback para Abas Vazias */}
        {activeTab !== 'integracoes' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-20 relative z-10">
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-orange-500/5 rounded-full blur-[120px]"></div>
             <Activity size={80} className="text-orange-500/30 animate-pulse mb-8" />
             <h3 className="text-4xl font-black uppercase italic tracking-tighter italic opacity-40">Módulo em <span className="text-orange-500">Expansão.</span></h3>
             <p className="mt-4 uppercase font-black tracking-[0.5em] text-[10px] text-gray-700">Acesso via Integrações Liberado</p>
          </div>
        )}

        {/* MODAL QR CODE - BLINDADO E PERSISTENTE */}
        <AnimatePresence>
          {qrCodeModal.isOpen && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-black/95 backdrop-blur-3xl"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 50 }} 
                animate={{ scale: 1, y: 0 }} 
                className="bg-[#0c0c0c] border border-white/10 p-12 md:p-16 rounded-[4rem] max-w-lg w-full relative text-center shadow-[0_0_120px_rgba(255,115,0,0.1)]"
              >
                <button 
                  onClick={() => { 
                    setQrCodeModal(p => ({ ...p, isOpen: false })); 
                    isPollingRef.current = false; 
                    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
                  }} 
                  className="absolute top-12 right-12 text-gray-700 hover:text-white transition-all transform hover:rotate-90 p-2"
                >
                  <X size={32} />
                </button>
                
                <Logo size="sm" className="mb-12 mx-auto" />

                <div className="bg-white p-10 rounded-[3rem] aspect-square flex items-center justify-center border-8 border-orange-500/10 overflow-hidden shadow-[inset_0_0_50px_rgba(0,0,0,0.1)] relative mx-auto mb-12 min-h-[320px]">
                   {qrCodeModal.code === 'CONNECTED' ? (
                     <div className="flex flex-col items-center">
                        <CheckCircle2 size={140} className="text-green-500 mb-6 drop-shadow-[0_0_20px_rgba(34,197,94,0.4)]" />
                        <span className="text-[14px] font-black uppercase text-green-500 tracking-[0.3em] italic">Engine Sincronizada</span>
                     </div>
                   ) : qrCodeModal.code ? (
                     <img 
                       src={qrCodeModal.code} 
                       className="w-full h-full object-contain animate-in fade-in zoom-in duration-500" 
                       alt="QR Code Ativo" 
                       key={qrCodeModal.code} // Garante que o componente re-renderize se o código mudar
                     />
                   ) : (
                     <div className="flex flex-col items-center gap-8">
                        <Loader2 className="animate-spin text-orange-500" size={70} />
                        <span className="text-[11px] font-black uppercase text-gray-500 tracking-widest italic animate-pulse">{qrCodeModal.status}</span>
                     </div>
                   )}
                </div>

                <div className="space-y-4 mb-10">
                  <h3 className="text-4xl font-black uppercase italic tracking-tighter italic leading-none">Conexão <span className="text-orange-500">Neural.</span></h3>
                  <p className="text-[14px] font-black uppercase tracking-[0.2em] text-gray-400 italic animate-pulse">{qrCodeModal.status}</p>
                  <div className="inline-block px-6 py-2 bg-orange-500/5 rounded-full border border-orange-500/10">
                    <span className="text-[9px] font-black text-orange-500 uppercase tracking-widest italic">{qrCodeModal.name}</span>
                  </div>
                </div>

                {(!qrCodeModal.code || qrCodeModal.isBooting) ? null : (
                  <p className="text-[9px] font-bold text-gray-700 uppercase tracking-[0.2em] mb-4">
                    Abra o WhatsApp > Configurações > Dispositivos Conectados
                  </p>
                )}

                {!qrCodeModal.code && !qrCodeModal.isBooting && (
                  <button 
                    onClick={() => connectInstance(qrCodeModal.name)} 
                    className="text-[10px] font-black uppercase text-orange-500 underline underline-offset-8 tracking-widest hover:text-orange-400 transition-colors"
                  >
                    O QR Code não carregou? Clique para forçar refresh
                  </button>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
