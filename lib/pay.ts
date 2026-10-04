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

export const brl = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

async function call<T>(path: string, init: RequestInit = {}, auth = true): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('login necessario');
    headers.Authorization = `Bearer ${session.access_token}`;
  }
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `erro ${res.status}`);
  return data as T;
}

export const payApi = {
  catalog: () => call<PayProduct[]>('/catalog', {}, false),
  me: () => call<{ email: string; isAdmin: boolean; subscriptions: PaySubscription[] }>('/me'),
  checkout: (product: string, cpfCnpj: string) =>
    call<{ invoiceUrl?: string | null; alreadyActive?: boolean; redirect?: string }>('/checkout', {
      method: 'POST', body: JSON.stringify({ product, cpfCnpj }),
    }),
  adminSummary: () => call<any>('/admin/summary'),
  adminFinance: () => call<Finance>('/admin/finance'),
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
