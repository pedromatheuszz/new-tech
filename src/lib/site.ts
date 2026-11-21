/**
 * Acesso aos dados da empresa (src/data/site.json) com formatação e validação.
 * Contatos e redes só viram links quando estão preenchidos com valores válidos.
 */
import site from '../data/site.json';
import type { NomeIcone } from '../icons/icones';

export const dadosSite = site;

const somenteDigitos = (valor: string) => valor.replace(/\D/g, '');

function urlValida(valor: string | undefined): valor is string {
  if (!valor) return false;
  try {
    const url = new URL(valor);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

/** Formata números brasileiros: 5511912345678 → +55 (11) 91234-5678 */
export function formatarTelefone(valor: string): string {
  const d = somenteDigitos(valor);
  const m = d.match(/^(55)?(\d{2})(\d{4,5})(\d{4})$/);
  if (!m) return valor;
  return `${m[1] ? '+55 ' : ''}(${m[2]}) ${m[3]}-${m[4]}`;
}

export interface CanalWhatsApp {
  url: string;
  numeroFormatado: string;
}

export function whatsapp(mensagem = site.contato.whatsappMensagem): CanalWhatsApp | null {
  const numero = somenteDigitos(site.contato.whatsapp ?? '');
  if (numero.length < 10 || numero.length > 15) return null;
  const texto = mensagem ? `?text=${encodeURIComponent(mensagem)}` : '';
  return { url: `https://wa.me/${numero}${texto}`, numeroFormatado: formatarTelefone(numero) };
}

export function emailComercial(): string | null {
  const email = site.contato.email?.trim();
  return email && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? email : null;
}

export function telefoneComercial(): { url: string; texto: string } | null {
  const numero = somenteDigitos(site.contato.telefone ?? '');
  if (numero.length < 10) return null;
  return { url: `tel:+${numero.startsWith('55') ? numero : `55${numero}`}`, texto: formatarTelefone(numero) };
}

export interface RedeSocial {
  id: string;
  nome: string;
  url: string;
  icone: NomeIcone;
  usuario: string;
}

const REDES: { id: keyof typeof site.redes; nome: string; icone: NomeIcone }[] = [
  { id: 'instagram', nome: 'Instagram', icone: 'marca-instagram' },
  { id: 'linkedin', nome: 'LinkedIn', icone: 'marca-linkedin' },
  { id: 'tiktok', nome: 'TikTok', icone: 'marca-tiktok' },
  { id: 'youtube', nome: 'YouTube', icone: 'marca-youtube' },
  { id: 'github', nome: 'GitHub', icone: 'marca-github' },
  { id: 'behance', nome: 'Behance', icone: 'marca-behance' },
  { id: 'facebook', nome: 'Facebook', icone: 'marca-facebook' },
];

function usuarioDaUrl(url: string): string {
  const { pathname, hostname } = new URL(url);
  const ultimo = pathname.split('/').filter(Boolean).pop();
  return ultimo ? `@${ultimo.replace(/^@/, '')}` : hostname.replace(/^www\./, '');
}

/** Redes sociais preenchidas em site.json (na ordem da lista acima). */
export function redesConfiguradas(): RedeSocial[] {
  return REDES.flatMap((rede) => {
    const url = site.redes[rede.id];
    return urlValida(url) ? [{ ...rede, url, usuario: usuarioDaUrl(url) }] : [];
  });
}

export function instagram(): RedeSocial | null {
  return redesConfiguradas().find((r) => r.id === 'instagram') ?? null;
}

/** Ano atual (do build) para o aviso de direitos autorais. */
export const anoAtual = new Date().getFullYear();
