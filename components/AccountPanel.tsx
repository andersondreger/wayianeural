import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, ExternalLink, Download, Trash2, XCircle, Crown, Clock, Lock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { payApi, brl, MyPayments, Hub, HubProject } from '../lib/pay';
import { EmailGate, STATUS_LABEL, STATUS_COLOR, btnCls, inputCls } from './PaymentsPanel';

const dt = (s?: string | null) => (s ? new Date(s).toLocaleDateString('pt-BR') : '—');
const INV_LABEL: Record<string, string> = {
  PAYMENT_RECEIVED: 'Pago', PAYMENT_CONFIRMED: 'Pago', PAYMENT_CREATED: 'Em aberto', PAYMENT_OVERDUE: 'Vencida',
  PAYMENT_REFUNDED: 'Estornada', PAYMENT_DELETED: 'Cancelada',
};
const STATE_BADGE: Record<HubProject['state'], { label: string; cls: string }> = {
  FREE: { label: 'Gratis', cls: 'text-sky-400' }, TRIAL: { label: 'Teste', cls: 'text-yellow-400' },
  ACTIVE: { label: 'Ativo', cls: 'text-green-400' }, GRACE: { label: 'Pagamento em atraso', cls: 'text-red-400' },
  EXPIRED: { label: 'Expirado · somente leitura', cls: 'text-red-400' }, NONE: { label: 'Disponivel', cls: 'text-gray-400' },
};
const TICKET_LABEL = { open: 'Aberto', answered: 'Respondido', closed: 'Fechado' } as const;

