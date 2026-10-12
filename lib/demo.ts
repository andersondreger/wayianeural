import type { Hub, HubProject, MyPayments, Overview, Finance, PayTicket } from './pay';

// Dados de EXEMPLO do /dashboard sem login ("Demonstrativo"). Nada aqui e real: nomes e valores sao ficticios.
const p = (slug: string, name: string, description: string, state: HubProject['state'], extra: Partial<HubProject> = {}): HubProject => ({
  slug, name, description, tier: 'paid', price_cents: 14900, cycle: 'MONTHLY', app_url: '#', checkout_url: null, trial_days: 11,
  state, access: ['FREE', 'TRIAL', 'ACTIVE', 'GRACE'].includes(state) ? 'full' : 'none', active: state === 'ACTIVE',
  daysLeft: null, trialEndsAt: null, currentPeriodEnd: '2026-11-05T00:00:00Z', ...extra,
});

export const DEMO_HUB: Hub = {
  email: 'cliente@email.com', scoped: false,
  projects: [
    p('wayar', 'WayAR', 'Realidade aumentada na web para o seu negócio', 'ACTIVE', { seats: { used: 3, total: 5 } }),
    p('wayclip', 'WayClip', 'Vídeos com avatar e roteiro calibrado', 'ACTIVE', { seats: { used: 2, total: 5 } }),
    p('pharmagent', 'PharmAgent', 'Agentes de WhatsApp para farmácias', 'ACTIVE', { seats: { used: 4, total: 5 } }),
    p('forja', 'Forja', 'Gere modelos 3D a partir de texto', 'NONE', { trial_days: 0 }),
    p('wayfarm', 'WayFarm', 'Gestão de plantio e aviário', 'NONE', { trial_days: 0 }),
    p('waysend', 'WaySend', 'Envio programado de WhatsApp', 'NONE', { trial_days: 0 }),
    p('waypulse', 'WayPulse', 'Scanner de sites: SEO, GEO e WebMCP', 'NONE', { trial_days: 0 }),
    p('waymeet', 'WayMeet', 'Sala de reunião com agentes de IA', 'NONE', { trial_days: 0 }),
  ],
};

export const DEMO_PAYMENTS: MyPayments = {
  subscriptions: [],
  invoices: [
    { product: 'Mensalidade · mês anterior', amountCents: 89000, status: 'RECEIVED', event: 'PAYMENT_RECEIVED', dueDate: null, paidAt: null, billingType: null, url: null, at: '2026-09-05T00:00:00Z' },
    { product: 'Setup inicial', amountCents: 150000, status: 'RECEIVED', event: 'PAYMENT_RECEIVED', dueDate: null, paidAt: null, billingType: null, url: null, at: '2026-08-05T00:00:00Z' },
  ],
  tickets: [
    { product_slug: 'wayar', subject: 'Dúvida sobre integração', status: 'open', reply: null, replied_at: null, created_at: '2026-10-08T00:00:00Z' },
    { product_slug: 'wayclip', subject: 'Ajuste de cadastro', status: 'answered', reply: 'Ajuste feito.', replied_at: '2026-10-05T00:00:00Z', created_at: '2026-10-04T00:00:00Z' },
  ],
};

export const DEMO_OVERVIEW: Overview = {
  gatewayMode: 'sandbox', generatedAt: new Date().toISOString(),
  totals: { products: 8, customers: 3, openTickets: 2, trials: 1 },
  products: DEMO_HUB.projects.map((x, i) => ({
    slug: x.slug, name: x.name, tier: 'paid' as const, active: true, price_cents: 14900, cycle: 'MONTHLY' as const, app_url: '#', checkout_url: null, trial_days: 11,
    counts: { FREE: 0, TRIAL: i === 1 ? 1 : 0, ACTIVE: i < 3 ? 2 : 0, GRACE: 0, EXPIRED: 0, NONE: 0 }, mrrCents: i < 3 ? 29800 : 0, openTickets: i === 0 ? 1 : 0,
  })),
  customers: [
    { email: 'farmacia@exemplo.com', mrrCents: 44700, since: '2026-08-05T00:00:00Z', products: [
      { slug: 'wayar', state: 'ACTIVE', access: 'full', daysLeft: null, priceCents: 14900 }, { slug: 'pharmagent', state: 'ACTIVE', access: 'full', daysLeft: null, priceCents: 14900 }, { slug: 'wayclip', state: 'TRIAL', access: 'full', daysLeft: 6, priceCents: 14900 }] },
    { email: 'pet@exemplo.com', mrrCents: 14900, since: '2026-09-12T00:00:00Z', products: [{ slug: 'wayar', state: 'ACTIVE', access: 'full', daysLeft: null, priceCents: 14900 }] },
    { email: 'salao@exemplo.com', mrrCents: 0, since: '2026-10-01T00:00:00Z', products: [{ slug: 'wayclip', state: 'EXPIRED', access: 'readonly', daysLeft: null, priceCents: 14900 }] },
  ],
};

const months = Array.from({ length: 12 }, (_, i) => {
  const d = new Date(Date.UTC(2026, 9 - 11 + i, 1));
  return { month: d.toISOString().slice(0, 7), receivedCents: i < 6 ? 0 : [29800, 59600, 89400, 104300, 134100, 148900][i - 6], refundsCents: 0, newSubs: i < 6 ? 0 : 2, canceled: 0 };
});
export const DEMO_FINANCE: Finance = {
  kpis: { mrrCents: 148900, arrCents: 1786800, activeCount: 6, arpuCents: 24816, receivedThisMonthCents: 148900, receivedPrevMonthCents: 134100, refundsThisMonthCents: 0,
    pendingCents: 14900, pendingCount: 1, atRiskCents: 0, pastDueCount: 0, newThisMonth: 2, canceledThisMonth: 0, churnPct: 0 },
  months, byProduct: [], overdue: [], gatewayMode: 'sandbox', generatedAt: new Date().toISOString(),
};

export const DEMO_TICKETS: PayTicket[] = [
  { id: '1', source_ref: 'd:1', product_slug: 'wayar', email: 'farmacia@exemplo.com', subject: 'Dúvida sobre integração', message: 'Como conecto o WayAR ao meu site?', status: 'open', reply: null, replied_at: null, created_at: '2026-10-08T00:00:00Z' },
  { id: '2', source_ref: 'd:2', product_slug: 'wayclip', email: 'pet@exemplo.com', subject: 'Ajuste de cadastro', message: 'Preciso trocar o CNPJ.', status: 'answered', reply: 'Ajuste feito.', replied_at: '2026-10-05T00:00:00Z', created_at: '2026-10-04T00:00:00Z' },
];

// Novidades do ecossistema (coluna da direita). Edite aqui para publicar um aviso para todos os clientes.
export const NEWS: { tag: 'Novo' | 'Melhoria' | 'Aviso'; title: string; text: string }[] = [
  { tag: 'Novo', title: 'Dashboard único do ecossistema Way', text: 'Todos os seus produtos, financeiro e suporte em um só lugar.' },
  { tag: 'Melhoria', title: 'Teste grátis de 11 dias por produto', text: 'Entre em qualquer produto e experimente com acesso completo.' },
  { tag: 'Aviso', title: 'Teste vencido vira somente leitura', text: 'Seus dados ficam salvos; assine para voltar a criar.' },
];
