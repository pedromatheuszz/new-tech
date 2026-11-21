/**
 * Prepara a identidade visual do site a partir do logotipo oficial.
 *
 * Uso:  npm run gerar:marca            (usa "Logotipo New Tech.png" na raiz do projeto)
 *       npm run gerar:marca -- caminho/para/logo.png
 *
 * O arquivo de entrada deve ter o símbolo acima da escrita, sobre fundo escuro e liso
 * (como o logotipo oficial). O script:
 *   1. remove o fundo escuro, preservando as bordas suavizadas (transparência real);
 *   2. separa o símbolo ("NT") e a escrita ("NEW TECH") sem alterar suas proporções;
 *   3. gera as versões usadas no site e os ícones/imagem de compartilhamento.
 *
 * Saídas:
 *   src/assets/marca/logo-horizontal.png  → cabeçalho (símbolo + escrita lado a lado)
 *   src/assets/marca/logo-vertical.png    → rodapé (versão original empilhada)
 *   src/assets/marca/simbolo.png          → símbolo isolado
 *   public/brand/logo-new-tech.png        → logotipo sobre fundo escuro (dados estruturados/SEO)
 *   public/favicon.ico, apple-touch-icon.png, icon-192.png, icon-512.png, og-image.png
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const origem = resolve(raiz, process.argv[2] ?? 'Logotipo New Tech.png');
const destinoAssets = join(raiz, 'src/assets/marca');
const destinoPublico = join(raiz, 'public');
const FUNDO_SITE = { r: 4, g: 5, b: 9 }; // #040509 — mesmo tom do fundo do site

/** Lê a imagem como RGB bruto. */
async function lerRgb(arquivo) {
  const { data, info } = await sharp(arquivo).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, largura: info.width, altura: info.height };
}

/** Cor média e brilho máximo do fundo, medidos numa moldura de 24 px nas bordas. */
function medirFundo({ data, largura, altura }) {
  const soma = [0, 0, 0];
  let maximo = 0;
  let n = 0;
  for (let y = 0; y < altura; y++) {
    for (let x = 0; x < largura; x++) {
      if (x >= 24 && x < largura - 24 && y >= 24 && y < altura - 24) continue;
      const i = (y * largura + x) * 3;
      soma[0] += data[i];
      soma[1] += data[i + 1];
      soma[2] += data[i + 2];
      maximo = Math.max(maximo, data[i], data[i + 1], data[i + 2]);
      n++;
    }
  }
  return { cor: soma.map((v) => v / n), maximo };
}

/**
 * Remove o fundo escuro ("cor para transparência"): a opacidade vem do brilho do pixel e a cor é
 * recalculada para que, sobre o fundo original, o resultado seja idêntico ao arquivo de origem.
 */
function removerFundo({ data, largura, altura }, fundo) {
  const limiar = fundo.maximo + 4; // abaixo disso é fundo (ruído de compressão)
  const opaco = 225; // a partir disso o pixel é totalmente opaco
  const saida = Buffer.alloc(largura * altura * 4);
  for (let p = 0; p < largura * altura; p++) {
    const i = p * 3;
    const o = p * 4;
    const m = Math.max(data[i], data[i + 1], data[i + 2]);
    const a = Math.min(1, Math.max(0, (m - limiar) / (opaco - limiar)));
    if (a === 0) continue;
    for (let k = 0; k < 3; k++) {
      const cor = (data[i + k] - (1 - a) * fundo.cor[k]) / a;
      saida[o + k] = Math.round(Math.min(255, Math.max(0, cor)));
    }
    saida[o + 3] = Math.round(a * 255);
  }
  return saida;
}

