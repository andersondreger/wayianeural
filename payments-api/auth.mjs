// Login próprio do WayIA (substitui o Supabase Auth). Usuários em auth.users (mesmo formato do Supabase,
// então o trigger handle_new_user continua criando o perfil). Sessão = JWT HS256 enviado como Bearer.
import { createHmac, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const env = (k, d = '') => process.env[k] ?? d;
const SECRET = () => env('AUTH_SECRET');
const TTL = 60 * 60 * 24 * 14;
export const pool = new pg.Pool({ connectionString: env('DATABASE_URL'), max: 5 });
pool.on('error', (e) => console.error('[pg]', e.message));

const b64u = (b) => Buffer.from(b).toString('base64url');
export const signJwt = (claims, ttl = TTL) => {
  const head = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64u(JSON.stringify({ ...claims, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + ttl }));
  return `${head}.${body}.${createHmac('sha256', SECRET()).update(`${head}.${body}`).digest('base64url')}`;
};
export const verifyJwt = (token) => {
  try {
    const [h, b, s] = String(token).split('.');
    if (!SECRET() || !h || !b || !s) return null;
    const exp = createHmac('sha256', SECRET()).update(`${h}.${b}`).digest();
    const got = Buffer.from(s, 'base64url');
    if (exp.length !== got.length || !timingSafeEqual(exp, got)) return null;
    const p = JSON.parse(Buffer.from(b, 'base64url').toString());
    return p.exp && p.exp > Date.now() / 1000 ? p : null;
  } catch { return null; }
};
/** Chave de serviço para o PostgREST (role service_role, ignora RLS). */
export const serviceKey = () => signJwt({ role: 'service_role' }, 60 * 60 * 24 * 365 * 10);

const COLS = 'id, email, raw_user_meta_data, raw_app_meta_data, phone';
const shape = (r) => r && ({ id: r.id, email: r.email, user_metadata: r.raw_user_meta_data ?? {}, app_metadata: r.raw_app_meta_data ?? {}, phone: r.phone });
export const userById = async (id) => shape((await pool.query(`select ${COLS} from auth.users where id = $1`, [id])).rows[0]);
export const userByEmail = async (e) => shape((await pool.query(`select ${COLS} from auth.users where lower(email) = lower($1)`, [e.trim()])).rows[0]);
export const userByGoogle = async (sub) => shape((await pool.query(`select ${COLS} from auth.users where google_id = $1`, [sub])).rows[0]);
export const tokenFor = (u) => signJwt({ sub: u.id, email: u.email, name: u.user_metadata?.full_name ?? u.user_metadata?.name ?? null, role: 'authenticated' });
const session = (u) => ({ access_token: tokenFor(u), user: u });

async function createUser({ email, password, meta = {}, googleId }) {
  const r = await pool.query(
    `insert into auth.users (email, encrypted_password, raw_user_meta_data, google_id) values ($1,$2,$3,$4) returning id`,
    [email.trim().toLowerCase(), password ? await bcrypt.hash(password, 10) : null, JSON.stringify(meta), googleId ?? null]);
  return userById(r.rows[0].id);
}

// limitador simples (memória) contra força bruta: 8 tentativas / 10 min por IP+e-mail
const tries = new Map();
const tooMany = (key) => {
  const now = Date.now(); const a = (tries.get(key) ?? []).filter((t) => now - t < 600e3);
  a.push(now); tries.set(key, a); if (tries.size > 5000) tries.clear();
  return a.length > 8;
};
class HttpErr extends Error { constructor(status, message) { super(message); this.status = status; } }
const ip = (req) => String(req.headers['x-real-ip'] ?? req.socket.remoteAddress ?? '');

export const bearerUser = async (req) => {
  const a = req.headers.authorization;
  const p = a?.startsWith('Bearer ') ? verifyJwt(a.slice(7)) : null;
  return p?.sub ? userById(p.sub) : null;
};

// ---- Google OAuth (code + PKCE; id_token validado pela JWKS do Google) ----
const GID = () => env('GOOGLE_CLIENT_ID'), GSEC = () => env('GOOGLE_CLIENT_SECRET');
const APP = () => env('APP_URL', 'https://wayia.com.br');
const redirectUri = () => `${APP()}/pay-api/auth/google/callback`;
let jwks = { at: 0, keys: [] };
async function googleKey(kid) {
  if (Date.now() - jwks.at > 3600e3) { jwks = { at: Date.now(), keys: (await (await fetch('https://www.googleapis.com/oauth2/v3/certs')).json()).keys }; }
  return jwks.keys.find((k) => k.kid === kid);
}
async function verifyGoogleIdToken(idToken) {
  const [h, b, s] = idToken.split('.');
  const head = JSON.parse(Buffer.from(h, 'base64url').toString());
  const jwk = await googleKey(head.kid); if (!jwk) throw new Error('chave desconhecida');
  const { createPublicKey, verify } = await import('node:crypto');
  const ok = verify('RSA-SHA256', Buffer.from(`${h}.${b}`), createPublicKey({ key: jwk, format: 'jwk' }), Buffer.from(s, 'base64url'));
  const p = JSON.parse(Buffer.from(b, 'base64url').toString());
  if (!ok || !['https://accounts.google.com', 'accounts.google.com'].includes(p.iss) || p.aud !== GID() || p.exp < Date.now() / 1000 || p.email_verified !== true) throw new Error('id_token inválido');
  return p;
}
const sha = (s) => createHash('sha256').update(s).digest('base64url');

/** Rotas de auth. `json(res, status, body)` e `redirect(res, url, cookies)` vêm do server.mjs. */
export const authRoutes = {
  'GET /auth/providers': async () => ({ google: !!(GID() && GSEC()) }),
  'POST /auth/login': async (req, _u, body) => {
    const email = String(body.email ?? '').trim().toLowerCase();
    if (tooMany(`${ip(req)}|${email}`)) throw new HttpErr(429, 'Muitas tentativas. Aguarde alguns minutos.');
    const row = (await pool.query(`select ${COLS}, encrypted_password from auth.users where lower(email) = $1`, [email])).rows[0];
    if (!row?.encrypted_password || !(await bcrypt.compare(String(body.password ?? ''), row.encrypted_password))) throw new HttpErr(401, 'Invalid login credentials');
    await pool.query('update auth.users set last_sign_in_at = now() where id = $1', [row.id]);
    return session(shape(row));
  },
  'POST /auth/register': async (req, _u, body) => {
    const email = String(body.email ?? '').trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new HttpErr(400, 'E-mail inválido.');
    if (String(body.password ?? '').length < 6) throw new HttpErr(400, 'A senha precisa ter pelo menos 6 caracteres.');
    if (tooMany(`reg|${ip(req)}`)) throw new HttpErr(429, 'Muitas tentativas. Aguarde alguns minutos.');
    if (await userByEmail(email)) throw new HttpErr(409, 'User already registered');
    const d = body.data && typeof body.data === 'object' ? body.data : {};
    const meta = { full_name: String(d.full_name ?? '').slice(0, 120) || undefined, phone: String(d.phone ?? '').slice(0, 30) || undefined };
    return session(await createUser({ email, password: body.password, meta }));
  },
  // Recuperacao de senha por WhatsApp (via WaySend /api/notify). Resposta sempre igual.
  'POST /auth/forgot': async (req, _u, body) => {
    const email = String(body.email ?? '').trim().toLowerCase();
    if (tooMany(`forgot|${ip(req)}`)) throw new HttpErr(429, 'Muitas tentativas. Aguarde alguns minutos.');
    const u = /^\S+@\S+\.\S+$/.test(email) ? await userByEmail(email) : null;
    const rawPhone = String(u?.phone ?? u?.user_metadata?.phone ?? '').replace(/\D/g, '');
    const phone = rawPhone.length < 10 ? null : rawPhone.length <= 11 ? `55${rawPhone}` : rawPhone;
    if (u && phone) {
      const token = randomBytes(32).toString('hex');
      await pool.query(`insert into auth.password_resets (user_id, token_hash, expires_at) values ($1,$2, now() + interval '1 hour')`, [u.id, createHash('sha256').update(token).digest('hex')]);
      const text = `Use o link para criar uma nova senha (vale 1 hora):\n${APP()}/?reset=${token}\nSe não foi você, ignore.`;
      const r = await fetch(`${env('SEND_URL', 'http://waysend-web:3020')}/api/notify`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-service-key': env('GUARDIAN_SERVICE_KEY', '') }, body: JSON.stringify({ phone, text }), signal: AbortSignal.timeout(15000) }).catch(() => null);
      if (!r?.ok) console.warn(`[auth] reset de ${u.email} nao entregue por WhatsApp (${r?.status ?? 'sem resposta'})`);
    } else if (u) console.warn(`[auth] reset de ${u.email}: conta sem telefone cadastrado`);
    return { ok: true };
  },
  'POST /auth/reset': async (_req, _u, body) => {
    if (!body.token || String(body.password ?? '').length < 6) throw new HttpErr(400, 'Dados inválidos (senha com 6+ caracteres).');
    const h = createHash('sha256').update(String(body.token)).digest('hex');
    const r = await pool.query(`update auth.password_resets set used_at = now() where token_hash = $1 and used_at is null and expires_at > now() returning user_id`, [h]);
    if (!r.rows[0]) throw new HttpErr(400, 'Link inválido ou expirado.');
    await pool.query('update auth.users set encrypted_password = $2, updated_at = now() where id = $1', [r.rows[0].user_id, await bcrypt.hash(String(body.password), 10)]);
    return { ok: true };
  },
  'GET /auth/me': async (req) => { const u = await bearerUser(req); if (!u) throw new HttpErr(401, 'login necessario'); return { user: u }; },
  'POST /auth/update': async (req, _u, body) => {
    const u = await bearerUser(req); if (!u) throw new HttpErr(401, 'login necessario');
    if (body.password !== undefined) {
      if (String(body.password).length < 6) throw new HttpErr(400, 'A senha precisa ter pelo menos 6 caracteres.');
      await pool.query('update auth.users set encrypted_password = $2, updated_at = now() where id = $1', [u.id, await bcrypt.hash(String(body.password), 10)]);
    }
    if (body.data && typeof body.data === 'object') {
      const allowed = {}; for (const k of ['full_name', 'phone', 'avatar_url']) if (k in body.data) allowed[k] = String(body.data[k] ?? '').slice(0, 300);
      await pool.query(`update auth.users set raw_user_meta_data = raw_user_meta_data || $2::jsonb, updated_at = now() where id = $1`, [u.id, JSON.stringify(allowed)]);
      if ('full_name' in allowed || 'phone' in allowed) await pool.query(`update public.profiles set full_name = coalesce($2, full_name), phone = coalesce($3, phone) where id = $1`, [u.id, allowed.full_name ?? null, allowed.phone ?? null]).catch(() => {});
    }
    return session(await userById(u.id));
  },
  'POST /leads': async (_r, _u, b) => {
    await pool.query(
      `insert into public.quiz_leads (business_name, segment, goals, contact_name, contact_email, contact_phone) values ($1,$2,$3,$4,$5,$6)`,
      [b.business_name, b.segment, Array.isArray(b.goals) ? b.goals : [], b.contact_name, b.contact_email, b.contact_phone]).catch((e) => { throw new HttpErr(400, e.message.includes('check') ? 'dados inválidos' : 'erro ao salvar'); });
    return { ok: true };
  },
};

/** Fluxo Google: devolve {redirect, setCookies}. */
export async function googleStart() {
  if (!GID() || !GSEC()) return { redirect: `${APP()}/?erro=google_indisponivel` };
  const state = randomBytes(16).toString('base64url'), verifier = randomBytes(32).toString('base64url');
  const q = new URLSearchParams({ client_id: GID(), redirect_uri: redirectUri(), response_type: 'code', scope: 'openid email profile', state, code_challenge: sha(verifier), code_challenge_method: 'S256', prompt: 'select_account' });
  const o = 'Path=/pay-api/auth/google; HttpOnly; Secure; SameSite=Lax; Max-Age=600';
  return { redirect: `https://accounts.google.com/o/oauth2/v2/auth?${q}`, setCookies: [`g_state=${state}; ${o}`, `g_verifier=${verifier}; ${o}`] };
}
export async function googleCallback(req, url) {
  const back = (e) => ({ redirect: `${APP()}/?erro=${e}` });
  const ck = Object.fromEntries(String(req.headers.cookie ?? '').split(';').map((c) => c.trim().split('=')));
  const q = url.searchParams;
  if (q.get('error') || !q.get('code') || !ck.g_state || q.get('state') !== ck.g_state || !ck.g_verifier) return back('google_cancelado');
  try {
    const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code: q.get('code'), client_id: GID(), client_secret: GSEC(), redirect_uri: redirectUri(), grant_type: 'authorization_code', code_verifier: ck.g_verifier }) });
    const j = await r.json(); if (!r.ok || !j.id_token) throw new Error(j.error_description ?? 'troca falhou');
    const p = await verifyGoogleIdToken(j.id_token);
    let u = await userByGoogle(p.sub);
    if (!u) {
      const byEmail = await userByEmail(p.email);
      if (byEmail) { await pool.query('update auth.users set google_id = $2 where id = $1', [byEmail.id, p.sub]); u = byEmail; }
      else u = await createUser({ email: p.email, googleId: p.sub, meta: { full_name: p.name ?? p.email.split('@')[0] } });
    }
    const clear = 'Path=/pay-api/auth/google; Max-Age=0';
    return { redirect: `${APP()}/dashboard/#gt=${tokenFor(u)}`, setCookies: [`g_state=; ${clear}`, `g_verifier=; ${clear}`] };
  } catch (e) { console.warn('[auth] google:', e.message); return back('google_falhou'); }
}
