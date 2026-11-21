/**
 * POST /api/contato — recebe o formulário de contato.
 *
 * Aceita JSON (envio pelo JavaScript do site) ou formulário HTML padrão (quando o JavaScript
 * está desativado). Roda sob demanda (função serverless na Vercel); o restante do site é estático.
 */
import type { APIRoute } from 'astro';
import {
  CONTATO_DESTINATARIO,
  CONTATO_ORIGENS_PERMITIDAS,
  CONTATO_REMETENTE,
  CONTATO_WEBHOOK_TOKEN,
  CONTATO_WEBHOOK_URL,
  SMTP_HOST,
  SMTP_PASS,
  SMTP_PORT,
  SMTP_SECURE,
  SMTP_USER,
} from 'astro:env/server';
import { criarLimitador } from '../../lib/contato/limitador.js';
import { MENSAGENS, origemPermitida, processarContato, type ResultadoContato } from '../../lib/contato/processar.js';
import { criarTransportes, type Transporte } from '../../lib/contato/transportes.js';
import { escaparHtml } from '../../lib/contato/email.js';

export const prerender = false;

const LIMITE_BYTES = 16 * 1024;
const limitador = criarLimitador({ maximo: 6, janelaMs: 10 * 60 * 1000 });
let transportes: Transporte[] | undefined;

function obterTransportes(): Transporte[] {
  transportes ??= criarTransportes(
    {
      SMTP_HOST,
      SMTP_PORT,
      SMTP_SECURE,
      SMTP_USER,
      SMTP_PASS,
      CONTATO_DESTINATARIO,
      CONTATO_REMETENTE,
      CONTATO_WEBHOOK_URL,
      CONTATO_WEBHOOK_TOKEN,
    },
    { desenvolvimento: import.meta.env.DEV },
  );
  return transportes;
}

class ErroRequisicao extends Error {
  constructor(
    readonly status: number,
    readonly codigo: string,
    mensagem: string,
  ) {
    super(mensagem);
  }
}

async function lerCorpo(request: Request): Promise<{ dados: Record<string, unknown>; formularioHtml: boolean }> {
  const tamanhoDeclarado = Number(request.headers.get('content-length') ?? 0);
  if (tamanhoDeclarado > LIMITE_BYTES) throw new ErroRequisicao(413, 'tamanho', MENSAGENS.tamanho);

  const tipo = (request.headers.get('content-type') ?? '').toLowerCase();
  const texto = await request.text();
  if (new TextEncoder().encode(texto).length > LIMITE_BYTES) throw new ErroRequisicao(413, 'tamanho', MENSAGENS.tamanho);

  if (tipo.includes('application/json')) {
    try {
      const dados = JSON.parse(texto);
      if (!dados || typeof dados !== 'object' || Array.isArray(dados)) throw new Error('corpo inválido');
      return { dados, formularioHtml: false };
    } catch {
      throw new ErroRequisicao(400, 'json-invalido', MENSAGENS.validacao);
    }
  }
  if (tipo.includes('application/x-www-form-urlencoded')) {
    return { dados: Object.fromEntries(new URLSearchParams(texto)), formularioHtml: true };
  }
  throw new ErroRequisicao(415, 'formato', MENSAGENS.formato);
}

function identificarCliente(request: Request, clientAddress: () => string): string {
  try {
    return clientAddress();
  } catch {
    return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'desconhecido';
  }
}

const cabecalhosBase = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' };

function respostaJson(resultado: ResultadoContato): Response {
  const { status, tentarEmSegundos, ...corpo } = resultado;
  const headers: Record<string, string> = { ...cabecalhosBase };
  if (tentarEmSegundos) headers['Retry-After'] = String(tentarEmSegundos);
  return Response.json(corpo, { status, headers });
}

/** Página simples para quem envia o formulário sem JavaScript e encontra um erro. */
function respostaHtml(resultado: ResultadoContato): Response {
  const detalhes = resultado.campos
    ? `<ul>${Object.values(resultado.campos)
        .map((erro) => `<li>${escaparHtml(erro)}</li>`)
        .join('')}</ul>`
    : '';
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Não foi possível enviar — New Tech</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#040509;color:#f5f7fb;font:16px/1.6 system-ui,sans-serif;padding:24px}
main{max-width:520px}h1{font-size:1.6rem;margin:0 0 12px}p,li{color:#a6afc0}a{display:inline-block;margin-top:20px;padding:12px 22px;border-radius:999px;background:#0a62f6;color:#fff;text-decoration:none;font-weight:600}</style>
</head><body><main><h1>Não foi possível enviar sua mensagem</h1><p>${escaparHtml(resultado.mensagem)}</p>${detalhes}
<a href="/#contato">Voltar ao formulário</a></main></body></html>`;
  return new Response(html, {
    status: resultado.status,
    headers: { ...cabecalhosBase, 'Content-Type': 'text/html; charset=utf-8' },
  });
}

export const POST: APIRoute = async (contexto) => {
  const { request } = contexto;
  const extras = (CONTATO_ORIGENS_PERMITIDAS ?? '').split(',').filter(Boolean);
  if (!origemPermitida(request.headers.get('origin'), request.url, extras)) {
    return respostaJson({ status: 403, ok: false, codigo: 'origem', mensagem: MENSAGENS.origem });
  }

  let formularioHtml = false;
  try {
    const corpo = await lerCorpo(request);
    formularioHtml = corpo.formularioHtml;
    const resultado = await processarContato(corpo.dados, {
      chave: identificarCliente(request, () => contexto.clientAddress),
      limitador,
      transportes: obterTransportes(),
    });

    if (!formularioHtml) return respostaJson(resultado);
    if (resultado.ok) {
      return new Response(null, { status: 303, headers: { ...cabecalhosBase, Location: '/obrigado/' } });
    }
    return respostaHtml(resultado);
  } catch (erro) {
    const resultado: ResultadoContato =
      erro instanceof ErroRequisicao
        ? { status: erro.status, ok: false, codigo: erro.codigo, mensagem: erro.message }
        : { status: 500, ok: false, codigo: 'erro-interno', mensagem: MENSAGENS.falha };
    if (!(erro instanceof ErroRequisicao)) {
      console.error('[contato] Erro inesperado:', erro instanceof Error ? erro.message : erro);
    }
    return formularioHtml ? respostaHtml(resultado) : respostaJson(resultado);
  }
};

export const ALL: APIRoute = () =>
  new Response(JSON.stringify({ ok: false, mensagem: 'Método não permitido.' }), {
    status: 405,
    headers: { ...cabecalhosBase, Allow: 'POST', 'Content-Type': 'application/json' },
  });