/** Faixas horizontais com conteúdo (separa símbolo e escrita) e a caixa de cada uma. */
function encontrarBlocos(rgba, largura, altura) {
  const linhaTemConteudo = (y) => {
    for (let x = 0; x < largura; x++) if (rgba[(y * largura + x) * 4 + 3] > 24) return true;
    return false;
  };
  const faixas = [];
  let inicio = -1;
  for (let y = 0; y < altura; y++) {
    const tem = linhaTemConteudo(y);
    if (tem && inicio < 0) inicio = y;
    if (!tem && inicio >= 0) {
      faixas.push([inicio, y - 1]);
      inicio = -1;
    }
  }
  if (inicio >= 0) faixas.push([inicio, altura - 1]);
  // ignora sujeiras muito finas
  const blocos = faixas.filter(([a, b]) => b - a > 8);
  return blocos.map(([y0, y1]) => {
    let x0 = largura;
    let x1 = 0;
    for (let y = y0; y <= y1; y++) {
      for (let x = 0; x < largura; x++) {
        if (rgba[(y * largura + x) * 4 + 3] > 24) {
          x0 = Math.min(x0, x);
          x1 = Math.max(x1, x);
        }
      }
    }
    return { x0, y0, x1, y1 };
  });
}

const comMargem = ({ x0, y0, x1, y1 }, margem, largura, altura) => {
  const left = Math.max(0, x0 - margem);
  const top = Math.max(0, y0 - margem);
  return {
    left,
    top,
    width: Math.min(largura, x1 + margem + 1) - left,
    height: Math.min(altura, y1 + margem + 1) - top,
  };
};

const recortar = (rgba, largura, altura, area) =>
  sharp(rgba, { raw: { width: largura, height: altura, channels: 4 } }).extract(area).png().toBuffer();

/** Monta um .ico com imagens PNG internas (aceito por todos os navegadores atuais). */
function montarIco(pngs) {
  const cabecalho = Buffer.alloc(6);
  cabecalho.writeUInt16LE(0, 0);
  cabecalho.writeUInt16LE(1, 2);
  cabecalho.writeUInt16LE(pngs.length, 4);
  let deslocamento = 6 + 16 * pngs.length;
  const entradas = pngs.map(({ tamanho, dados }) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(tamanho, 0);
    e.writeUInt8(tamanho, 1);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(dados.length, 8);
    e.writeUInt32LE(deslocamento, 12);
    deslocamento += dados.length;
    return e;
  });
  return Buffer.concat([cabecalho, ...entradas, ...pngs.map((p) => p.dados)]);
}

