import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Crown, Users, ExternalLink, Download, Trash2, XCircle, Lock, Clock, Home, LayoutGrid, Wallet, HelpCircle, Settings, CreditCard, Gem, Plus, MessageSquare, Box } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { payApi, brl, MyPayments, Hub, HubProject } from '../lib/pay';
import { EmailGate, STATUS_LABEL } from './PaymentsPanel';
import { CeoCenter, CeoSection } from './CeoCenter';

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

// Area do cliente: produtos liberados, financeiro, chamados e direitos LGPD. Tudo vem filtrado pelo e-mail logado no servidor.
export function AccountPanel({ initialProduct }: { initialProduct?: string }) {
  const [state, setState] = useState<'loading' | 'gate' | 'ready'>('loading');
  const [data, setData] = useState<MyPayments | null>(null);
  const [hub, setHub] = useState<Hub | null>(null);
  const [selected, setSelected] = useState<string | null>(initialProduct ?? null);
  const [section, setSection] = useState<Section>(initialProduct ? 'produtos' : 'inicio');
  const [doc, setDoc] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [ceo, setCeo] = useState(false);
  const [ceoSection, setCeoSection] = useState<CeoSection>('geral');

  const load = useCallback(async () => {
    try {
      const h = await payApi.hub();          // login completo OU link assinado do projeto
      setHub(h);
      if (!h.scoped) payApi.me().then(m => setIsAdmin(m.isAdmin)).catch(() => {});   // visao CEO so para admin (o servidor valida de novo)
      setData(h.scoped ? null : await payApi.myPayments());   // faturas/LGPD so com login completo
      setErr(''); setState('ready');
    } catch (e: any) {
      if (/login|sessao|expirado/i.test(e.message)) setState('gate');
      else { setErr(e.message); setState('ready'); }
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const run = async (key: string, fn: () => Promise<void>) => {
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
  const nome = email.split('@')[0] || 'cliente';

  // Fatura atual: assinatura aguardando pagamento, ou cobranca em aberto/vencida.
  const current = useMemo(() => {
    const pend = subs.find(s => s.status === 'PENDING' && s.invoice_url);
    if (pend) return { cents: pend.price_cents, url: pend.invoice_url, due: null as string | null, product: pend.product_slug };
    const open = invoices.find(i => (i.event === 'PAYMENT_CREATED' || i.event === 'PAYMENT_OVERDUE') && i.url);
    return open ? { cents: open.amountCents, url: open.url, due: open.dueDate, product: open.product } : null;
  }, [subs, invoices]);
  const nextCharge = subs.filter(s => s.status === 'ACTIVE' && s.current_period_end).map(s => s.current_period_end as string).sort()[0];

  if (state === 'loading') return <div className="flex justify-center py-24"><Loader2 className="animate-spin text-[#6d28d9]" size={44} /></div>;
  if (state === 'gate') return <EmailGate onDone={load} />;

  const productCard = (p: HubProject) => {
    const b = BADGE[p.state];
    const isReleased = RELEASED.includes(p.state);
    const needsPay = p.tier === 'paid' && p.state !== 'ACTIVE';
    return (
      <div key={p.slug} className={`${card} p-5 flex flex-col gap-3 ${selected === p.slug ? 'ring-2 ring-[#6d28d9]' : ''}`}>
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-full bg-[#ede9fe] text-[#6d28d9] grid place-items-center shrink-0"><Box size={18} /></span>
          <h4 className="font-extrabold text-lg leading-tight">{p.name}</h4>
        </div>
        <p className="text-sm text-slate-600 leading-snug">{p.description}</p>
        {p.state === 'TRIAL' && <p className="text-xs font-bold text-amber-700 inline-flex items-center gap-1.5"><Clock size={13} /> {p.daysLeft} dia(s) de teste · acesso completo</p>}
        {p.state === 'EXPIRED' && <p className="text-xs font-bold text-red-600 inline-flex items-center gap-1.5"><Lock size={13} /> Dados salvos. Assine para voltar a criar.</p>}
        {p.state === 'GRACE' && <p className="text-xs font-bold text-red-600">Regularize até {dt(p.currentPeriodEnd)}.</p>}
        {p.state === 'ACTIVE' && <p className="text-xs text-slate-500">Acesso até {dt(p.currentPeriodEnd)}</p>}
        {!isReleased && p.tier === 'paid' && <p className="text-sm font-bold">A partir de {brl(p.price_cents)}<span className="text-slate-500 font-medium"> /{p.cycle === 'YEARLY' ? 'ano' : 'mês'}</span></p>}
        {!isReleased && p.state === 'NONE' && p.trial_days > 0 && !p.checkout_url && <p className="text-xs text-slate-500">{p.trial_days} dias grátis ao entrar no projeto</p>}
        <div className="mt-auto flex items-center justify-between gap-2 flex-wrap pt-1">
          <span className={`text-xs font-bold px-3 py-1 rounded-full ${b.cls}`}>{b.label}</span>
          {p.access !== 'none' && <a href={p.app_url} className="text-[#6d28d9] font-bold text-sm inline-flex items-center gap-1.5 hover:underline">Abrir <ExternalLink size={14} /></a>}
        </div>
        {needsPay && (p.checkout_url
          ? <a className={primary} href={p.checkout_url}>Contratar</a>
          : selected === p.slug
            ? <div className="flex flex-col gap-2">
                <input className={field} inputMode="numeric" placeholder="CPF ou CNPJ (só números)" value={doc} onChange={e => setDoc(e.target.value)} />
                <button className={primary} disabled={busy === 'k' + p.slug} onClick={() => checkout(p.slug)}>{busy === 'k' + p.slug ? 'Gerando...' : 'Ir para o pagamento'}</button>
              </div>
            : <button className={primary} onClick={() => { setSelected(p.slug); setErr(''); }}>{p.state === 'TRIAL' ? 'Assinar agora' : 'Contratar'}</button>)}
      </div>
    );
  };

  const grid = (list: HubProject[]) => <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">{list.map(productCard)}</div>;

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
    {isAdmin && (
      <div className="inline-flex rounded-full bg-white/10 p-1 text-sm font-bold">
        <button onClick={() => setCeo(false)} className={`px-5 py-2 rounded-full ${!ceo ? 'bg-white text-[#1c0b3d]' : 'text-white/70'}`}>Visão do cliente</button>
        <button onClick={() => setCeo(true)} className={`px-5 py-2 rounded-full inline-flex items-center gap-2 ${ceo ? 'bg-white text-[#1c0b3d]' : 'text-white/70'}`}><Crown size={14} /> Visão CEO</button>
      </div>
    )}
    <div className="rounded-[2rem] overflow-hidden bg-[#1c0b3d] grid md:grid-cols-[230px_1fr] min-h-[640px] text-white">
      <aside className="bg-white text-[#1c0b3d] p-4 flex md:flex-col gap-1 overflow-x-auto md:overflow-visible">
        <div className="hidden md:block text-3xl font-black text-[#6d28d9] px-3 py-4">WayIA</div>
        {(ceo ? CEO_NAV : NAV).map(n => (
          <button key={n.id} onClick={() => ceo ? setCeoSection(n.id as CeoSection) : setSection(n.id as Section)}
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold whitespace-nowrap text-left transition-colors ${(ceo ? ceoSection : section) === n.id ? 'bg-[#ede9fe] text-[#4c1d95]' : 'text-slate-600 hover:bg-slate-50'}`}>
            <n.icon size={18} /> {n.label}
          </button>
        ))}
        <div className="hidden md:flex mt-auto items-center gap-3 rounded-2xl bg-[#f5f3ff] p-3">
          <span className="w-10 h-10 rounded-full bg-[#6d28d9] text-white grid place-items-center font-black text-sm">{nome.slice(0, 2).toUpperCase()}</span>
          <div className="min-w-0"><p className="font-bold text-sm truncate">{nome}</p><p className="text-xs text-slate-500 truncate">{email}</p></div>
        </div>
      </aside>

      <main className="p-5 md:p-8 min-w-0 space-y-6">
        {err && <div className="rounded-2xl bg-red-100 text-red-700 px-5 py-3 text-sm font-bold">{err}</div>}

        {ceo && isAdmin && <CeoCenter section={ceoSection} />}
        {!ceo && <>

        {section === 'inicio' && (
          <div className="grid xl:grid-cols-[1fr_340px] gap-6">
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
              {released.length > 0 && grid(released)}
              {projects.length > released.length && (
                <>
                  <p className="text-right text-xs text-white/50">Libera na hora após o pagamento</p>
                  {grid(projects.filter(p => !RELEASED.includes(p.state)))}
                </>
              )}
            </div>
            <div className="space-y-6 min-w-0">{financeCard}{supportCard}</div>
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
