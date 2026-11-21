// Cliente de sessão do WayIA: mesma interface usada pelo app (supabase.auth.*), agora falando com o
// payments-api (/pay-api/auth/*) e Postgres próprio. Sessão = JWT guardado no navegador.
const API = '/pay-api';
const KEY = 'wayia_session_token';

export const isSupabaseConfigured = true;
export const SUPABASE_URL = ''; // legado (avatars agora em /pay-api/avatars/)

type User = { id: string; email: string; user_metadata: Record<string, any>; app_metadata: Record<string, any> };
type Session = { access_token: string; user: User };
type Err = { message: string; status?: number } | null;

const store = {
  get: () => { try { return localStorage.getItem(KEY); } catch { return null; } },
  set: (t: string | null) => { try { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY); } catch { /* sem storage */ } },
};
const expired = (t: string) => { try { return JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).exp * 1000 < Date.now(); } catch { return true; } };

type Listener = (event: 'SIGNED_IN' | 'SIGNED_OUT', session: Session | null) => void;
const listeners = new Set<Listener>();
const emit = (e: 'SIGNED_IN' | 'SIGNED_OUT', s: Session | null) => listeners.forEach((l) => { try { l(e, s); } catch { /* ignora */ } });

async function api(path: string, init: RequestInit = {}, token?: string | null) {
  const res = await fetch(API + path, { ...init, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  const j = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, j };
}
const err = (r: { status: number; j: any }): Err => ({ message: r.j?.error ?? 'erro', status: r.status });

// token vindo do login com Google (#gt=...): guarda e limpa a URL
try {
  const m = location.hash.match(/gt=([A-Za-z0-9_.-]+)/);
  if (m) { store.set(m[1]); history.replaceState(null, '', location.pathname + location.search); }
} catch { /* fora do navegador */ }

const unsupported = async (..._a: any[]) => ({ data: { user: null, session: null }, error: { message: 'Entrar por código foi desativado. Use e-mail e senha ou Google.' } as Err });

export const supabase = {
  auth: {
    async getSession(): Promise<{ data: { session: Session | null } }> {
      const t = store.get();
      if (!t || expired(t)) { store.set(null); return { data: { session: null } }; }
      const r = await api('/auth/me', {}, t);
      if (!r.ok) { store.set(null); return { data: { session: null } }; }
      return { data: { session: { access_token: t, user: r.j.user } } };
    },
    async getUser(): Promise<{ data: { user: User | null }; error: Err }> {
      const { data: { session } } = await supabase.auth.getSession();
      return { data: { user: session?.user ?? null }, error: null };
    },
    async signInWithPassword(c: { email: string; password: string }): Promise<{ data: { session: Session | null }; error: Err }> {
      const r = await api('/auth/login', { method: 'POST', body: JSON.stringify(c) });
      if (!r.ok) return { data: { session: null }, error: err(r) };
      store.set(r.j.access_token); emit('SIGNED_IN', r.j);
      return { data: { session: r.j }, error: null };
    },
    async signUp(c: { email: string; password: string; options?: { data?: Record<string, any> } }): Promise<{ data: { session: Session | null; user: User | null }; error: Err }> {
      const r = await api('/auth/register', { method: 'POST', body: JSON.stringify({ email: c.email, password: c.password, data: c.options?.data }) });
      if (!r.ok) return { data: { session: null, user: null }, error: err(r) };
      store.set(r.j.access_token); emit('SIGNED_IN', r.j);
      return { data: { session: r.j, user: r.j.user }, error: null };
    },
    async updateUser(c: { password?: string; data?: Record<string, any> }): Promise<{ data: { user: User | null }; error: Err }> {
      const r = await api('/auth/update', { method: 'POST', body: JSON.stringify(c) }, store.get());
      if (!r.ok) return { data: { user: null }, error: err(r) };
      store.set(r.j.access_token);
      return { data: { user: r.j.user }, error: null };
    },
    async signOut(): Promise<{ error: Err }> { store.set(null); emit('SIGNED_OUT', null); return { error: null }; },
    onAuthStateChange(cb: Listener) {
      listeners.add(cb);
      return { data: { subscription: { unsubscribe: () => { listeners.delete(cb); } } } };
    },
    // login por código/magic link (e-mail) foi substituído por senha + Google
    signInWithOtp: unsupported,
    verifyOtp: unsupported,
  },
  /** Só o necessário pelo app: gravar lead do quiz. */
  from(table: string) {
    return {
      async insert(row: Record<string, any>): Promise<{ error: Err }> {
        if (table !== 'quiz_leads') return { error: { message: 'tabela não permitida' } };
        const r = await api('/leads', { method: 'POST', body: JSON.stringify(row) });
        return { error: r.ok ? null : err(r) };
      },
    };
  },
};
