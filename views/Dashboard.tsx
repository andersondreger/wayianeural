
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageSquare, LogOut, Plus, Loader2, RefreshCw, 
  Trash2, X, Layers, Search, Send, CheckCircle2, 
  Smartphone, ShieldCheck, ChevronLeft, Bot, Zap, 
  Activity, User, Smile, Mic, ArrowRight,
  Database, QrCode, LayoutDashboard, Power
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { UserSession, DashboardTab, EvolutionInstance, Ticket, Message, KanbanColumn } from '../types';
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
const HEADERS = { 'apikey': EVOLUTION_API_KEY, 'Content-Type': 'application/json' };

export function Dashboard({ user, onLogout }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<DashboardTab>('integracoes');
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [instances, setInstances] = useState<EvolutionInstance[]>([]);
  const [leads, setLeads] = useState<Ticket[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [newInstanceName, setNewInstanceName] = useState('');
  const [isCreatingInstance, setIsCreatingInstance] = useState(false);
  
  const [qrModal, setQrModal] = useState({ 
    isOpen: false, 
    code: '', 
    name: '', 
    status: '', 
    connected: false,
    timestamp: 0
  });

  const poolingRef = useRef<any>(null);

  const fetchInstances = async () => {
    try {
      const res = await fetch(`${EVOLUTION_URL}/instance/fetchInstances`, { headers: HEADERS });
      const data = await res.json();
      const raw = Array.isArray(data) ? data : (data.instances || []);
      const mapped: EvolutionInstance[] = raw.map((i: any) => {
        const instData = i.instance || i;
        const name = instData.instanceName || instData.name || instData.id;
        return {
          id: instData.id || instData.instanceId || name,
          name: name,
          status: (instData.status === 'open' || instData.connectionStatus === 'open') ? 'CONNECTED' : 'DISCONNECTED',
          phone: instData.ownerJid ? instData.ownerJid.split('@')[0] : 'Motor Standby',
          profilePicUrl: instData.profilePicUrl || ""
        };
      });
      setInstances(mapped);

      // Se o modal estiver aberto e a instância que estamos monitorando conectar, fechamos o pooling
      if (qrModal.isOpen && !qrModal.connected) {
        const current = mapped.find(i => i.name === qrModal.name);
        if (current?.status === 'CONNECTED') {
          setQrModal(p => ({ ...p, connected: true, status: 'Motor Sincronizado!' }));
          if (poolingRef.current) clearInterval(poolingRef.current);
        }
      }
    } catch (e) {
      console.error('Fetch Instances Fail');
    }
  };

  const pollQrCode = async (name: string) => {
    try {
      // Endpoint de conexão da Evolution para buscar o QR Code atualizado
      const res = await fetch(`${EVOLUTION_URL}/instance/connect/${name}`, { headers: HEADERS });
      const data = await res.json();
      
      // COLETOR DE HANDSHAKE MULTI-NÍVEL (Resolução da Causa Raiz)
      // Varremos todas as possibilidades de retorno da Evolution v1/v2
      let qrBase64 = null;
      
      if (data.base64) qrBase64 = data.base64;
      else if (data.qrcode?.base64) qrBase64 = data.qrcode.base64;
      else if (data.code?.base64) qrBase64 = data.code.base64;
      else if (data.qrcode) qrBase64 = data.qrcode;
      else if (data.code) qrBase64 = data.code;
      
      if (typeof qrBase64 === 'string' && qrBase64.length > 50) {
        setQrModal(p => {
          if (p.connected) return p;
          // Se o código for novo, atualizamos o estado
          return { ...p, code: qrBase64, status: 'Pronto para Escanear' };
        });
      } else if (data.status === 'open' || data.instance?.status === 'open' || data.connectionStatus === 'open') {
        // Se a instância já estiver aberta, marcamos como conectado
        setQrModal(p => ({ ...p, connected: true, status: 'Engine Ativa!' }));
        if (poolingRef.current) clearInterval(poolingRef.current);
        fetchInstances();
      }
    } catch (e) {
      console.log("Pooling handshake...");
    }
  };

  const createInstance = async () => {
    if (!newInstanceName.trim()) return;
    setIsCreatingInstance(true);
    const sanitizedName = newInstanceName.trim().toLowerCase().replace(/[^a-z0-9]/g, '-');
    
    // Reset imediato do modal para evitar travamentos visuais
    setQrModal({ 
      isOpen: true, 
      code: '', 
      name: sanitizedName, 
      status: 'Injetando no Cluster...', 
      connected: false, 
      timestamp: Date.now() 
    });

    try {
      // Logout preventivo para evitar conflito de sessões presas
      await fetch(`${EVOLUTION_URL}/instance/logout/${sanitizedName}`, { method: 'DELETE', headers: HEADERS }).catch(() => {});
      
      // Criar a instância
      await fetch(`${EVOLUTION_URL}/instance/create`, {
        method: 'POST', 
        headers: HEADERS, 
        body: JSON.stringify({ instanceName: sanitizedName, qrcode: true })
      });
      
      setNewInstanceName('');
      
      // Inicia o pooling de QR Code imediatamente
      if (poolingRef.current) clearInterval(poolingRef.current);
      pollQrCode(sanitizedName);
      poolingRef.current = setInterval(() => pollQrCode(sanitizedName), 4000);
      
    } catch (e) { 
      // Em caso de erro (como instância já existente), tentamos conectar direto
      pollQrCode(sanitizedName);
      poolingRef.current = setInterval(() => pollQrCode(sanitizedName), 4000);
    } finally { 
      setIsCreatingInstance(false); 
      fetchInstances();
    }
  };

  const connectInstance = async (name: string) => {
    setQrModal({ 
      isOpen: true, 
      name, 
      status: 'Reiniciando Handshake...', 
      code: '', 
      connected: false, 
      timestamp: Date.now() 
    });
    
    // Limpa estado anterior no servidor
    await fetch(`${EVOLUTION_URL}/instance/logout/${name}`, { method: 'DELETE', headers: HEADERS }).catch(() => {});
    
    pollQrCode(name);
    if (poolingRef.current) clearInterval(poolingRef.current);
    poolingRef.current = setInterval(() => pollQrCode(name), 4000);
  };

  const deleteInstance = async (name: string) => {
    if (!confirm(`Remover motor neural ${name}?`)) return;
    try {
      await fetch(`${EVOLUTION_URL}/instance/delete/${name}`, { method: 'DELETE', headers: HEADERS });
      fetchInstances();
    } catch (e) {}
  };

  useEffect(() => {
    fetchInstances();
    const interval = setInterval(fetchInstances, 20000); 
    return () => {
      clearInterval(interval);
      if (poolingRef.current) clearInterval(poolingRef.current);
    };
  }, []);

  const SidebarItem = ({ icon: Icon, label, badge, active, onClick }: any) => (
    <button onClick={onClick} className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all group ${active ? 'bg-orange-500/10 text-orange-500 border border-orange-500/20 shadow-lg shadow-orange-500/5' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}>
      <div className="flex items-center gap-3">
        <Icon size={16} className={active ? 'text-orange-500' : 'text-gray-500 group-hover:text-orange-500 transition-colors'} />
        {isSidebarExpanded && <span className="text-[10px] font-black uppercase tracking-[0.2em]">{label}</span>}
      </div>
      {isSidebarExpanded && badge > 0 && <span className="text-[8px] font-black text-white bg-orange-600 px-2 py-0.5 rounded-full">{badge}</span>}
    </button>
  );

  return (
    <div className="flex h-screen bg-[#050505] text-white overflow-hidden relative font-sans">
      <div className="fixed inset-0 grid-engine pointer-events-none opacity-5"></div>
      
      {/* Sidebar Industrial */}
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

      <main className="flex-1 flex flex-col min-w-0 bg-[#050505]/50">
        <header className="h-16 border-b border-white/5 bg-black/20 backdrop-blur-xl flex items-center justify-between px-8 shrink-0 z-40">
          <div className="flex items-center gap-6">
            <button onClick={() => setIsSidebarExpanded(!isSidebarExpanded)} className="p-2.5 glass rounded-xl text-orange-500 hover:scale-110 transition-transform"><ChevronLeft size={14} className={!isSidebarExpanded ? 'rotate-180' : ''} /></button>
            <div className="flex flex-col">
              <h2 className="text-[10px] font-black uppercase tracking-[0.6em] text-white/40 italic leading-none">Neural Cluster Control</h2>
              <span className="text-[8px] font-bold text-orange-500/50 uppercase tracking-widest mt-1">Status: Operação em Alta Frequência</span>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <button onClick={fetchInstances} className="p-2 glass rounded-xl text-gray-500 hover:text-orange-500 transition-all"><RefreshCw size={14}/></button>
            <div className="flex items-center gap-4 border-l border-white/5 pl-6">
               <div className="text-right hidden sm:block">
                  <div className="text-[10px] font-black uppercase text-white italic tracking-widest">{user.name}</div>
                  <div className="text-[8px] font-bold text-gray-600 uppercase tracking-tighter">Admin Principal</div>
               </div>
               <div className="w-10 h-10 rounded-xl bg-rajado p-0.5 shadow-xl shadow-orange-500/10">
                  <div className="w-full h-full bg-black rounded-[9px] flex items-center justify-center text-[12px] font-black italic">{user.name?.[0]}</div>
               </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-8 md:p-12 custom-scrollbar">
           {activeTab === 'integracoes' && (
             <div className="max-w-6xl mx-auto space-y-12 animate-in fade-in duration-1000">
                <div className="flex flex-col md:flex-row justify-between items-end gap-6 border-b border-white/5 pb-10">
                  <div className="space-y-2">
                    <h1 className="text-5xl font-black uppercase italic tracking-tighter leading-none">Neural <span className="text-orange-500">Engines.</span></h1>
                    <p className="text-[10px] font-black uppercase tracking-[0.5em] text-gray-700 italic">Ativação de clusters de processamento WhatsApp</p>
                  </div>
                  <div className="flex gap-4 w-full md:w-auto">
                    <input 
                      value={newInstanceName} 
                      onChange={e => setNewInstanceName(e.target.value)} 
                      onKeyDown={e => e.key === 'Enter' && createInstance()}
                      placeholder="Identificador do Motor..." 
                      className="flex-1 md:w-64 bg-white/[0.02] border border-white/5 rounded-xl py-4 px-6 text-[11px] font-black uppercase outline-none focus:border-orange-500/40 transition-all placeholder:text-gray-800" 
                    />
                    <NeonButton onClick={createInstance} className="!px-8 !text-[11px] !py-4 shadow-orange-600/20">
                      {isCreatingInstance ? <Loader2 className="animate-spin" size={16}/> : 'Ativar Cluster'}
                    </NeonButton>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                   {instances.length === 0 ? (
                     <div className="col-span-full py-32 text-center space-y-4 opacity-20">
                        <Smartphone size={48} className="mx-auto text-gray-700" />
                        <div className="text-[12px] font-black uppercase tracking-[0.5em]">Nenhum motor ativo no cluster</div>
                     </div>
                   ) : instances.map(inst => (
                     <GlassCard key={inst.id} className="!p-8 group relative overflow-hidden bg-gradient-to-br from-white/[0.01] to-transparent border-white/5 hover:border-orange-500/20 transition-all">
                        <div className="flex flex-col gap-8 relative z-10">
                           <div className="flex items-center gap-6">
                              <div className="relative">
                                 <div className="w-14 h-14 rounded-2xl bg-black border border-white/10 flex items-center justify-center overflow-hidden shadow-2xl">
                                    {inst.profilePicUrl ? <img src={inst.profilePicUrl} className="w-full h-full object-cover" /> : <Smartphone size={24} className="text-gray-800" />}
                                 </div>
                                 <div className={`absolute -bottom-1.5 -right-1.5 w-4 h-4 rounded-full border-[3px] border-[#050505] ${inst.status === 'CONNECTED' ? 'bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.5)]' : 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]'}`} />
                              </div>
                              <div className="flex-1 overflow-hidden">
                                 <div className="text-xl font-black uppercase italic tracking-tighter text-white truncate leading-none mb-1.5">{inst.name}</div>
                                 <div className="text-[9px] font-black text-gray-700 uppercase tracking-[0.2em] italic">{inst.phone || 'Standby'}</div>
                              </div>
                           </div>
                           <div className="flex gap-3">
                              {inst.status === 'DISCONNECTED' ? (
                                <NeonButton onClick={() => connectInstance(inst.name)} className="flex-1 !py-3 !text-[10px] !rounded-xl !shadow-lg">Sincronizar</NeonButton>
                              ) : (
                                <div className="flex-1 py-3 border border-green-500/10 rounded-xl text-green-500 text-[10px] font-black uppercase text-center bg-green-500/5 flex items-center justify-center gap-2">
                                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" /> Operacional
                                </div>
                              )}
                              <button onClick={() => connectInstance(inst.name)} className="p-3 rounded-xl bg-white/[0.02] text-gray-600 hover:text-orange-500 border border-white/5 transition-all hover:scale-105" title="Reiniciar Handshake"><Power size={16}/></button>
                              <button onClick={() => deleteInstance(inst.name)} className="p-3 rounded-xl bg-red-600/5 text-red-500/40 hover:bg-red-600 hover:text-white border border-red-500/10 transition-all" title="Remover Motor"><Trash2 size={16}/></button>
                           </div>
                        </div>
                     </GlassCard>
                   ))}
                </div>
             </div>
           )}

           {activeTab !== 'integracoes' && (
             <div className="flex flex-col items-center justify-center opacity-10 h-full scale-90 select-none">
                <Logo size="md" className="grayscale mb-8" />
                <div className="flex flex-col items-center gap-4">
                  <h4 className="text-3xl font-black uppercase tracking-[0.8em] italic text-white leading-none">Cluster em Standby</h4>
                  <div className="h-px w-32 bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-gray-500 italic">Aguardando injeção de dados via Engine Central</span>
                </div>
             </div>
           )}
        </div>
      </main>

      {/* Modal QR Sync (Design Inoxidável) */}
      <AnimatePresence>
        {qrModal.isOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/98 backdrop-blur-3xl">
            <div key={qrModal.timestamp} className="bg-[#050505] border border-orange-500/30 p-12 rounded-[3rem] text-center max-w-sm w-full relative shadow-[0_0_120px_rgba(255,115,0,0.2)] animate-in zoom-in-95 duration-500 border-t-orange-500">
              <button 
                onClick={() => { 
                  setQrModal(p => ({ ...p, isOpen: false })); 
                  if(poolingRef.current) clearInterval(poolingRef.current); 
                }} 
                className="absolute top-10 right-10 text-gray-800 hover:text-white p-2.5 hover:bg-white/5 rounded-full transition-all border border-transparent hover:border-white/5"
              >
                <X size={28}/>
              </button>
              
              <div className="mb-10 space-y-2">
                <h3 className="text-3xl font-black uppercase italic tracking-tighter text-white leading-none">{qrModal.name}</h3>
                <div className="flex items-center justify-center gap-3">
                  <div className="w-2 h-2 bg-orange-500 rounded-full animate-ping" />
                  <p className="text-[11px] font-black uppercase text-orange-500 tracking-[0.5em] italic">{qrModal.status}</p>
                </div>
              </div>

              <div className="relative mb-10 flex justify-center">
                 <div className="bg-white p-8 rounded-[2.5rem] flex items-center justify-center min-h-[300px] min-w-[300px] border-[10px] border-white/5 overflow-hidden shadow-2xl relative">
                    {qrModal.code ? (
                      <motion.img 
                        initial={{ opacity: 0, scale: 0.9 }} 
                        animate={{ opacity: 1, scale: 1 }} 
                        src={qrModal.code.startsWith('data:') ? qrModal.code : `data:image/png;base64,${qrModal.code}`} 
                        className="w-full h-auto block rounded-xl" 
                        alt="Neural Handshake" 
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-8 p-10">
                        <div className="relative">
                          <Loader2 className="animate-spin text-orange-500" size={56} strokeWidth={3} />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Zap size={20} className="text-orange-500/50" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <span className="text-[10px] font-black text-gray-900 uppercase tracking-widest italic leading-tight block">Injetando Semente Neural...</span>
                          <span className="text-[8px] font-bold text-gray-400 uppercase tracking-tighter block opacity-50">Sincronizando Clusters Globais</span>
                        </div>
                      </div>
                    )}
                 </div>
                 
                 {qrModal.connected && (
                   <div className="absolute inset-0 bg-black/95 backdrop-blur-3xl rounded-[2.5rem] flex flex-col items-center justify-center z-20 border border-green-500/30">
                      <div className="relative mb-8">
                        <CheckCircle2 size={64} className="text-green-500" />
                        <div className="absolute inset-0 bg-green-500/20 blur-2xl rounded-full" />
                      </div>
                      <h4 className="text-3xl font-black uppercase italic text-white mb-2 tracking-tighter">Sincronizado</h4>
                      <p className="text-[9px] font-bold text-gray-500 uppercase tracking-[0.3em] mb-8">Acesso ao Motor Neural Liberado</p>
                      <NeonButton onClick={() => setQrModal(p => ({ ...p, isOpen: false }))} className="!px-12 !py-5 !text-[12px] shadow-green-500/20">Acessar Painel</NeonButton>
                   </div>
                 )}
              </div>
              
              <div className="pt-8 border-t border-white/5 opacity-40 flex items-center justify-center gap-8 text-white">
                 <div className="flex items-center gap-3">
                    <ShieldCheck size={18} className="text-orange-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest italic">Criptografia RSA 4096 Ativa</span>
                 </div>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
