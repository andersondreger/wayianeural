// Projetos do ecossistema WayIA que aparecem como card no Painel Financeiro.
// `billing` diz como o projeto cobra hoje. Ao integrar um projeto, troque 'none' por
// 'central' (payments-api) ou 'own' (Asaas proprio) e, se for central, cadastre o slug em pay_products.
export type BillingMode = 'central' | 'own' | 'none';

export interface EcosystemProject {
  slug: string;
  name: string;
  billing: BillingMode;
  url?: string;
}

export const ECOSYSTEM: EcosystemProject[] = [
  { slug: 'pet360', name: 'Pet360', billing: 'central', url: 'https://pet360.wayia.com.br/' },
  { slug: 'imob360', name: 'ImobiVision 360', billing: 'central', url: 'https://imob360.wayia.com.br/' },
  { slug: 'criar', name: 'WayIA Criar', billing: 'own', url: 'https://criar.wayia.com.br/' },
  { slug: 'neural', name: 'WayFlow Neural', billing: 'central', url: 'https://wayia.com.br/app/' },
  { slug: 'bela360', name: 'Bela360', billing: 'own', url: 'https://bela360.wayia.com.br/' },
  { slug: 'wayar', name: 'WayAR', billing: 'own', url: 'https://wayar.wayia.com.br/' },
  { slug: 'way3d', name: 'Way3D', billing: 'none' },
  { slug: 'waymeet', name: 'WayMeet', billing: 'none' },
  { slug: 'waypulse', name: 'WayPulse', billing: 'none' },
  { slug: 'wayface', name: 'WayFace', billing: 'none' },
  { slug: 'wayfarm', name: 'WayFarm', billing: 'none' },
  { slug: 'waydroid', name: 'WayDroid', billing: 'none' },
  { slug: 'waysend', name: 'WaySend', billing: 'none' },
  { slug: 'matelandia', name: 'Matelandia', billing: 'none' },
  { slug: 'videos', name: 'WayIA Videos', billing: 'none' },
];

export const BILLING_LABEL: Record<BillingMode, string> = {
  central: 'Cobrança central',
  own: 'Cobrança própria',
  none: 'Sem cobrança ainda',
};