// Area do cliente: assinaturas, faturas, chamados e direitos LGPD. Tudo vem filtrado pelo e-mail logado no servidor.
export function AccountPanel({ initialProduct }: { initialProduct?: string }) {
  const [state, setState] = useState<'loading' | 'gate' | 'ready'>('loading');
  const [data, setData] = useState<MyPayments | null>(null);
  const [hub, setHub] = useState<Hub | null>(null);
  const [selected, setSelected] = useState<string | null>(initialProduct ?? null);
  const [doc, setDoc] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    try {
      const h = await payApi.hub();          // login completo OU link assinado do projeto
      setHub(h);
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

  if (state === 'loading') return <div className="flex justify-center py-24"><Loader2 className="animate-spin text-orange-500" size={44} /></div>;
  if (state === 'gate') return <EmailGate onDone={load} />;

  const subs = data?.subscriptions ?? [], invoices = data?.invoices ?? [], tickets = data?.tickets ?? [];
  return (
    <div className="space-y-10">
      <div className="border-b border-white/5 pb-10">
        <h2 className="text-5xl font-black uppercase italic tracking-tighter leading-none">Meu <span className="text-orange-500 text-glow">Financeiro.</span></h2>
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.3em] mt-4 italic">Todos os seus projetos, pagamentos e faturas num so lugar.</p>
      </div>
      {err && <div className="px-6 py-4 rounded-2xl bg-red-500/5 border border-red-500/10 text-[10px] font-bold text-red-400 uppercase tracking-widest">{err}</div>}

      <section className="space-y-4">
        <h3 className="text-xl font-black uppercase italic">Meus projetos</h3>
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
          {(hub?.projects ?? []).map(p => {
            const b = STATE_BADGE[p.state];
            const needsPay = p.tier === 'paid' && p.state !== 'ACTIVE';
            return (
              <div key={p.slug} className={`glass p-6 rounded-[2rem] space-y-4 ${selected === p.slug ? 'border-orange-500/40' : 'border-white/5'}`}>
                <div className="flex items-start justify-between gap-3">
                  <h4 className="font-black uppercase italic">{p.name}</h4>
                  <span className={`text-[9px] font-black uppercase tracking-widest text-right ${b.cls}`}>{b.label}</span>
                </div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest leading-relaxed">{p.description}</p>
                {p.tier === 'paid' && <div className="text-2xl font-black italic">{brl(p.price_cents)}<span className="text-[10px] text-gray-500 not-italic"> /{p.cycle === 'YEARLY' ? 'ano' : 'mes'}</span></div>}
                {p.state === 'TRIAL' && <p className="text-[10px] font-black uppercase tracking-widest text-yellow-400 inline-flex items-center gap-2"><Clock size={12} /> {p.daysLeft} dia(s) de teste restantes · acesso completo</p>}
                {p.state === 'NONE' && p.trial_days > 0 && !p.checkout_url && <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{p.trial_days} dias gratis ao entrar no projeto</p>}
                {p.state === 'EXPIRED' && <p className="text-[10px] font-black uppercase tracking-widest text-red-400 inline-flex items-center gap-2"><Lock size={12} /> Seus dados continuam salvos. Assine para voltar a criar e enviar.</p>}
                {p.state === 'GRACE' && <p className="text-[10px] font-black uppercase tracking-widest text-red-400">Regularize o pagamento para nao perder o acesso ({dt(p.currentPeriodEnd)}).</p>}
                {p.state === 'ACTIVE' && <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Acesso ate {dt(p.currentPeriodEnd)}</p>}

                <div className="flex gap-3 flex-wrap items-center">
                  {p.access !== 'none' && <a className={`${needsPay ? 'px-4 py-3 rounded-2xl border border-white/10 text-[10px] font-black uppercase tracking-widest text-gray-300' : btnCls} inline-flex items-center gap-2`} href={p.app_url}><ExternalLink size={14} /> Abrir</a>}
                  {needsPay && (p.checkout_url
                    ? <a className={`${btnCls} inline-flex items-center gap-2`} href={p.checkout_url}><Crown size={14} /> Assinar</a>
                    : selected === p.slug
                      ? <div className="flex gap-3 flex-wrap w-full">
                          <input className={inputCls} inputMode="numeric" placeholder="CPF ou CNPJ (so numeros)" value={doc} onChange={e => setDoc(e.target.value)} />
                          <button className={btnCls} disabled={busy === 'k' + p.slug} onClick={() => checkout(p.slug)}>{busy === 'k' + p.slug ? 'Gerando...' : 'Ir para o pagamento'}</button>
                        </div>
                      : <button className={`${btnCls} inline-flex items-center gap-2`} onClick={() => { setSelected(p.slug); setErr(''); }}><Crown size={14} /> {p.state === 'TRIAL' ? 'Assinar agora' : 'Assinar'}</button>)}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {hub?.scoped && <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Para ver faturas, chamados e seus dados (LGPD), entre com o codigo do seu e-mail.</p>}

      {!hub?.scoped && <><section className="space-y-4">
        <h3 className="text-xl font-black uppercase italic">Assinaturas</h3>
        {subs.length === 0 && <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Nenhuma assinatura ainda. Contrate em Projetos & Planos.</p>}
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
          {subs.map(s => (
            <div key={s.product_slug} className="glass p-6 rounded-[2rem] border-white/5 space-y-3">
              <div className="flex items-start justify-between">
                <h4 className="font-black uppercase italic">{s.product_slug}</h4>
                <span className={`text-[9px] font-black uppercase tracking-widest ${STATUS_COLOR[s.status]}`}>{STATUS_LABEL[s.status]}</span>
              </div>
              <div className="text-2xl font-black italic">{brl(s.price_cents)}</div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Acesso ate {dt(s.current_period_end)}</p>
              <div className="flex gap-3 flex-wrap">
                {s.status === 'PENDING' && s.invoice_url && <a className={btnCls} href={s.invoice_url}>Finalizar pagamento</a>}
                {s.canCancel && (
                  <button className="px-4 py-3 rounded-2xl border border-white/10 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-red-400 inline-flex items-center gap-2 disabled:opacity-50"
                    disabled={busy === 'c' + s.product_slug} onClick={() => cancel(s.product_slug)}><XCircle size={14} /> Cancelar</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-xl font-black uppercase italic">Faturas</h3>
        {invoices.length === 0 ? <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Nenhuma cobranca registrada.</p> : (
          <div className="glass rounded-[2rem] border-white/5 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[9px] uppercase tracking-widest text-gray-500"><tr><th className="p-4">Produto</th><th>Vencimento</th><th>Valor</th><th>Situacao</th><th /></tr></thead>
              <tbody>
                {invoices.map((i, k) => (
                  <tr key={k} className="border-t border-white/5 font-bold">
                    <td className="p-4 uppercase">{i.product}</td><td>{dt(i.dueDate)}</td><td>{brl(i.amountCents)}</td>
                    <td>{INV_LABEL[i.event] ?? i.status ?? i.event}</td>
                    <td>{i.url && <a href={i.url} target="_blank" rel="noreferrer" className="text-orange-500 inline-flex items-center gap-1"><ExternalLink size={12} /> Abrir</a>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h3 className="text-xl font-black uppercase italic">Chamados de suporte</h3>
        {tickets.length === 0 ? <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Nenhum chamado.</p> : tickets.map((t, k) => (
          <div key={k} className="glass p-6 rounded-[2rem] border-white/5 space-y-2">
            <div className="flex justify-between text-xs font-black uppercase"><span>{t.subject}</span><span className="text-gray-500">{TICKET_LABEL[t.status]} · {dt(t.created_at)}</span></div>
            {t.reply && <p className="text-sm text-gray-300 whitespace-pre-wrap">{t.reply}</p>}
          </div>
        ))}
      </section>

      <section className="space-y-4">
        <h3 className="text-xl font-black uppercase italic">Privacidade (LGPD)</h3>
        <div className="flex gap-3 flex-wrap">
          <button className={`${btnCls} inline-flex items-center gap-2`} disabled={busy === 'exp'} onClick={exportData}><Download size={14} /> Baixar meus dados</button>
          <button className="px-6 py-4 rounded-2xl border border-red-500/20 text-[10px] font-black uppercase tracking-widest text-red-400 inline-flex items-center gap-2 disabled:opacity-50"
            disabled={busy === 'del'} onClick={deleteData}><Trash2 size={14} /> Excluir meus dados</button>
        </div>
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Para excluir, cancele antes as assinaturas ativas.</p>
      </section></>}
    </div>
  );
}
