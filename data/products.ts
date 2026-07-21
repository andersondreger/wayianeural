
export interface Product {
  title: string;
  desc: string;
  icon: string;
  color: string;
  tag: string;
  link: string;
  bgFull?: boolean;
  status: 'ATIVO' | 'EM BREVE';
}

export const products: Product[] = [
  {
    title: "Pet360 sua Gestão",
    desc: "O Cérebro Digital do seu Pet Shop. Agenda Preditiva, Fidelização via WhatsApp e Controle de Estoque Inteligente.",
    icon: "/images/pet360-hero-banner.jpg",
    color: "text-orange-500",
    tag: "Petshop",
    link: "https://pet360.wayia.com.br/",
    bgFull: true,
    status: 'ATIVO'
  },
  {
    title: "ImobiVision 360",
    desc: "A Máquina de Vendas da Sua Imobiliária. Atendimento e qualificação de leads 24/7 com inteligência neural.",
    icon: "/images/imob360-carousel.jpg",
    color: "text-blue-500",
    tag: "Imobiliária",
    link: "https://imob360.wayia.com.br/",
    bgFull: true,
    status: 'ATIVO'
  },
  {
    title: "Bela360",
    desc: "O WhatsApp do seu salão trabalhando sozinho. Confirma horário, lembra o cliente, chama quem sumiu e avisa aniversário — sem o dono precisar digitar nada.",
    icon: "/images/bela360-carousel.png",
    color: "text-pink-500",
    tag: "Beleza",
    link: "https://bela360.wayia.com.br/",
    bgFull: true,
    status: 'ATIVO'
  },
  {
    title: "WayIA Criar",
    desc: "Construa sua marca sem ser designer. 129 bibliotecas de identidade visual, edição por chat e exportação em HTML — com sua própria API Key OpenAI/Anthropic.",
    icon: "/images/wayia-criar-carousel.png",
    color: "text-pink-500",
    tag: "Designer",
    link: "https://criar.wayia.com.br/",
    bgFull: true,
    status: 'ATIVO'
  },
  {
    title: "WayAR",
    desc: "Realidade Aumentada direto no navegador para todo o ecossistema. Modelos 3D que abrem por QR code, sem app pra baixar.",
    icon: "/images/wayar-logo.png",
    color: "text-cyan-400",
    tag: "Realidade Aumentada",
    link: "https://wayar.wayia.com.br/",
    status: 'ATIVO'
  }
];
