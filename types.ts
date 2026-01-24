
export type ViewState = 'LANDING' | 'LOGIN' | 'ONBOARDING' | 'DASHBOARD' | 'THANK_YOU';

export type DashboardTab = 'overview' | 'atendimento' | 'evolution' | 'config-neural' | 'clientes' | 'financeiro' | 'n8n' | 'afiliados' | 'admin' | 'settings';

export type SubscriptionStatus = 'ACTIVE' | 'TRIALING' | 'EXPIRED' | 'INACTIVE';

export interface SystemMessage {
  id: string;
  text: string;
  type: 'info' | 'alert' | 'urgent';
  timestamp: number;
}

export interface UserSession {
  email: string;
  name: string;
  phone?: string;
  isAdmin: boolean;
  isAffiliate?: boolean;
  trialStart: number;
  subscriptionStatus?: SubscriptionStatus;
  stripeCustomerId?: string;
  messages?: SystemMessage[];
}

export interface EvolutionInstance {
  id: string;
  name: string;
  status: 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING';
  phone?: string;
  qrCode?: string;
  instanceKey?: string;
}

export type Sentiment = 'happy' | 'neutral' | 'angry';

export interface Lead {
  id: string;
  name: string;
  phone: string;
  lastMessage: string;
  summary?: string;
  sentiment: Sentiment;
  time: string;
  stage: 'novo' | 'qualificado' | 'agendado' | 'fechado';
  isPaused?: boolean;
}

export interface AgentIA {
  id: string;
  name: string;
  tone: string;
  objective: string;
  knowledgeBase: string;
  companyName: string;
}

export interface Affiliate {
  id: string;
  name: string;
  email: string;
  referrals: number;
  commission: string;
}

export interface WebhookLog {
  id: string;
  event: string;
  status: 'success' | 'error';
  timestamp: number;
  payload_summary: string;
}
