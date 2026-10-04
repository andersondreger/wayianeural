// WayIA Payments API - zero dependencias (Node 20+).
// Gateway: Asaas (o mesmo do WayAR). Banco/auth: Supabase do wayianeural.
// Segredos so por variavel de ambiente (.env da VPS), nunca no navegador.
import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';

const env = (k, d = '') => process.env[k] ?? d;
const PORT = Number(env('PORT', '3000'));
const SUPABASE_URL = env('SUPABASE_URL', 'https://dteagxhnuhejefvguxfw.supabase.co');
const SERVICE_KEY = env('SUPABASE_SERVICE_ROLE_KEY');
const PUBLISHABLE_KEY = env('SUPABASE_PUBLISHABLE_KEY');
const ASAAS_BASE = env('ASAAS_API_BASE_URL', 'https://sandbox.asaas.com/api/v3');
const ASAAS_KEY = env('ASAAS_API_KEY');
const WEBHOOK_TOKEN = env('ASAAS_WEBHOOK_TOKEN');
const SERVICE_TOKEN = env('PAY_SERVICE_TOKEN'); // projetos do ecossistema consultam /entitlement com isto
const ADMINS = env('ADMIN_EMAILS').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
const ALLOWED_ORIGINS = env('ALLOWED_ORIGINS', 'https://wayia.com.br').split(',').map((s) => s.trim());

// ---------- helpers ----------
const safeEq = (a = '', b = '') => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
};

const ACTIVE = new Set(['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED', 'PAYMENT_RESTORED', 'PAYMENT_ANTICIPATED']);
const PAST_DUE = new Set(['PAYMENT_OVERDUE', 'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED', 'PAYMENT_CHARGEBACK_REQUESTED',
  'PAYMENT_CHARGEBACK_DISPUTE', 'PAYMENT_REPROVED_BY_RISK_ANALYSIS']);
const CANCELED = new Set(['PAYMENT_DELETED', 'PAYMENT_REFUNDED', 'PAYMENT_PARTIALLY_REFUNDED',
  'PAYMENT_REFUND_IN_PROGRESS', 'SUBSCRIPTION_DELETED', 'SUBSCRIPTION_INACTIVATED']);
export const eventToStatus = (e) => (ACTIVE.has(e) ? 'ACTIVE' : PAST_DUE.has(e) ? 'PAST_DUE' : CANCELED.has(e) ? 'CANCELED' : null);

export const isEntitled = (sub) =>
  !!sub && sub.status === 'ACTIVE' && (!sub.current_period_end || new Date(sub.current_period_end) > new Date());

const sb = async (path, { method = 'GET', body, prefer } = {}) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new HttpError(502, `supabase ${res.status}`);
  return res.status === 204 ? null : res.json();
};

const asaas = async (path, init = {}) => {
  if (!ASAAS_KEY) throw new HttpError(503, 'gateway de pagamento nao configurado');
  const res = await fetch(`${ASAAS_BASE}${path}`, {
    ...init, headers: { 'Content-Type': 'application/json', access_token: ASAAS_KEY },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new HttpError(502, `asaas ${res.status}: ${data?.errors?.[0]?.description ?? 'erro'}`);
  return data;
};

class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }

const userFromJwt = async (req) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) throw new HttpError(401, 'login necessario');
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: PUBLISHABLE_KEY, Authorization: auth } });
  if (!res.ok) throw new HttpError(401, 'sessao invalida');
  const u = await res.json();
  if (!u.email) throw new HttpError(401, 'sessao invalida');
  return { email: u.email.toLowerCase(), name: u.user_metadata?.full_name };
};
const adminFromJwt = async (req) => {
  const u = await userFromJwt(req);
  if (!ADMINS.includes(u.email)) throw new HttpError(403, 'acesso restrito');
  return u;
};

const readJson = async (req) => {
  let size = 0; const chunks = [];
  for await (const c of req) { size += c.length; if (size > 64 * 1024) throw new HttpError(413, 'payload grande'); chunks.push(c); }
  try { return chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {}; } catch { throw new HttpError(400, 'json invalido'); }
};

const validCpfCnpj = (v) => /^\d{11}$|^\d{14}$/.test(v);

