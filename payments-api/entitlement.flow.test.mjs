// Fluxo ponta a ponta do /entitlement com um PostgREST falso em memoria (sem rede, sem Supabase real).
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

const db = { products: [], subs: [] };
const fake = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  const table = u.pathname.split('/').pop();
  const eq = (k) => u.searchParams.get(k)?.replace(/^eq\./, '');
  let body = ''; for await (const c of req) body += c;
  const send = (code, v) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(v)); };
  if (table === 'pay_products') return send(200, db.products.filter((p) => !eq('slug') || p.slug === eq('slug')));
  if (table === 'pay_subscriptions') {
    if (req.method === 'POST') {
      const row = JSON.parse(body);
      if (!db.subs.find((s) => s.email === row.email && s.product_slug === row.product_slug)) db.subs.push({ id: String(db.subs.length + 1), ...row });
      return send(201, []);
    }
    if (req.method === 'PATCH') {
      const hit = db.subs.filter((s) => s.email === eq('email') && s.product_slug === eq('product_slug') && (!u.searchParams.get('claimed_ref') || !s.claimed_ref));
      hit.forEach((s) => Object.assign(s, JSON.parse(body)));
      return send(200, hit);
    }
    return send(200, db.subs.filter((s) => (!eq('email') || s.email === eq('email')) && (!eq('product_slug') || s.product_slug === eq('product_slug'))));
  }
  send(404, {});
});
await new Promise((r) => fake.listen(0, r));
Object.assign(process.env, {
  SUPABASE_URL: `http://127.0.0.1:${fake.address().port}`, SUPABASE_SERVICE_ROLE_KEY: 'k', PAY_SERVICE_TOKEN: 'glob',
  PAY_SERVICE_TOKENS: 'waysend=ws-key', HANDOFF_SECRET: 'segredo', PANEL_URL: 'https://wayia.com.br/app/',
});
const { server } = await import('./server.mjs');
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;
const ent = (email, product, key = 'ws-key', extra = '') =>
  fetch(`${base}/entitlement?email=${email}&product=${product}${extra}`, { headers: { 'x-service-token': key } }).then(async (r) => ({ status: r.status, ...(await r.json()) }));

db.products = [
  { slug: 'waysend', tier: 'paid', trial_days: 11, price_cents: 9700, cycle: 'MONTHLY' },
  { slug: 'wayar', tier: 'free', trial_days: 11, price_cents: 9700 },
];

test.after(() => { server.close(); fake.close(); });

test('1o acesso abre teste de 11 dias, segundo acesso nao reabre', async () => {
  const a = await ent('novo@x.com', 'waysend');
  assert.equal(a.state, 'TRIAL'); assert.equal(a.access, 'full'); assert.equal(a.daysLeft, 11); assert.equal(a.active, true);
  assert.match(a.payUrl, /^https:\/\/wayia\.com\.br\/app\/\?pay=waysend#h=/);
  assert.equal(db.subs.length, 1);
  await ent('novo@x.com', 'waysend');
  assert.equal(db.subs.length, 1);
});

test('teste vencido vira somente leitura e NAO reabre teste novo', async () => {
  db.subs[0].trial_ends_at = new Date(Date.now() - 86_400_000).toISOString();
  const a = await ent('novo@x.com', 'waysend');
  assert.equal(a.state, 'EXPIRED'); assert.equal(a.access, 'readonly'); assert.equal(a.readOnly, true); assert.equal(a.active, false);
  assert.equal(db.subs.length, 1);
});

test('pagamento aprovado (webhook marcou ACTIVE) libera e remove o link de pagamento do handoff', async () => {
  Object.assign(db.subs[0], { status: 'ACTIVE', current_period_end: new Date(Date.now() + 20 * 86_400_000).toISOString() });
  const a = await ent('novo@x.com', 'waysend');
  assert.equal(a.state, 'ACTIVE'); assert.equal(a.access, 'full');
  assert.ok(!a.payUrl.includes('#h='));
});

test('produto gratis nunca cria linha nem bloqueia', async () => {
  const before = db.subs.length;
  const a = await ent('novo@x.com', 'wayar', 'glob');
  assert.equal(a.state, 'FREE'); assert.equal(a.access, 'full');
  assert.equal(db.subs.length, before);
});

test('chave errada ou de outro produto e recusada', async () => {
  assert.equal((await ent('novo@x.com', 'waysend', 'glob')).status, 401);   // waysend tem chave propria
  assert.equal((await ent('novo@x.com', 'wayar', 'ws-key')).status, 401);   // chave do waysend nao vale no wayar
});

test('um negocio so por assinatura: segundo ref com o mesmo e-mail e recusado', async () => {
  db.subs.push({ id: 'x', email: 'dupla@x.com', product_slug: 'waysend', status: 'TRIAL', trial_ends_at: new Date(Date.now() + 5 * 86_400_000).toISOString() });
  assert.equal((await ent('dupla@x.com', 'waysend', 'ws-key', '&ref=waysend:A')).active, true);
  const b = await ent('dupla@x.com', 'waysend', 'ws-key', '&ref=waysend:B');
  assert.equal(b.active, false); assert.equal(b.reason, 'claimed_by_other_business');
});
