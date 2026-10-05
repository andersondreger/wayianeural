import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { payApi, PayTicket } from '../lib/pay';

const STATUS_LABEL: Record<PayTicket['status'], string> = { open: 'Aberto', answered: 'Respondido', closed: 'Fechado' };

// Caixa de suporte: tickets que os clientes abrem nos projetos (ex.: criar) chegam via /ingest/ticket.
export function SupportInbox() {
  const [tickets, setTickets] = useState<PayTicket[] | null>(null);
  const [filter, setFilter] = useState<PayTicket['status'] | ''>('open');
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');

  const load = () => payApi.adminTickets(filter || undefined).then(setTickets).catch(e => setErr(e.message));
  useEffect(() => { setTickets(null); setErr(''); load(); }, [filter]);

  const act = async (t: PayTicket, body: { reply?: string; status?: PayTicket['status'] }) => {
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
    <section className="glass p-8 rounded-[2.5rem] border-white/5 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-[11px] font-black uppercase tracking-[0.3em]">Suporte{tickets ? ` (${tickets.length})` : ''}</h3>
        <div className="flex gap-2" role="tablist" aria-label="Filtrar tickets">
          {([['open', 'Abertos'], ['answered', 'Respondidos'], ['closed', 'Fechados'], ['', 'Todos']] as const).map(([v, l]) => (
            <button key={v} role="tab" aria-selected={filter === v} onClick={() => setFilter(v)}
              className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border ${filter === v ? 'text-orange-400 border-orange-500/40' : 'text-gray-500 border-white/10 hover:text-white'}`}>{l}</button>
          ))}
        </div>
      </div>
      {err && <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest">{err}</p>}
      {note && <p role="status" className="text-[10px] font-bold text-green-400 uppercase tracking-widest">{note}</p>}
      {!tickets && !err && <div className="flex justify-center py-8"><Loader2 className="animate-spin text-orange-500" size={28} /></div>}
      {tickets?.length === 0 && <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Nenhum ticket aqui.</p>}
      <div className="space-y-3">
        {tickets?.map(t => (
          <div key={t.id} className="rounded-2xl border border-white/5 p-5 space-y-3">
            <button className="w-full text-left flex flex-wrap items-start justify-between gap-2" onClick={() => { setOpenId(openId === t.id ? null : t.id); setDraft(t.reply ?? ''); }} aria-expanded={openId === t.id}>
              <span className="font-black text-sm">{t.subject}</span>
              <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500">{t.product_slug} · {t.email}{t.phone ? ` · ${t.phone}` : ''}{t.whatsapp_optin ? ' · WhatsApp ok' : ''} · {new Date(t.created_at).toLocaleDateString('pt-BR')} · <span className={t.status === 'open' ? 'text-orange-400' : ''}>{STATUS_LABEL[t.status]}</span></span>
            </button>
            {openId === t.id && (
              <div className="space-y-3">
                <p className="text-[12px] text-gray-300 whitespace-pre-wrap">{t.message}</p>
                <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={3} maxLength={4000} placeholder="Resposta ao cliente"
                  className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-[12px] focus:outline-none focus:border-orange-500" />
                <div className="flex gap-3">
                  <button disabled={busy || !draft.trim()} onClick={() => act(t, { reply: draft })} className="text-[9px] font-black uppercase tracking-widest px-4 py-2 rounded-full bg-orange-500 text-black disabled:opacity-50">Responder</button>
                  {t.status !== 'closed' && <button disabled={busy} onClick={() => act(t, { status: 'closed' })} className="text-[9px] font-black uppercase tracking-widest px-4 py-2 rounded-full border border-white/10 text-gray-400 hover:text-white">Fechar</button>}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
