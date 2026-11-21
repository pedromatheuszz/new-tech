/**
 * Lista o que ainda precisa ser preenchido antes de publicar o site.
 *
 *   npm run verificar      → mostra as pendências e falha (código 1) se houver alguma
 *   (também roda antes de "npm run build", apenas como aviso)
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const ler = (arquivo) => JSON.parse(readFileSync(join(raiz, arquivo), 'utf8'));
const estrito = process.argv.includes('--estrito');

const site = ler('src/data/site.json');
const clientes = ler('src/data/clientes.json');
const resultados = ler('src/data/resultados.json');

/** @type {{ arquivo: string, item: string }[]} */
const pendencias = [];
const pendente = (arquivo, item) => pendencias.push({ arquivo, item });

// Site e contatos
if (!site.url && !process.env.SITE_URL && !process.env.VERCEL_PROJECT_PRODUCTION_URL) {
  pendente('src/data/site.json', 'URL pública do site ("url") — ou defina a variável SITE_URL');
}
if (!site.contato.email) pendente('src/data/site.json', 'E-mail comercial (contato.email)');
if (!site.contato.whatsapp) pendente('src/data/site.json', 'WhatsApp oficial (contato.whatsapp) — ativa o botão flutuante');
if (!site.redes.instagram) pendente('src/data/site.json', 'Instagram (redes.instagram)');
const outrasRedes = Object.entries(site.redes).filter(([chave, valor]) => !chave.startsWith('$') && chave !== 'instagram' && valor);
if (!outrasRedes.length) pendente('src/data/site.json', 'Outras redes sociais (redes.linkedin, redes.tiktok...) — opcional');
if (!site.empresa.razaoSocial || !site.empresa.cnpj) {
  pendente('src/data/site.json', 'Razão social e CNPJ (empresa) — recomendado para a Política de Privacidade');
}

// Clientes
const reservados = clientes.clientes.filter((c) => c.reservado).length;
if (reservados) pendente('src/data/clientes.json', `${reservados} espaço(s) reservado(s) aguardando clientes reais`);
for (const cliente of clientes.clientes.filter((c) => !c.reservado)) {
  if (cliente.logo && !existsSync(join(raiz, 'src/assets/clientes', cliente.logo))) {
    pendente('src/data/clientes.json', `Logotipo não encontrado para "${cliente.nome}": src/assets/clientes/${cliente.logo}`);
  }
}

// Resultados
for (const indicador of resultados.indicadores) {
  if (typeof indicador.valor !== 'number') {
    pendente('src/data/resultados.json', `Valor real de "${indicador.rotulo}"`);
  }
}

if (!pendencias.length) {
  console.log('✔ Conteúdo completo: nenhuma pendência encontrada.');
  process.exit(0);
}

const cor = (codigo, texto) => (process.stdout.isTTY ? `\x1b[${codigo}m${texto}\x1b[0m` : texto);
console.log(cor('33', `\n⚠ Conteúdo pendente antes da publicação (${pendencias.length}):`));
let arquivoAtual = '';
for (const { arquivo, item } of pendencias) {
  if (arquivo !== arquivoAtual) {
    console.log(`\n  ${cor('36', arquivo)}`);
    arquivoAtual = arquivo;
  }
  console.log(`    • ${item}`);
}
console.log(
  '\n  Lembre-se também de configurar o envio do formulário (SMTP_HOST ou CONTATO_WEBHOOK_URL) na hospedagem.\n',
);
process.exit(estrito ? 1 : 0);
