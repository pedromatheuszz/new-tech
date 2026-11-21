import type { APIRoute } from 'astro';
import site from '../data/site.json';

/** Páginas indexáveis do site. Inclua aqui novas páginas públicas. */
const paginas = [
  { caminho: '/', prioridade: '1.0', frequencia: 'monthly' },
  { caminho: '/politica-de-privacidade/', prioridade: '0.3', frequencia: 'yearly', atualizadaEm: site.privacidade.atualizadaEm },
];

export const GET: APIRoute = ({ site: urlSite }) => {
  const hoje = new Date().toISOString().slice(0, 10);
  const urls = paginas
    .map(
      (pagina) => `  <url>
    <loc>${new URL(pagina.caminho, urlSite).href}</loc>
    <lastmod>${pagina.atualizadaEm ?? hoje}</lastmod>
    <changefreq>${pagina.frequencia}</changefreq>
    <priority>${pagina.prioridade}</priority>
  </url>`,
    )
    .join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
