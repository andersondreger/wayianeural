
import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, MessageSquare, CreditCard, 
  LogOut, Smartphone, Activity, Crown, Plus, QrCode, 
  Loader2, RefreshCw, Trash2, Send, Search, 
  MessageCircle, History, Terminal as TerminalIcon, 
  Database, SignalHigh, Globe, Cpu, CheckCircle2, Paperclip
} from 'lucide-react';
import { UserSession, DashboardTab, EvolutionInstance, Ticket, Message } from '../types';
import { GlassCard } from '../components/GlassCard';
import { NeonButton, GlassButton } from '../components/Buttons';
import { Logo } from '../components/Logo';

const ADMIN_MASTER = 'dregerr.anderson@gmail.com';

export function Dashboard({ user, onLogout }: { user: UserSession; onLogout: () => void; onCheckout: () => void }) {
  const [activeTab, setActiveTab] = useState<DashboardTab>('evolution');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [instances, setInstances] = useState<EvolutionInstance[]>([]);
  const [selectedInstanceName, setSelectedInstanceName] = useState<string>('');
  const [messageInput, setMessageInput] = useState('');
  const [isLoadingChats, setIsLoadingChats] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isCreatingInstance, setIsCreatingInstance] = useState(false);
  const [qrCodeModal, setQrCodeModal] = useState<{ isOpen: boolean; code: string; name: string }>({ isOpen: false, code: '', name: '' });
  const [instanceLeadsCount, setInstanceLeadsCount] = useState<Record<string, number>>({});
  const [searchTerm, setSearchTerm] = useState('');
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Configuração Evolution API v2
  const evolutionUrl = 'https://evo2.wayiaflow.com.br'; 
  const evolutionApiKey = 'd86920ba398e31464c46401214779885';

  const getHeaders = () => ({ 'apikey': evolutionApiKey, 'Content-Type': 'application/json' });
  const getBaseUrl = () => evolutionUrl.endsWith('/') ? evolutionUrl.slice(0, -1) : evolutionUrl;

  const userPrefix = useMemo(() => {
    return user.email.split('@')[0].toUpperCase().replace(/[^A-Z0-9]/g, '');
  }, [user.email]);

  const isAdminMaster = user.email.toLowerCase() === ADMIN_MASTER.toLowerCase();

  // --- EVOLUTION ENGINE ---
  const fetchInstances = async () => {
    try {
      const res = await fetch(`${getBaseUrl()}/instance/fetchInstances`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.instances || []);
        const mapped = list.map((inst: any) => ({
          id: inst.instanceId || inst.name || inst.instanceName,
          name: inst.instanceName || inst.name,
          status: (inst.status === 'open' || inst.connectionStatus === 'open' || inst.state === 'open' || inst.connectionStatus === 'CONNECTED' || inst.status === 'CONNECTED') ? 'CONNECTED' : 'DISCONNECTED',
          phone: inst.ownerJid?.split('@')[0] || inst.number || 'Pendente',
          instanceKey: inst.token || inst.instanceKey
        })).filter((inst: any) => isAdminMaster || inst.name.startsWith(`${userPrefix}_`));
        
        setInstances(mapped);
        
        // Atualiza contagem de leads para cada instância conectada
        mapped.forEach((inst: any) => {
           if (inst.status === 'CONNECTED') updateLeadCount(inst.name);
        });

        // Auto-seleciona no CRM se houver conectada
        if (activeTab === 'atendimento' && !selectedInstanceName) {
           const connected = mapped.find(i => i.status === 'CONNECTED');
           if (connected) setSelectedInstanceName(connected.name);
        }
      }
    } catch (err) {}
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
    setIsCreatingInstance(true);
    const name = `${userPrefix}_CH_${instances.length + 1}`;
    try {
      const res = await fetch(`${getBaseUrl()}/instance/create`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ instanceName: name, token: Math.random().toString(36).substring(7), qrcode: true })
      });
      if (res.ok) {
        await fetchInstances();
        setTimeout(() => connectInstance(name), 1500);
      }
    } catch (err) {} finally { setIsCreatingInstance(false); }
  };

  const connectInstance = async (name: string) => {
    setQrCodeModal({ isOpen: true, code: '', name }); // Abre o modal em estado de loading
    try {
      const res = await fetch(`${getBaseUrl()}/instance/connect/${name}`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        const rawCode = data.base64 || data.code;
        if (rawCode) {
          const code = rawCode.startsWith('data:image') ? rawCode : `data:image/png;base64,${rawCode}`;
          setQrCodeModal({ isOpen: true, code, name });
        } else {
          setQrCodeModal({ isOpen: false, code: '', name: '' });
          fetchInstances();
        }
      }
    } catch (err) {
      setQrCodeModal({ isOpen: false, code: '', name: '' });
    }
  };

  const deleteInstance = async (name: string) => {
    if (!confirm(`Desvincular canal ${name}?`)) return;
    try {
      const res = await fetch(`${getBaseUrl()}/instance/delete/${name}`, { method: 'DELETE', headers: getHeaders() });
      if (res.ok) fetchInstances();
    } catch (e) {}
  };

  // --- CRM ATENDIMENTO ---
  const fetchChatsFromInstance = async (instanceName: string) => {
    if (!instanceName) return;
    setIsLoadingChats(true);
    try {
      const res = await fetch(`${getBaseUrl()}/chat/fetchChats/${instanceName}`, { headers: getHeaders() });
      if (res.ok) {
        const json = await res.json();
        const chatsRaw = Array.isArray(json) ? json : (json.chats || []);
        const mapped = chatsRaw.filter((i: any) => i.id?.includes('@s.whatsapp.net')).map((item: any) => ({
          id: item.id,
          contactName: item.pushName || item.name || item.id.split('@')[0],
          contactPhone: item.id.split('@')[0],
          lastMessage: item.lastMessage?.message?.conversation || 'Sem mensagens',
          sentiment: 'neutral' as const,
          time: 'Agora',
          status: 'aberto' as const,
          unreadCount: item.unreadCount || 0,
          assignedTo: instanceName,
          protocol: String(Math.floor(Math.random() * 90000) + 10000),
          avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(item.pushName || 'U')}&background=ff7300&color=fff&bold=true`,
          messages: []
        }));
        setTickets(mapped);
      }
    } catch (e) {} finally { setIsLoadingChats(false); }
  };

  const fetchMessagesForTicket = async (ticket: Ticket) => {
    if (!selectedInstanceName || !ticket.id) return;
    setIsLoadingMessages(true);
    try {
      const res = await fetch(`${getBaseUrl()}/chat/fetchMessages/${selectedInstanceName}`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ remoteJid: ticket.id, count: 50 })
      });
      if (res.ok) {
        const json = await res.json();
        const messagesRaw = Array.isArray(json) ? json : (json.messages || []);
        const mapped: Message[] = messagesRaw.reverse().map((m: any) => ({
          id: m.key?.id || Math.random().toString(),
          text: m.message?.conversation || m.message?.extendedTextMessage?.text || "Mídia",
          sender: m.key?.fromMe ? 'me' : 'contact',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: 'read',
          type: 'text'
        }));
        setSelectedTicket({ ...ticket, messages: mapped });
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      }
    } catch (e) {} finally { setIsLoadingMessages(false); }
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedTicket || !selectedInstanceName) return;
    const msg = messageInput;
    setMessageInput('');
    try {
      const res = await fetch(`${getBaseUrl()}/message/sendText/${selectedInstanceName}`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ number: selectedTicket.id, text: msg })
      });
      if (res.ok) {
        const newMsg: Message = { id: Date.now().toString(), text: msg, sender: 'me', time: 'Agora', status: 'sent', type: 'text' };
        setSelectedTicket(prev => prev ? { ...prev, messages: [...prev.messages, newMsg] } : null);
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      }
    } catch (e) {}
  };

  // Polling Connection Status
  useEffect(() => {
    let poll: any;
    if (qrCodeModal.isOpen) {
      poll = setInterval(async () => {
        try {
          const res = await fetch(`${getBaseUrl()}/instance/connectionState/${qrCodeModal.name}`, { headers: getHeaders() });
          if (res.ok) {
            const data = await res.json();
            const state = data.instance?.state || data.state || data.status;
            if (state === 'open' || state === 'CONNECTED') {
              setQrCodeModal(p => ({ ...p, isOpen: false }));
              clearInterval(poll);
              fetchInstances();
            }
          }
        } catch (e) {}
      }, 3000);
    }
    return () => clearInterval(poll);
  }, [qrCodeModal.isOpen, qrCodeModal.name]);

  useEffect(() => {
    fetchInstances();
    const timer = setInterval(fetchInstances, 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (selectedInstanceName && activeTab === 'atendimento') fetchChatsFromInstance(selectedInstanceName);
  }, [selectedInstanceName, activeTab]);

  return (
    <div className="flex h-screen bg-[#050505] overflow-hidden text-white font-sans">
      <div className="fixed inset-0 grid-engine pointer-events-none opacity-5"></div>

      {/* SIDEBAR */}
      <aside className="w-[260px] border-r border-white/5 flex flex-col p-6 bg-black/40 backdrop-blur-2xl z-50">
        <Logo size="sm" className="mb-8 px-2" />
        <nav className="flex-1 space-y-1">
          <button onClick={() => setActiveTab('evolution')} className={`w-full flex items-center gap-3 px-5 py-3 rounded-xl transition-all ${activeTab === 'evolution' ? 'bg-orange-600/10 text-orange-500 border border-orange-500/10' : 'text-gray-500 hover:text-white'}`}>
             <Smartphone size={16} /> <span className="text-[9px] font-black uppercase tracking-widest">Canais Evolution</span>
          </button>
          <button onClick={() => setActiveTab('atendimento')} className={`w-full flex items-center gap-3 px-5 py-3 rounded-xl transition-all ${activeTab === 'atendimento' ? 'bg-orange-600/10 text-orange-500 border border-orange-500/10' : 'text-gray-500 hover:text-white'}`}>
             <MessageSquare size={16} /> <span className="text-[9px] font-black uppercase tracking-widest">Atendimento CRM</span>
          </button>
          <div className="h-px bg-white/5 my-6 mx-2" />
          <button onClick={() => setActiveTab('n8n' as any)} className="w-full flex items-center gap-3 px-5 py-3 rounded-xl text-gray-500 hover:text-white">
             <TerminalIcon size={16} /> <span className="text-[9px] font-black uppercase tracking-widest">Logs de Sinais</span>
          </button>
        </nav>
        <button onClick={onLogout} className="mt-6 flex items-center gap-3 px-5 py-4 text-gray-700 hover:text-red-500 transition-colors uppercase text-[9px] font-black tracking-widest border-t border-white/5">
            <LogOut size={16} /> Logout Engine
        </button>
      </aside>

      {/* MAIN */}
      <main className="flex-1 flex flex-col relative overflow-hidden bg-[#070707]">
        
        {/* QR CODE MODAL REAL */}
        <AnimatePresence>
          {qrCodeModal.isOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/95 backdrop-blur-xl">
              <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="bg-[#0a0a0a] border border-white/10 p-10 rounded-[3rem] max-w-sm w-full text-center space-y-8 shadow-2xl">
                <QrCode className="text-orange-500 mx-auto" size={40} />
                <h3 className="text-2xl font-black uppercase italic tracking-tighter">Pareamento Neural</h3>
                <div className="bg-white p-6 rounded-[2rem] mx-auto inline-block border-8 border-orange-500/10">
                   {qrCodeModal.code ? (
                      <img src={qrCodeModal.code} className="w-56 h-56 object-contain" alt="QR Code" />
                   ) : (
                      <div className="w-56 h-56 flex items-center justify-center text-black font-black uppercase text-[10px] animate-pulse">Sincronizando...</div>
                   )}
                </div>
                <div className="flex items-center justify-center gap-3 text-orange-500 animate-pulse text-[10px] font-black uppercase tracking-widest">
                   <Loader2 size={16} className="animate-spin" /> Aguardando Leitura
                </div>
                <NeonButton onClick={() => setQrCodeModal({ ...qrCodeModal, isOpen: false })} className="w-full !rounded-2xl !py-4">Cancelar</NeonButton>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {activeTab === 'atendimento' ? (
          <div className="flex h-full w-full overflow-hidden">
            {/* LEADS */}
            <div className="w-[360px] border-r border-white/5 flex flex-col bg-black/30 backdrop-blur-xl">
              <div className="p-5 space-y-4 border-b border-white/5">
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest italic text-orange-500">Leads no Cluster</div>
                <select value={selectedInstanceName} onChange={e => setSelectedInstanceName(e.target.value)} className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-3 px-4 text-[10px] font-black uppercase outline-none focus:border-orange-500">
                  <option value="">Escolher Canal...</option>
                  {instances.map(i => <option key={i.id} value={i.name} disabled={i.status !== 'CONNECTED'}>{i.status === 'CONNECTED' ? '🟢' : '🔴'} {i.name.replace(`${userPrefix}_`, '')}</option>)}
                </select>
                <div className="relative">
                   <Search size={14} className="absolute left-4 top-3.5 text-gray-600" />
                   <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Buscar contato..." className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-3 px-10 text-[10px] font-black uppercase outline-none" />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
                {isLoadingChats ? <div className="text-center py-20 opacity-30 animate-pulse font-black uppercase text-[10px]">Pulsando Sinal Neural...</div> :
                 tickets.filter(t => t.contactName.toLowerCase().includes(searchTerm.toLowerCase())).map(t => (
                  <div key={t.id} onClick={() => { setSelectedTicket(t); fetchMessagesForTicket(t); }} className={`p-4 rounded-2xl cursor-pointer transition-all border ${selectedTicket?.id === t.id ? 'bg-orange-600/10 border-orange-500/20 shadow-xl' : 'bg-transparent border-transparent hover:bg-white/[0.02]'}`}>
                    <div className="flex gap-4">
                      <img src={t.avatar} className="w-12 h-12 rounded-2xl border border-white/10" />
                      <div className="flex-1 min-w-0">
                        <h4 className="text-[11px] font-black uppercase truncate italic text-white">{t.contactName}</h4>
                        <p className="text-[9px] text-gray-500 truncate mt-1">"{t.lastMessage}"</p>
                      </div>
                      {t.unreadCount > 0 && <div className="w-5 h-5 bg-orange-600 rounded-lg flex items-center justify-center text-[8px] font-black">{t.unreadCount}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* CHAT CENTRAL */}
            <div className="flex-1 flex flex-col relative bg-[#090909]">
              {selectedTicket ? (
                <>
                  <header className="h-20 border-b border-white/5 flex items-center justify-between px-8 bg-black/40 backdrop-blur-md">
                    <div className="flex items-center gap-4">
                       <img src={selectedTicket.avatar} className="w-12 h-12 rounded-2xl border border-white/10" />
                       <div className="text-[14px] font-black uppercase italic tracking-tighter">{selectedTicket.contactName}</div>
                    </div>
                    <GlassButton onClick={() => fetchMessagesForTicket(selectedTicket)} className="!px-6 !py-2.5 !text-[9px]"><RefreshCw size={16}/></GlassButton>
                  </header>
                  <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar" style={{ backgroundImage: `url('https://qonrpzlkjhdmswjfxvtu.supabase.co/storage/v1/object/public/WayIAFlow/whatsapp-bg.png')`, backgroundSize: '400px' }}>
                    {selectedTicket.messages.map((m, i) => (
                      <div key={i} className={`flex ${m.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] p-4 rounded-2xl ${m.sender === 'me' ? 'bg-orange-600/90' : 'bg-white/5 border border-white/5 backdrop-blur-xl'}`}>
                          <p className="text-[12px] font-medium leading-relaxed">{m.text}</p>
                          <div className="text-[8px] mt-2 opacity-50 flex items-center gap-1">{m.time} {m.sender === 'me' && <CheckCircle2 size={10} className="text-blue-400" />}</div>
                        </div>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>
                  <div className="p-5 bg-black/60 border-t border-white/5">
                    <div className="flex gap-4 bg-white/[0.03] border border-white/10 rounded-2xl p-2 px-5">
                       <input value={messageInput} onChange={e => setMessageInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleSendMessage()} placeholder="Escreva aqui..." className="flex-1 bg-transparent border-none outline-none text-[12px] font-bold py-3 text-white" />
                       <button onClick={handleSendMessage} className="bg-orange-600 p-3 rounded-xl hover:scale-110 transition-all"><Send size={20} /></button>
                    </div>
                  </div>
                </>
              ) : <div className="flex-1 flex flex-col items-center justify-center opacity-10"><MessageCircle size={100} className="text-orange-500 mb-6" /><h2 className="text-3xl font-black uppercase italic tracking-tighter">Escolha um lead para atender</h2></div>}
            </div>
          </div>
        ) : activeTab === 'evolution' ? (
          <div className="flex-1 p-10 lg:p-16 overflow-y-auto custom-scrollbar">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-16 gap-8">
               <div className="space-y-3">
                  <SignalHigh size={24} className="text-orange-500" />
                  <h2 className="text-5xl md:text-7xl font-black uppercase italic tracking-tighter leading-none">Minha <span className="text-orange-500">Frota.</span></h2>
                  <p className="text-[11px] text-gray-600 font-black uppercase tracking-widest italic max-w-lg">Gerencie instâncias reais da Evolution API.</p>
               </div>
               <div className="flex gap-4 w-full md:w-auto">
                  <GlassButton onClick={fetchInstances} className="!px-8 !py-5 flex items-center gap-3 !rounded-2xl"><RefreshCw size={18} /> Sincronizar</GlassButton>
                  <NeonButton onClick={createInstance} disabled={isCreatingInstance} className="!px-10 !py-5 !rounded-2xl">{isCreatingInstance ? <Loader2 size={18} className="animate-spin" /> : <><Plus size={20} className="mr-3"/> Instalar Canal</>}</NeonButton>
               </div>
            </header>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-10">
               {instances.length === 0 ? <div className="col-span-full py-40 text-center opacity-20 border-2 border-dashed border-white/5 rounded-[4rem] text-3xl font-black uppercase italic">Nenhuma instância detectada</div> :
               instances.map(inst => (
                 <GlassCard key={inst.id} className="!p-0 h-full flex flex-col relative group rounded-[3rem] bg-white/[0.01]">
                    <div className="p-10 flex-1 space-y-10">
                       <div className="flex justify-between">
                          <div className={`p-6 rounded-[2rem] ${inst.status === 'CONNECTED' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}><Cpu size={32} /></div>
                          <button onClick={() => deleteInstance(inst.name)} className="p-4 text-gray-700 hover:text-red-500 transition-all"><Trash2 size={22}/></button>
                       </div>
                       <div className="space-y-2">
                          <h3 className="text-3xl font-black uppercase italic tracking-tighter truncate text-white">{inst.name.replace(`${userPrefix}_`, '')}</h3>
                          <div className="flex items-center gap-2 text-[11px] text-gray-500 font-black uppercase tracking-widest"><Globe size={14} /> +{inst.phone}</div>
                       </div>
                       <div className="grid grid-cols-2 gap-5">
                          <div className="bg-white/[0.03] border border-white/5 p-5 rounded-3xl"><div className="text-[9px] font-black text-gray-600 uppercase">Leads Sync</div><div className="text-3xl font-black italic">{instanceLeadsCount[inst.name] || 0}</div></div>
                          <div className={`text-center p-5 rounded-3xl font-black uppercase text-[10px] ${inst.status === 'CONNECTED' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>{inst.status}</div>
                       </div>
                    </div>
                    <div className="p-8 border-t border-white/5 bg-black/40 flex items-center justify-between">
                       <span className="text-[10px] font-black uppercase tracking-widest italic opacity-40">Cluster v3.1</span>
                       <NeonButton onClick={() => connectInstance(inst.name)} className="!px-8 !py-3 !text-[10px] !rounded-2xl">Parear Chip</NeonButton>
                    </div>
                 </GlassCard>
               ))}
            </div>
          </div>
        ) : <div className="flex-1 flex flex-col items-center justify-center opacity-10"><TerminalIcon size={100} className="text-orange-500" /><h2 className="text-3xl font-black uppercase italic mt-8">Sinais de Rede em Escaneamento</h2></div>}
      </main>
    </div>
  );
}
