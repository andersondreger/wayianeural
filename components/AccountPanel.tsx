import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Crown, ChevronRight, Play, Users, ExternalLink, Download, Trash2, XCircle, Lock, Clock, Home, LayoutGrid, Wallet, HelpCircle, Settings, CreditCard, Gem, Plus, MessageSquare, Box } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { payApi, brl, MyPayments, Hub, HubProject } from '../lib/pay';
import { STATUS_LABEL } from './PaymentsPanel';
import { resizeToJpeg, safeAvatarUrl } from '../lib/avatar';
import { CeoCenter, CeoSection } from './CeoCenter';
import { DEMO_HUB, DEMO_PAYMENTS, NEWS } from '../lib/demo';

const dt = (s?: string | null) => (s ? new Date(s).toLocaleDateString('pt-BR') : '—');
const INV_LABEL: Record<string, string> = {
  PAYMENT_RECEIVED: 'Pago', PAYMENT_CONFIRMED: 'Pago', PAYMENT_CREATED: 'Em aberto', PAYMENT_OVERDUE: 'Vencida',
  PAYMENT_REFUNDED: 'Estornada', PAYMENT_DELETED: 'Cancelada',
};
const TICKET_LABEL = { open: 'Em andamento', answered: 'Resolvido', closed: 'Fechado' } as const;
const TICKET_CLS = { open: 'bg-amber-100 text-amber-800', answered: 'bg-emerald-100 text-emerald-800', closed: 'bg-slate-100 text-slate-600' } as const;

type Section = 'inicio' | 'produtos' | 'financeiro' | 'suporte' | 'config';
const NAV: { id: Section; label: string; icon: React.ElementType }[] = [
  { id: 'inicio', label: 'Início', icon: Home },
  { id: 'produtos', label: 'Meus produtos', icon: LayoutGrid },
  { id: 'financeiro', label: 'Financeiro', icon: Wallet },
  { id: 'suporte', label: 'Suporte', icon: HelpCircle },
  { id: 'config', label: 'Configurações', icon: Settings },
];

const CEO_NAV: { id: CeoSection; label: string; icon: React.ElementType }[] = [
  { id: 'geral', label: 'Visão geral', icon: Home },
  { id: 'clientes', label: 'Clientes', icon: Users },
  { id: 'financeiro', label: 'Financeiro', icon: Wallet },
  { id: 'suporte', label: 'Suporte', icon: HelpCircle },
];

const BADGE: Record<HubProject['state'], { label: string; cls: string }> = {
  FREE: { label: 'Grátis', cls: 'bg-sky-100 text-sky-800' },
  TRIAL: { label: 'Teste', cls: 'bg-amber-100 text-amber-800' },
  ACTIVE: { label: 'Ativo', cls: 'bg-emerald-100 text-emerald-800' },
  GRACE: { label: 'Em atraso', cls: 'bg-red-100 text-red-700' },
  EXPIRED: { label: 'Expirado', cls: 'bg-red-100 text-red-700' },
  NONE: { label: 'Disponível', cls: 'bg-slate-100 text-slate-600' },
};
const RELEASED: HubProject['state'][] = ['FREE', 'TRIAL', 'ACTIVE', 'GRACE'];

const primary = 'inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-[#6d28d9] hover:bg-[#5b21b6] text-white text-sm font-bold transition-colors disabled:opacity-50';
const ghost = 'inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full border border-[#6d28d9] text-[#6d28d9] hover:bg-[#6d28d9]/5 text-sm font-bold transition-colors disabled:opacity-50';
const card = 'bg-white text-[#1c0b3d] rounded-3xl';
const field = 'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-[#1c0b3d] outline-none focus:border-[#6d28d9]';

// Sem sessao: um unico login, no site principal (codigo por e-mail). Depois dele o /dashboard abre direto, sem confirmar de novo.
function ToLogin({ pay }: { pay: string | null }) {
  useEffect(() => { window.location.replace(`/app/?start=onboarding${pay ? `&pay=${encodeURIComponent(pay)}` : ''}`); }, [pay]);
  return <div className="flex justify-center py-24"><Loader2 className="animate-spin text-white" size={44} /></div>;
}

