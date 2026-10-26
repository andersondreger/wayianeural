import React, { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { payApi, brl } from '../lib/pay';

// Visao CEO do Marketplace da Bela 360. Tudo passa pelo payments-api (/admin/marketplace/*),
// que valida o admin e fala com a API do bela360. Dinheiro em centavos; comissao em pontos-base.

type Status = 'ATIVO' | 'EM_NEGOCIACAO' | 'PAUSADO';
interface Dist { id: string; name: string; contact: string | null; commissionBp: number; payDays: number; status: Status; asaasWalletId: string | null; _count?: { products: number } }
interface Prod { id: string; name: string; category: string; priceCents: number; active: boolean; distributorId: string; distributor: { id: string; name: string } }
interface Fin {
  totals: { grossCents: number; toDistributorsCents: number; commissionCents: number; feeCents: number; netCommissionCents: number; cashbackCents: number; netRevenueCents: number; cashbackReserveCents: number; orders: number; refunded: number };
  byDistributor: { id: string; name: string; orders: number; grossCents: number; toDistributorCents: number; commissionCents: number }[];
  orders: { id: string; number: number; status: string; splitStatus: string; business: string; distributor: string; paidCents: number; toDistributorCents: number; commissionCents: number; feeCents: number; cashbackCents: number; netRevenueCents: number }[];
}
interface RefundReq { id: string; orderId: string; source: string; gatewayRefunded: boolean; reason: string | null; requestedBy: string; order: { number: number; paidCents: number; cashbackCents: number; business: { name: string } } | null }
interface Rules { cashbackSharePct: number; walletLimitPct: number; returnDays: number; feeBp: number }
interface Client { id: string; name: string; orders: number; purchasedCents: number; wallet: { availableCents: number; pendingCents: number; usedCents: number } }

const CATS = [['CABELO', 'Cabelo'], ['ESTETICA_FACIAL', 'Estética facial'], ['CORPORAL', 'Corporal'], ['DESCARTAVEIS', 'Descartáveis'], ['EQUIPAMENTOS', 'Equipamentos']];
const STATUS_LABEL: Record<Status, string> = { ATIVO: 'Ativo', EM_NEGOCIACAO: 'Em negociação', PAUSADO: 'Pausado' };
const ORDER_LABEL: Record<string, string> = { RECEBIDO: 'Recebido', PAGO: 'Pago', ENVIADO: 'Enviado', ENTREGUE: 'Entregue', CASHBACK_LIBERADO: 'Cashback liberado', ESTORNADO: 'Estornado' };
const SPLIT_LABEL: Record<string, string> = { AGUARDANDO: 'Aguardando', LIQUIDADO: 'Liquidado', ESTORNADO: 'Estornado' };
const card = 'bg-white text-[#1c0b3d] rounded-3xl';
const field = 'w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-[#1c0b3d] outline-none focus:border-[#6d28d9]';
const primary = 'inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-[#6d28d9] hover:bg-[#5b21b6] text-white text-sm font-bold disabled:opacity-50';
const ghost = 'px-4 py-2 rounded-full bg-[#ede9fe] text-[#4c1d95] text-xs font-bold disabled:opacity-40';
const pct = (bp: number) => `${(bp / 100).toString().replace('.', ',')}%`;
const toCents = (v: string) => Math.round(Number(v.replace(/\./g, '').replace(',', '.')) * 100);

const Kpi = ({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'good' | 'warn' }) => (
  <div className={`${card} p-5`}>
    <p className="text-sm text-slate-500">{label}</p>
    <p className={`text-2xl font-black tracking-tight mt-1 ${tone === 'good' ? 'text-emerald-600' : tone === 'warn' ? 'text-amber-600' : ''}`}>{value}</p>
    {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
  </div>
);

// Dados de exemplo do modo demonstrativo (sem login): so leitura, nada vai ao servidor.
const DEMO_DISTS: Dist[] = [
  { id: 'd1', name: 'Distribuidora Cabelo Pro', contact: 'vendas@exemplo.com', commissionBp: 1200, payDays: 30, status: 'ATIVO', asaasWalletId: 'demo', _count: { products: 3 } },
  { id: 'd2', name: 'Estética Facial Brasil', contact: 'contato@exemplo.com', commissionBp: 1000, payDays: 15, status: 'ATIVO', asaasWalletId: 'demo', _count: { products: 3 } },
  { id: 'd3', name: 'Descartáveis & Equipamentos SP', contact: null, commissionBp: 800, payDays: 30, status: 'EM_NEGOCIACAO', asaasWalletId: null, _count: { products: 2 } },
];
const DEMO_DATA: Record<string, unknown> = {
  finance: {
    totals: { grossCents: 32880, toDistributorsCents: 29232, commissionCents: 3648, feeCents: 986, netCommissionCents: 2662, cashbackCents: 1824, netRevenueCents: 838, cashbackReserveCents: 1824, orders: 2, refunded: 0 },
    byDistributor: [
      { id: 'd1', name: 'Distribuidora Cabelo Pro', orders: 1, grossCents: 17980, toDistributorCents: 15822, commissionCents: 2158 },
      { id: 'd2', name: 'Estética Facial Brasil', orders: 1, grossCents: 14900, toDistributorCents: 13410, commissionCents: 1490 },
    ],
    orders: [
      { id: 'o2', number: 2, status: 'ENTREGUE', splitStatus: 'LIQUIDADO', business: 'Clínica Exemplo', distributor: 'Estética Facial Brasil', paidCents: 14900, toDistributorCents: 13410, commissionCents: 1490, feeCents: 447, cashbackCents: 745, netRevenueCents: 298 },
      { id: 'o1', number: 1, status: 'ENTREGUE', splitStatus: 'LIQUIDADO', business: 'Clínica Exemplo', distributor: 'Distribuidora Cabelo Pro', paidCents: 17980, toDistributorCents: 15822, commissionCents: 2158, feeCents: 539, cashbackCents: 1079, netRevenueCents: 540 },
    ],
  },
  clients: [{ id: 'c1', name: 'Clínica Exemplo', orders: 2, purchasedCents: 32880, wallet: { availableCents: 0, pendingCents: 1824, usedCents: 0 } }],
  distributors: DEMO_DISTS,
  products: [
    { id: 'p1', name: 'Shampoo Profissional 1L', category: 'CABELO', priceCents: 8990, active: true, distributorId: 'd1', distributor: { id: 'd1', name: 'Distribuidora Cabelo Pro' } },
    { id: 'p2', name: 'Sérum Vitamina C 30ml', category: 'ESTETICA_FACIAL', priceCents: 14900, active: true, distributorId: 'd2', distributor: { id: 'd2', name: 'Estética Facial Brasil' } },
  ],
  config: { cashbackSharePct: 50, walletLimitPct: 30, returnDays: 7, feeBp: 300 },
  'refund-requests?status=PENDENTE': [],
  messages: { mode: 'simulado', whatsappConfigured: false, emailConfigured: false, counts: {}, templates: [], recent: [] },
};

function useLoad<T>(path: string, demo?: boolean) {
  const [data, setData] = useState<T | null>((demo ? (DEMO_DATA[path] as T) : null) ?? null);
  const [err, setErr] = useState('');
  const load = useCallback(() => {
    if (demo) return;
    payApi.mk.get<T>(path).then(d => { setData(d); setErr(''); }).catch(e => setErr((e as Error).message));
  }, [path, demo]);
  useEffect(load, [load]);
  return { data, err, load };
}

const Wait = ({ err }: { err: string }) => err
  ? <div className="rounded-2xl bg-red-100 text-red-700 px-5 py-3 text-sm font-bold">{err}</div>
  : <div className="flex justify-center py-16"><Loader2 className="animate-spin text-white" size={36} /></div>;

function Resumo({ demo }: { demo?: boolean }) {
  const { data: f, err } = useLoad<Fin>('finance', demo);
  const clients = useLoad<Client[]>('clients', demo);
  if (!f) return <Wait err={err} />;
  const t = f.totals;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Vendas brutas" value={brl(t.grossCents)} hint={`${t.orders} pedidos · ${t.refunded} estornados`} />
        <Kpi label="Repassado aos distribuidores" value={brl(t.toDistributorsCents)} />
        <Kpi label="Comissão bruta" value={brl(t.commissionCents)} />
        <Kpi label="Taxas de pagamento (estim.)" value={brl(t.feeCents)} />
        <Kpi label="Comissão líquida" value={brl(t.netCommissionCents)} />
        <Kpi label="Cashback dos clientes" value={brl(t.cashbackCents)} />
        <Kpi label="Receita líquida" value={brl(t.netRevenueCents)} tone="good" />
        <Kpi label="Reserva de cashback" value={brl(t.cashbackReserveCents)} tone="warn" hint="a liberar: não é receita" />
      </div>
      <div className={`${card} p-5 overflow-x-auto`}>
        <h4 className="font-extrabold mb-3">Por distribuidor</h4>
        {f.byDistributor.length === 0 ? <p className="text-sm text-slate-500">Nenhuma venda ainda.</p> : (
          <table className="w-full text-sm text-left"><thead className="text-xs text-slate-500"><tr><th className="py-2">Distribuidor</th><th>Pedidos</th><th className="text-right">Vendas</th><th className="text-right">Repasse</th><th className="text-right">Comissão</th></tr></thead>
            <tbody>{f.byDistributor.map(d => <tr key={d.id} className="border-t border-slate-100"><td className="py-2 font-bold">{d.name}</td><td>{d.orders}</td><td className="text-right">{brl(d.grossCents)}</td><td className="text-right">{brl(d.toDistributorCents)}</td><td className="text-right">{brl(d.commissionCents)}</td></tr>)}</tbody></table>
        )}
      </div>
      <div className={`${card} p-5 overflow-x-auto`}>
        <h4 className="font-extrabold mb-3">Clientes do marketplace</h4>
        {!clients.data?.length ? <p className="text-sm text-slate-500">Nenhum cliente comprou ainda.</p> : (
          <table className="w-full text-sm text-left"><thead className="text-xs text-slate-500"><tr><th className="py-2">Clínica / salão</th><th>Pedidos</th><th className="text-right">Comprou</th><th className="text-right">Cashback disp.</th><th className="text-right">A liberar</th></tr></thead>
            <tbody>{clients.data.map(c => <tr key={c.id} className="border-t border-slate-100"><td className="py-2 font-bold">{c.name}</td><td>{c.orders}</td><td className="text-right">{brl(c.purchasedCents)}</td><td className="text-right">{brl(c.wallet.availableCents)}</td><td className="text-right">{brl(c.wallet.pendingCents)}</td></tr>)}</tbody></table>
        )}
      </div>
    </div>
  );
}

function Pedidos({ demo }: { demo?: boolean }) {
  const { data: f, err, load } = useLoad<Fin>('finance', demo);
  const reqs = useLoad<RefundReq[]>('refund-requests?status=PENDENTE', demo);
  const reloadReq = reqs.load;
  const [msg, setMsg] = useState('');
  const decide = async (r: RefundReq, decision: 'APROVAR' | 'REJEITAR') => {
    const txt = decision === 'APROVAR'
      ? `Aprovar o estorno do pedido #${r.order?.number}? ${r.gatewayRefunded ? 'O dinheiro já foi devolvido pelo gateway.' : 'O dinheiro será devolvido no gateway.'} O cashback já liberado (${brl(r.order?.cashbackCents ?? 0)}) será revertido do saldo do cliente.`
      : `Rejeitar o estorno do pedido #${r.order?.number}? O pedido e o cashback ficam como estão.`;
    if (!window.confirm(txt)) return;
    try { await payApi.mk.send('POST', `refund-requests/${r.id}/decide`, { decision }); setMsg(decision === 'APROVAR' ? 'Estorno aprovado.' : 'Estorno rejeitado.'); reqs.load(); load(); }
    catch (e) { setMsg((e as Error).message); }
  };
  const act = async (id: string, kind: 'ENVIADO' | 'ENTREGUE' | 'refund') => {
    if (kind === 'refund' && !window.confirm('Estornar este pedido? O split é desfeito, o cashback a liberar é cancelado e o saldo usado volta ao cliente. Se o cashback já foi liberado, o estorno vai para aprovação.')) return;
    try {
      if (kind === 'refund') {
        const r = await payApi.mk.send<{ pendingApproval?: boolean }>('POST', `orders/${id}/refund`, {});
        setMsg(r?.pendingApproval ? 'Cashback já liberado: o estorno ficou aguardando sua aprovação (veja o quadro abaixo).' : 'Estornado.');
        reloadReq();
      } else { await payApi.mk.send('POST', `orders/${id}/advance`, { to: kind }); setMsg('Atualizado.'); }
      load();
    } catch (e) { setMsg((e as Error).message); }
  };
  if (!f) return <Wait err={err} />;
  return (
    <div className="space-y-3">
      {msg && <div role="status" className="rounded-2xl bg-white/10 px-5 py-3 text-sm font-bold">{msg}</div>}
      {!!reqs.data?.length && (
        <div className={`${card} p-5 space-y-3 border-2 border-amber-400`}>
          <p className="font-black">Estornos aguardando sua aprovação</p>
          {reqs.data.map(r => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-amber-50 p-3 text-sm">
              <div><b>Pedido #{r.order?.number} · {r.order?.business.name}</b><p className="text-slate-600">{brl(r.order?.paidCents ?? 0)} pagos · cashback liberado {brl(r.order?.cashbackCents ?? 0)} · {r.source === 'GATEWAY' ? 'o gateway já devolveu o dinheiro' : 'pedido por ' + r.requestedBy}{r.reason ? ` · ${r.reason}` : ''}</p></div>
              <div className="flex gap-2"><button className={primary} onClick={() => decide(r, 'APROVAR')}>Aprovar</button><button className={ghost} onClick={() => decide(r, 'REJEITAR')}>Rejeitar</button></div>
            </div>))}
        </div>)}
      {f.orders.length === 0 && <div className={`${card} p-6 text-sm text-slate-500`}>Nenhum pedido ainda.</div>}
      {f.orders.map(o => (
        <div key={o.id} className={`${card} p-5 space-y-3`}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div><p className="font-extrabold">Pedido #{o.number} · {o.business}</p><p className="text-sm text-slate-500">{o.distributor}</p></div>
            <div className="flex gap-2"><span className="text-xs font-bold px-3 py-1 rounded-full bg-[#ede9fe] text-[#4c1d95]">{ORDER_LABEL[o.status] ?? o.status}</span>
              <span className={`text-xs font-bold px-3 py-1 rounded-full ${o.splitStatus === 'LIQUIDADO' ? 'bg-emerald-100 text-emerald-800' : o.splitStatus === 'ESTORNADO' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}>Split {SPLIT_LABEL[o.splitStatus]}</span></div>
          </div>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-sm">
            {([['Pago', o.paidCents], ['Repasse', o.toDistributorCents], ['Comissão', o.commissionCents], ['Taxa', o.feeCents], ['Cashback', o.cashbackCents], ['Receita', o.netRevenueCents]] as const).map(([l, v]) => (
              <div key={l}><p className="text-xs text-slate-500">{l}</p><p className="font-black">{brl(v)}</p></div>))}
          </div>
          <div className="flex gap-2 flex-wrap">
            <button className={ghost} disabled={o.status !== 'PAGO'} onClick={() => act(o.id, 'ENVIADO')}>Marcar enviado</button>
            <button className={ghost} disabled={o.status !== 'ENVIADO'} onClick={() => act(o.id, 'ENTREGUE')}>Marcar entregue</button>
            <button className={`${ghost} !bg-red-50 !text-red-700`} disabled={o.status === 'ESTORNADO'} onClick={() => act(o.id, 'refund')}>Estornar</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function Distribuidores({ demo }: { demo?: boolean }) {
  const { data, err, load } = useLoad<Dist[]>('distributors', demo);
  const blank = { id: '', name: '', contact: '', commission: '12', payDays: '30', status: 'EM_NEGOCIACAO' as Status, wallet: '' };
  const [f, setF] = useState(blank);
  const [msg, setMsg] = useState('');
  const set = (k: keyof typeof blank, v: string) => setF(p => ({ ...p, [k]: v }));
  const edit = (d: Dist) => setF({ id: d.id, name: d.name, contact: d.contact ?? '', commission: String(d.commissionBp / 100).replace('.', ','), payDays: String(d.payDays), status: d.status, wallet: d.asaasWalletId ?? '' });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = { name: f.name, contact: f.contact || null, commissionBp: Math.round(Number(f.commission.replace(',', '.')) * 100), payDays: parseInt(f.payDays, 10) || 0, status: f.status, asaasWalletId: f.wallet.trim() || null };
    try { await payApi.mk.send(f.id ? 'PUT' : 'POST', f.id ? `distributors/${f.id}` : 'distributors', body); setF(blank); setMsg('Salvo.'); load(); }
    catch (er) { setMsg((er as Error).message); }
  };
  if (!data) return <Wait err={err} />;
  return (
    <div className="space-y-5">
      <form onSubmit={submit} className={`${card} p-5 space-y-3`}>
        <h4 className="font-extrabold">{f.id ? 'Editar distribuidor' : 'Novo distribuidor'}</h4>
        <div className="grid md:grid-cols-2 gap-3">
          <input className={field} placeholder="Nome" value={f.name} onChange={e => set('name', e.target.value)} required />
          <input className={field} placeholder="Contato (e-mail ou WhatsApp)" value={f.contact} onChange={e => set('contact', e.target.value)} />
          <input className={field} placeholder="Comissão % (ex.: 12)" inputMode="decimal" value={f.commission} onChange={e => set('commission', e.target.value)} required />
          <input className={field} placeholder="Prazo de pagamento (dias)" inputMode="numeric" value={f.payDays} onChange={e => set('payDays', e.target.value)} />
          <select className={field} value={f.status} onChange={e => set('status', e.target.value)}>{(Object.keys(STATUS_LABEL) as Status[]).map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select>
          <input className={field} placeholder="walletId do Asaas" value={f.wallet} onChange={e => set('wallet', e.target.value)} />
        </div>
        <p className="text-xs text-slate-500">Só aparece no marketplace com status Ativo e walletId preenchido. Combine comissão e prazo por escrito antes de ativar.</p>
        {msg && <p className="text-sm font-bold text-[#6d28d9]">{msg}</p>}
        <div className="flex gap-2"><button className={primary}>{f.id ? 'Salvar' : 'Cadastrar'}</button>{f.id && <button type="button" className={ghost} onClick={() => setF(blank)}>Cancelar</button>}</div>
      </form>
      {data.map(d => (
        <div key={d.id} className={`${card} p-5 flex flex-wrap items-center justify-between gap-3`}>
          <div><p className="font-extrabold">{d.name}</p><p className="text-sm text-slate-500">{d.contact || 'Sem contato'} · comissão {pct(d.commissionBp)} · {d.payDays} dias · {d._count?.products ?? 0} produtos</p></div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold px-3 py-1 rounded-full ${d.status === 'ATIVO' && d.asaasWalletId ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{STATUS_LABEL[d.status]}{!d.asaasWalletId ? ' · sem walletId' : ''}</span>
            <button className={ghost} onClick={() => edit(d)}>Editar</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function Produtos({ demo }: { demo?: boolean }) {
  const prods = useLoad<Prod[]>('products', demo);
  const dists = useLoad<Dist[]>('distributors', demo);
  const [f, setF] = useState({ distributorId: '', name: '', category: 'CABELO', price: '' });
  const [msg, setMsg] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await payApi.mk.send('POST', 'products', { distributorId: f.distributorId, name: f.name, category: f.category, priceCents: toCents(f.price) }); setF({ ...f, name: '', price: '' }); setMsg('Produto cadastrado.'); prods.load(); }
    catch (er) { setMsg((er as Error).message); }
  };
  const toggle = async (p: Prod) => {
    try { await payApi.mk.send('PUT', `products/${p.id}`, { distributorId: p.distributorId, name: p.name, category: p.category, priceCents: p.priceCents, active: !p.active }); prods.load(); }
    catch (er) { setMsg((er as Error).message); }
  };
  if (!prods.data || !dists.data) return <Wait err={prods.err || dists.err} />;
  return (
    <div className="space-y-5">
      <form onSubmit={submit} className={`${card} p-5 space-y-3`}>
        <h4 className="font-extrabold">Novo produto</h4>
        <div className="grid md:grid-cols-2 gap-3">
          <select className={field} value={f.distributorId} onChange={e => setF({ ...f, distributorId: e.target.value })} required><option value="">Distribuidor…</option>{dists.data.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
          <select className={field} value={f.category} onChange={e => setF({ ...f, category: e.target.value })}>{CATS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <input className={field} placeholder="Nome do produto" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} required />
          <input className={field} placeholder="Preço em R$ (ex.: 189,90)" inputMode="decimal" value={f.price} onChange={e => setF({ ...f, price: e.target.value })} required />
        </div>
        {msg && <p className="text-sm font-bold text-[#6d28d9]">{msg}</p>}
        <button className={primary}>Cadastrar produto</button>
      </form>
      {prods.data.map(p => (
        <div key={p.id} className={`${card} p-4 flex flex-wrap items-center justify-between gap-3 ${p.active ? '' : 'opacity-60'}`}>
          <div><p className="font-bold">{p.name}</p><p className="text-sm text-slate-500">{p.distributor.name} · {CATS.find(c => c[0] === p.category)?.[1]} · {brl(p.priceCents)}</p></div>
          <button className={ghost} onClick={() => toggle(p)}>{p.active ? 'Pausar' : 'Reativar'}</button>
        </div>
      ))}
    </div>
  );
}

function Regras({ demo }: { demo?: boolean }) {
  const { data, err, load } = useLoad<Rules>('config', demo);
  const [f, setF] = useState<Record<keyof Rules, string> | null>(null);
  const [msg, setMsg] = useState('');
  useEffect(() => { if (data) setF({ cashbackSharePct: String(data.cashbackSharePct), walletLimitPct: String(data.walletLimitPct), returnDays: String(data.returnDays), feeBp: String(data.feeBp / 100).replace('.', ',') }); }, [data]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!f) return;
    try {
      await payApi.mk.send('PUT', 'config', { cashbackSharePct: parseInt(f.cashbackSharePct, 10), walletLimitPct: parseInt(f.walletLimitPct, 10), returnDays: parseInt(f.returnDays, 10), feeBp: Math.round(Number(f.feeBp.replace(',', '.')) * 100) });
      setMsg('Regras salvas. Valem para os próximos pedidos; pedidos antigos mantêm o cashback combinado.'); load();
    } catch (er) { setMsg((er as Error).message); }
  };
  if (!f) return <Wait err={err} />;
  const row = (k: keyof Rules, label: string) => (
    <label className="block text-sm font-bold">{label}<input className={`${field} mt-1`} inputMode="decimal" value={f[k]} onChange={e => setF({ ...f, [k]: e.target.value })} required /></label>);
  return (
    <form onSubmit={submit} className={`${card} p-5 space-y-3 max-w-xl`}>
      <h4 className="font-extrabold">Regras do cashback (valem para todos os clientes)</h4>
      {row('cashbackSharePct', '% da comissão que vira cashback (padrão 50)')}
      {row('walletLimitPct', 'Limite do saldo por pedido, em % (padrão 30)')}
      {row('returnDays', 'Prazo de devolução, em dias (padrão 7)')}
      {row('feeBp', 'Taxa estimada do meio de pagamento, em % (ex.: 3)')}
      {msg && <p className="text-sm font-bold text-[#6d28d9]">{msg}</p>}
      <button className={primary}>Salvar regras</button>
    </form>
  );
}

interface MsgView {
  mode: string; whatsappConfigured: boolean; emailConfigured: boolean; counts: Record<string, number>;
  templates: { type: string; channel: string; audience: string; body: string; waTemplateName: string; active: boolean; customized: boolean }[];
  recent: { id: string; orderId: string; type: string; channel: string; audience: string; status: string; error: string | null; createdAt: string }[];
}
const MSG_LABEL: Record<string, string> = { PEDIDO_PAGO: 'Pagamento confirmado', PEDIDO_ENVIADO: 'Pedido enviado', PEDIDO_ENTREGUE: 'Pedido entregue', CASHBACK_LIBERADO: 'Cashback liberado', PEDIDO_ESTORNADO: 'Pedido estornado', NOVO_PEDIDO: 'Novo pedido (distribuidor)' };

function Mensagens({ demo }: { demo?: boolean }) {
  const { data, err, load } = useLoad<MsgView>('messages', demo);
  const [edit, setEdit] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  if (!data) return <Wait err={err} />;
  const key = (t: { type: string; channel: string }) => `${t.type}:${t.channel}`;
  const save = async (t: MsgView['templates'][number], patch: { body?: string; waTemplateName?: string; active?: boolean }) => {
    try { await payApi.mk.send('PUT', 'messages/templates', { type: t.type, channel: t.channel, ...patch }); setNote('Salvo.'); setEdit(e => { const n = { ...e }; delete n[key(t)]; return n; }); load(); }
    catch (er) { setNote((er as Error).message); }
  };
  const dispatch = async () => { try { const r = await payApi.mk.send<{ sent: number; failed: number }>('POST', 'jobs/dispatch-messages'); setNote(`Fila processada: ${r.sent} enviada(s), ${r.failed} com falha.`); load(); } catch (er) { setNote((er as Error).message); } };
  const modeTxt = data.mode === 'ativo' ? 'Envio real ligado' : data.mode === 'simulado' ? 'Modo simulado (só registra, nada é enviado)' : 'Mensagens desligadas';
  return (
    <div className="space-y-5">
      <div className={`${card} p-5 space-y-2`}>
        <p className="font-black">{modeTxt}</p>
        <p className="text-sm text-slate-600">WhatsApp Cloud API oficial: {data.whatsappConfigured ? 'configurada' : 'não configurada'} · E-mail: {data.emailConfigured ? 'configurado' : 'não configurado'}.
          São avisos transacionais do próprio pedido, no máximo 30 por minuto. O WhatsApp só sai para o cliente que ativou o consentimento; o distribuidor recebe só por e-mail.</p>
        <div className="flex flex-wrap gap-3 text-xs font-bold text-slate-600">{Object.entries(data.counts).map(([s, n]) => <span key={s} className="rounded-full bg-[#ede9fe] px-3 py-1">{s}: {n}</span>)}</div>
        <button className={ghost} onClick={dispatch}>Processar fila agora</button>
        {note && <p className="text-sm font-bold text-[#6d28d9]">{note}</p>}
      </div>
      <div className={`${card} p-5`}>
        <h3 className="font-black mb-1">Textos e templates</h3>
        <p className="text-xs text-slate-500 mb-3">Variáveis: {'{nome} {pedido} {valor} {cashback} {distribuidor}'}. No WhatsApp vale o template aprovado na Meta (nome abaixo); o texto serve de base para cadastrá-lo.</p>
        <div className="space-y-3">{data.templates.map(t => (
          <div key={key(t)} className="rounded-2xl border border-slate-200 p-4 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2"><b>{MSG_LABEL[t.type]} · {t.channel === 'WHATSAPP' ? 'WhatsApp' : 'E-mail'}</b>
              <label className="text-xs font-bold flex items-center gap-2"><input type="checkbox" checked={t.active} onChange={e => save(t, { active: e.target.checked })} />Ativo</label></div>
            <textarea className={field} rows={2} value={edit[key(t)] ?? t.body} onChange={e => setEdit(s => ({ ...s, [key(t)]: e.target.value }))} />
            <div className="flex flex-wrap items-center gap-2">
              {t.channel === 'WHATSAPP' && <span className="text-xs text-slate-500">template Meta: <code>{t.waTemplateName}</code></span>}
              {edit[key(t)] !== undefined && edit[key(t)] !== t.body && <button className={ghost} onClick={() => save(t, { body: edit[key(t)] })}>Salvar texto</button>}
            </div>
          </div>))}</div>
      </div>
      <div className={`${card} p-5`}>
        <h3 className="font-black mb-3">Últimas mensagens</h3>
        <table className="w-full text-sm text-left"><thead className="text-xs text-slate-500"><tr><th className="py-2">Quando</th><th>Tipo</th><th>Canal</th><th>Para</th><th>Status</th></tr></thead>
          <tbody>{data.recent.map(m => <tr key={m.id} className="border-t border-slate-100"><td className="py-2">{new Date(m.createdAt).toLocaleString('pt-BR')}</td><td>{MSG_LABEL[m.type]}</td><td>{m.channel === 'WHATSAPP' ? 'WhatsApp' : 'E-mail'}</td><td>{m.audience === 'CLIENTE' ? 'Cliente' : 'Distribuidor'}</td><td title={m.error ?? ''}>{m.status}{m.error ? ' ⓘ' : ''}</td></tr>)}
            {!data.recent.length && <tr><td colSpan={5} className="py-6 text-center text-slate-500">Nenhuma mensagem ainda.</td></tr>}</tbody></table>
      </div>
    </div>
  );
}

const SUB = [['resumo', 'Resumo'], ['pedidos', 'Pedidos'], ['distribuidores', 'Distribuidores'], ['produtos', 'Produtos'], ['mensagens', 'Mensagens'], ['regras', 'Regras']] as const;

export function MarketplaceCeo({ demo }: { demo?: boolean }) {
  const [tab, setTab] = useState<(typeof SUB)[number][0]>('resumo');
  return (
    <div className="space-y-5">
      {demo && <div className="rounded-2xl bg-amber-100 text-amber-900 px-5 py-3 text-sm font-bold">Demonstrativo: dados de exemplo. Entre com sua conta de admin para operar o Marketplace da Bela 360.</div>}
      <div className="rounded-[1.75rem] bg-[#6d22d8] p-6">
        <p className="text-sm text-white/80">Bela 360 · Marketplace com cashback e split</p>
        <h2 className="text-2xl md:text-3xl font-black mt-1">Distribuidores, pedidos e financeiro da plataforma</h2>
        <a href="https://bela360.wayia.com.br/marketplace" target="_blank" rel="noreferrer" className="text-xs font-bold text-white/80 underline mt-2 inline-block">Ver como o cliente vê</a>
      </div>
      <div className="flex gap-2 overflow-x-auto">{SUB.map(([k, l]) => (
        <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap ${tab === k ? 'bg-white text-[#1c0b3d]' : 'bg-white/10 text-white/80 hover:bg-white/20'}`}>{l}</button>))}</div>
      {tab === 'resumo' && <Resumo demo={demo} />}
      {tab === 'pedidos' && <Pedidos demo={demo} />}
      {tab === 'distribuidores' && <Distribuidores demo={demo} />}
      {tab === 'produtos' && <Produtos demo={demo} />}
      {tab === 'mensagens' && <Mensagens demo={demo} />}
      {tab === 'regras' && <Regras demo={demo} />}
    </div>
  );
}
