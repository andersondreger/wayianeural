
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, User, Mail, Smartphone, LogIn, Sparkles, Lock } from 'lucide-react';
import { GlassButton } from '../components/Buttons';
import { BusinessQuiz, BusinessQuizData } from '../components/BusinessQuiz';
import { OtpStep, authErrorMessage } from '../components/OtpStep';
import { supabase } from '../lib/supabase';

// Recuperacao de senha por WhatsApp: pede o link (forgot) ou define a nova senha com o token (?reset=).
function RecoverPanel({ token, onBack }: { token: string | null; onBack: () => void }) {
  const [email, setEmail] = useState(''); const [pw, setPw] = useState(''); const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(''); const [err, setErr] = useState('');
  const post = (path: string, body: unknown) => fetch(`/pay-api/auth/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(''); setMsg('');
    if (token) {
      if (pw.length < 6) return setErr('A senha precisa ter pelo menos 6 caracteres.');
      if (pw !== pw2) return setErr('As senhas não coincidem.');
    }
    setBusy(true);
    const r = await (token ? post('reset', { token, password: pw }) : post('forgot', { email: email.trim() })).catch(() => null);
    const j: any = await r?.json().catch(() => ({}));
    setBusy(false);
    if (!r || !r.ok) return setErr(j?.error ?? 'Não foi possível concluir. Tente de novo.');
    if (token) { setMsg('Senha alterada! Entre com a nova senha.'); setTimeout(() => { window.location.href = '/app/'; }, 1500); }
    else setMsg('Se a conta existir, enviamos o link de redefinição para o WhatsApp cadastrado nela. Confira suas mensagens.');
  };
  const input = 'w-full bg-white/[0.03] border border-white/10 rounded-xl py-4 px-5 outline-none focus:border-blue-500/40 font-bold transition-all text-sm';
  return (
    <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center p-8">
      <form onSubmit={submit} className="w-full max-w-md space-y-5">
        <h2 className="text-3xl font-black">{token ? 'Nova senha' : 'Recuperar senha'}</h2>
        <p className="text-sm text-gray-400">{token ? 'Escolha a nova senha da sua conta.' : 'Digite o e-mail da conta e enviamos o link pelo WhatsApp cadastrado.'}</p>
        {token ? (<>
          <input required type="password" minLength={6} autoComplete="new-password" placeholder="Nova senha" value={pw} onChange={e => setPw(e.target.value)} className={input} />
          <input required type="password" minLength={6} autoComplete="new-password" placeholder="Confirmar senha" value={pw2} onChange={e => setPw2(e.target.value)} className={input} />
        </>) : <input required type="email" autoComplete="email" placeholder="nome@empresa.com" value={email} onChange={e => setEmail(e.target.value)} className={input} />}
        {err && <p role="alert" className="text-[10px] font-bold text-red-400 uppercase tracking-widest">{err}</p>}
        {msg && <p className="text-sm text-green-400">{msg}</p>}
        <GlassButton type="submit" disabled={busy} className="w-full !py-5 !text-[12px]">{busy ? 'Aguarde...' : token ? 'Salvar senha' : 'Enviar link'}</GlassButton>
        <button type="button" onClick={onBack} className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-600 hover:text-blue-500">Voltar ao login</button>
      </form>
    </div>
  );
}

// Cadastro e quiz criam a conta com senha (OtpStep); login por senha ou Google.
export function OnboardingPage({ onCompleteQuiz, onBack }: {
  onCompleteQuiz: (data: BusinessQuizData) => void;
  onBack: () => void;
}) {
  const [otp, setOtp] = useState<{ email: string; password?: string; meta?: { full_name?: string; phone?: string } } | null>(null);
  const resetToken = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('reset') : null;
  const [recover, setRecover] = useState<boolean>(!!resetToken);
  const [isLoginMode, setIsLoginMode] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '' });

  const [password, setPassword] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginErr, setLoginErr] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoginMode) {
      if (password.length < 6) { setLoginErr('A senha precisa ter pelo menos 6 caracteres.'); return; }
      setLoginErr('');
      setOtp({ email: formData.email, password, meta: { full_name: formData.name, phone: formData.phone } });
      return;
    }
    // Login de usuario cadastrado: e-mail + senha. O App reage a sessao (onAuthStateChange).
    setLoginBusy(true); setLoginErr('');
    const { error } = await supabase.auth.signInWithPassword({ email: formData.email.trim(), password });
    setLoginBusy(false);
    if (error) setLoginErr(authErrorMessage(error));
  };

  if (recover) return <RecoverPanel token={resetToken} onBack={() => { setRecover(false); setIsLoginMode(true); if (resetToken) window.location.href = '/app/'; }} />;

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-[#050505] text-white">
      <div className="fixed inset-0 grid-engine pointer-events-none opacity-5"></div>

      <button
        onClick={onBack}
        className="absolute top-6 left-6 z-[110] flex items-center gap-2 text-gray-500 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest"
      >
        <ArrowLeft size={14} /> Voltar ao Portal
      </button>

      {/* LADO ESQUERDO: FORMULARIO INTERATIVO SOBRE O NEGOCIO */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 lg:p-16 relative overflow-hidden border-r border-white/5 bg-gradient-to-br from-orange-500/[0.02] to-transparent">
        <BusinessQuiz onComplete={d => { onCompleteQuiz(d); setOtp({ email: d.contactEmail, password: d.password, meta: { full_name: d.contactName || d.businessName, phone: d.contactPhone } }); }} />
      </div>

      {/* LADO DIREITO: ACESSO GRATUITO OU LOGIN */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 lg:p-16 bg-black relative">
        {otp ? <OtpStep email={otp.email} password={otp.password} meta={otp.meta} onBack={() => setOtp(null)} onDone={() => { /* App reage a sessao (onAuthStateChange) */ }} /> : (
        <div className="max-w-md w-full space-y-8 z-10">
          <div className="text-center lg:text-left space-y-4">
             <div className="flex items-center gap-2 text-blue-500 mb-2">
                <Sparkles size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest">
                  {isLoginMode ? 'Acesso ao Painel' : 'Acesso Gratuito'}
                </span>
             </div>
             <h2 className="text-4xl font-black uppercase italic tracking-tighter leading-none">
               {isLoginMode ? <>Entrar na <span className="text-blue-500">Engine.</span></> : <>Acesse <span className="text-blue-500">Gratuitamente.</span></>}
             </h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <AnimatePresence mode="wait">
              {!isLoginMode && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-4 overflow-hidden">
                  <div className="space-y-1.5">
                    <label className="text-[8px] font-black uppercase text-gray-700 tracking-widest ml-1 flex items-center gap-2">
                      <User size={10} /> Nome da Operação
                    </label>
                    <input
                      required
                      placeholder="Ex: Minha Empresa IA"
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-4 px-5 outline-none focus:border-blue-500/40 font-bold transition-all text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[8px] font-black uppercase text-gray-700 tracking-widest ml-1 flex items-center gap-2">
                      <Smartphone size={10} /> WhatsApp (Com DDD)
                    </label>
                    <input
                      required
                      type="tel"
                      placeholder="(11) 99999-9999"
                      value={formData.phone}
                      onChange={e => setFormData({...formData, phone: e.target.value})}
                      className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-4 px-5 outline-none focus:border-blue-500/40 font-bold transition-all text-sm"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-1.5">
              <label className="text-[8px] font-black uppercase text-gray-700 tracking-widest ml-1 flex items-center gap-2">
                <Mail size={10} /> E-mail Corporativo
              </label>
              <input
                required
                type="email"
                placeholder="nome@empresa.com"
                value={formData.email}
                onChange={e => setFormData({...formData, email: e.target.value})}
                className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-4 px-5 outline-none focus:border-blue-500/40 font-bold transition-all text-sm"
              />
            </div>

            {(
              <div className="space-y-1.5">
                <label className="text-[8px] font-black uppercase text-gray-700 tracking-widest ml-1 flex items-center gap-2">
                  <Lock size={10} /> {isLoginMode ? 'Senha' : 'Criar senha'}
                </label>
                <input
                  required
                  type="password"
                  autoComplete={isLoginMode ? 'current-password' : 'new-password'}
                  minLength={isLoginMode ? undefined : 6}
                  placeholder={isLoginMode ? 'Sua senha' : 'Mínimo 6 caracteres'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-4 px-5 outline-none focus:border-blue-500/40 font-bold transition-all text-sm"
                />
              </div>
            )}
            {loginErr && <p role="alert" className="text-[10px] font-bold text-red-400 uppercase tracking-widest">{loginErr}</p>}

            <GlassButton type="submit" disabled={loginBusy} className="w-full !py-5 mt-4 !text-[12px] !border-blue-500/20 hover:!bg-blue-600/10 flex items-center justify-center gap-2">
              {isLoginMode ? <><LogIn size={14} /> {loginBusy ? 'Entrando...' : 'Acessar Dashboard'}</> : <><Sparkles size={14} className="text-blue-500" /> Acessar Gratuitamente</>}
            </GlassButton>
          </form>

          {isLoginMode && (
            <>
              <div className="flex items-center gap-3 text-gray-700">
                <div className="flex-1 h-px bg-white/10" /><span className="text-[8px] font-black uppercase tracking-widest">ou continue com</span><div className="flex-1 h-px bg-white/10" />
              </div>
              {/* Google ativo; GitHub ainda em breve. */}
              <div className="grid grid-cols-2 gap-3">
                <a href="/pay-api/auth/google" className="flex items-center justify-center gap-2 py-3 rounded-xl bg-white/[0.03] border border-white/10 text-[10px] font-black uppercase tracking-widest text-gray-300 hover:border-blue-500/40">
                  <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.5-4.1 7-10.2 7-17.6z"/><path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.3.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>
                  Google
                </a>
                <button type="button" aria-disabled="true" title="Em breve" onClick={e => e.preventDefault()} className="flex items-center justify-center gap-2 py-3 rounded-xl bg-white/[0.03] border border-white/10 text-[10px] font-black uppercase tracking-widest text-gray-300 cursor-not-allowed">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.4-3.9-1.4-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.1.1 1.7 1.2 1.7 1.2 1 1.7 2.7 1.2 3.3.9.1-.7.4-1.2.7-1.5-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0c2.2-1.5 3.2-1.2 3.2-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.9 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.2c0 .3.2.7.8.6 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.7 18.3.5 12 .5z"/></svg>
                  GitHub
                </button>
              </div>
            </>
          )}

          {isLoginMode && (
            <div className="text-center">
              <button onClick={() => setRecover(true)} className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-600 hover:text-blue-500 transition-colors">Esqueci minha senha</button>
            </div>
          )}

          <div className="text-center">
            <button
              onClick={() => { setIsLoginMode(!isLoginMode); setLoginErr(''); setPassword(''); }}
              className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-600 hover:text-blue-500 transition-colors"
            >
              {isLoginMode ? 'Novo por aqui? Criar conta grátis' : 'Já possui acesso? Fazer Login'}
            </button>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
