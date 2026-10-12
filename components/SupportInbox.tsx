import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { payApi, PayTicket } from '../lib/pay';

const STATUS_LABEL: Record<PayTicket['status'], string> = { open: 'Aberto', answered: 'Respondido', closed: 'Fechado' };

// Caixa de suporte: tickets que os clientes abrem nos projetos (ex.: criar) chegam via /ingest/ticket.
export function SupportInbox({ demo }: { demo?: PayTicket[] }) {
  const [tickets, setTickets] = useState<PayTicket[] | null>(null);
  const [filter, setFilter] = useState<PayTicket['status'] | ''>('open');
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');

  const load = () => demo ? Promise.resolve(setTickets(demo.filter(t => !filter || t.status === filter))) : payApi.adminTickets(filter || undefined).then(setTickets).catch(e => setErr(e.message));
  useEffect(() => { setTickets(null); setErr(''); load(); }, [filter]);

  const act = async (t: PayTicket, body: { reply?: string; status?: PayTicket['status'] }) => {
    if (demo) { setNote('Demonstrativo: entre com sua conta para responder chamados reais.'); return; }
    setBusy(true); setErr(''); setNote('');
    try {
      const r = await payApi.adminReplyTicket(t.id, body);
      if (body.reply) setNote(r.whatsapp === 'sent' ? 'Resposta enviada ao cliente por WhatsApp.' : r.whatsapp === 'failed' ? 'Resposta salva, mas o WhatsApp falhou. O cliente vê a resposta no painel dele.' : 'Resposta salva. O cliente vê no painel dele (não pediu WhatsApp).');
      setDraft(''); setOpenId(null); await load();
    }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-3xl font-black">Suporte{tickets ? <span className="text-white/50 text-xl"> ({tickets.length})</span> : ''}</h2>
        <div className="flex gap-2 flex-wrap" role="tablist" aria-label="Filtrar tickets">
          {([['open', 'Abertos'], ['answered', 'Respondidos'], ['closed', 'Fechados'], ['', 'Todos']] as const).map(([v, l]) => (
            <button key={v} role="tab" aria-selected={filter === v} onClick={() => setFilter(v)}
              className={`text-sm font-bold px-4 py-2 rounded-full ${filter === v ? 'bg-white text-[#1c0b3d]' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}>{l}</button>
          ))}
        </div>
      </div>
      {err && <div className="rounded-2xl bg-red-100 text-red-700 px-5 py-3 text-sm font-bold">{err}</div>}
      {note && <div role="status" className="rounded-2xl bg-emerald-100 text-emerald-800 px-5 py-3 text-sm font-bold">{note}</div>}
      {!tickets && !err && <div className="flex justify-center py-8"><Loader2 className="animate-spin text-white" size={28} /></div>}
      {tickets?.length === 0 && <div className="bg-white text-[#1c0b3d] rounded-3xl p-6 text-sm text-slate-500">Nenhum chamado aqui.</div>}
      <div className="space-y-3">
        {tickets?.map(t => (
          <div key={t.id} className="bg-white text-[#1c0b3d] rounded-3xl p-5 space-y-3">
            <button className="w-full text-left flex flex-wrap items-start justify-between gap-2" onClick={() => { setOpenId(openId === t.id ? null : t.id); setDraft(t.reply ?? ''); }} aria-expanded={openId === t.id}>
              <span className="font-extrabold">{t.subject}</span>
              <span className={`text-xs font-bold px-3 py-1 rounded-full ${t.status === 'open' ? 'bg-amber-100 text-amber-800' : t.status === 'answered' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>{STATUS_LABEL[t.status]}</span>
              <span className="w-full text-xs text-slate-500">{t.product_slug} · {t.email}{t.phone ? ` · ${t.phone}` : ''}{t.whatsapp_optin ? ' · WhatsApp ok' : ''} · {new Date(t.created_at).toLocaleDateString('pt-BR')}</span>
            </button>
            {openId === t.id && (
              <div className="space-y-3">
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{t.message}</p>
                <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={3} maxLength={4000} placeholder="Resposta ao cliente"
                  className="w-full rounded-xl border border-slate-200 p-3 text-sm font-semibold outline-none focus:border-[#6d28d9]" />
                <div className="flex gap-3">
                  <button disabled={busy || !draft.trim()} onClick={() => act(t, { reply: draft })} className="px-5 py-2.5 rounded-full bg-[#6d28d9] hover:bg-[#5b21b6] text-white text-sm font-bold disabled:opacity-50">Responder</button>
                  {t.status !== 'closed' && <button disabled={busy} onClick={() => act(t, { status: 'closed' })} className="px-5 py-2.5 rounded-full border border-[#6d28d9] text-[#6d28d9] text-sm font-bold">Fechar</button>}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