// ---------- handlers ----------
const routes = {
  'GET /catalog': async () => sb('pay_products?active=eq.true&order=sort.asc'),

  'GET /me': async (req) => {
    const u = await userFromJwt(req);
    const subs = await sb(`pay_subscriptions?email=eq.${encodeURIComponent(u.email)}&select=*`);
    return { email: u.email, isAdmin: ADMINS.includes(u.email), subscriptions: subs };
  },

  'POST /checkout': async (req) => {
    const u = await userFromJwt(req);
    const { product, cpfCnpj, billingType = 'UNDEFINED' } = await readJson(req);
    const doc = String(cpfCnpj ?? '').replace(/\D/g, '');
    if (!validCpfCnpj(doc)) throw new HttpError(400, 'CPF/CNPJ invalido');
    if (!['UNDEFINED', 'PIX', 'CREDIT_CARD', 'BOLETO'].includes(billingType)) throw new HttpError(400, 'forma de pagamento invalida');

    const [prod] = await sb(`pay_products?slug=eq.${encodeURIComponent(String(product))}&active=eq.true`);
    if (!prod) throw new HttpError(404, 'produto nao encontrado');

    const [existing] = await sb(`pay_subscriptions?email=eq.${encodeURIComponent(u.email)}&product_slug=eq.${prod.slug}`);
    if (isEntitled(existing)) return { alreadyActive: true, redirect: prod.app_url };
    if (existing?.status === 'PENDING' && existing.invoice_url) return { invoiceUrl: existing.invoice_url };

    const customerId = existing?.asaas_customer_id ?? (await asaas('/customers', {
      method: 'POST', body: JSON.stringify({ name: u.name || u.email.split('@')[0], email: u.email, cpfCnpj: doc }),
    })).id;

    const due = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const sub = await asaas('/subscriptions', {
      method: 'POST',
      body: JSON.stringify({
        customer: customerId, billingType, value: prod.price_cents / 100, nextDueDate: due,
        cycle: prod.cycle, description: `WayIA ${prod.name}`, externalReference: `${u.email}|${prod.slug}`,
      }),
    });
    const first = (await asaas(`/payments?subscription=${sub.id}&limit=1`)).data?.[0];

    await sb('pay_subscriptions?on_conflict=email,product_slug', {
      method: 'POST', prefer: 'resolution=merge-duplicates',
      body: {
        email: u.email, product_slug: prod.slug, status: 'PENDING', billing_type: billingType,
        asaas_customer_id: customerId, asaas_subscription_id: sub.id, invoice_url: first?.invoiceUrl ?? null,
        price_cents: prod.price_cents, updated_at: new Date().toISOString(),
      },
    });
    return { invoiceUrl: first?.invoiceUrl ?? null };
  },

  'POST /webhook/asaas': async (req) => {
    if (!safeEq(req.headers['asaas-access-token'], WEBHOOK_TOKEN)) throw new HttpError(401, 'token invalido');
    const evt = await readJson(req);
    const subId = evt.payment?.subscription ?? evt.subscription?.id ?? null;
    const amount = evt.payment?.value != null ? Math.round(evt.payment.value * 100) : null;
    if (evt.id) {
      await sb('pay_events?on_conflict=id', {
        method: 'POST', prefer: 'resolution=ignore-duplicates,return=minimal',
        body: { id: evt.id, event: evt.event, asaas_subscription_id: subId, amount_cents: amount, payload: evt },
      });
    }
    const status = eventToStatus(evt.event);
    if (status && subId) {
      const patch = { status, updated_at: new Date().toISOString() };
      if (status === 'ACTIVE') {
        // acesso ate o proximo vencimento + 3 dias de tolerancia
        const next = evt.payment?.dueDate ? new Date(evt.payment.dueDate) : new Date();
        next.setDate(next.getDate() + 33);
        patch.current_period_end = next.toISOString();
      }
      await sb(`pay_subscriptions?asaas_subscription_id=eq.${encodeURIComponent(subId)}`, { method: 'PATCH', body: patch });
    }
    return { received: true };
  },

  // Chamado pelos outros projetos (pet360, imob360...) no servidor deles.
  'GET /entitlement': async (req, url) => {
    if (!safeEq(req.headers['x-service-token'], SERVICE_TOKEN)) throw new HttpError(401, 'token invalido');
    const email = (url.searchParams.get('email') ?? '').toLowerCase();
    const product = url.searchParams.get('product') ?? '';
    if (!email || !product) throw new HttpError(400, 'email e product obrigatorios');
    const [sub] = await sb(`pay_subscriptions?email=eq.${encodeURIComponent(email)}&product_slug=eq.${encodeURIComponent(product)}`);
    return { active: isEntitled(sub), status: sub?.status ?? 'NONE', currentPeriodEnd: sub?.current_period_end ?? null };
  },

  'GET /admin/summary': async (req) => {
    await adminFromJwt(req);
    const subs = await sb('pay_subscriptions?select=product_slug,status,price_cents,email,created_at,billing_type&order=created_at.desc');
    const active = subs.filter((s) => s.status === 'ACTIVE');
    const byProduct = {};
    for (const s of subs) {
      const p = (byProduct[s.product_slug] ??= { active: 0, pending: 0, pastDue: 0, canceled: 0, mrrCents: 0 });
      if (s.status === 'ACTIVE') { p.active++; p.mrrCents += s.price_cents; }
      else if (s.status === 'PENDING') p.pending++;
      else if (s.status === 'PAST_DUE') p.pastDue++;
      else p.canceled++;
    }
    return {
      mrrCents: active.reduce((a, s) => a + s.price_cents, 0),
      activeCount: active.length, pendingCount: subs.filter((s) => s.status === 'PENDING').length,
      pastDueCount: subs.filter((s) => s.status === 'PAST_DUE').length,
      byProduct, subscriptions: subs.slice(0, 200),
      gatewayMode: ASAAS_BASE.includes('sandbox') ? 'sandbox' : 'producao',
    };
  },

  'GET /admin/products': async (req) => { await adminFromJwt(req); return sb('pay_products?order=sort.asc'); },
};

