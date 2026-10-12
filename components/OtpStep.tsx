import React, { useState } from 'react';
import { Mail, ArrowLeft, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';

// Login real: o Supabase manda um codigo ao e-mail e so entra quem o digita (cria a conta no 1o acesso).
// Nome/telefone do cadastro vao para user_metadata. Sucesso = sessao criada; quem chamou reage via onAuthStateChange.
export function OtpStep({ email, meta, onBack, onDone }: {
  email: string; meta?: { full_name?: string; phone?: string }; onBack: () => void; onDone: () => void;
}) {
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const send = async () => {
    setBusy(true); setErr('');
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true, data: meta } });
    setBusy(false);
    if (error) setErr(/rate|seconds/i.test(error.message) ? 'Aguarde um minuto para pedir outro código.' : 'Não foi possível enviar o código. Confira o e-mail.');
    else setSent(true);
  };
  const verify = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('');
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
    setBusy(false);
    if (error) setErr('Código inválido ou expirado.'); else onDone();
  };

  return (
    <div className="max-w-md w-full space-y-6 z-10">
      <button onClick={onBack} className="flex items-center gap-2 text-gray-500 hover:text-white text-[10px] font-black uppercase tracking-widest"><ArrowLeft size={14} /> Voltar</button>
      <div className="flex items-center gap-3"><ShieldCheck className="text-blue-500" size={22} /><h2 className="text-3xl font-black uppercase italic tracking-tighter">Confirme seu acesso</h2></div>
      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest leading-relaxed flex items-center gap-2"><Mail size={12} /> {email}</p>
      {!sent ? (
        <>
          <p className="text-[11px] text-gray-400 leading-relaxed">Enviaremos um código de acesso para este e-mail. Sem senha: só quem recebe o código entra na conta.</p>
          <button disabled={busy} onClick={send} className="w-full px-6 py-4 bg-blue-600 hover:bg-blue-700 rounded-2xl font-black text-[11px] uppercase tracking-widest italic disabled:opacity-50">{busy ? 'Enviando...' : 'Receber código'}</button>
        </>
      ) : (
        <form onSubmit={verify} className="space-y-4">
          <p className="text-[11px] text-gray-400 leading-relaxed">Digite o código que chegou no seu e-mail (olhe também o spam).</p>
          <input autoFocus required inputMode="numeric" autoComplete="one-time-code" placeholder="Código" value={code} onChange={e => setCode(e.target.value)}
            className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-4 px-5 outline-none focus:border-blue-500/40 font-bold text-lg tracking-[0.4em] text-center" />
          <button disabled={busy || !code} className="w-full px-6 py-4 bg-blue-600 hover:bg-blue-700 rounded-2xl font-black text-[11px] uppercase tracking-widest italic disabled:opacity-50">{busy ? 'Entrando...' : 'Entrar'}</button>
          <button type="button" disabled={busy} onClick={send} className="text-[9px] font-black uppercase tracking-widest text-gray-600 hover:text-blue-500">Reenviar código</button>
        </form>
      )}
      {err && <p role="alert" className="text-[10px] font-bold text-red-400 uppercase tracking-widest">{err}</p>}
    </div>
  );
}
