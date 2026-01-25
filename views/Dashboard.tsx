
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, MessageSquare, CreditCard, 
  LogOut, Smartphone, User as UserIcon, Activity, 
  Crown, Rocket, Info, ShieldCheck, Database, Zap, 
  ExternalLink, Users, Power, Send, Search, Filter,
  TrendingUp, AlertTriangle
} from 'lucide-react';
import { UserSession, DashboardTab, Lead } from '../types';
import { GlassCard } from '../components/GlassCard';
import { NeonButton, GlassButton } from '../components/Buttons';
import { Logo } from '../components/Logo';
import { supabase } from '../lib/supabase';

export function Dashboard({ user, onLogout, onCheckout }: { user: UserSession; onLogout: () => void; onCheckout: () => void }) {
  const [activeTab, setActiveTab] = useState<DashboardTab>(user.isAdmin ? 'admin' : 'overview');
  const [clients, setClients] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loadingClients, setLoadingClients] = useState(false);

  // Carregar clientes se for admin
  useEffect(() => {
    if (user.isAdmin && activeTab === 'admin') {
      fetchClients();
    }
  }, [activeTab, user.isAdmin]);

  const fetchClients = async () => {
    setLoadingClients(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (!error && data) setClients(data);
    setLoadingClients(false);
  };

  const toggleSubscription = async (clientId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const { error } = await supabase
      .from('profiles')
      .update({ subscription_status: newStatus })
      .eq('id', clientId);
    
    if (!error) fetchClients();
  };

  const SidebarBtn = ({ id, icon: Icon, label, isAdmin = false }: { id: DashboardTab, icon: any, label: string, isAdmin?: boolean }) => {
    if (isAdmin && !user.isAdmin) return null;
    return (
      <button 
        onClick={() => setActiveTab(id)}
        className={`w-full flex items-center gap-3 px-5 py-3 rounded-lg transition-all relative group ${
          activeTab === id 
            ? 'bg-orange-600/10 text-orange-500 border border-orange-500/10 shadow-sm' 
            : 'text-gray-600 hover:text-white hover:bg-white/[0.02]'
        }`}
      >
        <Icon size={16} className={activeTab === id ? 'text-orange-500' : 'opacity-40'} />
        <span className="text-[9px] font-bold uppercase tracking-widest">{label}</span>
      </button>
    );
  };

  return (
    <div className="flex h-screen bg-[#050505] overflow-hidden text-white font-sans">
      <div className="fixed inset-0 grid-engine pointer-events-none opacity-10"></div>

      <aside className="w-[240px] border-r border-white/5 flex flex-col p-6 bg-black/40 backdrop-blur-xl z-50">
        <Logo size="sm" className="mb-12 px-2" />
        <nav className="flex-1 space-y-1">
          <SidebarBtn id="overview" icon={LayoutDashboard} label="Overview" />
          <SidebarBtn id="evolution" icon={Smartphone} label="Evolution API" />
          <SidebarBtn id="atendimento" icon={MessageSquare} label="CRM Atendimento" />
          <SidebarBtn id="financeiro" icon={CreditCard} label="Faturamento" />
          <div className="h-px bg-white/5 my-6 mx-2" />
          <SidebarBtn id="admin" icon={Crown} label="Gestão Clientes" isAdmin />
        </nav>
        <button onClick={onLogout} className="mt-auto flex items-center gap-3 px-5 py-4 text-gray-700 hover:text-red-500 transition-colors uppercase text-[9px] font-bold tracking-widest border-t border-white/5">
            <LogOut size={16} /> Logout Engine
        </button>
      </aside>

      <main className="flex-1 flex flex-col relative overflow-hidden bg-[#070707]">
        <header className="h-16 flex items-center justify-between px-10 border-b border-white/5 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
             <span className="text-[10px] font-black uppercase text-orange-500 tracking-widest">{activeTab}</span>
          </div>
          <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-[10px] font-bold uppercase italic leading-none">{user.name}</div>
                  <div className="text-[7px] text-orange-500 font-black uppercase tracking-widest mt-1">
                    {user.isAdmin ? 'NEURAL ADMIN MASTER' : 'OPERADOR ELITE'}
                  </div>
                </div>
                <div className="w-9 h-9 bg-rajado rounded-lg border border-white/10 flex items-center justify-center">
                  <UserIcon size={16} />
                </div>
          </div>
        </header>

        <div className="flex-1 p-10 overflow-y-auto z-10 custom-scrollbar">
          <AnimatePresence mode="wait">
            <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="h-full">
              
              {activeTab === 'overview' && (
                <div className="space-y-10">
                   {user.subscriptionStatus === 'TRIALING' && !user.isAdmin && (
                     <GlassCard className="!p-8 border-orange-500/30 bg-orange-500/[0.03] flex flex-col lg:flex-row items-center gap-8 relative z-10">
                        <div className="w-16 h-16 bg-orange-500/10 rounded-2xl flex items-center justify-center text-orange-500 shrink-0">
                           <Rocket size={32} className="animate-bounce" />
                        </div>
                        <div className="flex-1 text-center lg:text-left">
                           <h3 className="text-xl font-black uppercase italic tracking-tighter mb-2">Sua Engine está em modo <span className="text-orange-500">Trial</span></h3>
                           <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest leading-relaxed">
                             Seus clusters neurais serão suspensos em 15 dias. Ative a licença Enterprise agora para manter a sincronização vitalícia.
                           </p>
                        </div>
                        <NeonButton onClick={onCheckout} className="!px-10 !py-4 whitespace-nowrap shadow-xl shadow-orange-500/20">
                           Ativar Licença (R$ 89,00)
                        </NeonButton>
                     </GlassCard>
                   )}

                   <div className="flex justify-between items-end">
                      <h2 className="text-4xl font-black uppercase italic tracking-tighter">Status <span className="text-orange-500">Neural</span></h2>
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      {[
                        { l: 'Faturamento', v: user.isAdmin ? 'R$ 14.280' : 'R$ 89,00', t: 'Geral Mensal', c: 'text-orange-500', icon: CreditCard },
                        { l: 'Nodes Ativos', v: user.isAdmin ? clients.filter(c => c.subscription_status === 'ACTIVE').length : '01', t: 'Online', c: 'text-blue-500', icon: Smartphone },
                        { l: 'Hits IA / Dia', v: user.isAdmin ? '42.8k' : '1.2k', t: 'Processando', c: 'text-purple-500', icon: Activity },
                        { l: 'Status Licença', v: user.isAdmin ? 'MASTER' : user.subscriptionStatus, t: 'Licença Operacional', c: 'text-orange-500', icon: ShieldCheck }
                      ].map((s, i) => (
                        <GlassCard key={i} className="!p-6">
                          <div className="text-[8px] font-black text-gray-700 uppercase tracking-widest mb-4">{s.l}</div>
                          <div className="text-3xl font-black italic">{s.v}</div>
                          <div className={`mt-3 text-[7px] font-bold uppercase tracking-widest ${s.c}`}>{s.t}</div>
                        </GlassCard>
                      ))}
                   </div>
                </div>
              )}

              {activeTab === 'admin' && user.isAdmin && (
                <div className="space-y-8">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                    <div className="space-y-2">
                       <h2 className="text-4xl font-black uppercase italic tracking-tighter">Gestão de <span className="text-orange-500">Frota Neural.</span></h2>
                       <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest italic">Controle total de acessos e faturamento da plataforma.</p>
                    </div>
                    <div className="flex gap-4 w-full md:w-auto">
                       <div className="relative flex-1 md:w-64">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" size={14} />
                          <input 
                            placeholder="BUSCAR CLIENTE..." 
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full bg-white/[0.03] border border-white/5 rounded-xl py-3 pl-12 pr-4 text-[10px] font-bold uppercase tracking-widest outline-none focus:border-orange-500/40 transition-all"
                          />
                       </div>
                       <GlassButton onClick={fetchClients} className="!px-4"><Zap size={14}/></GlassButton>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    {loadingClients ? (
                      <div className="py-20 flex justify-center"><Activity className="text-orange-500 animate-spin" /></div>
                    ) : (
                      clients
                        .filter(c => c.email?.toLowerCase().includes(search.toLowerCase()) || c.full_name?.toLowerCase().includes(search.toLowerCase()))
                        .map((client) => (
                        <GlassCard key={client.id} className="!p-6 flex flex-col md:flex-row items-center gap-8 group">
                          <div className="flex items-center gap-5 flex-1 w-full">
                             <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${client.subscription_status === 'ACTIVE' ? 'bg-orange-500/20 text-orange-500' : 'bg-gray-800 text-gray-600'}`}>
                                <UserIcon size={20} />
                             </div>
                             <div className="space-y-1">
                                <div className="text-sm font-black uppercase italic tracking-tighter">{client.full_name || 'Usuário Neural'}</div>
                                <div className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">{client.email}</div>
                                <div className="flex items-center gap-3 mt-2">
                                   <span className={`text-[7px] font-black uppercase px-2 py-0.5 rounded-full border ${client.subscription_status === 'ACTIVE' ? 'border-orange-500/30 text-orange-500 bg-orange-500/5' : 'border-white/10 text-gray-600'}`}>
                                      {client.subscription_status}
                                   </span>
                                   <span className="text-[7px] font-bold text-gray-700 uppercase">HITS: {Math.floor(Math.random() * 5000)}/mês</span>
                                </div>
                             </div>
                          </div>

                          <div className="flex items-center gap-3 w-full md:w-auto">
                             <GlassButton 
                               onClick={() => alert(`Enviando pulsar para ${client.email}...`)}
                               className="flex-1 md:flex-none !px-4 !py-3 !text-[8px] hover:!border-blue-500/40"
                             >
                                <Send size={12} className="mr-2" /> Mensagem
                             </GlassButton>
                             <NeonButton 
                               onClick={() => toggleSubscription(client.id, client.subscription_status)}
                               className={`flex-1 md:flex-none !px-4 !py-3 !text-[8px] ${client.subscription_status === 'ACTIVE' ? 'grayscale opacity-70 hover:grayscale-0' : ''}`}
                             >
                                <Power size={12} className="mr-2" /> {client.subscription_status === 'ACTIVE' ? 'Suspender' : 'Ativar'}
                             </NeonButton>
                          </div>
                        </GlassCard>
                      ))
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'financeiro' && (
                <div className="space-y-8">
                  <h2 className="text-4xl font-black uppercase italic tracking-tighter leading-none">Gestão <span className="text-orange-500">Financeira.</span></h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <GlassCard className="!p-8 space-y-6">
                      <div className="flex items-center gap-4 text-orange-500">
                        <CreditCard size={24} />
                        <h3 className="text-sm font-black uppercase tracking-widest italic">Licenciamento Neural</h3>
                      </div>
                      
                      <div className="p-6 bg-white/[0.02] rounded-2xl border border-white/5 space-y-4">
                        <div className="flex justify-between items-center">
                           <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest italic">Acesso Enterprise</span>
                           <span className="text-xl font-black italic">R$ 89,00<span className="text-[10px] text-gray-600">/mês</span></span>
                        </div>
                        <div className="h-px bg-white/5 w-full"></div>
                        <ul className="space-y-2">
                           <li className="flex items-center gap-2 text-[9px] font-bold text-gray-400 uppercase"><Zap size={10} className="text-orange-500"/> PIX Instantâneo (Kiwify)</li>
                           <li className="flex items-center gap-2 text-[9px] font-bold text-gray-400 uppercase"><ShieldCheck size={10} className="text-orange-500"/> SSL Secure Gateway</li>
                        </ul>
                      </div>

                      <NeonButton onClick={onCheckout} className="w-full !py-5">
                         Ativar via PIX ou Cartão <ExternalLink size={12} className="ml-2" />
                      </NeonButton>
                    </GlassCard>

                    <GlassCard className="!p-8 space-y-6 flex flex-col justify-center items-center text-center">
                       <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-2">
                          <Info size={24} className="text-gray-600" />
                       </div>
                       <div className="text-[10px] font-black uppercase tracking-widest">Suporte Financeiro</div>
                       <p className="text-[8px] font-bold text-gray-700 uppercase leading-relaxed max-w-[200px]">
                         Dúvidas sobre faturamento? <br/> Entre em contato com nossa equipe neural.
                       </p>
                    </GlassCard>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
