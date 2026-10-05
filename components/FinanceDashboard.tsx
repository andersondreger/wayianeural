import React, { useEffect, useState } from 'react';
import { Loader2, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import { payApi, brl, Finance } from '../lib/pay';
import { SupportInbox } from './SupportInbox';
import { ECOSYSTEM, BILLING_LABEL, EcosystemProject } from '../lib/ecosystem';

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const monthLabel = (k: string) => `${MONTHS[Number(k.slice(5)) - 1]}/${k.slice(2, 4)}`;

function Tile({ label, value, hint, tone }: { label: string; value: string; hint?: React.ReactNode; tone?: 'bad' }) {
  return (
    <div className="glass p-6 rounded-3xl border-white/5">
      <div className="text-[8px] font-black uppercase tracking-widest text-gray-500">{label}</div>
      <div className={`text-3xl font-black italic mt-2 ${tone === 'bad' ? 'text-red-400' : ''}`}>{value}</div>
      {hint && <div className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mt-2">{hint}</div>}
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
        <line x1="0" x2={W} y1={H - bottom} y2={H - bottom} stroke="rgba(255,255,255,0.12)" />
        {months.map((m, i) => {
          const x = i * slot + (slot - bar) / 2, bh = Math.max(h(m.receivedCents), m.receivedCents ? 3 : 0);
          return (
            <g key={m.month} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={i * slot} y={0} width={slot} height={H} fill="transparent" />
              <path d={`M${x},${H - bottom} v${-Math.max(bh - 4, 0)} q0,-4 4,-4 h${bar - 8} q4,0 4,4 v${Math.max(bh - 4, 0)} z`}
                fill="#f97316" opacity={hover === null || hover === i ? 1 : 0.45} />
              {m.receivedCents > 0 && (i === months.length - 1 || i === hover) && (
                <text x={x + bar / 2} y={H - bottom - bh - 6} textAnchor="middle" fontSize="11" fontWeight="800" fill="#e5e5e5">{brl(m.receivedCents)}</text>
              )}
              <text x={x + bar / 2} y={H - 8} textAnchor="middle" fontSize="10" fill="#9ca3af">{monthLabel(m.month)}</text>
            </g>
          );
        })}
      </svg>
      {hm && (
        <div className="absolute top-0 right-0 glass px-4 py-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest pointer-events-none">
          <div className="text-orange-400">{monthLabel(hm.month)}</div>
          <div>Recebido {brl(hm.receivedCents)}</div>
          <div className="text-gray-400">Estornos {brl(hm.refundsCents)}</div>
          <div className="text-gray-400">Novas {hm.newSubs} · Canceladas {hm.canceled}</div>
        </div>
      )}
    </div>
  );
}

export function FinanceDashboard() {
  const [f, setF] = useState<Finance | null>(null);
  const [err, setErr] = useState('');
  const [table, setTable] = useState(false);
  useEffect(() => { payApi.adminFinance().then(setF).catch(e => setErr(e.message)); }, []);

  if (err) return <div className="px-6 py-4 rounded-2xl bg-red-500/5 border border-red-500/10 text-[10px] font-bold text-red-400 uppercase tracking-widest">{err}</div>;
  if (!f) return <div className="flex justify-center py-24"><Loader2 className="animate-spin text-orange-500" size={44} /></div>;

  const k = f.kpis;
  const delta = k.receivedPrevMonthCents ? Math.round(((k.receivedThisMonthCents - k.receivedPrevMonthCents) / k.receivedPrevMonthCents) * 100) : null;
  const net = k.receivedThisMonthCents - k.refundsThisMonthCents;
  const stats = Object.fromEntries(f.byProduct.map(p => [p.slug, p]));
  const known = new Set(ECOSYSTEM.map(e => e.slug));
  const extra: EcosystemProject[] = f.byProduct.filter(p => !known.has(p.slug)).map(p => ({ slug: p.slug, name: p.name, billing: 'central' }));
  const cards = [...ECOSYSTEM, ...extra].map(e => ({ ...e, active: stats[e.slug]?.active ?? 0, mrrCents: stats[e.slug]?.mrrCents ?? 0, received12mCents: stats[e.slug]?.received12mCents ?? 0 }));
  const empty = f.months.every(m => m.receivedCents === 0) && k.activeCount === 0;

  return (
    <div className="space-y-10">
      <div className="border-b border-white/5 pb-10 flex flex-wrap items-end justify-between gap-4">
        <h2 className="text-5xl font-black uppercase italic tracking-tighter leading-none">Painel <span className="text-orange-500 text-glow">Financeiro.</span></h2>
        {f.gatewayMode === 'sandbox' && (
          <span className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-yellow-400"><AlertTriangle size={12} /> Asaas sandbox: valores de teste</span>
        )}
      </div>

      {empty && <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Sem vendas ainda. Os numeros aparecem aqui assim que o primeiro pagamento for confirmado.</p>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <Tile label="MRR (receita recorrente)" value={brl(k.mrrCents)} hint={`ARR ${brl(k.arrCents)}`} />
        <Tile label="Recebido no mes" value={brl(k.receivedThisMonthCents)} hint={delta === null ? 'sem mes anterior' : (
          <span className={`inline-flex items-center gap-1 ${delta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {delta >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />} {delta >= 0 ? '+' : ''}{delta}% vs mes anterior
          </span>)} />
        <Tile label="Liquido do mes" value={brl(net)} hint={`estornos ${brl(k.refundsThisMonthCents)}`} />
        <Tile label="Ticket medio (ARPU)" value={brl(k.arpuCents)} hint={`${k.activeCount} assinaturas ativas`} />
        <Tile label="A receber" value={brl(k.pendingCents)} hint={`${k.pendingCount} aguardando pagamento`} />
        <Tile label="Em risco (atraso)" value={brl(k.atRiskCents)} hint={`${k.pastDueCount} em atraso`} tone={k.pastDueCount ? 'bad' : undefined} />
        <Tile label="Novas no mes" value={String(k.newThisMonth)} />
        <Tile label="Churn do mes" value={`${k.churnPct}%`} hint={`${k.canceledThisMonth} canceladas`} tone={k.churnPct >= 10 ? 'bad' : undefined} />
      </div>

      <section className="glass p-8 rounded-[2.5rem] border-white/5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] font-black uppercase tracking-[0.3em]">Recebido por mes (12 meses)</h3>
          <button className="text-[9px] font-black uppercase tracking-widest text-gray-500 hover:text-orange-400" onClick={() => setTable(!table)}>{table ? 'Ver grafico' : 'Ver tabela'}</button>
        </div>
        {table ? (
          <table className="w-full text-left text-[11px]">
            <thead className="text-[8px] uppercase tracking-widest text-gray-500"><tr><th className="py-2">Mes</th><th>Recebido</th><th>Estornos</th><th>Novas</th><th>Canceladas</th></tr></thead>
            <tbody>{f.months.map(m => (
              <tr key={m.month} className="border-t border-white/5 font-bold"><td className="py-2">{monthLabel(m.month)}</td><td>{brl(m.receivedCents)}</td><td>{brl(m.refundsCents)}</td><td>{m.newSubs}</td><td>{m.canceled}</td></tr>
            ))}</tbody>
          </table>
        ) : <RevenueBars months={f.months} />}
      </section>

      <section className="space-y-5">
        <h3 className="text-[11px] font-black uppercase tracking-[0.3em]">Projetos do ecossistema ({cards.length})</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {cards.map(c => (
            <div key={c.slug} className={`glass p-6 rounded-3xl border-white/5 space-y-3 ${c.billing === 'none' ? 'opacity-70' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <span className="text-lg font-black uppercase italic leading-tight">{c.name}</span>
                <span className={`shrink-0 text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-full border ${c.billing === 'central' ? 'text-orange-400 border-orange-500/30' : c.billing === 'own' ? 'text-sky-400 border-sky-500/30' : 'text-gray-500 border-white/10'}`}>{BILLING_LABEL[c.billing]}</span>
              </div>
              {c.billing === 'none' && <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Projeto em desenvolvimento. A cobrança entra quando for integrado.</p>}
              {c.billing === 'own' && !c.active && !c.received12mCents && <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Cobra pelo Asaas do próprio projeto. A receita aparece aqui quando o projeto passar a reportar.</p>}
              {(c.billing === 'central' || (c.billing === 'own' && (c.active > 0 || c.received12mCents > 0))) && (
                <div className="grid grid-cols-3 gap-3 text-[10px] font-bold uppercase tracking-widest">
                  <div><div className="text-gray-500 text-[8px]">MRR</div><div className="text-base font-black">{brl(c.mrrCents)}</div></div>
                  <div><div className="text-gray-500 text-[8px]">12 meses</div><div className="text-base font-black">{brl(c.received12mCents)}</div></div>
                  <div><div className="text-gray-500 text-[8px]">Ativos</div><div className="text-base font-black">{c.active}</div></div>
                </div>
              )}
              {c.url && <a href={c.url} target="_blank" rel="noreferrer" className="inline-block text-[9px] font-black uppercase tracking-widest text-gray-500 hover:text-orange-400">Abrir projeto</a>}
            </div>
          ))}
        </div>
      </section>

      {f.overdue.length > 0 && (
        <section className="glass p-8 rounded-[2.5rem] border-red-500/10 space-y-4">
          <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-red-400">Inadimplentes ({f.overdue.length})</h3>
          <table className="w-full text-left text-[11px]">
            <thead className="text-[8px] uppercase tracking-widest text-gray-500"><tr><th className="py-2">Cliente</th><th>Projeto</th><th>Valor</th><th>Desde</th></tr></thead>
            <tbody>{f.overdue.map((o, i) => (
              <tr key={i} className="border-t border-white/5 font-bold"><td className="py-2">{o.email}</td><td className="uppercase">{o.product}</td><td>{brl(o.priceCents)}</td><td>{new Date(o.since).toLocaleDateString('pt-BR')}</td></tr>
            ))}</tbody>
          </table>
        </section>
      )}
      <SupportInbox />

      <p className="text-[9px] font-bold text-gray-600 uppercase tracking-widest">Atualizado {new Date(f.generatedAt).toLocaleString('pt-BR')}. Custo por cliente entra quando o consumo (usage) for medido.</p>
    </div>
  );
}
