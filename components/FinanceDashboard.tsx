import React, { useEffect, useState } from 'react';
import { Loader2, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import { payApi, brl, Finance } from '../lib/pay';
import { ECOSYSTEM, BILLING_LABEL, EcosystemProject } from '../lib/ecosystem';

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const monthLabel = (k: string) => `${MONTHS[Number(k.slice(5)) - 1]}/${k.slice(2, 4)}`;

const card = 'bg-white text-[#1c0b3d] rounded-3xl';
function Tile({ label, value, hint, tone }: { label: string; value: string; hint?: React.ReactNode; tone?: 'bad' }) {
  return (
    <div className={`${card} p-5`}>
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`text-3xl font-black tracking-tight mt-1 ${tone === 'bad' ? 'text-red-600' : ''}`}>{value}</p>
      {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
    </div>
  );
}

// Uma serie so (recebido por mes), uma cor, sem eixo duplo. Valor no topo da barra, mes embaixo;
// hover mostra o detalhe. A tabela logo abaixo e a versao acessivel dos mesmos numeros.
function RevenueBars({ months }: { months: Finance['months'] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...months.map(m => m.receivedCents), 1);
  const W = 720, H = 220, top = 24, bottom = 28, slot = W / months.length, bar = Math.min(34, slot - 12);
  const h = (v: number) => ((H - top - bottom) * v) / max;
  const hm = hover !== null ? months[hover] : null;
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Receita recebida nos ultimos 12 meses">
        <line x1="0" x2={W} y1={H - bottom} y2={H - bottom} stroke="#e2e8f0" />
        {months.map((m, i) => {
          const x = i * slot + (slot - bar) / 2, bh = Math.max(h(m.receivedCents), m.receivedCents ? 3 : 0);
          return (
            <g key={m.month} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={i * slot} y={0} width={slot} height={H} fill="transparent" />
              <path d={`M${x},${H - bottom} v${-Math.max(bh - 4, 0)} q0,-4 4,-4 h${bar - 8} q4,0 4,4 v${Math.max(bh - 4, 0)} z`}
                fill="#6d28d9" opacity={hover === null || hover === i ? 1 : 0.45} />
              {m.receivedCents > 0 && (i === months.length - 1 || i === hover) && (
                <text x={x + bar / 2} y={H - bottom - bh - 6} textAnchor="middle" fontSize="11" fontWeight="800" fill="#1c0b3d">{brl(m.receivedCents)}</text>
              )}
              <text x={x + bar / 2} y={H - 8} textAnchor="middle" fontSize="10" fill="#64748b">{monthLabel(m.month)}</text>
            </g>
          );
        })}
      </svg>
      {hm && (
        <div className="absolute top-0 right-0 bg-[#1c0b3d] text-white px-4 py-3 rounded-2xl text-xs font-bold pointer-events-none shadow-lg">
          <div className="text-violet-300">{monthLabel(hm.month)}</div>
          <div>Recebido {brl(hm.receivedCents)}</div>
          <div className="text-white/70">Estornos {brl(hm.refundsCents)}</div>
          <div className="text-white/70">Novas {hm.newSubs} · Canceladas {hm.canceled}</div>
        </div>
      )}
    </div>
  );
}

