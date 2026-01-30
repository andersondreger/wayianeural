
import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { 
  LayoutDashboard, MessageSquare, LogOut, Plus, 
  Loader2, RefreshCw, Trash2, X, Layers, Activity, 
  Search, Send, User, CheckCircle2, Terminal, 
  Database, Bot, Kanban as KanbanIcon, Clock, Zap,
  Users, MoreVertical, Paperclip, Smile, Filter,
  Check, ChevronRight, UserPlus
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

const EMPTY_COLUMNS: Record<string, Ticket[]> = {
  'novo': [],
  'em_atendimento': [],
  'finalizado': []
};

export function Dashboard({ user, onLogout, onCheckout }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<DashboardTab>('integracoes');
  const [instances, setInstances] = useState<(EvolutionInstance & { leadCount?: number })[]>([]);
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [newInstanceName, setNewInstanceName] = useState('');
  const [isCreatingInstance, setIsCreatingInstance] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [logs, setLogs] = useState<string[]>(['> WayFlow Neural System v3.1 Booted', '> Cluster: Sincronizado com Evolution API']);
  
  const [columns, setColumns] = useState<Record<string, Ticket[]>>(EMPTY_COLUMNS);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

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

  // BUSCA DADOS DE UMA INSTÂNCIA ESPECÍFICA
  const fetchInstanceData = async (instanceName: string) => {
    try {
      const [chatRes, contactRes] = await Promise.all([
        fetch(`${getBaseUrl()}/chat/fetchChats/${instanceName}`, { headers: getHeaders() }),
        fetch(`${getBaseUrl()}/chat/fetchContacts/${instanceName}`, { headers: getHeaders() })
      ]);

      const chats = await chatRes.json();
      const contacts = await contactRes.json();

      const allChats = Array.isArray(chats) ? chats : (chats?.chats || []);
      const allContacts = Array.isArray(contacts) ? contacts : (contacts?.contacts || []);

      return { allChats, allContacts };
    } catch (err) {
      console.error(`Erro ao buscar dados da instância ${instanceName}:`, err);
      return { allChats: [], allContacts: [] };
    }
  };

  // SINCRONIZA TODAS AS INSTÂNCIAS CONECTADAS
  const syncAllRealTime = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    addLog("Neural Scan: Iniciando varredura em todas as engines...");

    try {
      const connectedInstances = instances.filter(i => i.status === 'CONNECTED');
      
      if (connectedInstances.length === 0) {
        setIsSyncing(false);
        return;
      }

      const globalContactMap = new Map();

      for (const inst of connectedInstances) {
        const { allChats, allContacts } = await fetchInstanceData(inst.name);

        // Processa Chats (Prioridade: Conversas Ativas)
        allChats.forEach((c: any) => {
          const jid = c.id || c.remoteJid;
          if (!jid || jid.includes('@g.us')) return; // Ignora grupos para foco em atendimento individual

          globalContactMap.set(jid, {
            id: jid,
            contactName: c.name || c.pushName || jid.split('@')[0],
            contactPhone: jid.split('@')[0],
            lastMessage: c.lastMessage?.message?.conversation || 
                         c.lastMessage?.message?.extendedTextMessage?.text || 
                         "Mídia ou Arquivo",
            time: c.lastMessage?.messageTimestamp 
                  ? new Date(c.lastMessage.messageTimestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : '--:--',
            unreadCount: c.unreadCount || 0,
            instanceSource: inst.name
          });
        });

        // Processa Agenda (Preenche quem não tem chat ativo ainda)
        allContacts.forEach((c: any) => {
          const jid = c.id || c.remoteJid;
          if (!jid || globalContactMap.has(jid) || jid.includes('@g.us')) return;

          globalContactMap.set(jid, {
            id: jid,
            contactName: c.name || c.pushName || jid.split('@')[0],
            contactPhone: jid.split('@')[0],
            lastMessage: "Sem interações recentes",
            time: "Agenda",
            unreadCount: 0,
            instanceSource: inst.name
          });
        });
      }

      const freshTickets: Ticket[] = Array.from(globalContactMap.values()).map(item => ({
        ...item,
        sentiment: 'neutral',
        status: 'novo',
        protocol: item.contactPhone,
        messages: [],
        assignedTo: 'Master'
      }));

      // Atualiza o Kanban sem perder os tickets que já foram movidos para outras colunas
      setColumns(prev => {
        const movedIds = new Set([
          ...prev.em_atendimento.map(t => t.id),
          ...prev.finalizado.map(t => t.id)
        ]);

        // Apenas tickets que NÃO estão em outras colunas vão para 'novo'
        const onlyNew = freshTickets.filter(t => !movedIds.has(t.id));

        return {
          ...prev,
          'novo': onlyNew
        };
      });

      addLog(`Sincronização: ${freshTickets.length} contatos reais ativos.`);
    } catch (err) {
      addLog("Erro: Falha na sincronização dos clusters.");
    } finally {
      setIsSyncing(false);
    }
  };

  const fetchInstances = async () => {
    try {
      const res = await fetch(`${getBaseUrl()}/instance/fetchInstances`, { headers: getHeaders() });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data?.instances || []);
      
      const mapped = list.map((inst: any) => {
        const rawStatus = (inst.status || inst.connectionStatus || inst.state || inst.instance?.status || '').toLowerCase();
        const isConnected = rawStatus.includes('open') || 
                           rawStatus.includes('connected') || 
                           rawStatus.includes('connected_service') ||
                           inst.status === 'open' || inst.instance?.status === 'open';

        return {
          id: inst.instanceId || inst.instanceName || inst.name,
          name: inst.instanceName || inst.name,
          status: isConnected ? 'CONNECTED' : 'DISCONNECTED' as any,
          phone: inst.ownerJid?.split('@')[0] || inst.number || 'OFFLINE',
          leadCount: inst.leadCount || 0
        };
      });

      setInstances(mapped);
      setApiStatus('online');
    } catch (err) {
      setApiStatus('offline');
      addLog("Falha ao conectar com Evolution API.");
    }
  };

  const handleDragEnd = (result: DropResult) => {
    const { source, destination } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const sourceCol = Array.from(columns[source.droppableId]) as Ticket[];
    const destCol = Array.from(columns[destination.droppableId]) as Ticket[];
    const [movedTicket] = sourceCol.splice(source.index, 1) as Ticket[];
    
    if (movedTicket) {
      movedTicket.status = destination.droppableId as any;
      destCol.splice(destination.index, 0, movedTicket);

      setColumns({
        ...columns,
        [source.droppableId]: sourceCol,
        [destination.droppableId]: destCol
      });
      addLog(`${movedTicket.contactName} -> ${destination.droppableId.toUpperCase()}`);
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
        const state = (data?.instance?.state || data?.state || data?.status || data?.instance?.status || '').toLowerCase();
        
        if (state.includes('open') || state.includes('connected')) {
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
          setQrCodeModal(p => ({ ...p, code: qrData, isBooting: false, status: 'Escaneie o QR Code.' }));
        }
        pollTimerRef.current = setTimeout(poll, 4000);
      } catch (err) {
        pollTimerRef.current = setTimeout(poll, 5000);
      }
    };
    poll();
  };

  const connectInstance = async (name: string) => {
    setQrCodeModal({ isOpen: true, code: '', name, status: 'Solicitando QR Code...', isBooting: true });
    try {
      addLog(`Handshake: Tentando conectar engine ${name}...`);
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
    try {
      addLog(`Cluster: Provisionando ${name}`);
      const res = await fetch(`${getBaseUrl()}/instance/create`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ instanceName: name, qrcode: true })
      });
      if (res.status === 201 || res.status === 409) {
        setNewInstanceName('');
        fetchInstances();
        setTimeout(() => connectInstance(name), 1500);
      } else {
        connectInstance(name);
      }
    } catch (err) {
      connectInstance(name);
    } finally {
      setIsCreatingInstance(false);
    }
  };

  const deleteInstance = async (name: string) => {
    if (!confirm(`Remover engine ${name}?`)) return;
    try {
      await fetch(`${getBaseUrl()}/instance/delete/${name}`, { method: 'DELETE', headers: getHeaders() });
      fetchInstances();
    } catch (err) {}
  };

  // Efeito principal de Pooling
  useEffect(() => {
    fetchInstances();
    const inv = setInterval(() => {
      fetchInstances();
      syncAllRealTime();
    }, 15000); // Poll mais rápido: 15 segundos
    return () => {
      clearInterval(inv);
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      isPollingRef.current = false;
    };
  }, []);

  // Monitora mudanças nas instâncias para disparar sync imediato quando uma conectar
  useEffect(() => {
    if (instances.some(i => i.status === 'CONNECTED')) {
      syncAllRealTime();
    }
  }, [instances]);

  const selectedTicket = useMemo(() => {
    for (const key in columns) {
      const ticket = (columns[key] as Ticket[]).find(t => t.id === selectedTicketId);
      if (ticket) return ticket;
    }
    return null;
  }, [selectedTicketId, columns]);

  const filteredColumns = useMemo(() => {
    if (!searchTerm) return columns;
    const term = searchTerm.toLowerCase();
    const newCols: Record<string, Ticket[]> = {};
    Object.keys(columns).forEach(key => {
      newCols[key] = columns[key].filter(t => 
        t.contactName.toLowerCase().includes(term) || 
        t.contactPhone.includes(term)
      );
    });
    return newCols;
  }, [columns, searchTerm]);

  return (
    <div className="flex h-screen bg-[#050505] overflow-hidden text-white font-sans selection:bg-orange-500/30">
      <div className="fixed inset-0 grid-engine pointer-events-none opacity-[0.03]"></div>

      {/* Sidebar Neural */}
      <aside className="w-[280px] border-r border-white/5 flex flex-col p-8 bg-black/60 backdrop-blur-3xl z-50">
        <Logo size="sm" className="mb-12" />
        <nav className="flex-1 space-y-3">
          {[
            { id: 'overview', icon: LayoutDashboard, label: 'Overview' },
            { id: 'atendimento', icon: MessageSquare, label: 'Atendimento Real' },
            { id: 'integracoes', icon: Layers, label: 'Minhas Engines' },
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
          <div className="px-6 py-4 glass rounded-2xl mb-4 border-white/5">
             <div className="flex items-center gap-2 mb-2">
                <div className={`w-2 h-2 rounded-full ${apiStatus === 'online' ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-[8px] font-black uppercase text-gray-400">Status Evolution</span>
             </div>
             <div className="text-[10px] font-bold text-white uppercase">{apiStatus === 'online' ? 'Cluster Ativo' : 'Cluster Offline'}</div>
          </div>
          <button onClick={onLogout} className="w-full flex items-center gap-3 px-6 py-4 text-gray-600 hover:text-red-500 transition-colors uppercase text-[9px] font-black tracking-widest">
            <LogOut size={18} /> Sair
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative overflow-hidden bg-[#070707]">
        
        {activeTab === 'atendimento' && (
          <div className="flex-1 flex overflow-hidden">
            <DragDropContext onDragEnd={handleDragEnd}>
              <div className="w-[450px] flex-shrink-0 border-r border-white/5 bg-black/20 flex flex-col">
                <div className="p-8 border-b border-white/5">
                  <div className="flex items-center justify-between mb-8">
                    <h2 className="text-3xl font-black italic uppercase tracking-tighter leading-none">Terminal <span className="text-orange-500">Live.</span></h2>
                    <div className="flex gap-2">
                       <button 
                         onClick={syncAllRealTime} 
                         disabled={isSyncing}
                         title="Forçar Sincronização"
                         className={`p-3 glass rounded-xl text-gray-600 hover:text-white transition-all ${isSyncing ? 'animate-spin text-orange-500' : ''}`}
                       >
                         <RefreshCw size={16}/>
                       </button>
                    </div>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-700" size={16} />
                    <input 
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      placeholder="Filtrar contatos reais..." 
                      className="w-full bg-white/[0.02] border border-white/5 rounded-2xl py-4 pl-14 pr-6 text-xs uppercase font-bold outline-none focus:border-orange-500/40 transition-all" 
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
                  {Object.entries(filteredColumns).map(([colId, tickets]) => {
                    const typedTickets = tickets as Ticket[];
                    return (
                      <div key={colId} className="space-y-4">
                        <div className="flex items-center justify-between px-2">
                           <span className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-500 italic">
                             {colId.replace('_', ' ')} <span className="text-orange-500/40 ml-2">{typedTickets.length}</span>
                           </span>
                           <div className="w-1.5 h-1.5 rounded-full bg-orange-500/20" />
                        </div>
                        
                        <Droppable droppableId={colId}>
                          {(provided) => (
                            <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-3 min-h-[50px]">
                              {typedTickets.length > 0 ? typedTickets.map((ticket, index) => (
                                <Draggable key={ticket.id} draggableId={ticket.id} index={index}>
                                  {(provided, snapshot) => (
                                    <div
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      {...provided.dragHandleProps}
                                      onClick={() => setSelectedTicketId(ticket.id)}
                                      className={`group p-6 rounded-[2rem] border transition-all cursor-pointer relative overflow-hidden ${
                                        selectedTicketId === ticket.id 
                                        ? 'bg-orange-600/10 border-orange-500/30 shadow-xl' 
                                        : 'bg-white/[0.01] border-white/5 hover:border-white/10'
                                      } ${snapshot.isDragging ? 'shadow-2xl ring-2 ring-orange-500/50 scale-105 rotate-2' : ''}`}
                                    >
                                      <div className="flex items-center gap-4">
                                        <div className="relative">
                                          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500/20 to-blue-500/10 flex items-center justify-center text-xl font-black italic">
                                            {ticket.contactName[0]}
                                          </div>
                                          <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-green-500 border-4 border-[#070707]" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex justify-between items-start mb-1">
                                            <h4 className="text-sm font-black uppercase tracking-tight truncate">{ticket.contactName}</h4>
                                            <span className="text-[8px] font-black text-gray-600 font-mono">{ticket.time}</span>
                                          </div>
                                          <p className="text-[10px] text-gray-500 truncate leading-relaxed">{ticket.lastMessage}</p>
                                        </div>
                                        {ticket.unreadCount > 0 && (
                                          <div className="w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center text-[8px] font-black italic text-white shadow-lg">
                                            {ticket.unreadCount}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </Draggable>
                              )) : (
                                <div className="text-[9px] text-gray-800 uppercase font-black text-center py-6 tracking-widest border border-dashed border-white/5 rounded-3xl opacity-20">
                                  {isSyncing ? "Neural Sync..." : "Sem Contatos"}
                                </div>
                              )}
                              {provided.placeholder}
                            </div>
                          )}
                        </Droppable>
                      </div>
                    );
                  })}
                </div>
              </div>
            </DragDropContext>

            {/* AREA DE CONVERSA REAL */}
            <div className="flex-1 flex flex-col bg-black/40">
              {selectedTicket ? (
                <>
                  <header className="p-8 border-b border-white/5 flex items-center justify-between backdrop-blur-xl bg-black/20">
                     <div className="flex items-center gap-6">
                        <div className="w-16 h-16 rounded-[2rem] bg-orange-500/10 flex items-center justify-center text-2xl font-black italic text-orange-500">
                           {selectedTicket.contactName[0]}
                        </div>
                        <div>
                           <h3 className="text-2xl font-black uppercase italic tracking-tighter leading-none mb-2">{selectedTicket.contactName}</h3>
                           <div className="flex items-center gap-3 text-[10px] font-black uppercase text-gray-500 italic">
                              <span className="text-green-500">Conectado via {selectedTicket.instanceSource || 'Engine'}</span>
                              <span>|</span>
                              <span>+{selectedTicket.contactPhone}</span>
                           </div>
                        </div>
                     </div>
                     <div className="flex gap-4">
                        <button className="p-4 glass rounded-[1.5rem] text-gray-600 hover:text-white transition-all"><Zap size={18}/></button>
                        <button className="p-4 glass rounded-[1.5rem] text-red-500/30 hover:text-red-500 transition-all"><Trash2 size={18}/></button>
                     </div>
                  </header>

                  <div className="flex-1 overflow-y-auto custom-scrollbar p-12 space-y-8">
                     <div className="flex justify-center">
                        <span className="bg-white/5 px-6 py-2 rounded-full text-[9px] font-black uppercase tracking-widest text-gray-600 italic">Conversa Sincronizada em Tempo Real</span>
                     </div>
                     
                     <div className="flex flex-col gap-6">
                        <div className="flex items-end gap-4">
                           <div className="w-8 h-8 rounded-xl bg-orange-500/10 flex items-center justify-center text-xs font-black italic uppercase">C</div>
                           <div className="max-w-[70%] bg-white/[0.03] border border-white/5 p-6 rounded-[2rem] rounded-bl-none shadow-xl">
                              <p className="text-xs leading-relaxed">{selectedTicket.lastMessage}</p>
                              <div className="mt-3 flex items-center gap-2 text-[8px] font-black text-gray-600 italic">
                                 {selectedTicket.time} • <Check size={10} className="text-orange-500"/>
                              </div>
                           </div>
                        </div>
                     </div>
                  </div>

                  <div className="p-10 bg-black/40 border-t border-white/5 backdrop-blur-2xl">
                     <div className="flex gap-4 items-center">
                        <button className="p-4 text-gray-600 hover:text-white transition-all"><Paperclip size={20}/></button>
                        <div className="flex-1 relative">
                           <input 
                             value={messageInput}
                             onChange={e => setMessageInput(e.target.value)}
                             placeholder="Escreva sua resposta real..." 
                             className="w-full bg-white/[0.02] border border-white/10 rounded-[2rem] py-6 px-10 text-sm outline-none focus:border-orange-500 transition-all shadow-inner" 
                           />
                           <button className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-700 hover:text-orange-500 transition-all">
                              <Smile size={20}/>
                           </button>
                        </div>
                        <button className="p-6 bg-orange-600 rounded-[2rem] text-white hover:bg-orange-500 transition-all shadow-xl shadow-orange-600/20 active:scale-95">
                           <Send size={24}/>
                        </button>
                     </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center opacity-20 text-center p-20">
                  <Logo size="md" className="mb-12 grayscale" />
                  <h3 className="text-4xl font-black uppercase italic tracking-tighter leading-none mb-6">Canal <span className="text-orange-500">Privado.</span></h3>
                  <p className="max-w-xs mx-auto text-[10px] font-black uppercase tracking-[0.4em] leading-relaxed">
                    Selecione um contato real da sua agenda Evolution para iniciar o atendimento neural.
                  </p>
                  <div className="mt-12 flex gap-4">
                     <div className="flex flex-col items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-[7px] uppercase font-black tracking-widest text-green-500">Socket Live</span>
                     </div>
                     <div className="flex flex-col items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                        <span className="text-[7px] uppercase font-black tracking-widest text-blue-500">Sync Ativo</span>
                     </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'integracoes' && (
          <div className="flex-1 p-12 lg:p-20 overflow-y-auto custom-scrollbar relative z-10">
             <header className="mb-20">
                <h2 className="text-6xl md:text-8xl font-black uppercase italic tracking-tighter leading-none">Cluster <span className="text-orange-500">Engines.</span></h2>
                <p className="text-[12px] font-black uppercase tracking-[0.5em] text-gray-500 mt-5 italic">Infraestrutura Evolution v2 Unificada</p>
             </header>

             <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                <GlassCard className="!p-12 border-white/10 bg-white/[0.02] shadow-2xl">
                   <div className="flex items-center gap-6 mb-12">
                      <div className="p-6 bg-orange-500/10 rounded-[2rem] text-orange-500 shadow-xl shadow-orange-500/5"><Plus size={32} /></div>
                      <div>
                         <h3 className="text-4xl font-black uppercase italic tracking-tight mb-2">Novo Cluster</h3>
                         <p className="text-[12px] text-gray-600 font-bold uppercase tracking-widest">Provisionamento de Instância WA</p>
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
                      <NeonButton onClick={handleProvisionInstance} disabled={!newInstanceName.trim() || isCreatingInstance} className="!px-10 !rounded-[1.5rem]">
                        {isCreatingInstance ? <Loader2 className="animate-spin" size={24} /> : "Provisionar"}
                      </NeonButton>
                   </div>

                   <div className="space-y-4">
                      {instances.map(inst => (
                        <div key={inst.id} className="group flex items-center justify-between p-8 bg-white/[0.01] border border-white/5 rounded-[2.5rem] hover:border-orange-500/40 transition-all hover:bg-white/[0.03]">
                           <div className="flex items-center gap-6">
                              <div className={`w-3 h-3 rounded-full ${inst.status === 'CONNECTED' ? 'bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.6)] animate-pulse' : 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]'}`} />
                              <div>
                                 <div className="text-xl font-black uppercase italic leading-none mb-2">{inst.name}</div>
                                 <div className="flex items-center gap-3 text-[10px] font-bold font-mono italic leading-none">
                                    <span className={`${inst.status === 'CONNECTED' ? 'text-orange-500' : 'text-gray-700'} uppercase tracking-tighter`}>
                                      {inst.status === 'CONNECTED' ? `+${inst.phone}` : 'Desconectado'}
                                    </span>
                                    <span className="text-white/10">|</span>
                                    <div className="flex items-center gap-1 text-blue-500 uppercase tracking-widest">
                                       <Activity size={10} />
                                       Live Data Sync
                                    </div>
                                 </div>
                              </div>
                           </div>
                           <div className="flex gap-4 opacity-0 group-hover:opacity-100 transition-all">
                              <button onClick={() => connectInstance(inst.name)} className="p-3 glass rounded-xl text-orange-500 hover:bg-orange-500 hover:text-white transition-all"><RefreshCw size={16} /></button>
                              <button onClick={() => deleteInstance(inst.name)} className="p-3 glass rounded-xl text-red-500/30 hover:text-red-500 transition-all"><Trash2 size={16} /></button>
                           </div>
                        </div>
                      ))}
                      {instances.length === 0 && (
                        <div className="text-center py-20 opacity-20">
                          <Database size={48} className="mx-auto mb-4" />
                          <p className="text-[10px] font-black uppercase tracking-widest italic">Nenhum cluster provisionado</p>
                        </div>
                      )}
                   </div>
                </GlassCard>

                <div className="space-y-12">
                   <GlassCard className="!p-12 border-blue-500/10 bg-blue-500/[0.02] flex flex-col items-center justify-center text-center shadow-blue-500/5 shadow-2xl min-h-[400px]">
                      <Terminal size={64} className="text-blue-500 mb-8" />
                      <h3 className="text-4xl font-black uppercase italic tracking-tighter mb-4">Evolution Core</h3>
                      <p className="text-[11px] text-gray-500 font-bold uppercase tracking-widest leading-relaxed mb-8">
                        Conecte múltiplas engines WhatsApp. Os contatos serão mesclados automaticamente no Terminal Atendimento.
                      </p>
                      <div className="text-green-500 text-[10px] font-black uppercase italic animate-pulse tracking-[0.4em] bg-green-500/5 px-8 py-4 rounded-full border border-green-500/10">API CONNECTION: {apiStatus.toUpperCase()}</div>
                   </GlassCard>
                </div>
             </div>
          </div>
        )}

        {/* MODAL QR CODE */}
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
                <button onClick={() => { setQrCodeModal(p => ({ ...p, isOpen: false })); isPollingRef.current = false; }} className="absolute top-12 right-12 text-gray-700 hover:text-white transition-all transform hover:rotate-90 p-2">
                  <X size={32} />
                </button>
                <Logo size="sm" className="mb-12 mx-auto" />
                <div className="bg-white p-10 rounded-[3rem] aspect-square flex items-center justify-center border-8 border-orange-500/10 overflow-hidden relative mx-auto mb-12 min-h-[320px]">
                   {qrCodeModal.code === 'CONNECTED' ? (
                     <div className="flex flex-col items-center">
                        <CheckCircle2 size={140} className="text-green-500 mb-6 drop-shadow-[0_0_20px_rgba(34,197,94,0.4)]" />
                        <span className="text-[14px] font-black uppercase text-green-500 tracking-[0.3em] italic">Engine Sincronizada</span>
                     </div>
                   ) : qrCodeModal.code ? (
                     <img src={qrCodeModal.code} className="w-full h-full object-contain animate-in fade-in zoom-in duration-500" alt="QR Code" key={qrCodeModal.code} />
                   ) : (
                     <div className="flex flex-col items-center gap-8 text-black">
                        <Loader2 className="animate-spin text-orange-500" size={70} />
                        <span className="text-[11px] font-black uppercase text-gray-400 tracking-widest italic">{qrCodeModal.status}</span>
                     </div>
                   )}
                </div>
                <h3 className="text-4xl font-black uppercase italic tracking-tighter mb-4">Conexão <span className="text-orange-500">Neural.</span></h3>
                <p className="text-[14px] font-black uppercase tracking-[0.2em] text-gray-400 italic animate-pulse">{qrCodeModal.status}</p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
