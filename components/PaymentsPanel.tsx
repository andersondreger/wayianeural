import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Crown, CheckCircle2, ExternalLink, Mail } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { payApi, brl, sendEmailCode, verifyEmailCode, PayProduct, PaySubscription } from '../lib/pay';

export const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Ativo', PENDING: 'Aguardando pagamento', PAST_DUE: 'Em atraso', CANCELED: 'Cancelado',
};
export const STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'text-green-400', PENDING: 'text-yellow-400', PAST_DUE: 'text-red-400', CANCELED: 'text-gray-500',
};

export const inputCls = 'w-full bg-white/[0.03] border border-white/10 rounded-xl py-4 px-5 outline-none focus:border-orange-500/40 font-bold text-sm';
export const btnCls = 'px-6 py-4 bg-orange-500 rounded-2xl font-black text-[10px] uppercase tracking-widest italic hover:bg-orange-600 transition-all disabled:opacity-50';

export function EmailGate({ onDone, purple = false }: { onDone: () => void; purple?: boolean }) {
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

  if (purple) {
    const f = 'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-[#1c0b3d] outline-none focus:border-[#6d28d9]';
    return (
      <div className="rounded-[2rem] bg-[#1c0b3d] min-h-[520px] grid place-items-center p-6">
        <div className="bg-white text-[#1c0b3d] rounded-3xl p-8 w-full max-w-md space-y-4">
          <p className="text-3xl font-black text-[#6d28d9]">WayIA</p>
          <h4 className="text-xl font-extrabold">Entre no seu painel</h4>
          <p className="text-sm text-slate-600">Enviamos um código para o seu e-mail. Sua conta vale para todos os produtos WayIA.</p>
          <input className={f} type="email" placeholder="voce@empresa.com" value={email} onChange={e => setEmail(e.target.value)} disabled={sent} />
          {sent && <input className={f} inputMode="numeric" placeholder="Código recebido" value={code} onChange={e => setCode(e.target.value)} />}
          {err && <p className="text-sm font-bold text-red-600">{err}</p>}
          <button className="w-full px-5 py-3 rounded-full bg-[#6d28d9] hover:bg-[#5b21b6] text-white text-sm font-bold disabled:opacity-50" disabled={busy || !email || (sent && !code)} onClick={sent ? verify : send}>
            {busy ? 'Aguarde...' : sent ? 'Entrar' : 'Receber código'}
          </button>
        </div>
      </div>
    );
  }
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
