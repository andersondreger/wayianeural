import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, ExternalLink, Search, Box } from 'lucide-react';
import { payApi, brl, Overview, OverviewProduct, AccessState, NewProduct } from '../lib/pay';
import { ECOSYSTEM } from '../lib/ecosystem';
import { FinanceDashboard } from './FinanceDashboard';
import { SupportInbox } from './SupportInbox';
import { MarketplaceCeo } from './MarketplaceCeo';
import { DEMO_OVERVIEW, DEMO_FINANCE, DEMO_TICKETS } from '../lib/demo';

export type CeoSection = 'geral' | 'clientes' | 'financeiro' | 'marketplace' | 'suporte';

const STATE_LABEL: Record<AccessState, string> = { FREE: 'Grátis', TRIAL: 'Teste', ACTIVE: 'Ativo', GRACE: 'Em atraso', EXPIRED: 'Expirado', NONE: 'Sem acesso' };
const STATE_TONE: Record<AccessState, string> = {
  FREE: 'bg-sky-100 text-sky-800', TRIAL: 'bg-amber-100 text-amber-800', ACTIVE: 'bg-emerald-100 text-emerald-800',
  GRACE: 'bg-red-100 text-red-700', EXPIRED: 'bg-red-100 text-red-700', NONE: 'bg-slate-100 text-slate-600',
};
const Badge = ({ state }: { state: AccessState }) => <span className={`text-xs font-bold px-3 py-1 rounded-full ${STATE_TONE[state]}`}>{STATE_LABEL[state]}</span>;
const card = 'bg-white text-[#1c0b3d] rounded-3xl';
const primary = 'inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-[#6d28d9] hover:bg-[#5b21b6] text-white text-sm font-bold transition-colors disabled:opacity-50';
const field = 'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-[#1c0b3d] outline-none focus:border-[#6d28d9]';

function Kpi({ label, value, hint, bad }: { label: string; value: string; hint?: string; bad?: boolean }) {
  return (
    <div className={`${card} p-5`}>
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`text-3xl font-black tracking-tight mt-1 ${bad ? 'text-red-600' : ''}`}>{value}</p>
      {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
    </div>
  );
}

const slugify = (v: string) => v.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

function NewProductForm({ onDone, demo }: { onDone: () => void; demo?: boolean }) {
  const [f, setF] = useState({ name: '', slug: '', description: '', price: '', app_url: 'https://', tier: 'paid', trial_days: '11' });
  const [slugTouched, setSlugTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v, ...(k === 'name' && !slugTouched ? { slug: slugify(v) } : {}) }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (demo) { setErr('Demonstrativo: entre com sua conta de admin para cadastrar produtos.'); return; }
    setBusy(true); setErr('');
    try {
      const body: NewProduct = {
        slug: f.slug, name: f.name, description: f.description, app_url: f.app_url, tier: f.tier === 'free' ? 'free' : 'paid',
        price_cents: Math.round(parseFloat(f.price.replace(',', '.')) * 100), trial_days: parseInt(f.trial_days, 10) || 0,
      };
      await payApi.adminCreateProduct(body);
      onDone();
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };

  return (
    <form onSubmit={submit} className={`${card} p-6 space-y-4`}>
      <h3 className="text-xl font-extrabold">Novo produto do ecossistema</h3>
      <div className="grid md:grid-cols-2 gap-3">
        <input className={field} placeholder="Nome (ex.: WayClip)" value={f.name} onChange={e => set('name', e.target.value)} required />
        <input className={field} placeholder="slug (ex.: wayclip)" value={f.slug} onChange={e => { setSlugTouched(true); set('slug', slugify(e.target.value)); }} required />
        <input className={field} placeholder="Preço mensal em R$ (ex.: 149,00)" value={f.price} onChange={e => set('price', e.target.value)} required inputMode="decimal" />
        <input className={field} placeholder="https://endereço-do-app" value={f.app_url} onChange={e => set('app_url', e.target.value)} required />
        <select className={field} value={f.tier} onChange={e => set('tier', e.target.value)}><option value="paid">Pago (com teste)</option><option value="free">Grátis</option></select>
        <input className={field} placeholder="Dias de teste" value={f.trial_days} onChange={e => set('trial_days', e.target.value)} inputMode="numeric" disabled={f.tier === 'free'} />
      </div>
      <input className={field} placeholder="Descrição curta (o cliente vê no card)" value={f.description} onChange={e => set('description', e.target.value)} />
      {err && <p className="text-sm font-bold text-red-600">{err}</p>}
      <div className="flex items-center gap-4 flex-wrap">
        <button disabled={busy} className={primary}>{busy ? 'Salvando...' : 'Cadastrar produto'}</button>
        <p className="text-xs text-slate-500">Aparece na hora no dashboard dos clientes como "Contratar". Cada cliente só acessa o que contratar.</p>
      </div>
    </form>
  );
}