// Area do cliente: produtos liberados, financeiro, chamados e direitos LGPD. Tudo vem filtrado pelo e-mail logado no servidor.
// embedded: dentro do painel antigo (que ja tem menu lateral e avatar): sem 2o menu lateral, abas em pilula no topo.
export function AccountPanel({ initialProduct, embedded = false }: { initialProduct?: string; embedded?: boolean }) {
  const [state, setState] = useState<'loading' | 'gate' | 'ready'>('loading');
  const [data, setData] = useState<MyPayments | null>(null);
  const [hub, setHub] = useState<Hub | null>(null);
  const [selected, setSelected] = useState<string | null>(initialProduct ?? null);
  const [section, setSection] = useState<Section>(initialProduct ? 'produtos' : 'inicio');
  const [doc, setDoc] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [profile, setProfile] = useState<{ name: string; phone: string; avatar: string }>({ name: '', phone: '', avatar: '' });
  const [menuOpen, setMenuOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [spot, setSpot] = useState(0);   // produto em destaque (efeito Netflix)
  const [demo, setDemo] = useState(false);   // /dashboard sem login: painel com dados de exemplo
  const [ceo, setCeo] = useState(false);
  const [ceoSection, setCeoSection] = useState<CeoSection>('geral');

  const load = useCallback(async () => {
    try {
      const h = await payApi.hub();          // login completo OU link assinado do projeto
      setHub(h);
      supabase.auth.getUser().then(({ data }) => {
        const m = data.user?.user_metadata ?? {};
        setProfile({ name: String(m.full_name ?? ''), phone: String(m.phone ?? ''), avatar: safeAvatarUrl(m.avatar_url) });
      }).catch(() => {});
      if (!h.scoped) payApi.me().then(m => setIsAdmin(m.isAdmin)).catch(() => {});   // visao CEO so para admin (o servidor valida de novo)
      setData(h.scoped ? null : await payApi.myPayments());   // faturas/LGPD so com login completo
      setErr(''); setState('ready');
    } catch (e: any) {
      if (/login|sessao|expirado/i.test(e.message)) {
        if (window.location.pathname.startsWith('/dashboard')) { setDemo(true); setHub(DEMO_HUB); setData(DEMO_PAYMENTS); setIsAdmin(true); setErr(''); setState('ready'); }
        else setState('gate');
      }
      else { setErr(e.message); setState('ready'); }
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  const nProjects = hub?.projects.length ?? 0;
  useEffect(() => {
    if (nProjects < 2) return;
    const t = setInterval(() => setSpot(i => i + 1), 6000);
    return () => clearInterval(t);
  }, [nProjects]);

  const changePhoto = (file?: File) => file && run('photo', async () => {
    const { url } = await payApi.uploadAvatar(await resizeToJpeg(file));
    const { error } = await supabase.auth.updateUser({ data: { avatar_url: url } });
    if (error) throw new Error('Não foi possível salvar a foto.');
    setProfile(p => ({ ...p, avatar: url }));
  });
  const signOut = async () => { await supabase.auth.signOut(); window.location.href = '/'; };
  const loginUrl = `/app/?start=onboarding${selected ? `&pay=${encodeURIComponent(selected)}` : ''}`;
  const run = async (key: string, fn: () => Promise<void>) => {
    if (demo) { window.location.href = loginUrl; return; }
    setBusy(key); setErr('');
    try { await fn(); } catch (e: any) { setErr(e.message); }
    setBusy('');
  };

  const checkout = (slug: string) => run('k' + slug, async () => {
    const r = await payApi.checkout(slug, doc);
    if (r.externalUrl) window.location.href = r.externalUrl;
    else if (r.alreadyActive && r.redirect) window.location.href = r.redirect;
    else if (r.invoiceUrl) window.location.href = r.invoiceUrl;
    else throw new Error('Cobranca criada, mas o link ainda nao ficou disponivel. Tente novamente em instantes.');
  });
  const cancel = (product: string) => {
    if (!window.confirm('Cancelar esta assinatura? O acesso e encerrado e nao ha novas cobrancas.')) return;
    run('c' + product, async () => { await payApi.cancel(product); await load(); });
  };
  const exportData = () => run('exp', async () => {
    const blob = new Blob([JSON.stringify(await payApi.myExport(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'meus-dados-wayia.json'; a.click();
    URL.revokeObjectURL(a.href);
  });
  const deleteData = () => {
    if (!window.confirm('Excluir seus dados de assinatura e chamados? Isso nao pode ser desfeito.')) return;
    run('del', async () => { await payApi.deleteMyData(); await supabase.auth.signOut(); await load(); });
  };

  const projects = hub?.projects ?? [];
  const subs = data?.subscriptions ?? [], invoices = data?.invoices ?? [], tickets = data?.tickets ?? [];
  const released = projects.filter(p => RELEASED.includes(p.state));
  const email = hub?.email ?? '';
  const nome = profile.name.trim() || email.split('@')[0] || 'cliente';

  // Fatura atual: assinatura aguardando pagamento, ou cobranca em aberto/vencida.
  const current = useMemo(() => {
    const pend = subs.find(s => s.status === 'PENDING' && s.invoice_url);
    if (pend) return { cents: pend.price_cents, url: pend.invoice_url, due: null as string | null, product: pend.product_slug };
    const open = invoices.find(i => (i.event === 'PAYMENT_CREATED' || i.event === 'PAYMENT_OVERDUE') && i.url);
    return open ? { cents: open.amountCents, url: open.url, due: open.dueDate, product: open.product } : null;
  }, [subs, invoices]);
  const nextCharge = subs.filter(s => s.status === 'ACTIVE' && s.current_period_end).map(s => s.current_period_end as string).sort()[0];

  if (state === 'loading') return <div className="flex justify-center py-24"><Loader2 className="animate-spin text-[#6d28d9]" size={44} /></div>;
  if (state === 'gate') return <ToLogin pay={selected} />;

  const productCard = (p: HubProject) => {
    const b = BADGE[p.state];
    const isReleased = RELEASED.includes(p.state);
    const needsPay = p.tier === 'paid' && p.state !== 'ACTIVE';
    // Estilo Netflix: o card inteiro e o botao. Liberado abre o produto; produto com teste comeca o teste ao entrar.
    const canTry = p.state === 'NONE' && p.tier === 'paid' && p.trial_days > 0 && !p.checkout_url;
    const opens = p.access !== 'none' || canTry;
    const stop = (e: React.MouseEvent) => e.stopPropagation();
    return (
      <div key={p.slug} role={opens ? 'link' : undefined} tabIndex={opens ? 0 : undefined}
        onClick={opens ? () => { window.location.href = demo ? loginUrl : p.app_url; } : undefined}
        onKeyDown={opens ? e => { if (e.key === 'Enter') window.location.href = demo ? loginUrl : p.app_url; } : undefined}
        className={`${card} p-5 flex flex-col gap-3 transition-all ${opens ? 'cursor-pointer hover:scale-[1.04] hover:z-10 hover:shadow-2xl hover:shadow-black/60 focus-visible:ring-2 focus-visible:ring-[#6d28d9]' : ''} ${selected === p.slug ? 'ring-2 ring-[#6d28d9]' : ''}`}>
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-full bg-[#ede9fe] text-[#6d28d9] grid place-items-center shrink-0"><Box size={18} /></span>
          <h4 className="font-extrabold text-lg leading-tight">{p.name}</h4>
        </div>
        <p className="text-sm text-slate-600 leading-snug">{p.description}</p>
        {p.seats && (
          <div>
            <div className="flex justify-between text-xs text-slate-500"><span>Usuários</span><span className="font-bold">{p.seats.used} de {p.seats.total}</span></div>
            <div className="h-1.5 rounded-full bg-[#ede9fe] mt-1 overflow-hidden"><div className="h-full bg-[#6d28d9] rounded-full" style={{ width: `${Math.min(100, (p.seats.used / p.seats.total) * 100)}%` }} /></div>
          </div>
        )}
        {p.state === 'TRIAL' && <p className="text-xs font-bold text-amber-700 inline-flex items-center gap-1.5"><Clock size={13} /> {p.daysLeft} dia(s) de teste · acesso completo</p>}
        {p.state === 'EXPIRED' && <p className="text-xs font-bold text-red-600 inline-flex items-center gap-1.5"><Lock size={13} /> Dados salvos. Assine para voltar a criar.</p>}
        {p.state === 'GRACE' && <p className="text-xs font-bold text-red-600">Regularize até {dt(p.currentPeriodEnd)}.</p>}
        {p.state === 'ACTIVE' && <p className="text-xs text-slate-500">Acesso até {dt(p.currentPeriodEnd)}</p>}
        {!isReleased && p.tier === 'paid' && <p className="text-sm font-bold">A partir de {brl(p.price_cents)}<span className="text-slate-500 font-medium"> /{p.cycle === 'YEARLY' ? 'ano' : 'mês'}</span></p>}
                <div className="mt-auto flex items-center justify-between gap-2 flex-wrap pt-1">
          <span className={`text-xs font-bold px-3 py-1 rounded-full ${b.cls}`}>{b.label}</span>
          {opens && <span className="text-[#6d28d9] font-bold text-sm inline-flex items-center gap-1.5">{canTry ? `Testar ${p.trial_days} dias grátis` : 'Abrir'} <ExternalLink size={14} /></span>}
        </div>
        {needsPay && (p.checkout_url
          ? <a className={canTry ? ghost : primary} href={p.checkout_url} onClick={stop}>Contratar</a>
          : selected === p.slug
            ? <div className="flex flex-col gap-2" onClick={stop}>
                <input className={field} inputMode="numeric" placeholder="CPF ou CNPJ (só números)" value={doc} onChange={e => setDoc(e.target.value)} />
                <button className={primary} disabled={busy === 'k' + p.slug} onClick={() => checkout(p.slug)}>{busy === 'k' + p.slug ? 'Gerando...' : 'Ir para o pagamento'}</button>
              </div>
            : <button className={canTry ? ghost : primary} onClick={e => { stop(e); setSelected(p.slug); setErr(''); }}>{p.state === 'TRIAL' ? 'Assinar agora' : canTry ? 'Assinar já' : 'Contratar'}</button>)}
      </div>
    );
  };

  // Fileira horizontal estilo Netflix: rola de lado, cards com zoom ao passar o mouse.
  const row = (title: string, list: HubProject[], hint?: string) => (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-xl font-extrabold">{title}</h3>
        {hint && <span className="text-xs text-white/50">{hint}</span>}
      </div>
      <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory py-4 -mx-1 px-1 [scrollbar-width:thin]">
        {list.map(p => <div key={p.slug} className="snap-start shrink-0 w-[270px] flex">{productCard(p)}</div>)}
      </div>
    </section>
  );

  const hue = (slug: string) => slug.split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
  const spotlight = (() => {
    const list = projects.length ? projects : [];
    if (!list.length) return null;
    const p = list[spot % list.length];
    const rel = RELEASED.includes(p.state);
    const canTry = p.state === 'NONE' && p.tier === 'paid' && p.trial_days > 0 && !p.checkout_url;
    const h = hue(p.slug);
    return (
      <div className={`relative rounded-[1.75rem] overflow-hidden ${embedded ? 'h-[200px] md:h-[240px]' : 'h-[250px] md:h-[300px]'}`}>
        <AnimatePresence mode="wait">
          <motion.div key={p.slug} initial={{ opacity: 0, scale: 1.06 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.7 }}
            className="absolute inset-0 flex flex-col justify-end p-6 md:p-9"
            style={{ background: `radial-gradient(120% 140% at 85% 0%, hsl(${h} 70% 42%) 0%, hsl(${(h + 40) % 360} 60% 20%) 55%, #14072b 100%)` }}>
            <div className="absolute inset-0 bg-gradient-to-t from-[#14072b] via-[#14072b]/30 to-transparent" />
            <div className="relative max-w-xl space-y-3">
              <span className="text-[11px] font-bold uppercase tracking-widest text-white/70">{rel ? 'No seu ecossistema' : 'Em destaque'}</span>
              <h2 className="text-4xl md:text-5xl font-black leading-none">{p.name}</h2>
              <p className="text-white/80 text-sm md:text-base">{p.description}</p>
              <div className="flex gap-3 flex-wrap pt-1">
                <button onClick={() => { window.location.href = demo ? loginUrl : (p.access !== 'none' || canTry ? p.app_url : loginUrl); }}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white text-[#1c0b3d] font-bold text-sm hover:bg-white/90">
                  <Play size={16} fill="currentColor" /> {rel ? 'Abrir' : canTry ? `Testar ${p.trial_days} dias grátis` : 'Conhecer'}
                </button>
                {!rel && <button onClick={() => { setSection('produtos'); setSelected(p.slug); }} className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white/15 hover:bg-white/25 font-bold text-sm">Contratar <ChevronRight size={16} /></button>}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
        <div className="absolute right-5 bottom-5 flex gap-1.5">
          {list.map((x, i) => <button key={x.slug} aria-label={x.name} onClick={() => setSpot(i)} className={`h-1.5 rounded-full transition-all ${i === spot % list.length ? 'w-6 bg-white' : 'w-2 bg-white/40'}`} />)}
        </div>
      </div>
    );
  })();

  const grid = (list: HubProject[]) => <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">{list.map(productCard)}</div>;

  const newsCard = NEWS.length > 0 && (
    <div className="px-1 space-y-4">
      <h3 className="text-xl font-extrabold">Novidades do Ecossistema Way</h3>
      {NEWS.map((n, k) => (
        <div key={k} className="border-t border-white/10 first:border-0 pt-3 first:pt-0">
          <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${n.tag === 'Novo' ? 'bg-violet-100 text-violet-800' : n.tag === 'Melhoria' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{n.tag}</span>
          <p className="font-bold mt-1.5">{n.title}</p>
          <p className="text-sm text-white/60">{n.text}</p>
        </div>
      ))}
    </div>
  );

  const financeCard = (
    <div className={`${card} p-6 space-y-4`}>
      <h3 className="text-xl font-extrabold">Financeiro</h3>
      <div>
        <p className="text-sm text-slate-500">Fatura atual</p>
        <p className="text-4xl font-black tracking-tight">{brl(current?.cents ?? 0)}</p>
        <p className="text-sm text-slate-500">{current ? `${current.due ? `Vence em ${dt(current.due)} · ` : ''}${current.product}` : 'Nenhuma fatura em aberto'}</p>
      </div>
      {current?.url
        ? <a href={current.url} target="_blank" rel="noreferrer" className={`${primary} w-full`}>Pagar agora</a>
        : <button className={`${primary} w-full`} disabled>Pagar agora</button>}
      <div>
        <h4 className="font-extrabold mb-2">Histórico</h4>
        {invoices.length === 0 && <p className="text-sm text-slate-500">Nenhuma cobrança registrada.</p>}
        {invoices.slice(0, 4).map((i, k) => (
          <div key={k} className="flex justify-between gap-3 py-2 text-sm border-t border-slate-100 first:border-0">
            <span className="min-w-0 truncate">{i.product} · {INV_LABEL[i.event] ?? i.status ?? i.event}</span>
            <span className="font-bold whitespace-nowrap">{brl(i.amountCents)}</span>
          </div>
        ))}
      </div>
    </div>
  );

  const supportCard = (
    <div className={`${card} p-6 space-y-3`}>
      <h3 className="text-xl font-extrabold">Suporte</h3>
      {tickets.length === 0 && <p className="text-sm text-slate-500">Nenhum chamado aberto.</p>}
      {tickets.slice(0, 4).map((t, k) => (
        <div key={k} className="flex items-start justify-between gap-3 py-2 border-t border-slate-100 first:border-0">
          <div className="min-w-0"><p className="font-bold text-sm">{t.subject}</p><p className="text-xs text-slate-500">{t.product_slug} · {dt(t.created_at)}</p></div>
          <span className={`text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap ${TICKET_CLS[t.status]}`}>{TICKET_LABEL[t.status]}</span>
        </div>
      ))}
    </div>
  );

  const quick = [
    { icon: CreditCard, label: 'Financeiro', go: 'financeiro' as Section },
    { icon: Gem, label: 'Meus produtos', go: 'produtos' as Section },
    { icon: Plus, label: 'Contratar', go: 'produtos' as Section },
    { icon: MessageSquare, label: 'Suporte', go: 'suporte' as Section },
  ];

  return (
    <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-4">
    {demo && <span className="text-xl font-extrabold">Demonstrativo</span>}
    {isAdmin && (
      <div className="inline-flex rounded-full bg-white/10 p-1 text-sm font-bold">
        <button onClick={() => setCeo(false)} className={`px-5 py-2 rounded-full ${!ceo ? 'bg-white text-[#1c0b3d]' : 'text-white/70'}`}>Visão do cliente</button>
        <button onClick={() => setCeo(true)} className={`px-5 py-2 rounded-full inline-flex items-center gap-2 ${ceo ? 'bg-white text-[#1c0b3d]' : 'text-white/70'}`}><Crown size={14} /> Visão CEO</button>
      </div>
    )}
    {demo && <p className="text-sm text-white/60 flex-1 min-w-[220px]">Valores e nomes são exemplos. Entre com sua conta para ver os seus produtos e dados reais.</p>}
    {demo && <a href={loginUrl} className="px-5 py-2.5 rounded-full bg-white text-[#6d28d9] text-sm font-bold">Entrar / Criar conta</a>}
    </div>
    <div className={`rounded-[2rem] overflow-hidden bg-[#1c0b3d] grid text-white ${embedded ? 'grid-cols-1' : 'md:grid-cols-[230px_1fr] min-h-[640px]'}`}>
      <aside className={embedded ? 'p-3 md:px-6 md:pt-5 flex gap-2 overflow-x-auto border-b border-white/10 [scrollbar-width:thin]' : 'bg-white text-[#1c0b3d] p-4 flex md:flex-col gap-1 overflow-x-auto md:overflow-visible'}>
        {!embedded && <div className="hidden md:block text-3xl font-black text-[#6d28d9] px-3 py-4">WayIA</div>}
        {(ceo ? CEO_NAV : NAV).map(n => (
          <button key={n.id} onClick={() => ceo ? setCeoSection(n.id as CeoSection) : setSection(n.id as Section)}
            className={embedded
              ? `flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-colors ${(ceo ? ceoSection : section) === n.id ? 'bg-white text-[#1c0b3d]' : 'bg-white/10 text-white/80 hover:bg-white/20'}`
              : `flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold whitespace-nowrap text-left transition-colors ${(ceo ? ceoSection : section) === n.id ? 'bg-[#ede9fe] text-[#4c1d95]' : 'text-slate-600 hover:bg-slate-50'}`}>
            <n.icon size={embedded ? 16 : 18} /> {n.label}
          </button>
        ))}
        {!embedded && !ceo && !demo && (
          <a href="/app/?go=neural" className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold whitespace-nowrap text-slate-600 hover:bg-slate-50"><Box size={18} /> {isAdmin ? 'Instâncias e WayAR' : 'WayFlow Neural'}</a>
        )}
        {!embedded && <div className="hidden md:flex mt-auto items-center gap-3 rounded-2xl bg-[#f5f3ff] p-3">
          {profile.avatar
            ? <img src={profile.avatar} alt={nome} className="w-10 h-10 rounded-full object-cover" />
            : <span className="w-10 h-10 rounded-full bg-[#6d28d9] text-white grid place-items-center font-black text-sm">{nome.slice(0, 2).toUpperCase()}</span>}
          <div className="min-w-0"><p className="font-bold text-sm truncate">{nome}</p><p className="text-xs text-slate-500 truncate">{email}</p></div>
        </div>}
        {!embedded && !demo && <button onClick={signOut} className="hidden md:block text-xs font-bold text-slate-500 hover:text-[#6d28d9] px-4 py-2 text-left">Sair</button>}
      </aside>

      <main className={`min-w-0 space-y-6 ${embedded ? 'p-4 md:p-6' : 'p-5 md:p-8'}`}>
        {!demo && !embedded && (
          <div className="relative flex justify-end -mb-2">
            <button onClick={() => setMenuOpen(o => !o)} aria-haspopup="menu" aria-expanded={menuOpen} className="flex items-center gap-3 rounded-full bg-white/10 hover:bg-white/20 pl-4 pr-1.5 py-1.5">
              <span className="text-sm font-bold max-w-[160px] truncate">{nome}</span>
              {profile.avatar
                ? <img src={profile.avatar} alt="" className="w-9 h-9 rounded-full object-cover" />
                : <span className="w-9 h-9 rounded-full bg-[#6d28d9] grid place-items-center font-black text-xs">{nome.slice(0, 2).toUpperCase()}</span>}
            </button>
            {menuOpen && (
              <div role="menu" className="absolute right-0 top-12 z-30 w-60 rounded-2xl bg-white text-[#1c0b3d] shadow-2xl p-2 text-sm font-bold">
                <p className="px-3 pt-2 pb-1 text-xs font-medium text-slate-500 truncate">{email}</p>
                {[
                  { label: 'Meu perfil e foto', go: () => { setCeo(false); setSection('config'); } },
                  { label: 'Gerir assinaturas e faturas', go: () => { setCeo(false); setSection('financeiro'); } },
                  { label: 'Suporte', go: () => { setCeo(false); setSection('suporte'); } },
                ].map(i => <button key={i.label} role="menuitem" onClick={() => { i.go(); setMenuOpen(false); }} className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-slate-50">{i.label}</button>)}
                <button role="menuitem" onClick={signOut} className="w-full text-left px-3 py-2.5 rounded-xl text-red-600 hover:bg-red-50 border-t border-slate-100 mt-1">Sair</button>
              </div>
            )}
          </div>
        )}
        {err && <div className="rounded-2xl bg-red-100 text-red-700 px-5 py-3 text-sm font-bold">{err}</div>}

        {ceo && isAdmin && <CeoCenter section={ceoSection} demo={demo} />}
        {!ceo && <>

        {section === 'inicio' && (
          <div className={`grid gap-6 ${embedded ? '2xl:grid-cols-[1fr_340px]' : 'xl:grid-cols-[1fr_340px]'}`}>
            <div className="space-y-6 min-w-0">
              <div className="rounded-[1.75rem] bg-[#6d22d8] p-7 grid sm:grid-cols-[1fr_220px] gap-6 items-center">
                <div>
                  <p className="text-sm text-white/80">Olá, {nome}</p>
                  <h2 className="text-3xl md:text-4xl font-black leading-tight mt-1">{released.length} de {projects.length} produtos liberados</h2>
                  <p className="text-sm text-white/80 mt-3">{nextCharge ? `Próxima cobrança em ${dt(nextCharge)}` : 'Nenhuma assinatura ativa'}</p>
                </div>
                <div>
                  <p className="text-xs text-white/80 mb-2">Ecossistema Way</p>
                  <div className="h-2 rounded-full bg-white/25 overflow-hidden"><div className="h-full bg-white rounded-full" style={{ width: `${projects.length ? (released.length / projects.length) * 100 : 0}%` }} /></div>
                </div>
              </div>
              <div className="flex gap-3 flex-wrap">
                {quick.map(q => (
                  <button key={q.label} onClick={() => setSection(q.go)} className="flex items-center gap-2 pr-4 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-sm font-bold">
                    <span className="w-11 h-11 rounded-full bg-white text-[#6d28d9] grid place-items-center"><q.icon size={18} /></span>{q.label}
                  </button>
                ))}
              </div>
              {spotlight}
              {released.length > 0 && row('Meus produtos', released)}
              {projects.length > released.length && row('Disponíveis para você', projects.filter(p => !RELEASED.includes(p.state)), 'Libera na hora após o pagamento')}
            </div>
            <div className="space-y-6 min-w-0">{newsCard}{financeCard}{supportCard}</div>
          </div>
        )}

        {section === 'produtos' && <><h2 className="text-3xl font-black">Meus produtos</h2>{grid(projects)}</>}

        {section === 'financeiro' && (
          <div className="space-y-6">
            <h2 className="text-3xl font-black">Financeiro</h2>
            {hub?.scoped && <p className="text-sm text-white/70">Para ver faturas, assinaturas e seus dados, entre com o código do seu e-mail.</p>}
            {!hub?.scoped && (
              <>
                <div className="grid md:grid-cols-2 gap-4">
                  {subs.length === 0 && <p className="text-sm text-white/70">Nenhuma assinatura ainda. Contrate em Meus produtos.</p>}
                  {subs.map(s => (
                    <div key={s.product_slug} className={`${card} p-5 space-y-2`}>
                      <div className="flex justify-between items-start gap-3"><h4 className="font-extrabold uppercase">{s.product_slug}</h4><span className="text-xs font-bold px-3 py-1 rounded-full bg-[#ede9fe] text-[#4c1d95]">{STATUS_LABEL[s.status]}</span></div>
                      <p className="text-2xl font-black">{brl(s.price_cents)}</p>
                      <p className="text-xs text-slate-500">Acesso até {dt(s.current_period_end)}</p>
                      <div className="flex gap-2 flex-wrap">
                        {s.status === 'PENDING' && s.invoice_url && <a className={primary} href={s.invoice_url} target="_blank" rel="noreferrer">Finalizar pagamento</a>}
                        {s.canCancel && <button className={ghost} disabled={busy === 'c' + s.product_slug} onClick={() => cancel(s.product_slug)}><XCircle size={14} /> Cancelar</button>}
                      </div>
                    </div>
                  ))}
                </div>
                <div className={`${card} p-5 overflow-x-auto`}>
                  <h3 className="font-extrabold text-lg mb-3">Faturas</h3>
                  {invoices.length === 0 ? <p className="text-sm text-slate-500">Nenhuma cobrança registrada.</p> : (
                    <table className="w-full text-left text-sm">
                      <thead className="text-xs text-slate-500"><tr><th className="py-2">Produto</th><th>Vencimento</th><th>Valor</th><th>Situação</th><th /></tr></thead>
                      <tbody>
                        {invoices.map((i, k) => (
                          <tr key={k} className="border-t border-slate-100 font-semibold">
                            <td className="py-3 uppercase">{i.product}</td><td>{dt(i.dueDate)}</td><td>{brl(i.amountCents)}</td>
                            <td>{INV_LABEL[i.event] ?? i.status ?? i.event}</td>
                            <td>{i.url && <a href={i.url} target="_blank" rel="noreferrer" className="text-[#6d28d9] inline-flex items-center gap-1"><ExternalLink size={12} /> Abrir</a>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {section === 'suporte' && (
          <div className="space-y-4 max-w-2xl">
            <h2 className="text-3xl font-black">Suporte</h2>
            {tickets.length === 0 && <p className="text-sm text-white/70">Nenhum chamado. Os chamados abertos dentro dos produtos aparecem aqui com a resposta da equipe.</p>}
            {tickets.map((t, k) => (
              <div key={k} className={`${card} p-5 space-y-2`}>
                <div className="flex justify-between gap-3"><p className="font-bold">{t.subject}</p><span className={`text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap ${TICKET_CLS[t.status]}`}>{TICKET_LABEL[t.status]}</span></div>
                <p className="text-xs text-slate-500">{t.product_slug} · {dt(t.created_at)}</p>
                {t.reply && <p className="text-sm text-slate-700 whitespace-pre-wrap">{t.reply}</p>}
              </div>
            ))}
          </div>
        )}

        {section === 'config' && (
          <div className="space-y-4 max-w-2xl">
            <h2 className="text-3xl font-black">Configurações</h2>
            <div className={`${card} p-6 space-y-4`}>
              <h3 className="font-extrabold text-lg">Meu perfil</h3>
              <div className="flex items-center gap-4">
                {profile.avatar
                  ? <img src={profile.avatar} alt={nome} className="w-20 h-20 rounded-full object-cover" />
                  : <span className="w-20 h-20 rounded-full bg-[#6d28d9] text-white grid place-items-center font-black text-2xl">{nome.slice(0, 2).toUpperCase()}</span>}
                <div className="space-y-1">
                  <label className={`${ghost} cursor-pointer ${busy === 'photo' ? 'opacity-50 pointer-events-none' : ''}`}>
                    {busy === 'photo' ? 'Enviando...' : 'Trocar foto'}
                    <input type="file" accept="image/*" className="hidden" onChange={e => { changePhoto(e.target.files?.[0]); e.target.value = ''; }} />
                  </label>
                  <p className="text-xs text-slate-500">JPG ou PNG. A foto é recortada em quadrado.</p>
                </div>
              </div>
              <label className="block text-xs font-bold text-slate-500">E-mail (usado no login)
                <input className={`${field} mt-1 bg-slate-50`} value={email} disabled />
              </label>
              <label className="block text-xs font-bold text-slate-500">Nome
                <input className={`${field} mt-1`} value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} maxLength={80} />
              </label>
              <label className="block text-xs font-bold text-slate-500">WhatsApp (com DDD)
                <input className={`${field} mt-1`} value={profile.phone} onChange={e => setProfile({ ...profile, phone: e.target.value })} inputMode="tel" maxLength={20} />
              </label>
              <button className={primary} disabled={busy === 'prof'} onClick={() => run('prof', async () => {
                const { error } = await supabase.auth.updateUser({ data: { full_name: profile.name.trim(), phone: profile.phone.trim() } });
                if (error) throw new Error('Não foi possível salvar o perfil.');
                setSaved(true); setTimeout(() => setSaved(false), 3000);
              })}>{busy === 'prof' ? 'Salvando...' : saved ? 'Perfil salvo' : 'Salvar perfil'}</button>
            </div>
            <div className={`${card} p-6 space-y-4`}>
              <h3 className="font-extrabold text-lg">Privacidade (LGPD)</h3>
              {hub?.scoped
                ? <p className="text-sm text-slate-600">Entre com o código do seu e-mail para baixar ou excluir seus dados.</p>
                : <>
                    <div className="flex gap-3 flex-wrap">
                      <button className={primary} disabled={busy === 'exp'} onClick={exportData}><Download size={14} /> Baixar meus dados</button>
                      <button className="inline-flex items-center gap-2 px-5 py-3 rounded-full border border-red-300 text-red-600 text-sm font-bold disabled:opacity-50" disabled={busy === 'del'} onClick={deleteData}><Trash2 size={14} /> Excluir meus dados</button>
                    </div>
                    <p className="text-xs text-slate-500">Para excluir, cancele antes as assinaturas ativas.</p>
                  </>}
            </div>
          </div>
        )}
        </>}
      </main>
    </div>
    </div>
  );
}