// PUT /admin/products/:slug  (preco/ativo/descricao). Preco novo vale so para novas contratacoes.
const updateProduct = async (req, slug) => {
  await adminFromJwt(req);
  const b = await readJson(req);
  const patch = { updated_at: new Date().toISOString() };
  if (b.price_cents !== undefined) {
    if (!Number.isInteger(b.price_cents) || b.price_cents < 100 || b.price_cents > 10_000_000) throw new HttpError(400, 'preco invalido');
    patch.price_cents = b.price_cents;
  }
  if (typeof b.active === 'boolean') patch.active = b.active;
  if (typeof b.description === 'string') patch.description = b.description.slice(0, 400);
  const rows = await sb(`pay_products?slug=eq.${encodeURIComponent(slug)}`, { method: 'PATCH', body: patch, prefer: 'return=representation' });
  if (!rows?.length) throw new HttpError(404, 'produto nao encontrado');
  return rows[0];
};

// ---------- server ----------
export const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const origin = req.headers.origin;
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    Object.assign(headers, {
      'Access-Control-Allow-Origin': origin, Vary: 'Origin',
      'Access-Control-Allow-Headers': 'authorization, content-type', 'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    });
  }
  if (req.method === 'OPTIONS') { res.writeHead(204, headers); return res.end(); }
  try {
    const put = url.pathname.match(/^\/admin\/products\/([a-z0-9-]+)$/);
    const handler = put && req.method === 'PUT' ? (r) => updateProduct(r, put[1]) : routes[`${req.method} ${url.pathname}`];
    if (!handler) throw new HttpError(404, 'nao encontrado');
    const out = await handler(req, url);
    res.writeHead(200, headers); res.end(JSON.stringify(out));
  } catch (e) {
    const status = e.status ?? 500;
    if (status >= 500) console.error('[payments-api]', e.message);
    res.writeHead(status, headers); res.end(JSON.stringify({ error: status >= 500 && !e.status ? 'erro interno' : e.message }));
  }
});

if (process.argv[1]?.endsWith('server.mjs')) {
  for (const k of ['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_PUBLISHABLE_KEY', 'ASAAS_API_KEY', 'ASAAS_WEBHOOK_TOKEN', 'PAY_SERVICE_TOKEN', 'ADMIN_EMAILS']) {
    if (!env(k)) console.warn(`[payments-api] AVISO: ${k} nao definida`);
  }
  server.listen(PORT, () => console.log(`payments-api na porta ${PORT} (gateway: ${ASAAS_BASE.includes('sandbox') ? 'sandbox' : 'PRODUCAO'})`));
}
