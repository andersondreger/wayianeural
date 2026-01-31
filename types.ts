
export type ViewState = 'LANDING' | 'LOGIN' | 'ONBOARDING' | 'DASHBOARD' | 'THANK_YOU';

export type DashboardTab = 'overview' | 'atendimento' | 'kanban' | 'integracoes' | 'agentes' | 'settings';

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
  instanceKey?: string;
}

export type Sentiment = 'happy' | 'neutral' | 'angry';

export interface Message {
  id: string;
  text: string;
  sender: 'me' | 'contact';
  time: string;
  status: 'sent' | 'delivered' | 'read';
  type: 'text' | 'image' | 'audio' | 'video';
}

export interface Ticket {
  id: string;
  contactName: string;
  contactPhone: string;
  lastMessage: string;
  avatar?: string;
  sentiment: Sentiment;
  time: string;
  status: 'novo' | 'em_atendimento' | 'aguardando' | 'finalizado';
  unreadCount: number;
  assignedTo: string;
  protocol: string;
  messages: Message[];
  instanceSource: string; // Nova propriedade para saber de qual chip veio o lead
}

export interface KanbanColumn {
  id: Ticket['status'];
  title: string;
  tickets: Ticket[];
}
