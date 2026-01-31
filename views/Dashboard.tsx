
import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { 
  LayoutDashboard, MessageSquare, LogOut, Plus, 
  Loader2, RefreshCw, Trash2, X, Layers, Activity, 
  Search, Send, User, CheckCircle2, Terminal, 
  Database, Bot, Kanban as KanbanIcon, Clock, Zap,
  Users, MoreVertical, Paperclip, Smile, Filter,
  Check, ChevronRight, UserPlus, PhoneIncoming, Smartphone
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
    setLogs(prev => [`> ${new Date().toLocaleTimeString()} - ${msg}`, ...prev.slice(0, 5)]);
  };

  const mapContactData = (item: any) => {
    const jid = item.id || item.remoteJid || item.jid || item.key?.remoteJid || item.remoteJid || (item.instance?.ownerJid);
    if (!jid || typeof jid !== 'string' || jid.includes('@g.us')) return null;

    const phone = jid.split('@')[0];
    const name = item.name || item.pushName || item.verifiedName || item.id?.split('@')[0] || phone;
    
    const lastMsg = item.lastMessage?.message?.conversation || 
                    item.lastMessage?.message?.extendedTextMessage?.text || 
                    item.message?.conversation ||
                    item.conversation ||
                    "Conversa via WhatsApp";

    const timestamp = item.lastMessage?.messageTimestamp || item.messageTimestamp || Math.floor(Date.now() / 1000);

    return {
      id: jid,
      contactName: name,
      contactPhone: phone,
      lastMessage: lastMsg,
      time: new Date(timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      unreadCount: item.unreadCount || 0
    };
  };

  const syncAllRealTime = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    
    try {
      const targetInstances = instances.filter(i => i.status === 'CONNECTED');
      
      if (targetInstances.length === 0) {
        addLog("Sync Alert: Nenhuma engine em estado OPEN.");
        setIsSyncing(false);
        return;
      }

      const globalContactMap = new Map<string, any>();

      for (const inst of targetInstances) {
        try {
          const [resChats, resContacts] = await Promise.all([
            fetch(`${getBaseUrl()}/chat/fetchChats/${inst.name}`, { headers: getHeaders() }),
            fetch(`${getBaseUrl()}/chat/fetchContacts/${inst.name}`, { headers: getHeaders() })
          ]);

          const dataChats = await resChats.json() as any;
          const dataContacts = await resContacts.json() as any;

          const listChats = Array.isArray(dataChats) ? dataChats : (dataChats?.chats || dataChats?.data || []);
          const listContacts = Array.isArray(dataContacts) ? dataContacts : (dataContacts?.contacts || dataContacts?.data || []);

          listChats.forEach((c: any) => {
            const mapped = mapContactData(c);
            if (mapped) globalContactMap.set(mapped.id, { ...mapped, instanceSource: inst.name });
          });

          listContacts.forEach((c: any) => {
            const mapped = mapContactData(c);
            if (mapped && !globalContactMap.has(mapped.id)) {
              globalContactMap.set(mapped.id, { ...mapped, instanceSource: inst.name });
            }
          });
        } catch (e) {}
      }

      if (globalContactMap.size > 0) {
        const freshTickets: Ticket[] = Array.from(globalContactMap.values()).map((item: any) => ({
          ...item,
          sentiment: 'neutral',
          status: 'novo',
          protocol: item.contactPhone,
          messages: [],
          assignedTo: 'Master'
        }));

        setColumns(prev => {
          const inProgressIds = new Set(prev.em_atendimento.map(t => t.id));
          const finishedIds = new Set(prev.finalizado.map(t => t.id));
          const onlyNew = freshTickets.filter(t => !inProgressIds.has(t.id) && !finishedIds.has(t.id));
          return { ...prev, 'novo': onlyNew };
        });
      }

    } catch (err) {
    } finally {
      setIsSyncing(false);
    }
  };

  const fetchInstances = async () => {
    try {
      const res = await fetch(`${getBaseUrl()}/instance/fetchInstances`, { headers: getHeaders() });
      if (!res.ok) throw new Error();
      const data = await res.json() as any;
      
      const rawList = Array.isArray(data) ? data : (data?.data || data?.instances || []);
      
      const mapped = rawList.map((item: any) => {
        const instObj = (item.instance || item) as any;
        const rawStatus = (instObj.status || instObj.connectionStatus || instObj.state || (item as any).status || '').toLowerCase();
        
        const isConnected = rawStatus.includes('open') || 
                           rawStatus.includes('connected') || 
                           rawStatus.includes('connected_service') ||
                           (item.instance as any)?.status === 'open';

        let phoneNumber = instObj.ownerJid || instObj.number || (item as any).number || (item.instance as any)?.ownerJid || 'Offline';
        if (phoneNumber.includes('@')) phoneNumber = phoneNumber.split('@')[0];

        if (isConnected) {
          addLog(`IDENTIDADE: ${instObj.instanceName || instObj.name} ativa no número +${phoneNumber}`);
        }

        return {
          id: instObj.instanceId || instObj.instanceName || instObj.name || item.name,
          name: instObj.instanceName || instObj.name || item.name,
          status: isConnected ? 'CONNECTED' : 'DISCONNECTED' as any,
          phone: phoneNumber,
          leadCount: item.leadCount || 0
        };
      });

      setInstances(mapped);
      setApiStatus('online');
    } catch (err) {
      setApiStatus('offline');
    }
  };

  const handleDragEnd = (result: DropResult) => {
    const { source, destination } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const sourceCol = Array.from(columns[source.droppableId] || []) as Ticket[];
    const destCol = Array.from(columns[destination.droppableId] || []) as Ticket[];
    const [movedTicket] = sourceCol.splice(source.index, 1);
    
    if (movedTicket) {
      movedTicket.status = destination.droppableId as any;
      destCol.splice(destination.index, 0, movedTicket);

      setColumns({
        ...columns,
        [source.droppableId]: sourceCol,
        [destination.droppableId]: destCol
      });
      addLog(`Mover: ${movedTicket.contactName} -> ${destination.droppableId.toUpperCase()}`);
    }
  };

  const startQrPolling = (name: string) => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    isPollingRef.current = true;
    
    const poll = async () => {
      if (!isPollingRef.current) return;
      try {
        const res = await fetch(`${getBaseUrl()}/instance/connect/${name}`, { headers: getHeaders() });
        const data = await res.json() as any;
        const state = (data?.instance?.state || data?.state || data?.status || data?.instance?.status || '').toLowerCase();
        
        if (state.includes('open') || state.includes('connected')) {
          setQrCodeModal(p => ({ ...p, status: 'Engine Conectada!', code: 'CONNECTED', isBooting: false }));
          isPollingRef.current = false;
          fetchInstances();
          setTimeout(() => setQrCodeModal(p => ({ ...p, isOpen: false })), 2000);
          return;
        }

        const qr = data?.base64 || data?.qrcode?.base64 || data?.code;
        if (qr) {
          const qrData = qr.startsWith('data') ? qr : `data:image/png;base64,${qr}`;
          setQrCodeModal(p => ({ ...p, code: qrData, isBooting: false, status: 'Escaneie para Conectar.' }));
        }
        pollTimerRef.current = setTimeout(poll, 4000);
      } catch (err) {
        pollTimerRef.current = setTimeout(poll, 5000);
      }
    };
    poll();
  };

  const connectInstance = async (name: string) => {
    setQrCodeModal({ isOpen: true, code: '', name, status: 'Handshake Inicial...', isBooting: true });
    try {
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
      const res = await fetch(`${getBaseUrl()}/instance/create`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ instanceName: name, qrcode: true })
      });
      if (res.status === 201 || res.status === 409) {
        setNewInstanceName('');
        fetchInstances();
        setTimeout(() => connectInstance(name), 1000);
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

  useEffect(() => {
    fetchInstances();
    const inv = setInterval(() => {
      fetchInstances();
      syncAllRealTime();
    }, 12000); 
    return () => {
      clearInterval(inv);
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      isPollingRef.current = false;
    };
  }, []);

  const selectedTicket = useMemo(() => {
    for (const key in columns) {
      const ticket = (columns[key] as Ticket[]).find(t => t.id === selectedTicketId);
      if (ticket) return ticket;
    }
    return null;
  }, [selectedTicketId, columns]);

  // Busca o número da engine transmissora
  const senderPhone = useMemo(() => {
    if (!selectedTicket) return null;
    return instances.find(i => i.name === selectedTicket.instanceSource)?.phone;
  }, [selectedTicket, instances]);

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

      <aside className="w-[280px] border-r border-white/5 flex flex-col p-8 bg-black/60 backdrop-blur-3xl z-50">
        <Logo size="sm" className="mb-12" />
        <nav className="flex-1 space-y-3">
          {[
            { id: 'overview', icon: LayoutDashboard, label: 'Dashboard' },
            { id: 'atendimento', icon: MessageSquare, label: 'Atendimento' },
            { id: 'integracoes', icon: Layers, label: 'Engines Evolution' },
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
                <div className={`w-2 h-2 rounded-full ${apiStatus === 'online' ? 'bg-green-500 shadow-[0_0_10px_#22c55e]' : 'bg-red-500'}`} />
                <span className="text-[8px] font-black uppercase text-gray-400 tracking-widest italic">Cluster Link</span>
             </div>
             <div className="text-[10px] font-bold text-white uppercase">{apiStatus === 'online' ? 'Neural Online' : 'Neural Offline'}</div>
          </div>
          <button onClick={onLogout} className="w-full flex items-center gap-3 px-6 py-4 text-gray-600 hover:text-red-500 transition-colors uppercase text-[9px] font-black tracking-widest">
            <LogOut size={18} /> Encerrar Sessão
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
                      placeholder="Identificar lead..." 
                      className="w-full bg-white/[0.02] border border-white/5 rounded-2xl py-4 pl-14 pr-6 text-xs uppercase font-bold outline-none focus:border-orange-500/40 transition-all shadow-inner" 
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8 bg-black/30">
                  {Object.entries(filteredColumns).map(([colId, tickets]) => {
                    const typedTickets = tickets as Ticket[];
                    return (
                      <div key={colId} className="space-y-4">
                        <div className="flex items-center justify-between px-2">
                           <span className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-600 italic">
                             {colId.replace('_', ' ')} <span className="text-orange-500/40 ml-2">({typedTickets.length})</span>
                           </span>
                           <div className="w-1 h-1 rounded-full bg-orange-500/40" />
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
                                      className={`group p-6 rounded-[2.2rem] border transition-all cursor-pointer relative overflow-hidden ${
                                        selectedTicketId === ticket.id 
                                        ? 'bg-orange-600/15 border-orange-500/40 shadow-2xl' 
                                        : 'bg-white/[0.01] border-white/5 hover:border-white/10'
                                      } ${snapshot.isDragging ? 'rotate-2 scale-105 z-[100]' : ''}`}
                                    >
                                      <div className="flex items-center gap-4">
                                        <div className="relative">
                                          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500/20 to-orange-800/10 flex items-center justify-center text-xl font-black italic text-orange-500/80">
                                            {ticket.contactName[0].toUpperCase()}
                                          </div>
                                          <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-green-500 border-4 border-[#0c0c0c]" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex justify-between items-start mb-1">
                                            <h4 className="text-sm font-black uppercase tracking-tight truncate pr-2">{ticket.contactName}</h4>
                                            <span className="text-[8px] font-black text-gray-700 font-mono whitespace-nowrap">{ticket.time}</span>
                                          </div>
                                          <p className="text-[10px] text-gray-500 truncate leading-relaxed font-medium">{ticket.lastMessage}</p>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </Draggable>
                              )) : (
                                <div className="text-[9px] text-gray-800 uppercase font-black text-center py-10 tracking-[0.4em] border border-dashed border-white/5 rounded-[2rem] bg-white/[0.01]">
                                  {isSyncing ? "Identificando Chip..." : "Chip sem Leads ativos"}
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

            <div className="flex-1 flex flex-col bg-black/40">
              {selectedTicket ? (
                <>
                  <header className="p-8 border-b border-white/5 flex items-center justify-between backdrop-blur-3xl bg-black/20">
                     <div className="flex items-center gap-6">
                        <div className="w-16 h-16 rounded-[2rem] bg-orange-500/10 flex items-center justify-center text-2xl font-black italic text-orange-500">
                           {selectedTicket.contactName[0].toUpperCase()}
                        </div>
                        <div>
                           <div className="flex items-center gap-3 mb-1">
                              <h3 className="text-2xl font-black uppercase italic tracking-tighter leading-none">{selectedTicket.contactName}</h3>
                              <div className="px-3 py-1 bg-orange-500/10 border border-orange-500/20 rounded-full flex items-center gap-2">
                                 <Smartphone size={10} className="text-orange-500 animate-pulse" />
                                 <span className="text-[8px] font-black uppercase text-orange-500 tracking-widest italic">Operando: +{senderPhone || '---'}</span>
                              </div>
                           </div>
                           <div className="flex items-center gap-3 text-[10px] font-black uppercase text-gray-500 italic">
                              <span className="text-green-500">Engine: {selectedTicket.instanceSource}</span>
                              <span className="text-white/10">|</span>
                              <span>Lead: +{selectedTicket.contactPhone}</span>
                           </div>
                        </div>
                     </div>
                     <div className="flex gap-4">
                        <button className="p-4 glass rounded-[1.5rem] text-gray-600 hover:text-white transition-all"><Zap size={18}/></button>
                     </div>
                  </header>

                  <div className="flex-1 overflow-y-auto custom-scrollbar p-12 space-y-8 bg-black/40">
                     <div className="flex justify-center">
                        <span className="bg-orange-500/5 px-6 py-2 rounded-full text-[9px] font-black uppercase tracking-widest text-orange-500 italic border border-orange-500/10">Transmissão via Chip +{senderPhone}</span>
                     </div>
                     
                     <div className="flex flex-col gap-8">
                        <div className="flex items-end gap-4">
                           <div className="w-10 h-10 rounded-2xl bg-orange-500/10 flex items-center justify-center text-xs font-black italic uppercase text-orange-500/40">C</div>
                           <div className="max-w-[70%] bg-white/[0.02] border border-white/5 p-6 rounded-[2.5rem] rounded-bl-none shadow-2xl">
                              <p className="text-[13px] leading-relaxed text-gray-300">{selectedTicket.lastMessage}</p>
                              <div className="mt-4 flex items-center gap-2 text-[8px] font-black text-gray-600 italic uppercase">
                                 {selectedTicket.time} • <Check size={10} className="text-orange-500"/>
                              </div>
                           </div>
                        </div>
                     </div>
                  </div>

                  <div className="p-10 bg-black/60 border-t border-white/5 backdrop-blur-3xl">
                     <div className="flex gap-4 items-center max-w-5xl mx-auto">
                        <div className="flex-1 relative">
                           <input 
                             value={messageInput}
                             onChange={e => setMessageInput(e.target.value)}
                             placeholder={`Responder de +${senderPhone}...`} 
                             className="w-full bg-white/[0.03] border border-white/10 rounded-[2.5rem] py-6 px-10 text-sm outline-none focus:border-orange-500 transition-all shadow-inner" 
                           />
                        </div>
                        <button className="p-6 bg-orange-600 rounded-[2rem] text-white hover:bg-orange-500 transition-all shadow-xl shadow-orange-600/20 active:scale-95">
                           <Send size={24}/>
                        </button>
                     </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center opacity-30 text-center p-20">
                  <Logo size="md" className="mb-12 grayscale" />
                  <h3 className="text-4xl font-black uppercase italic tracking-tighter leading-none mb-6">Terminal <span className="text-orange-500">Privado.</span></h3>
                  <p className="max-w-xs mx-auto text-[10px] font-black uppercase tracking-[0.5em] leading-relaxed italic">
                    Nenhum contato detectado nos chips conectados no momento.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'integracoes' && (
          <div className="flex-1 p-12 lg:p-20 overflow-y-auto custom-scrollbar relative z-10">
             <header className="mb-20">
                <h2 className="text-6xl md:text-8xl font-black uppercase italic tracking-tighter leading-none">Minhas <span className="text-orange-500">Engines.</span></h2>
                <p className="text-[12px] font-black uppercase tracking-[0.5em] text-gray-500 mt-5 italic">Identidade WA Evolution v2</p>
             </header>

             <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                <GlassCard className="!p-12 border-white/10 bg-white/[0.02] shadow-2xl rounded-[3rem]">
                   <div className="flex items-center gap-6 mb-12">
                      <div className="p-6 bg-orange-500/10 rounded-[2rem] text-orange-500 shadow-xl shadow-orange-500/5"><Plus size={32} /></div>
                      <div>
                         <h3 className="text-4xl font-black uppercase italic tracking-tight mb-2">Novo Cluster</h3>
                      </div>
                   </div>
                   
                   <div className="flex gap-4 mb-16">
                      <input 
                        value={newInstanceName} 
                        onChange={e => setNewInstanceName(e.target.value)} 
                        onKeyDown={e => e.key === 'Enter' && handleProvisionInstance()}
                        placeholder="NOME DA ENGINE..." 
                        className="flex-1 bg-black/60 border border-white/10 rounded-[1.8rem] py-6 px-10 text-[16px] font-black uppercase outline-none focus:border-orange-500 transition-all font-mono" 
                      />
                      <NeonButton onClick={handleProvisionInstance} disabled={!newInstanceName.trim() || isCreatingInstance} className="!px-12 !rounded-[1.8rem]">
                        {isCreatingInstance ? <Loader2 className="animate-spin" size={24} /> : "Provisionar"}
                      </NeonButton>
                   </div>

                   <div className="space-y-4">
                      {instances.map(inst => (
                        <div key={inst.id} className="group flex items-center justify-between p-8 bg-white/[0.01] border border-white/5 rounded-[3rem] hover:border-orange-500/40 transition-all hover:bg-white/[0.03] relative overflow-hidden">
                           <div className="flex items-center gap-6 relative z-10">
                              <div className={`w-3 h-3 rounded-full ${inst.status === 'CONNECTED' ? 'bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.6)] animate-pulse' : 'bg-red-500'}`} />
                              <div>
                                 <div className="text-xl font-black uppercase italic leading-none mb-3">{inst.name}</div>
                                 <div className="flex items-center gap-4 text-[10px] font-black font-mono italic leading-none uppercase tracking-widest">
                                    <div className={`px-4 py-2 rounded-xl border ${inst.status === 'CONNECTED' ? 'border-orange-500/30 text-orange-500 bg-orange-500/5 shadow-[0_0_15px_rgba(255,115,0,0.1)]' : 'border-white/5 text-gray-700'}`}>
                                      <span className="mr-2">CHIP:</span> 
                                      {inst.status === 'CONNECTED' ? `+${inst.phone}` : 'DESCONECTADO'}
                                    </div>
                                 </div>
                              </div>
                           </div>
                           <div className="flex gap-4 opacity-0 group-hover:opacity-100 transition-all relative z-10">
                              <button onClick={() => connectInstance(inst.name)} className="p-3 glass rounded-2xl text-orange-500 hover:bg-orange-500 hover:text-white transition-all"><RefreshCw size={18} /></button>
                              <button onClick={() => deleteInstance(inst.name)} className="p-3 glass rounded-2xl text-red-500/40 hover:text-red-500 transition-all"><Trash2 size={18} /></button>
                           </div>
                        </div>
                      ))}
                   </div>
                </GlassCard>

                <div className="space-y-12">
                   <GlassCard className="!p-16 border-blue-500/10 bg-blue-500/[0.02] flex flex-col items-center justify-center text-center shadow-blue-500/5 shadow-2xl rounded-[3rem] min-h-[500px]">
                      <Terminal size={72} className="text-blue-500 mb-10" />
                      <h3 className="text-4xl font-black uppercase italic tracking-tighter mb-6 leading-none">Mapa de <br/>Clusters WA.</h3>
                      <p className="text-[11px] text-gray-500 font-bold uppercase tracking-[0.3em] leading-relaxed italic text-center">
                        Cada engine representa um chip físico. Verifique se o número que aparece no Badge de "CHIP" é o correto para sua operação.
                      </p>
                   </GlassCard>
                </div>
             </div>
          </div>
        )}

        {/* Console Logs Overlay */}
        <div className="absolute bottom-8 right-8 z-[100] w-96 opacity-40 hover:opacity-100 transition-opacity">
           <GlassCard className="!p-6 !rounded-[2rem] bg-black/80 backdrop-blur-3xl border-white/10 pointer-events-none">
              <div className="flex items-center gap-3 mb-4 text-orange-500">
                 <Terminal size={14} />
                 <span className="text-[8px] font-black uppercase tracking-[0.4em]">Neural Identity Console</span>
              </div>
              <div className="space-y-2 max-h-32 overflow-hidden font-mono text-[9px] text-gray-400">
                 {logs.map((log, i) => (
                    <div key={i} className="truncate">{log}</div>
                 ))}
              </div>
           </GlassCard>
        </div>

        {/* MODAL QR CODE */}
        <AnimatePresence>
          {qrCodeModal.isOpen && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              className="fixed inset-0 z-[1000] flex items-center justify-center p-8 bg-black/98 backdrop-blur-3xl"
            >
              <motion.div 
                initial={{ scale: 0.95, y: 30 }} 
                animate={{ scale: 1, y: 0 }} 
                className="bg-[#0a0a0a] border border-white/10 p-16 md:p-24 rounded-[5rem] max-w-2xl w-full relative text-center shadow-[0_0_150px_rgba(255,115,0,0.15)]"
              >
                <button onClick={() => { setQrCodeModal(p => ({ ...p, isOpen: false })); isPollingRef.current = false; }} className="absolute top-16 right-16 text-gray-700 hover:text-white transition-all transform hover:rotate-90 p-3">
                  <X size={40} />
                </button>
                <Logo size="sm" className="mb-16 mx-auto" />
                
                <div className="bg-white p-12 rounded-[4rem] aspect-square flex items-center justify-center border-[12px] border-orange-500/10 overflow-hidden relative mx-auto mb-16 shadow-2xl max-w-[400px]">
                   {qrCodeModal.code === 'CONNECTED' ? (
                     <div className="flex flex-col items-center">
                        <CheckCircle2 size={160} className="text-green-500 mb-8 drop-shadow-[0_0_30px_rgba(34,197,94,0.4)]" />
                        <span className="text-[18px] font-black uppercase text-green-500 tracking-[0.4em] italic">Engine Sincronizada</span>
                     </div>
                   ) : qrCodeModal.code ? (
                     <img src={qrCodeModal.code} className="w-full h-full object-contain animate-in fade-in zoom-in duration-700" alt="QR Code" key={qrCodeModal.code} />
                   ) : (
                     <div className="flex flex-col items-center gap-10 text-black">
                        <Loader2 className="animate-spin text-orange-500" size={80} />
                        <span className="text-[12px] font-black uppercase text-gray-400 tracking-[0.4em] italic leading-relaxed">{qrCodeModal.status}</span>
                     </div>
                   )}
                </div>
                
                <h3 className="text-5xl font-black uppercase italic tracking-tighter mb-6 leading-none">Link <span className="text-orange-500">Neural.</span></h3>
                <p className="text-[15px] font-black uppercase tracking-[0.3em] text-gray-500 italic animate-pulse">{qrCodeModal.status}</p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
