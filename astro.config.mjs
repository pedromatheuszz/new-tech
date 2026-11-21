// @ts-check
import { readFileSync } from 'node:fs';
import { defineConfig, envField } from 'astro/config';
import vercel from '@astrojs/vercel';

const dadosSite = JSON.parse(readFileSync(new URL('./src/data/site.json', import.meta.url), 'utf8'));

/**
 * URL pública do site (usada em links canônicos, sitemap e compartilhamento).
 * Prioridade: variável SITE_URL → "url" em src/data/site.json → domínio de produção da Vercel → localhost.
 */
const urlDoSite =
  process.env.SITE_URL ||
  dadosSite.url ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '') ||
  'http://localhost:4321';

const segredoOpcional = () => envField.string({ context: 'server', access: 'secret', optional: true });

export default defineConfig({
  site: urlDoSite,
  // Páginas estáticas; apenas /api/contato roda sob demanda (função serverless na Vercel).
  adapter: vercel({ maxDuration: 15 }),
  build: { inlineStylesheets: 'auto' },
  // Scripts sempre em arquivos externos: permite a política de segurança (CSP) "script-src 'self'" do vercel.json.
  vite: { build: { assetsInlineLimit: 0 } },
  devToolbar: { enabled: false },
  security: { checkOrigin: true },
  env: {
    // Variáveis do formulário de contato (veja .env.example). Nunca ficam expostas no navegador.
    schema: {
      SMTP_HOST: segredoOpcional(),
      SMTP_PORT: segredoOpcional(),
      SMTP_SECURE: segredoOpcional(),
      SMTP_USER: segredoOpcional(),
      SMTP_PASS: segredoOpcional(),
      CONTATO_DESTINATARIO: segredoOpcional(),
      CONTATO_REMETENTE: segredoOpcional(),
      CONTATO_WEBHOOK_URL: segredoOpcional(),
      CONTATO_WEBHOOK_TOKEN: segredoOpcional(),
      CONTATO_ORIGENS_PERMITIDAS: segredoOpcional(),
    },
  },
});
