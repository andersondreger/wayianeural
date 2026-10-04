import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Crown, CheckCircle2, ExternalLink, Mail, ShieldCheck, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { payApi, brl, sendEmailCode, verifyEmailCode, PayProduct, PaySubscription } from '../lib/pay';

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Ativo', PENDING: 'Aguardando pagamento', PAST_DUE: 'Em atraso', CANCELED: 'Cancelado',
};
const STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'text-green-400', PENDING: 'text-yellow-400', PAST_DUE: 'text-red-400', CANCELED: 'text-gray-500',
};

const inputCls = 'w-full bg-white/[0.03] border border-white/10 rounded-xl py-4 px-5 outline-none focus:border-orange-500/40 font-bold text-sm';
const btnCls = 'px-6 py-4 bg-orange-500 rounded-2xl font-black text-[10px] uppercase tracking-widest italic hover:bg-orange-600 transition-all disabled:opacity-50';

function EmailGate({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const send = async () => {
    setBusy(true); setErr('');
    const { error } = await sendEmailCode(email.trim());
    setBusy(false);
    if (error) setErr(error.message); else setSent(true);
  };
  const verify = async () => {
    setBusy(true); setErr('');
    const { error } = await verifyEmailCode(email.trim(), code.trim());
    setBusy(false);
    if (error) setErr('Codigo invalido ou expirado'); else onDone();
  };

  return (
    <div className="glass p-8 rounded-[2.5rem] border-orange-500/10 max-w-md space-y-5">
      <div className="flex items-center gap-3"><Mail className="text-orange-500" size={20} /><h4 className="text-lg font-black uppercase italic">Confirme seu e-mail</h4></div>
      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest leading-relaxed">
        Para pagar com seguranca, enviamos um codigo para o seu e-mail. A assinatura fica ligada a ele em todos os projetos WayIA.
      </p>
      <input className={inputCls} type="email" placeholder="voce@empresa.com" value={email} onChange={e => setEmail(e.target.value)} disabled={sent} />
      {sent && <input className={inputCls} inputMode="numeric" placeholder="Codigo recebido" value={code} onChange={e => setCode(e.target.value)} />}
      {err && <div className="text-[10px] font-bold text-red-400 uppercase tracking-widest">{err}</div>}
      <button className={btnCls} disabled={busy || !email || (sent && !code)} onClick={sent ? verify : send}>
        {busy ? 'Aguarde...' : sent ? 'Confirmar codigo' : 'Enviar codigo'}
      </button>
    </div>
  );
}

export function PaymentsPanel({ initialProduct }: { initialProduct?: string }) {
  const [state, setState] = useState<'loading' | 'gate' | 'ready'>('loading');
  const [products, setProducts] = useState<PayProduct[]>([]);
  const [subs, setSubs] = useState<PaySubscription[]>([]);
  const [selected, setSelected] = useState<string | null>(initialProduct ?? null);
  const [doc, setDoc] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    try {
      const [cat, { data: { session } }] = await Promise.all([payApi.catalog(), supabase.auth.getSession()]);
      setProducts(cat);
      if (!session) { setState('gate'); return; }
      setSubs((await payApi.me()).subscriptions);
      setState('ready');
    } catch (e: any) {
      if (/login|sessao/i.test(e.message)) setState('gate');
      else { setErr(e.message); setState('ready'); }
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const subOf = (slug: string) => subs.find(s => s.product_slug === slug);

  const checkout = async (slug: string) => {
    setBusy(true); setErr('');
    try {
      const r = await payApi.checkout(slug, doc);
      if (r.alreadyActive && r.redirect) window.location.href = r.redirect;
      else if (r.invoiceUrl) window.location.href = r.invoiceUrl;
      else setErr('Cobranca criada, mas o link ainda nao ficou disponivel. Tente novamente em instantes.');
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };

  if (state === 'loading') return <div className="flex justify-center py-24"><Loader2 className="animate-spin text-orange-500" size={44} /></div>;
  if (state === 'gate') return <EmailGate onDone={load} />;

  return (
    <div className="space-y-10">
      <div className="border-b border-white/5 pb-10">
        <h2 className="text-5xl font-black uppercase italic tracking-tighter leading-none">Seus <span className="text-orange-500 text-glow">Projetos.</span></h2>
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.3em] mt-4 italic">Contrate so o que precisa. PIX, cartao ou boleto, cancele quando quiser.</p>
      </div>
      {err && <div className="px-6 py-4 rounded-2xl bg-red-500/5 border border-red-500/10 text-[10px] font-bold text-red-400 uppercase tracking-widest">{err}</div>}

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-8">
        {products.map(p => {
          const sub = subOf(p.slug);
          const active = sub?.status === 'ACTIVE';
          return (
            <div key={p.slug} className={`glass p-8 rounded-[2.5rem] space-y-5 ${selected === p.slug ? 'border-orange-500/40' : 'border-white/5'}`}>
              <div className="flex items-start justify-between">
                <h4 className="text-xl font-black uppercase italic">{p.name}</h4>
                {sub && <span className={`text-[9px] font-black uppercase tracking-widest ${STATUS_COLOR[sub.status]}`}>{STATUS_LABEL[sub.status]}</span>}
              </div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest leading-relaxed min-h-[3.5rem]">{p.description}</p>
              <div className="text-3xl font-black italic">{brl(p.price_cents)}<span className="text-[10px] text-gray-500 not-italic"> /{p.cycle === 'YEARLY' ? 'ano' : 'mes'}</span></div>

              {active ? (
                <a href={p.app_url} className={`${btnCls} inline-flex items-center gap-2`}><CheckCircle2 size={14} /> Abrir {p.name}</a>
              ) : p.checkout_url ? (
                <a href={p.checkout_url} className={`${btnCls} inline-flex items-center gap-2`}><Crown size={14} /> Assinar o {p.name}</a>
              ) : selected === p.slug ? (
                <div className="space-y-3">
                  <input className={inputCls} inputMode="numeric" placeholder="CPF ou CNPJ (so numeros)" value={doc} onChange={e => setDoc(e.target.value)} />
                  <button className={btnCls} disabled={busy} onClick={() => checkout(p.slug)}>{busy ? 'Gerando...' : 'Ir para o pagamento'}</button>
                </div>
              ) : (
                <button className={`${btnCls} inline-flex items-center gap-2`} onClick={() => { setSelected(p.slug); setErr(''); }}>
                  <Crown size={14} /> {sub?.status === 'PENDING' ? 'Finalizar pagamento' : 'Contratar'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AdminPaymentsPanel() {
  const [data, setData] = useState<any>(null);
  const [products, setProducts] = useState<PayProduct[]>([]);
  const [err, setErr] = useState('');
  const [edit, setEdit] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const [s, p] = await Promise.all([payApi.adminSummary(), payApi.adminProducts()]);
      setData(s); setProducts(p); setErr('');
    } catch (e: any) { setErr(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const savePrice = async (slug: string) => {
    const reais = Number(edit[slug]?.replace(',', '.'));
    if (!Number.isFinite(reais) || reais < 1) { setErr('Preco invalido'); return; }
    try { await payApi.adminUpdateProduct(slug, { price_cents: Math.round(reais * 100) }); setEdit({ ...edit, [slug]: '' }); load(); }
    catch (e: any) { setErr(e.message); }
  };
  const toggle = async (p: PayProduct) => {
    try { await payApi.adminUpdateProduct(p.slug, { active: !p.active }); load(); } catch (e: any) { setErr(e.message); }
  };

  if (err && !data) return <div className="px-6 py-4 rounded-2xl bg-red-500/5 border border-red-500/10 text-[10px] font-bold text-red-400 uppercase tracking-widest">{err}</div>;
  if (!data) return <div className="flex justify-center py-24"><Loader2 className="animate-spin text-orange-500" size={44} /></div>;

  const tile = (label: string, value: string, warn = false) => (
    <div className="glass p-6 rounded-3xl border-white/5">
      <div className="text-[8px] font-black uppercase tracking-widest text-gray-500">{label}</div>
      <div className={`text-3xl font-black italic mt-2 ${warn ? 'text-red-400' : ''}`}>{value}</div>
    </div>
  );

  return (
    <div className="space-y-10">
      <div className="border-b border-white/5 pb-10 flex items-end justify-between">
        <h2 className="text-5xl font-black uppercase italic tracking-tighter leading-none">Admin <span className="text-orange-500 text-glow">Pagamentos.</span></h2>
        <span className={`flex items-center gap-2 text-[9px] font-black uppercase tracking-widest ${data.gatewayMode === 'sandbox' ? 'text-yellow-400' : 'text-green-400'}`}>
          {data.gatewayMode === 'sandbox' ? <AlertTriangle size={12} /> : <ShieldCheck size={12} />} Asaas: {data.gatewayMode}
        </span>
      </div>
      {err && <div className="text-[10px] font-bold text-red-400 uppercase tracking-widest">{err}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {tile('MRR', brl(data.mrrCents))}
        {tile('Assinaturas ativas', String(data.activeCount))}
        {tile('Aguardando pagamento', String(data.pendingCount))}
        {tile('Em atraso', String(data.pastDueCount), data.pastDueCount > 0)}
      </div>

      <div className="glass rounded-[2.5rem] border-white/5 overflow-x-auto">
        <table className="w-full text-left text-[11px]">
          <thead className="text-[8px] uppercase tracking-widest text-gray-500">
            <tr><th className="p-5">Projeto</th><th>Preco/mes</th><th>Ativos</th><th>Pendentes</th><th>Atraso</th><th>MRR</th><th>Novo preco</th><th>Vendas</th></tr>
          </thead>
          <tbody>
            {products.map(p => {
              const s = data.byProduct[p.slug] ?? { active: 0, pending: 0, pastDue: 0, mrrCents: 0 };
              return (
                <tr key={p.slug} className="border-t border-white/5 font-bold">
                  <td className="p-5 uppercase italic">{p.name}</td>
                  <td>{brl(p.price_cents)}</td><td>{s.active}</td><td>{s.pending}</td><td>{s.pastDue}</td><td>{brl(s.mrrCents)}</td>
                  <td>
                    <div className="flex gap-2 py-2">
                      <input className="w-24 bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-xs" placeholder="R$" value={edit[p.slug] ?? ''} onChange={e => setEdit({ ...edit, [p.slug]: e.target.value })} />
                      <button className="px-3 rounded-lg bg-orange-500/20 text-orange-400 text-[9px] font-black uppercase" onClick={() => savePrice(p.slug)}>Salvar</button>
                    </div>
                  </td>
                  <td><button className={`text-[9px] font-black uppercase ${p.active ? 'text-green-400' : 'text-gray-500'}`} onClick={() => toggle(p)}>{p.active ? 'Aberta' : 'Pausada'}</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[9px] font-bold text-gray-600 uppercase tracking-widest">Preco novo vale so para novas contratacoes; quem ja assina mantem o valor travado.</p>

      <div className="glass rounded-[2.5rem] border-white/5 overflow-x-auto">
        <table className="w-full text-left text-[11px]">
          <thead className="text-[8px] uppercase tracking-widest text-gray-500"><tr><th className="p-5">Cliente</th><th>Projeto</th><th>Status</th><th>Valor</th><th>Desde</th></tr></thead>
          <tbody>
            {data.subscriptions.map((s: PaySubscription, i: number) => (
              <tr key={i} className="border-t border-white/5 font-bold">
                <td className="p-5">{s.email}</td><td className="uppercase">{s.product_slug}</td>
                <td className={STATUS_COLOR[s.status]}>{STATUS_LABEL[s.status]}</td><td>{brl(s.price_cents)}</td>
                <td>{new Date(s.created_at).toLocaleDateString('pt-BR')}</td>
              </tr>
            ))}
            {data.subscriptions.length === 0 && <tr><td className="p-8 text-gray-600 uppercase text-[10px] tracking-widest" colSpan={5}>Nenhuma assinatura ainda.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
