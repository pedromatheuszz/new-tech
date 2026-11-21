/**
 * Canais de entrega das mensagens do formulário.
 *  - smtp:    envia e-mail pelo servidor SMTP configurado (Nodemailer);
 *  - webhook: envia um POST em JSON para uma URL (n8n, Make, Zapier, Apps Script...);
 *  - arquivo: grava em .data/contatos.ndjson — usado apenas em desenvolvimento.
 */
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import nodemailer from 'nodemailer';
import { rotuloServico } from './campos.js';

/**
 * @typedef {object} MensagemContato
 * @property {import('./validacao.js').DadosContato} dados
 * @property {string} assunto
 * @property {string} texto
 * @property {string} html
 * @property {string} recebidoEm  Data ISO 8601
 *
 * @typedef {{ nome: string, enviar: (mensagem: MensagemContato) => Promise<void> }} Transporte
 */

const textoOuVazio = (v) => (typeof v === 'string' ? v.trim() : '');

/**
 * @param {{ host: string, porta?: number, seguro?: boolean, usuario?: string, senha?: string,
 *           para: string, de: string, ignorarTls?: boolean }} cfg
 * @returns {Transporte}
 */
export function criarTransporteSmtp(cfg) {
  const porta = cfg.porta ?? 587;
  const transportador = nodemailer.createTransport({
    host: cfg.host,
    port: porta,
    secure: cfg.seguro ?? porta === 465,
    auth: cfg.usuario ? { user: cfg.usuario, pass: cfg.senha ?? '' } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
    ...(cfg.ignorarTls ? { ignoreTLS: true } : {}),
  });
  return {
    nome: 'smtp',
    async enviar(mensagem) {
      await transportador.sendMail({
        from: cfg.de,
        to: cfg.para,
        replyTo: { name: mensagem.dados.nome.replace(/[\r\n"]/g, ' '), address: mensagem.dados.email },
        subject: mensagem.assunto,
        text: mensagem.texto,
        html: mensagem.html,
        headers: { 'X-Origem': 'formulario-site-new-tech' },
      });
    },
  };
}

/**
 * @param {{ url: string, token?: string, timeoutMs?: number, fetch?: typeof fetch }} cfg
 * @returns {Transporte}
 */
export function criarTransporteWebhook({ url, token, timeoutMs = 10_000, fetch: fetchImpl = fetch }) {
  return {
    nome: 'webhook',
    async enviar(mensagem) {
      const { dados } = mensagem;
      const resposta = await fetchImpl(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'NewTech-Site/1.0',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          evento: 'contato.recebido',
          recebidoEm: mensagem.recebidoEm,
          contato: {
            nome: dados.nome,
            empresa: dados.empresa || null,
            email: dados.email,
            telefone: dados.telefone,
            servico: dados.servico,
            servicoRotulo: rotuloServico(dados.servico),
            mensagem: dados.mensagem,
            consentimento: dados.consentimento,
          },
          assunto: mensagem.assunto,
          texto: mensagem.texto,
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!resposta.ok) throw new Error(`Webhook respondeu com status ${resposta.status}`);
    },
  };
}

/**
 * Apenas para desenvolvimento: grava cada mensagem como uma linha JSON.
 * @param {{ caminho: string }} cfg
 * @returns {Transporte}
 */
export function criarTransporteArquivo({ caminho }) {
  return {
    nome: 'arquivo',
    async enviar(mensagem) {
      await mkdir(dirname(caminho), { recursive: true });
      const registro = { recebidoEm: mensagem.recebidoEm, assunto: mensagem.assunto, ...mensagem.dados };
      await appendFile(caminho, `${JSON.stringify(registro)}\n`, 'utf8');
    },
  };
}

/**
 * Cria os canais de entrega a partir das variáveis de ambiente.
 * @param {Record<string, string | undefined>} env
 * @param {{ desenvolvimento?: boolean, caminhoArquivo?: string, log?: Pick<Console, 'warn' | 'error'> }} [opcoes]
 * @returns {Transporte[]}
 */
export function criarTransportes(env, { desenvolvimento = false, caminhoArquivo = '.data/contatos.ndjson', log = console } = {}) {
  /** @type {Transporte[]} */
  const transportes = [];

  const host = textoOuVazio(env.SMTP_HOST);
  if (host) {
    const usuario = textoOuVazio(env.SMTP_USER);
    const para = textoOuVazio(env.CONTATO_DESTINATARIO) || usuario;
    const remetente = textoOuVazio(env.CONTATO_REMETENTE) || usuario;
    const porta = Number.parseInt(textoOuVazio(env.SMTP_PORT) || '587', 10);
    const seguro = textoOuVazio(env.SMTP_SECURE) ? /^(true|1|sim)$/i.test(textoOuVazio(env.SMTP_SECURE)) : undefined;
    if (!para || !remetente) {
      log.error('[contato] SMTP_HOST definido, mas faltam CONTATO_DESTINATARIO/CONTATO_REMETENTE (ou SMTP_USER).');
    } else {
      const de = remetente.includes('<') ? remetente : { name: 'Site New Tech', address: remetente };
      transportes.push(
        criarTransporteSmtp({
          host,
          porta: Number.isFinite(porta) ? porta : 587,
          seguro,
          usuario: usuario || undefined,
          senha: env.SMTP_PASS,
          para,
          de, // string ("Nome <email>") ou objeto { name, address }, ambos aceitos pelo Nodemailer
        }),
      );
    }
  }

  const urlWebhook = textoOuVazio(env.CONTATO_WEBHOOK_URL);
  if (urlWebhook) {
    try {
      const url = new URL(urlWebhook);
      if (url.protocol !== 'https:' && !desenvolvimento) throw new Error('use https');
      transportes.push(criarTransporteWebhook({ url: url.href, token: textoOuVazio(env.CONTATO_WEBHOOK_TOKEN) || undefined }));
    } catch (erro) {
      log.error(`[contato] CONTATO_WEBHOOK_URL inválida (${erro instanceof Error ? erro.message : erro}).`);
    }
  }

  if (!transportes.length && desenvolvimento) {
    log.warn(`[contato] Nenhum canal configurado: em desenvolvimento as mensagens serão gravadas em ${caminhoArquivo}.`);
    transportes.push(criarTransporteArquivo({ caminho: caminhoArquivo }));
  }

  return transportes;
}

/**
 * Entrega a mensagem em todos os canais. Basta um canal funcionar para o envio ser bem-sucedido.
 * @param {MensagemContato} mensagem
 * @param {Transporte[]} transportes
 * @param {Pick<Console, 'error'>} [log]
 */
export async function entregar(mensagem, transportes, log = console) {
  const resultados = await Promise.allSettled(transportes.map((t) => t.enviar(mensagem)));
  const sucesso = [];
  const falhas = [];
  resultados.forEach((r, i) => {
    const nome = transportes[i].nome;
    if (r.status === 'fulfilled') sucesso.push(nome);
    else {
      falhas.push(nome);
      // Registra só o motivo técnico — nunca os dados pessoais do visitante.
      log.error(`[contato] Falha no canal "${nome}": ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`);
    }
  });
  return { entregue: sucesso.length > 0, sucesso, falhas };
}