// Visao CEO do /dashboard: todos os produtos do catalogo, quem tem o que, financeiro e suporte.
// Produto novo cadastrado entra sozinho (vem do catalogo no banco, nao de lista fixa no codigo).
export function CeoCenter({ section, demo }: { section: CeoSection; demo?: boolean }) {
  const [o, setO] = useState<Overview | null>(null);
  const [err, setErr] = useState('');
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState('');
  const [price, setPrice] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState('');
  const load = () => demo ? setO(DEMO_OVERVIEW) : payApi.adminOverview().then(setO).catch(e => setErr(e.message));
  useEffect(() => { load(); }, []);

  // Preco novo vale so para novas contratacoes (quem ja assina mantem o valor). Pausar tira o produto do dashboard dos clientes.
  const adjust = async (slug: string, patch: { price_cents?: number; active?: boolean }, confirmText?: string) => {
    if (demo) { setMsg('Demonstrativo: entre com sua conta de admin para alterar preços e vendas.'); return; }
    if (confirmText && !window.confirm(confirmText)) return;
    try { await payApi.adminUpdateProduct(slug, patch); setMsg('Salvo.'); setPrice(p => ({ ...p, [slug]: '' })); await load(); }
    catch (e) { setMsg((e as Error).message); }
  };
  const savePrice = (slug: string) => {
    const reais = Number((price[slug] ?? '').replace(',', '.'));
    if (!Number.isFinite(reais) || reais < 1) { setMsg('Preço inválido.'); return; }
    void adjust(slug, { price_cents: Math.round(reais * 100) });
  };

  const names = useMemo(() => Object.fromEntries((o?.products ?? []).map(p => [p.slug, p.name])), [o]);

  if (section === 'financeiro') return <FinanceDashboard demo={demo ? DEMO_FINANCE : undefined} />;
  if (section === 'marketplace') return <MarketplaceCeo demo={demo} />;
  if (section === 'suporte') return <SupportInbox demo={demo ? DEMO_TICKETS : undefined} />;
  if (err) return <div className="rounded-2xl bg-red-100 text-red-700 px-5 py-3 text-sm font-bold">{err}</div>;
  if (!o) return <div className="flex justify-center py-24"><Loader2 className="animate-spin text-white" size={44} /></div>;

  const inCatalog = new Set(o.products.map(p => p.slug));
  const pipeline = ECOSYSTEM.filter(e => !inCatalog.has(e.slug));
  const mrr = o.products.reduce((a, p) => a + p.mrrCents, 0);
  const overdue = o.products.reduce((a, p) => a + p.counts.GRACE + p.counts.EXPIRED, 0);

  if (section === 'clientes') {
    const customers = o.customers.filter(c => !q || c.email.includes(q.toLowerCase()));
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-3xl font-black">Clientes <span className="text-white/50 text-xl">({customers.length})</span></h2>
          <div className="flex items-center gap-2 bg-white rounded-full px-4 py-2 text-[#1c0b3d]"><Search size={14} className="text-slate-400" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="buscar e-mail" className="bg-transparent text-sm font-semibold outline-none w-48" /></div>
        </div>
        <div className={`${card} p-5 overflow-x-auto`}>
          {customers.length === 0 ? <p className="text-sm text-slate-500">Nenhum cliente ainda. Eles aparecem aqui quando entram em um produto.</p> : (
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-slate-500"><tr><th className="py-2">Cliente</th><th>O que acessa</th><th className="text-right">MRR</th></tr></thead>
              <tbody>{customers.slice(0, 200).map(c => (
                <tr key={c.email} className="border-t border-slate-100 align-top">
                  <td className="py-3 pr-4 font-bold">{c.email}<div className="text-xs font-medium text-slate-500">desde {new Date(c.since).toLocaleDateString('pt-BR')}</div></td>
                  <td className="py-3"><div className="flex flex-wrap gap-x-4 gap-y-2">{c.products.map(p => (
                    <span key={p.slug} className="flex items-center gap-2"><span className="font-bold">{names[p.slug] ?? p.slug}</span><Badge state={p.state} />{p.state === 'TRIAL' && p.daysLeft != null && <span className="text-xs text-slate-500">{p.daysLeft}d</span>}</span>
                  ))}</div></td>
                  <td className="py-3 text-right font-black whitespace-nowrap">{brl(c.mrrCents)}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      </div>
    );
  }

  const productCard = (p: OverviewProduct) => (
    <div key={p.slug} className={`${card} p-5 flex flex-col gap-3 ${p.active ? '' : 'opacity-60'}`}>
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-full bg-[#ede9fe] text-[#6d28d9] grid place-items-center shrink-0"><Box size={18} /></span>
        <h4 className="font-extrabold text-lg leading-tight">{p.name}</h4>
      </div>
      <p className="text-sm font-bold">{p.tier === 'free' ? 'Grátis' : <>{brl(p.price_cents)}<span className="text-slate-500 font-medium"> /{p.cycle === 'YEARLY' ? 'ano' : 'mês'}</span></>}</p>
      <div className="grid grid-cols-3 gap-2">
        <div><p className="text-xs text-slate-500">MRR</p><p className="font-black">{brl(p.mrrCents)}</p></div>
        <div><p className="text-xs text-slate-500">Pagantes</p><p className="font-black">{p.counts.ACTIVE}</p></div>
        <div><p className="text-xs text-slate-500">Em teste</p><p className="font-black">{p.counts.TRIAL}</p></div>
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        {(Object.keys(p.counts) as AccessState[]).filter(s => p.counts[s] > 0 && s !== 'NONE').map(s => <span key={s} className="flex items-center gap-1"><Badge state={s} /><b className="text-sm">{p.counts[s]}</b></span>)}
        {Object.values(p.counts).every(n => n === 0) && <span className="text-xs text-slate-500">Nenhum cliente ainda</span>}
      </div>
      <div className="border-t border-slate-100 pt-3 space-y-2">
        <div className="flex gap-2">
          <input className={`${field} !py-2 !px-3`} placeholder="Novo preço (R$)" inputMode="decimal" value={price[p.slug] ?? ''} onChange={e => setPrice({ ...price, [p.slug]: e.target.value })} />
          <button onClick={() => savePrice(p.slug)} disabled={!price[p.slug]} className="px-4 rounded-xl bg-[#ede9fe] text-[#4c1d95] text-sm font-bold disabled:opacity-40">Salvar</button>
        </div>
        <button onClick={() => adjust(p.slug, { active: !p.active }, p.active ? `Pausar as vendas de ${p.name}? O produto some do dashboard dos clientes.` : undefined)}
          className={`text-xs font-bold ${p.active ? 'text-slate-500 hover:text-red-600' : 'text-emerald-700'}`}>{p.active ? 'Pausar vendas' : 'Vendas pausadas · Reabrir'}</button>
      </div>
      <div className="mt-auto flex items-center justify-between pt-1">
        {p.openTickets > 0 ? <span className="text-xs font-bold px-3 py-1 rounded-full bg-amber-100 text-amber-800">{p.openTickets} chamado(s)</span> : <span />}
        <a href={p.app_url} target="_blank" rel="noreferrer" className="text-[#6d28d9] font-bold text-sm inline-flex items-center gap-1.5 hover:underline">Abrir <ExternalLink size={14} /></a>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="rounded-[1.75rem] bg-[#6d22d8] p-7 grid sm:grid-cols-[1fr_auto] gap-6 items-center">
        <div>
          <p className="text-sm text-white/80">Visão CEO · Ecossistema Way{o.gatewayMode === 'sandbox' ? ' · Asaas sandbox' : ''}</p>
          <h2 className="text-3xl md:text-4xl font-black leading-tight mt-1">{brl(mrr)} de receita recorrente</h2>
          <p className="text-sm text-white/80 mt-3">{o.totals.products} produtos · {o.totals.customers} clientes · {o.totals.trials} em teste</p>
        </div>
        <button onClick={() => setAdding(!adding)} className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-white text-[#6d28d9] text-sm font-bold"><Plus size={16} /> Novo produto</button>
      </div>

      {adding && <NewProductForm onDone={() => { setAdding(false); load(); }} demo={demo} />}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="ARR" value={brl(mrr * 12)} />
        <Kpi label="Clientes" value={String(o.totals.customers)} hint={`${o.totals.trials} em teste`} />
        <Kpi label="Em atraso / expirados" value={String(overdue)} bad={overdue > 0} />
        <Kpi label="Chamados abertos" value={String(o.totals.openTickets)} bad={o.totals.openTickets > 0} />
      </div>

      <h3 className="text-xl font-extrabold">Produtos ({o.products.length})</h3>
      {msg && <div role="status" className="rounded-2xl bg-white/10 px-5 py-3 text-sm font-bold">{msg}</div>}
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">{o.products.map(productCard)}</div>
      {pipeline.length > 0 && <p className="text-xs text-white/50">Preço novo vale só para novas contratações; quem já assina mantém o valor. Em desenvolvimento (fora do catálogo): {pipeline.map(p => p.name).join(' · ')}. Use "Novo produto" quando forem para a venda.</p>}
      <p className="text-xs text-white/40">Atualizado {new Date(o.generatedAt).toLocaleString('pt-BR')}</p>
    </div>
  );
}
