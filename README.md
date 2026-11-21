# Site institucional — New Tech

Site one page da New Tech (tecnologia e inovação), com formulário de contato funcional, Política de Privacidade (LGPD), SEO e acessibilidade.

- **Astro 7**: páginas estáticas, quase nenhum JavaScript enviado ao navegador (cerca de 10 kB no total).
- **Formulário**: endpoint serverless `/api/contato` com envio por **e-mail (SMTP)** e/ou **webhook**.
- **Hospedagem**: Vercel (região `gru1`, São Paulo), mesmo padrão dos outros projetos.
- **Sem dependências de terceiros no navegador**: fontes auto-hospedadas, sem cookies e sem rastreadores.

## Como rodar

```bash
npm install
npm run dev        # http://localhost:4321
```

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Gera o site de produção (lista antes as pendências de conteúdo) |
| `npm run check` | Verificação de tipos (TypeScript/Astro) |
| `npm test` | Testes automatizados do formulário (validação, segurança, envio SMTP e webhook) |
| `npm run verificar` | Lista o que falta preencher antes de publicar (falha se houver pendência) |
| `npm run gerar:marca` | Regera logos, favicons e imagem de compartilhamento a partir do logotipo |
| `npm run smtp:local` | Servidor de e-mail local para testar o formulário sem conta real |

## Onde editar o conteúdo

| O quê | Arquivo |
|---|---|
| Contatos, WhatsApp, e-mail, redes sociais, CNPJ, URL do site, SEO | `src/data/site.json` |
| Serviços (títulos, descrições, listas de soluções) | `src/data/servicos.json` |
| Clientes e logotipos | `src/data/clientes.json` + imagens em `src/assets/clientes/` |
| Números da seção Resultados | `src/data/resultados.json` |
| Textos de cada seção | `src/components/secoes/*.astro` (textos no topo de cada arquivo) |
| Cores, fontes e espaçamentos | `src/styles/global.css` (tokens em `:root`) |
| Opções do campo "Serviço de interesse" | `src/lib/contato/campos.js` |
| Política de Privacidade | `src/pages/politica-de-privacidade.astro` |

Campos vazios **não viram links**: o site mostra "Em breve" no lugar. O botão flutuante de WhatsApp só aparece quando `contato.whatsapp` estiver preenchido (somente números, com DDI e DDD, por exemplo `5511912345678`).

### Resultados (números)

Em `src/data/resultados.json`, troque `"valor": null` pelo número real (ex.: `"valor": 120`). Enquanto for `null`, o card mostra "Valor a definir". A contagem progressiva roda automaticamente quando o card aparece na tela, e é desativada para quem usa "reduzir movimento".

### Clientes (seção desativada)

A seção "Alguns clientes" está **fora do site por enquanto**. O componente (`src/components/secoes/Clientes.astro`) e os dados continuam no projeto. Para reativar:

- em `src/pages/index.astro`, importe `Clientes` e coloque `<Clientes />` entre `<Servicos />` e `<Resultados />`;
- volte o item `{ id: 'clientes', rotulo: 'Alguns clientes' }` no menu (`src/components/Cabecalho.astro`) e o link `/#clientes` no rodapé (`src/components/Rodape.astro`).

Para cadastrar os clientes:

1. Coloque o logotipo em `src/assets/clientes/` (SVG ou PNG com fundo transparente, de preferência na versão clara).
2. Em `src/data/clientes.json`, substitua um item `{ "reservado": true }` por:
   ```json
   { "nome": "Empresa X", "logo": "empresa-x.svg", "site": "https://empresax.com.br", "segmento": "Varejo", "cor": "#ff6a00" }
   ```
   `site`, `segmento` e `cor` são opcionais. A `cor` dá a identidade visual de cada card.
3. Se a lista ficar vazia (`"clientes": []`), a seção mostra uma mensagem institucional.

> Só cadastre clientes que autorizaram a divulgação da marca.

### Logotipo

O arquivo-fonte é `Logotipo New Tech.png` (raiz do projeto). Para trocar o logo, substitua esse arquivo (símbolo acima da escrita, sobre fundo escuro e liso) e rode:

```bash
npm run gerar:marca
```

O script remove o fundo, separa símbolo e escrita sem distorcer e gera a versão horizontal do cabeçalho, a vertical do rodapé, os favicons e a imagem de compartilhamento (`public/og-image.png`).

## Formulário de contato

Fluxo: o navegador valida os campos → `POST /api/contato` → o servidor valida de novo → envia por e-mail e/ou webhook. Basta um canal funcionar para o envio dar certo. Se nenhum funcionar, o visitante vê uma mensagem de erro (o site nunca finge sucesso).