/** Símbolo centralizado num quadrado (com ou sem fundo). */
async function iconeQuadrado(simbolo, tamanho, margem, fundo) {
  const interno = Math.round(tamanho * (1 - margem * 2));
  const camada = await sharp(simbolo)
    .resize(interno, interno, { fit: 'inside', kernel: 'lanczos3' })
    .png()
    .toBuffer();
  const base = fundo ? { ...fundo, alpha: 1 } : { r: 0, g: 0, b: 0, alpha: 0 };
  return sharp({ create: { width: tamanho, height: tamanho, channels: 4, background: base } })
    .composite([{ input: camada, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function main() {
  if (!existsSync(origem)) throw new Error(`Logotipo não encontrado: ${origem}`);
  mkdirSync(destinoAssets, { recursive: true });
  mkdirSync(join(destinoPublico, 'brand'), { recursive: true });

  const imagem = await lerRgb(origem);
  const { largura, altura } = imagem;
  const fundo = medirFundo(imagem);
  const rgba = removerFundo(imagem, fundo);
  const blocos = encontrarBlocos(rgba, largura, altura);
  if (blocos.length < 2) {
    throw new Error('Não foi possível separar símbolo e escrita. O logotipo deve ter o símbolo acima do texto.');
  }
  const caixaSimbolo = blocos[0];
  const caixaEscrita = blocos[blocos.length - 1];
  const caixaTotal = {
    x0: Math.min(caixaSimbolo.x0, caixaEscrita.x0),
    y0: caixaSimbolo.y0,
    x1: Math.max(caixaSimbolo.x1, caixaEscrita.x1),
    y1: caixaEscrita.y1,
  };

  const simbolo = await recortar(rgba, largura, altura, comMargem(caixaSimbolo, 2, largura, altura));
  const escrita = await recortar(rgba, largura, altura, comMargem(caixaEscrita, 2, largura, altura));
  const vertical = await recortar(rgba, largura, altura, comMargem(caixaTotal, 2, largura, altura));
  writeFileSync(join(destinoAssets, 'simbolo.png'), simbolo);
  writeFileSync(join(destinoAssets, 'logo-vertical.png'), vertical);

  // Versão horizontal: símbolo + escrita lado a lado, centralizados (proporções de cada parte preservadas).
  const alturaSimbolo = 240;
  const alturaEscrita = Math.round(alturaSimbolo * 0.38);
  const espaco = Math.round(alturaSimbolo * 0.3);
  const simboloH = await sharp(simbolo).resize({ height: alturaSimbolo, kernel: 'lanczos3' }).png().toBuffer();
  const escritaH = await sharp(escrita).resize({ height: alturaEscrita, kernel: 'lanczos3' }).png().toBuffer();
  const larguraSimboloH = (await sharp(simboloH).metadata()).width;
  const larguraEscritaH = (await sharp(escritaH).metadata()).width;
  const horizontal = await sharp({
    create: {
      width: larguraSimboloH + espaco + larguraEscritaH,
      height: alturaSimbolo,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      { input: simboloH, left: 0, top: 0 },
      { input: escritaH, left: larguraSimboloH + espaco, top: Math.round((alturaSimbolo - alturaEscrita) / 2) },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer();
  writeFileSync(join(destinoAssets, 'logo-horizontal.png'), horizontal);

  // Logotipo sobre fundo escuro (para buscadores e dados estruturados, que podem usar fundo branco).
  const verticalMeta = await sharp(vertical).metadata();
  const lado = Math.round(Math.max(verticalMeta.width, verticalMeta.height) * 1.25);
  const logoComFundoOriginal = await sharp({
    create: { width: lado, height: lado, channels: 4, background: { ...FUNDO_SITE, alpha: 1 } },
  })
    .composite([{ input: vertical, gravity: 'center' }])
    .png()
    .toBuffer();
  const logoComFundo = await sharp(logoComFundoOriginal)
    .resize(600, 600, { kernel: 'lanczos3' })
    .png({ compressionLevel: 9 })
    .toBuffer();
  writeFileSync(join(destinoPublico, 'brand/logo-new-tech.png'), logoComFundo);

  // Favicons e ícones de app
  const pngsIco = await Promise.all(
    [16, 32, 48].map(async (tamanho) => ({ tamanho, dados: await iconeQuadrado(simbolo, tamanho, 0.02) })),
  );
  writeFileSync(join(destinoPublico, 'favicon.ico'), montarIco(pngsIco));
  writeFileSync(join(destinoPublico, 'apple-touch-icon.png'), await iconeQuadrado(simbolo, 180, 0.16, FUNDO_SITE));
  writeFileSync(join(destinoPublico, 'icon-192.png'), await iconeQuadrado(simbolo, 192, 0.2, FUNDO_SITE));
  writeFileSync(join(destinoPublico, 'icon-512.png'), await iconeQuadrado(simbolo, 512, 0.2, FUNDO_SITE));

  // Imagem de compartilhamento (Open Graph) 1200x630: base com textos + logotipo horizontal
  const base = readFileSync(join(raiz, 'scripts/assets/og-base.svg'));
  const logoOg = await sharp(horizontal).resize({ height: 60, kernel: 'lanczos3' }).png().toBuffer();
  const og = await sharp(base)
    .resize(1200, 630)
    .composite([{ input: logoOg, left: 80, top: 92 }])
    .png({ compressionLevel: 9 })
    .toBuffer();
  writeFileSync(join(destinoPublico, 'og-image.png'), og);

  console.log(
    `Marca gerada a partir de "${origem}".\n` +
      `  símbolo ${caixaSimbolo.x1 - caixaSimbolo.x0 + 1}x${caixaSimbolo.y1 - caixaSimbolo.y0 + 1}px, ` +
      `escrita ${caixaEscrita.x1 - caixaEscrita.x0 + 1}x${caixaEscrita.y1 - caixaEscrita.y0 + 1}px, ` +
      `fundo removido (brilho máx. ${fundo.maximo}).`,
  );
}

main().catch((erro) => {
  console.error('Falha ao gerar a marca:', erro.message);
  process.exit(1);
});