export function FinanceDashboard({ demo }: { demo?: Finance }) {
  const [f, setF] = useState<Finance | null>(null);
  const [err, setErr] = useState('');
  const [table, setTable] = useState(false);
  useEffect(() => { if (demo) setF(demo); else payApi.adminFinance().then(setF).catch(e => setErr(e.message)); }, [demo]);

  if (err) return <div className="rounded-2xl bg-red-100 text-red-700 px-5 py-3 text-sm font-bold">{err}</div>;
  if (!f) return <div className="flex justify-center py-24"><Loader2 className="animate-spin text-white" size={44} /></div>;

  const k = f.kpis;
  const delta = k.receivedPrevMonthCents ? Math.round(((k.receivedThisMonthCents - k.receivedPrevMonthCents) / k.receivedPrevMonthCents) * 100) : null;
  const net = k.receivedThisMonthCents - k.refundsThisMonthCents;
  const stats = Object.fromEntries(f.byProduct.map(p => [p.slug, p]));
  const known = new Set(ECOSYSTEM.map(e => e.slug));
  const extra: EcosystemProject[] = f.byProduct.filter(p => !known.has(p.slug)).map(p => ({ slug: p.slug, name: p.name, billing: 'central' }));
  const cards = [...ECOSYSTEM, ...extra].map(e => ({ ...e, active: stats[e.slug]?.active ?? 0, mrrCents: stats[e.slug]?.mrrCents ?? 0, received12mCents: stats[e.slug]?.received12mCents ?? 0 }));
  const empty = f.months.every(m => m.receivedCents === 0) && k.activeCount === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-3xl font-black">Financeiro do ecossistema</h2>
        {f.gatewayMode === 'sandbox' && <span className="inline-flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full bg-amber-100 text-amber-800"><AlertTriangle size={13} /> Asaas sandbox: valores de teste</span>}
      </div>

      {empty && <p className="text-sm text-white/70">Sem vendas ainda. Os números aparecem aqui assim que o primeiro pagamento for confirmado.</p>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Tile label="MRR (receita recorrente)" value={brl(k.mrrCents)} hint={`ARR ${brl(k.arrCents)}`} />
        <Tile label="Recebido no mês" value={brl(k.receivedThisMonthCents)} hint={delta === null ? 'sem mês anterior' : (
          <span className={`inline-flex items-center gap-1 font-bold ${delta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {delta >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />} {delta >= 0 ? '+' : ''}{delta}% vs mês anterior
          </span>)} />
        <Tile label="Líquido do mês" value={brl(net)} hint={`estornos ${brl(k.refundsThisMonthCents)}`} />
        <Tile label="Ticket médio (ARPU)" value={brl(k.arpuCents)} hint={`${k.activeCount} assinaturas ativas`} />
        <Tile label="A receber" value={brl(k.pendingCents)} hint={`${k.pendingCount} aguardando pagamento`} />
        <Tile label="Em risco (atraso)" value={brl(k.atRiskCents)} hint={`${k.pastDueCount} em atraso`} tone={k.pastDueCount ? 'bad' : undefined} />
        <Tile label="Novas no mês" value={String(k.newThisMonth)} />
        <Tile label="Churn do mês" value={`${k.churnPct}%`} hint={`${k.canceledThisMonth} canceladas`} tone={k.churnPct >= 10 ? 'bad' : undefined} />
      </div>

      <section className={`${card} p-6 space-y-4`}>
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-extrabold">Recebido por mês (12 meses)</h3>
          <button className="text-sm font-bold text-[#6d28d9] hover:underline" onClick={() => setTable(!table)}>{table ? 'Ver gráfico' : 'Ver tabela'}</button>
        </div>
        {table ? (
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-slate-500"><tr><th className="py-2">Mês</th><th>Recebido</th><th>Estornos</th><th>Novas</th><th>Canceladas</th></tr></thead>
            <tbody>{f.months.map(m => (
              <tr key={m.month} className="border-t border-slate-100 font-semibold"><td className="py-2">{monthLabel(m.month)}</td><td>{brl(m.receivedCents)}</td><td>{brl(m.refundsCents)}</td><td>{m.newSubs}</td><td>{m.canceled}</td></tr>
            ))}</tbody>
          </table>
        ) : <RevenueBars months={f.months} />}
      </section>

      <h3 className="text-xl font-extrabold">Receita por projeto ({cards.length})</h3>
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {cards.map(c => (
          <div key={c.slug} className={`${card} p-5 space-y-3 ${c.billing === 'none' ? 'opacity-70' : ''}`}>
            <div className="flex items-start justify-between gap-3">
              <h4 className="font-extrabold text-lg leading-tight">{c.name}</h4>
              <span className={`shrink-0 text-xs font-bold px-3 py-1 rounded-full ${c.billing === 'central' ? 'bg-violet-100 text-violet-800' : c.billing === 'own' ? 'bg-sky-100 text-sky-800' : 'bg-slate-100 text-slate-600'}`}>{BILLING_LABEL[c.billing]}</span>
            </div>
            {c.billing === 'none' && <p className="text-sm text-slate-500">Em desenvolvimento. A cobrança entra quando for integrado.</p>}
            {c.billing === 'own' && !c.active && !c.received12mCents && <p className="text-sm text-slate-500">Cobra pelo Asaas do próprio projeto. A receita aparece aqui quando o projeto passar a reportar.</p>}
            {(c.billing === 'central' || (c.billing === 'own' && (c.active > 0 || c.received12mCents > 0))) && (
              <div className="grid grid-cols-3 gap-2">
                <div><p className="text-xs text-slate-500">MRR</p><p className="font-black">{brl(c.mrrCents)}</p></div>
                <div><p className="text-xs text-slate-500">12 meses</p><p className="font-black">{brl(c.received12mCents)}</p></div>
                <div><p className="text-xs text-slate-500">Ativos</p><p className="font-black">{c.active}</p></div>
              </div>
            )}
            {c.url && <a href={c.url} target="_blank" rel="noreferrer" className="inline-block text-sm font-bold text-[#6d28d9] hover:underline">Abrir projeto</a>}
          </div>
        ))}
      </div>

      {f.overdue.length > 0 && (
        <section className={`${card} p-6 space-y-3 overflow-x-auto`}>
          <h3 className="text-xl font-extrabold text-red-600">Inadimplentes ({f.overdue.length})</h3>
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-slate-500"><tr><th className="py-2">Cliente</th><th>Projeto</th><th>Valor</th><th>Desde</th></tr></thead>
            <tbody>{f.overdue.map((o, i) => (
              <tr key={i} className="border-t border-slate-100 font-semibold"><td className="py-2">{o.email}</td><td className="uppercase">{o.product}</td><td>{brl(o.priceCents)}</td><td>{new Date(o.since).toLocaleDateString('pt-BR')}</td></tr>
            ))}</tbody>
          </table>
        </section>
      )}

      <p className="text-xs text-white/40">Atualizado {new Date(f.generatedAt).toLocaleString('pt-BR')}. Custo por cliente entra quando o consumo (usage) for medido.</p>
    </div>
  );
}
