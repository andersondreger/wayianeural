
import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageSquare, LogOut, Plus, Loader2, RefreshCw, 
  Trash2, X, Layers, Search, Send, CheckCircle2, 
  Smartphone, ShieldCheck, ChevronLeft, ChevronRight,
  Bot, Zap, Activity, AlertCircle, Paperclip, MoreVertical,
  Settings, LayoutDashboard, Globe, User, Terminal, AlertTriangle
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

const EVOLUTION_URL = 'https://evo2.wayiaflow.com.br';
const EVOLUTION_API_KEY = 'd86920ba398e31464c46401214779885';
const HEADERS = { 
  'apikey': EVOLUTION_API_KEY, 
  'Content-Type': 'application/json' 
};

export function Dashboard({ user, onLogout }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<DashboardTab>('integracoes');
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [instances, setInstances] = useState<EvolutionInstance[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newInstanceName, setNewInstanceName] = useState('');
  
  const [leads, setLeads] = useState<Ticket[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [isSending, setIsSending] = useState(false);

  const [qrModal, setQrModal] = useState({ 
    isOpen: false, code: '', name: '', status: 'Iniciando...', connected: false 
  });

  // --- BUSCA DE INSTÂNCIAS ---
  const fetchInstances = async (): Promise<EvolutionInstance[]> => {
    try {
      const res = await fetch(`${EVOLUTION_URL}/instance/fetchInstances?t=${Date.now()}`, { headers: HEADERS });
      const data = await res.json();
      const raw = Array.isArray(data) ? data : (data.instances || data.data || []);
      
      const mapped = raw.map((item: any) => {
        const inst = item.instance || item;
        const rawStatus = (inst.status || inst.connectionStatus || inst.state || inst.connection?.state || '').toLowerCase();
        const isOnline = ['open', 'connected', 'connected_chat', 'online'].includes(rawStatus);

        return {
          id: inst.instanceId || inst.name || inst.instanceName,
          name: inst.instanceName || inst.name,
          status: isOnline ? 'CONNECTED' : 'DISCONNECTED',
          phone: inst.ownerJid?.split('@')[0] || inst.number || '---'
        } as EvolutionInstance;
      });
      setInstances(mapped);
      return mapped;
    } catch (e) {
      console.error("WAYFLOW ERROR:", e);
      return [];
    }
  };

  // --- SINCRONIZAÇÃO DE CHATS ---
  const syncChats = async () => {
    setIsSyncing(true);
    setSyncError(null);
    const allLeadsMap = new Map<string, Ticket>();

    try {
      const currentInstances = await fetchInstances();
      const connectedOnes = currentInstances.filter(i => i.status === 'CONNECTED');

      if (connectedOnes.length === 0) {
          setSyncError("Nenhum chip online no cluster para ler chats.");
          setIsSyncing(false);
          return;
      }

      for (const inst of connectedOnes) {
        const scanPlans = [
          { ep: `/chat/findChats/${inst.name}`, method: 'POST', body: {} },
          { ep: `/chat/fetchChats/${inst.name}`, method: 'GET' },
          { ep: `/contact/fetchContacts/${inst.name}`, method: 'GET' }
        ];

        for (const plan of scanPlans) {
          try {
            const url = `${EVOLUTION_URL}${plan.ep}?t=${Date.now()}`;
            const res = await fetch(url, {
              method: plan.method,
              headers: HEADERS,
              body: plan.method === 'POST' ? JSON.stringify(plan.body) : undefined
            });

            if (!res.ok) continue;

            const data = await res.json();
            const items = Array.isArray(data) ? data : (data.data || data.chats || data.records || data.all || []);

            if (items.length > 0) {
              items.forEach((item: any) => {
                const jid = item.id || item.jid || item.remoteJid || item.key?.remoteJid;
                if (!jid || typeof jid !== 'string') return;
                
                const isGroup = jid.includes('@g.us');
                const name = item.pushName || item.name || item.verifiedName || (isGroup ? "Grupo" : jid.split('@')[0]);
                const lastMsg = item.message?.conversation || item.message?.extendedTextMessage?.text || item.lastMessage?.message?.conversation || "Conversa ativa";

                if (!allLeadsMap.has(jid)) {
                  allLeadsMap.set(jid, {
                    id: jid,
                    contactName: isGroup ? `👥 ${name}` : name,
                    contactPhone: jid.split('@')[0],
                    avatar: item.profilePicUrl || "", 
                    lastMessage: lastMsg,
                    time: item.messageTimestamp ? new Date(item.messageTimestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Agora",
                    status: 'novo',
                    unreadCount: item.unreadCount || 0,
                    assignedTo: 'Neural Agent',
                    protocol: jid.split('@')[0],
                    sentiment: 'neutral',
                    messages: [],
                    instanceSource: inst.name
                  });
                }
              });
              break;
            }
          } catch (err) {}
        }
      }
      
      const finalLeads = Array.from(allLeadsMap.values());
      setLeads(finalLeads);
      if (finalLeads.length === 0) setSyncError("Sincronizado, mas a lista retornou vazia.");
    } catch (e) {
      setSyncError("Falha de conexão com o cluster.");
    } finally {
      setIsSyncing(false);
    }
  };

  // --- HISTÓRICO ---
  const loadHistory = async (lead: Ticket) => {
    try {
      const res = await fetch(`${EVOLUTION_URL}/chat/fetchMessages/${(lead as any).instanceSource}?t=${Date.now()}`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({ remoteJid: lead.id, count: 50 })
      });
      const data = await res.json();
      const rawMsgs = Array.isArray(data) ? data : (data.messages || data.data || []);
      
      const mapped: Message[] = rawMsgs.map((m: any) => ({
        id: m.key.id,
        text: m.message?.conversation || m.message?.extendedTextMessage?.text || "📎 Arquivo/Mídia",
        sender: (m.key.fromMe ? 'me' : 'contact') as 'me' | 'contact',
        time: new Date((m.messageTimestamp || Date.now()/1000) * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'read' as 'read',
        type: 'text' as 'text'
      })).reverse();
      
      setChatMessages(mapped);
    } catch (e) {}
  };

  // --- ENVIAR MENSAGEM (CORREÇÃO V2) ---
  const handleSend = async () => {
    const lead = leads.find(l => l.id === selectedLeadId);
    if (!lead || !messageInput) return;
    setIsSending(true);
    
    try {
      // Endpoint V2 Correto: /message/sendText/{instance}
      // Payload V2 Correto: { number: "JID", text: "mensagem" }
      const res = await fetch(`${EVOLUTION_URL}/message/sendText/${lead.instanceSource}`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({ 
          number: lead.id, // Usar o JID completo (ID) é o padrão mais estável
          text: messageInput 
        })
      });

      const resData = await res.json();

      if (res.ok) {
        setChatMessages(prev => [...prev, {
          id: resData.key?.id || Date.now().toString(),
          text: messageInput,
          sender: 'me' as 'me',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: 'sent' as 'sent',
          type: 'text' as 'text'
        }]);
        setMessageInput('');
        
        // Atualiza o preview na lista lateral
        setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, lastMessage: messageInput, time: 'Agora' } : l));
      } else {
        console.error("Erro no envio Evolution:", resData);
        alert(`Erro ao enviar: ${resData.message || 'Verifique a conexão do chip.'}`);
      }
    } catch (e) {
      console.error("Erro de rede no envio:", e);
      alert("Falha crítica de conexão ao tentar enviar.");
    } finally {
      setIsSending(false);
    }
  };

  useEffect(() => {
    fetchInstances();
    const inv = setInterval(fetchInstances, 20000);
    return () => clearInterval(inv);
  }, []);

  useEffect(() => {
    if (activeTab === 'atendimento') syncChats();
  }, [activeTab]);

  const currentLead = useMemo(() => leads.find(l => l.id === selectedLeadId), [selectedLeadId, leads]);
  useEffect(() => { if (currentLead) loadHistory(currentLead); }, [currentLead]);

  return (
    <div className="flex h-screen bg-[#050505] text-white font-sans overflow-hidden">
      <div className="fixed inset-0 grid-engine pointer-events-none opacity-[0.03]"></div>

      <motion.aside 
        animate={{ width: isSidebarExpanded ? 260 : 80 }}
        className="relative h-full border-r border-white/5 bg-black/40 backdrop-blur-3xl flex flex-col p-6 z-50 transition-all duration-300"
      >
        <div className="mb-12 flex items-center justify-between">
          {isSidebarExpanded && <Logo size="sm" />}
          <button onClick={() => setIsSidebarExpanded(!isSidebarExpanded)} className="p-2 glass rounded-xl text-orange-500">
            {isSidebarExpanded ? <ChevronLeft size={18}/> : <ChevronRight size={18}/>}
          </button>
        </div>

        <nav className="flex-1 space-y-3">
          {[
            { id: 'integracoes', icon: Layers, label: 'Chips' },
            { id: 'atendimento', icon: MessageSquare, label: 'Atendimento' },
            { id: 'settings', icon: Settings, label: 'Ajustes' }
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as DashboardTab)}
              className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all border ${activeTab === tab.id ? 'bg-orange-600/10 text-orange-500 border-orange-500/20 shadow-lg' : 'text-gray-600 border-transparent hover:bg-white/[0.02]'}`}
            >
              <tab.icon size={20} />
              {isSidebarExpanded && <span className="text-[10px] font-black uppercase tracking-widest">{tab.label}</span>}
            </button>
          ))}
        </nav>

        <button onClick={onLogout} className="mt-auto flex items-center gap-4 p-4 text-gray-700 hover:text-red-500">
          <LogOut size={20} />
          {isSidebarExpanded && <span className="text-[10px] font-black uppercase tracking-widest">Sair</span>}
        </button>
      </motion.aside>

      <main className="flex-1 flex flex-col relative overflow-hidden bg-[#070707]">
        
        {activeTab === 'integracoes' && (
          <div className="flex-1 p-10 overflow-y-auto custom-scrollbar">
            <header className="mb-12 text-left">
              <h2 className="text-5xl font-black uppercase italic tracking-tighter mb-2">Engines <span className="text-orange-500">Ativas.</span></h2>
              <p className="text-[10px] font-black text-gray-700 uppercase tracking-widest italic">Controle de Chips Evolution v2</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <GlassCard className="!p-8 !rounded-[2.5rem] border-white/5">
                <h3 className="text-sm font-black uppercase italic mb-6 flex items-center gap-2 text-orange-500"><Plus size={16} /> Nova Engine</h3>
                <div className="flex gap-3 mb-8">
                  <input 
                    value={newInstanceName} onChange={e => setNewInstanceName(e.target.value)}
                    placeholder="NOME DO CHIP..." 
                    className="flex-1 bg-black border border-white/10 rounded-xl py-4 px-6 text-[10px] font-black uppercase outline-none focus:border-orange-500 transition-all placeholder:text-gray-800"
                  />
                  <NeonButton onClick={async () => {
                    const sanitizedName = newInstanceName.trim().toLowerCase();
                    if (!sanitizedName) return;
                    setIsCreating(true);
                    try {
                      await fetch(`${EVOLUTION_URL}/instance/create`, {
                        method: 'POST', headers: HEADERS, body: JSON.stringify({ instanceName: sanitizedName, qrcode: true })
                      });
                      setNewInstanceName('');
                      await fetchInstances();
                      setQrModal({ isOpen: true, code: '', name: sanitizedName, status: 'Gerando...', connected: false });
                      const qrRes = await fetch(`${EVOLUTION_URL}/instance/connect/${sanitizedName}?t=${Date.now()}`, { headers: HEADERS });
                      const qrData = await qrRes.json();
                      if (qrData.base64) setQrModal(p => ({ ...p, code: qrData.base64, status: 'Pronto para Escanear' }));
                    } catch (e) {} finally { setIsCreating(false); }
                  }} disabled={!newInstanceName || isCreating} className="!px-6 !py-4 min-w-[100px]">
                    {isCreating ? <Loader2 className="animate-spin mx-auto" /> : "Criar"}
                  </NeonButton>
                </div>

                <div className="space-y-3">
                  {instances.map(inst => (
                    <div key={inst.id} className="p-5 bg-white/[0.01] border border-white/5 rounded-2xl flex items-center justify-between group hover:border-orange-500/20">
                      <div className="flex items-center gap-4">
                        <div className={`w-2 h-2 rounded-full ${inst.status === 'CONNECTED' ? 'bg-green-500 shadow-[0_0_10px_green] animate-pulse' : 'bg-red-500'}`} />
                        <div>
                          <div className="text-xs font-black uppercase italic">{inst.name}</div>
                          <div className="text-[8px] font-black uppercase text-gray-600 tracking-widest">{inst.phone}</div>
                        </div>
                      </div>
                      <div className="flex gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                        <button onClick={async () => {
                           setQrModal({ isOpen: true, code: '', name: inst.name, status: 'Reiniciando...', connected: false });
                           const qrRes = await fetch(`${EVOLUTION_URL}/instance/connect/${inst.name}?t=${Date.now()}`, { headers: HEADERS });
                           const qrData = await qrRes.json();
                           if (qrData.base64) setQrModal(p => ({ ...p, code: qrData.base64, status: 'Escanear agora' }));
                        }} className="p-3 glass rounded-lg text-orange-500 hover:bg-orange-600 hover:text-white transition-all"><RefreshCw size={14}/></button>
                        <button onClick={async () => {
                           if (confirm(`Remover ${inst.name}?`)) {
                             await fetch(`${EVOLUTION_URL}/instance/delete/${inst.name}`, { method: 'DELETE', headers: HEADERS });
                             await fetchInstances();
                           }
                        }} className="p-3 glass rounded-lg text-red-500 hover:bg-red-600 hover:text-white transition-all"><Trash2 size={14}/></button>
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>

              <div className="space-y-6">
                <GlassCard className="!p-8 !rounded-[2.5rem] border-orange-500/10 flex flex-col justify-center text-center">
                   <div className="text-6xl font-black text-orange-500 mb-2">{instances.filter(i => i.status === 'CONNECTED').length}</div>
                   <div className="text-[10px] font-black uppercase tracking-widest text-gray-600 italic">Chips Online no Cluster</div>
                </GlassCard>
                <GlassCard className="!p-8 !rounded-[2.5rem] border-white/5 flex items-center gap-6">
                   <Activity className="text-orange-500" size={32} />
                   <div>
                     <div className="text-xs font-black uppercase italic">Status do Cluster</div>
                     <div className="text-[8px] font-black uppercase text-gray-700 tracking-[0.3em]">Operando em Alta Frequência</div>
                   </div>
                </GlassCard>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'atendimento' && (
          <div className="flex-1 flex overflow-hidden">
            <div className="w-[350px] border-r border-white/5 flex flex-col bg-black/20 backdrop-blur-3xl">
              <header className="p-6 border-b border-white/5 flex items-center justify-between">
                <div className="flex-1 overflow-hidden mr-4">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-orange-500 italic">CRM Neural</h3>
                  {syncError && <span className="text-[7px] text-red-500 font-bold uppercase block mt-1 truncate">{syncError}</span>}
                </div>
                <button 
                  onClick={syncChats} disabled={isSyncing}
                  className={`p-2 glass rounded-lg transition-all ${isSyncing ? 'animate-spin text-orange-500' : 'text-gray-600 hover:text-orange-500'}`}
                >
                  <RefreshCw size={12}/>
                </button>
              </header>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
                {leads.length > 0 ? leads.map(lead => (
                  <button 
                    key={lead.id} onClick={() => setSelectedLeadId(lead.id)}
                    className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all text-left border ${selectedLeadId === lead.id ? 'bg-orange-600/10 border-orange-500/20 shadow-xl' : 'border-transparent hover:bg-white/[0.01]'}`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-orange-600/10 flex items-center justify-center text-orange-500 font-black italic border border-orange-500/10 shrink-0 uppercase">
                      {lead.contactName[0]}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <div className="flex justify-between items-center mb-0.5">
                        <span className="text-[10px] font-black uppercase truncate italic">{lead.contactName}</span>
                        <span className="text-[7px] text-gray-700">{lead.time}</span>
                      </div>
                      <p className="text-[9px] text-gray-600 truncate italic">{lead.lastMessage}</p>
                    </div>
                  </button>
                )) : (
                  <div className="flex flex-col items-center justify-center h-full opacity-60 text-center px-8 py-20">
                    {isSyncing ? <Loader2 size={32} className="text-orange-500 mb-4 animate-spin" /> : <Activity size={32} className="text-orange-500 mb-4 animate-pulse" />}
                    <p className="text-[9px] font-black uppercase tracking-widest leading-relaxed italic text-gray-500">
                      {isSyncing ? "Escaneando chips..." : "Nenhum chat indexado."}
                    </p>
                    <button onClick={syncChats} className="mt-4 px-4 py-2 glass rounded-lg text-[8px] font-black text-orange-500 uppercase tracking-widest hover:bg-orange-600 hover:text-white transition-all">Forçar Sincronização</button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 flex flex-col bg-black/40">
              {selectedLeadId && currentLead ? (
                <div className="flex-1 flex flex-col">
                  <header className="p-6 border-b border-white/5 flex items-center justify-between bg-black/20 backdrop-blur-xl">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-orange-600/10 flex items-center justify-center text-orange-500 font-black italic border border-orange-500/10 uppercase">
                        {currentLead.contactName[0]}
                      </div>
                      <div>
                        <h4 className="text-lg font-black uppercase italic leading-none mb-1">{currentLead.contactName}</h4>
                        <span className="text-[8px] font-black uppercase text-gray-700 tracking-widest italic">{currentLead.contactPhone} • Engine: {currentLead.instanceSource}</span>
                      </div>
                    </div>
                  </header>

                  <div className="flex-1 overflow-y-auto p-8 space-y-4 custom-scrollbar scroll-smooth">
                    {chatMessages.map((m, idx) => (
                      <div key={idx} className={`flex ${m.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] p-4 rounded-2xl shadow-xl ${m.sender === 'me' ? 'bg-orange-600 text-white rounded-br-none' : 'bg-white/[0.04] text-gray-200 border border-white/5 rounded-bl-none'}`}>
                          <p className="text-xs font-medium leading-relaxed tracking-tight">{m.text}</p>
                          <div className={`text-[6px] font-black uppercase mt-2 opacity-40 tracking-widest ${m.sender === 'me' ? 'text-white' : 'text-gray-500'}`}>{m.time}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-6 border-t border-white/5 flex gap-3 bg-black/40 backdrop-blur-2xl">
                    <button className="p-4 glass rounded-xl text-gray-600 hover:text-orange-500 transition-all"><Paperclip size={18}/></button>
                    <input 
                      value={messageInput} onChange={e => setMessageInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleSend()}
                      placeholder="RESPOSTA RÁPIDA..." className="flex-1 bg-white/[0.02] border border-white/5 rounded-xl py-4 px-6 text-[10px] font-bold uppercase outline-none focus:border-orange-500 transition-all placeholder:text-gray-900"
                    />
                    <button onClick={handleSend} disabled={isSending || !messageInput} className="p-4 bg-orange-600 rounded-xl hover:bg-orange-500 shadow-lg transition-all min-w-[60px] flex items-center justify-center">
                      {isSending ? <Loader2 className="animate-spin" size={18} /> : <Send size={18}/>}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center opacity-10 italic uppercase font-black tracking-[0.5em] text-[10px]">
                   <MessageSquare size={48} className="mb-4" />
                   Aguardando Seleção de Lead
                </div>
              )}
            </div>
          </div>
        )}

        <AnimatePresence>
          {qrModal.isOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-2xl">
              <div className="bg-[#0a0a0a] border border-white/10 p-12 rounded-[3rem] text-center max-w-sm w-full relative shadow-2xl">
                <button onClick={() => setQrModal(p => ({ ...p, isOpen: false }))} className="absolute top-8 right-8 text-gray-700 hover:text-white p-2 hover:bg-white/5 rounded-full transition-all"><X size={24}/></button>
                <div className="bg-white p-6 rounded-3xl mb-8 flex items-center justify-center min-h-[250px] shadow-inner overflow-hidden">
                   {qrModal.code ? <img src={qrModal.code} className="w-full h-auto scale-110" alt="QR" /> : <Loader2 className="animate-spin text-orange-500" size={48} />}
                </div>
                <h3 className="text-2xl font-black uppercase italic mb-2 tracking-tighter">{qrModal.name}</h3>
                <p className="text-[10px] font-black uppercase text-orange-500 animate-pulse tracking-widest italic">{qrModal.status}</p>
              </div>
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