**Proteções:** validação no servidor, limite de 16 kB por envio, limite de 6 envios a cada 10 minutos por IP, campo-armadilha contra robôs, tempo mínimo de preenchimento, verificação de origem (bloqueia envios de outros sites), conteúdo escapado no e-mail e nenhum dado pessoal nos logs. Sem JavaScript, o formulário continua funcionando com envio HTML comum.

### Configuração (variáveis de ambiente)

Copie `.env.example` para `.env` (local) ou cadastre as variáveis na Vercel (**Settings → Environment Variables**). Credenciais nunca vão para o navegador.

**E-mail por SMTP** (Gmail com senha de app, Zoho, Hostinger, Locaweb, Brevo, Resend etc.):

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=contato@seudominio.com.br
SMTP_PASS=senha-de-app
CONTATO_DESTINATARIO=contato@seudominio.com.br
CONTATO_REMETENTE="Site New Tech <contato@seudominio.com.br>"
```

O e-mail chega com "Responder para" apontando ao visitante e, quando o telefone é brasileiro, um link direto para o WhatsApp dele.

**Webhook** (opcional, pode ser combinado com o SMTP): `CONTATO_WEBHOOK_URL` recebe um POST JSON a cada mensagem (n8n, Make, Zapier, Google Apps Script...). `CONTATO_WEBHOOK_TOKEN` é enviado como `Authorization: Bearer`. Em produção a URL precisa ser `https`.

**Em desenvolvimento**, sem nenhum canal configurado, as mensagens são gravadas em `.data/contatos.ndjson`.

### Testar o envio de e-mail localmente

```bash
npm run smtp:local      # terminal 1: servidor de e-mail de teste
```

No `.env`: `SMTP_HOST=127.0.0.1`, `SMTP_PORT=2525`, `SMTP_SECURE=false`, `CONTATO_DESTINATARIO=equipe@newtech.local`, `CONTATO_REMETENTE=site@newtech.local`. Depois rode `npm run dev` e envie o formulário. Os e-mails aparecem no terminal e ficam salvos em `.data/emails/*.eml`.

## Publicação na Vercel

1. Suba o projeto para um repositório (GitHub, GitLab ou Bitbucket) e importe-o na Vercel. O framework Astro é detectado automaticamente.
2. Cadastre as variáveis do formulário (veja acima).
3. Conecte o domínio. A URL pública é detectada sozinha; para fixá-la, preencha `url` em `src/data/site.json` ou defina `SITE_URL`.
4. Confirme a região das funções em **Settings → Functions** (`gru1`, São Paulo).
5. Envie uma mensagem de teste pelo site publicado.

O `vercel.json` aplica cabeçalhos de segurança: CSP restritiva (`script-src 'self'`), HSTS, `X-Frame-Options`, `Referrer-Policy` e `Permissions-Policy`.

**Outras hospedagens:** troque o adapter em `astro.config.mjs` (`@astrojs/netlify` para Netlify ou `@astrojs/node` para servidor próprio). O endpoint funciona sem alterações.

## Antes de publicar

Rode `npm run verificar` e resolva as pendências:

- [ ] Números reais em `src/data/resultados.json`
- [ ] E-mail, WhatsApp e redes sociais em `src/data/site.json`
- [ ] Razão social e CNPJ (recomendado para a Política de Privacidade)
- [ ] Variáveis de envio do formulário configuradas na hospedagem
- [ ] Revisão jurídica da Política de Privacidade (o texto é um modelo alinhado à LGPD)

## Estrutura

```
public/            fontes, favicons, imagem de compartilhamento, manifest
scripts/           geração da marca, verificação de conteúdo, SMTP local
src/
  assets/          logotipos (marca e clientes), otimizados no build
  components/      cabeçalho, rodapé, ícones, logo e seções da página
  data/            conteúdo editável (JSON)
  icons/           ícones SVG (Lucide/Simple Icons, embutidos sem dependências)
  layouts/         layout base (SEO, Open Graph, dados estruturados)
  lib/contato/     validação, limite de envios, e-mail, canais de entrega
  pages/           página inicial, política, obrigado, 404, robots, sitemap, API
  scripts/         comportamento no navegador (menu, animações, formulário)
  styles/          estilos globais e tokens da marca
tests/             testes automatizados (node:test)
```

## Qualidade

- **SEO:** HTML semântico, título e descrição próprios, canonical, Open Graph e Twitter Card com imagem 1200×630, dados estruturados (Organization, WebSite e serviços), `sitemap.xml` e `robots.txt`.
- **Acessibilidade:** navegação por teclado, link "Pular para o conteúdo", menu mobile com foco gerenciado e `inert`, campos com rótulos e mensagens de erro associadas, contraste AA e suporte a "reduzir movimento".
- **Desempenho:** páginas estáticas, CSS e JS mínimos, fontes WOFF2 com pré-carregamento, logos convertidos para WebP (3–12 kB) e animações que usam apenas `transform`/`opacity`.
