import { supabase } from './supabase';

// payments-api fica atras do nginx em /pay-api/ (mesma origem, sem CORS).
const BASE = '/pay-api';

export interface PayProduct {
  slug: string;
  name: string;
  description: string | null;
  price_cents: number;
  cycle: 'MONTHLY' | 'YEARLY';
  app_url: string;
  active: boolean;
  checkout_url?: string | null;
}

export interface PaySubscription {
  email: string;
  product_slug: string;
  status: 'PENDING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED';
  price_cents: number;
  invoice_url: string | null;
  current_period_end: string | null;
  created_at: string;
  billing_type?: string | null;
}

export interface PayTicket {
  id: string;
  source_ref: string;
  product_slug: string;
  email: string;
  subject: string;
  message: string;
  status: 'open' | 'answered' | 'closed';
  reply: string | null;
  replied_at: string | null;
  created_at: string;
  phone?: string | null;
  whatsapp_optin?: boolean;
  wa_reply_status?: 'sent' | 'failed' | null;
}

export const brl = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Link assinado vindo de um projeto (/app/?pay=<slug>#h=<token>): vale so para pagar aquele produto, nao pede codigo de novo.
// Fica na sessionStorage (some ao fechar a aba) e e tirado da URL na hora para nao vazar em historico/compartilhamento.
const HANDOFF_KEY = 'wayia_handoff';
export function captureHandoff(): string | null {
  try {
    const m = window.location.hash.match(/[#&]h=([\w.-]+)/);
    if (m) {
      sessionStorage.setItem(HANDOFF_KEY, m[1]);
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    return sessionStorage.getItem(HANDOFF_KEY);
  } catch { return null; }
}
export const hasHandoff = () => !!captureHandoff();

async function call<T>(path: string, init: RequestInit = {}, auth = true): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth) {
    const { data: { session } } = await supabase.auth.getSession();
    const handoff = captureHandoff();
    if (session) headers.Authorization = `Bearer ${session.access_token}`;
    else if (handoff) headers['x-handoff'] = handoff;
    else throw new Error('login necessario');
  }
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && headers['x-handoff']) { try { sessionStorage.removeItem(HANDOFF_KEY); } catch { /* sem storage */ } }
  if (!res.ok) throw new Error(data.error || `erro ${res.status}`);
  return data as T;
}

export const payApi = {
  catalog: () => call<PayProduct[]>('/catalog', {}, false),
  me: () => call<{ email: string; isAdmin: boolean; subscriptions: PaySubscription[] }>('/me'),
  checkout: (product: string, cpfCnpj: string) =>
    call<{ invoiceUrl?: string | null; alreadyActive?: boolean; redirect?: string; externalUrl?: string }>('/checkout', {
      method: 'POST', body: JSON.stringify({ product, cpfCnpj }),
    }),
  hub: () => call<Hub>('/me/hub'),
  myPayments: () => call<MyPayments>('/me/payments'),
  myExport: () => call<any>('/me/export'),
  cancel: (product: string) => call<{ canceled: boolean }>('/me/cancel', { method: 'POST', body: JSON.stringify({ product }) }),
  deleteMyData: () => call<{ deleted: boolean }>('/me/delete', { method: 'POST', body: '{}' }),
  adminSummary: () => call<any>('/admin/summary'),
  adminFinance: () => call<Finance>('/admin/finance'),
  adminTickets: (status?: PayTicket['status']) => call<PayTicket[]>(`/admin/tickets${status ? `?status=${status}` : ''}`),
  adminReplyTicket: (id: string, body: { reply?: string; status?: PayTicket['status'] }) =>
    call<PayTicket & { whatsapp?: 'sent' | 'failed' | 'skipped' }>(`/admin/tickets/${id}/reply`, { method: 'POST', body: JSON.stringify(body) }),
  adminProducts: () => call<PayProduct[]>('/admin/products'),
  adminUpdateProduct: (slug: string, patch: { price_cents?: number; active?: boolean }) =>
    call<PayProduct>(`/admin/products/${slug}`, { method: 'PUT', body: JSON.stringify(patch) }),
};

// Confirmacao de e-mail por codigo (OTP) so para a area de pagamentos:
// o login atual do portal nao cria sessao real no Supabase.
export const sendEmailCode = (email: string) =>
  supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
export const verifyEmailCode = (email: string, token: string) =>
  supabase.auth.verifyOtp({ email, token, type: 'email' });

export interface Finance {
  kpis: {
    mrrCents: number; arrCents: number; activeCount: number; arpuCents: number;
    receivedThisMonthCents: number; receivedPrevMonthCents: number; refundsThisMonthCents: number;
    pendingCents: number; pendingCount: number; atRiskCents: number; pastDueCount: number;
    newThisMonth: number; canceledThisMonth: number; churnPct: number;
  };
  months: { month: string; receivedCents: number; refundsCents: number; newSubs: number; canceled: number }[];
  byProduct: { slug: string; name: string; active: number; mrrCents: number; received12mCents: number; sharePct: number }[];
  overdue: { email: string; product: string; priceCents: number; since: string }[];
  gatewayMode: string;
  generatedAt: string;
}

export interface MyPayments {
  subscriptions: { product_slug: string; status: PaySubscription['status']; price_cents: number; billing_type: string | null;
    invoice_url: string | null; current_period_end: string | null; created_at: string; canCancel: boolean }[];
  invoices: { product: string; amountCents: number; status: string | null; event: string; dueDate: string | null; paidAt: string | null;
    billingType: string | null; url: string | null; at: string }[];
  tickets: { product_slug: string; subject: string; status: PayTicket['status']; reply: string | null; replied_at: string | null; created_at: string }[];
}

export interface HubProject {
  slug: string; name: string; description: string | null; tier: 'free' | 'paid'; price_cents: number; cycle: 'MONTHLY' | 'YEARLY';
  app_url: string; checkout_url: string | null; trial_days: number;
  state: 'FREE' | 'TRIAL' | 'ACTIVE' | 'GRACE' | 'EXPIRED' | 'NONE'; access: 'full' | 'readonly' | 'none'; active: boolean;
  daysLeft: number | null; trialEndsAt: string | null; currentPeriodEnd: string | null;
}
export interface Hub { email: string; scoped: boolean; projects: HubProject[] }
