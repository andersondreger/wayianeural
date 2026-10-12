import { SUPABASE_URL } from './supabase';

// So aceitamos como foto uma URL do nosso bucket publico "avatars" (nunca uma URL arbitraria de metadata).
const AVATAR_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/avatars/`;
export const safeAvatarUrl = (u: unknown): string => (typeof u === 'string' && u.startsWith(AVATAR_PREFIX) ? u : '');

// Recorta quadrado, reduz para 256px e comprime em JPEG ate caber (o servidor aceita ate 44 KB).
export async function resizeToJpeg(file: File, size = 256, maxBytes = 40 * 1024): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Escolha um arquivo de imagem.');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('Imagem inválida.')); i.src = url; });
    const c = document.createElement('canvas'); c.width = c.height = size;
    const ctx = c.getContext('2d')!;
    const side = Math.min(img.width, img.height);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, size, size);
    ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
    for (let q = 0.85; q >= 0.4; q -= 0.15) {
      const data = c.toDataURL('image/jpeg', q);
      if ((data.length - 'data:image/jpeg;base64,'.length) * 0.75 <= maxBytes) return data;
    }
    throw new Error('Imagem muito detalhada. Tente outra foto.');
  } finally { URL.revokeObjectURL(url); }
}
