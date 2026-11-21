/**
 * Regras de negócio do envio do formulário, independentes do framework/hospedagem:
 * limite de tentativas → campo-armadilha → tempo mínimo → validação → entrega.
 */
import { TEMPO_MINIMO_MS } from './campos.js';
import { montarEmail } from './email.js';
import { entregar } from './transportes.js';
import { validarContato } from './validacao.js';

export const MENSAGENS = Object.freeze({
  sucesso: 'Mensagem enviada com sucesso! Em breve nossa equipe entrará em contato.',
  validacao: 'Revise os campos destacados e tente novamente.',
  rapido: 'Não foi possível validar o envio. Aguarde alguns segundos e tente novamente.',
  limite: 'Você fez muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.',
  indisponivel: 'O envio de mensagens está temporariamente indisponível. Tente novamente mais tarde.',
  falha: 'Não foi possível enviar sua mensagem agora. Tente novamente em instantes.',
  origem: 'Envio não autorizado.',
  formato: 'Formato de envio não suportado.',
  tamanho: 'A mensagem enviada é grande demais.',
});

/**
 * @typedef {object} ResultadoContato
 * @property {number} status         Código HTTP sugerido
 * @property {boolean} ok
 * @property {string} codigo
 * @property {string} mensagem
 * @property {Record<string, string>} [campos]
 * @property {number} [tentarEmSegundos]
 */

/**
 * Verifica se a requisição veio do próprio site (ou de uma origem autorizada).
 * @param {string | null | undefined} origem  Cabeçalho Origin
 * @param {string} urlRequisicao
 * @param {string[]} [extras]
 */
export function origemPermitida(origem, urlRequisicao, extras = []) {
  if (!origem) return true; // clientes que não são navegadores; navegadores sempre enviam Origin em POST
  try {
    const alvo = new URL(origem).origin;
    if (alvo === new URL(urlRequisicao).origin) return true;
    return extras.some((extra) => {
      try {
        return new URL(extra.trim()).origin === alvo;
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

/**
 * @param {Record<string, unknown> | null | undefined} entrada  Corpo já interpretado
 * @param {{
 *   chave?: string,
 *   agora?: number,
 *   limitador?: ReturnType<typeof import('./limitador.js').criarLimitador>,
 *   transportes: import('./transportes.js').Transporte[],
 *   log?: Pick<Console, 'warn' | 'error'>,
 * }} contexto
 * @returns {Promise<ResultadoContato>}
 */
export async function processarContato(entrada, { chave = 'anonimo', agora = Date.now(), limitador, transportes, log = console }) {
  if (limitador) {
    const limite = limitador.verificar(chave, agora);
    if (!limite.permitido) {
      return { status: 429, ok: false, codigo: 'limite', mensagem: MENSAGENS.limite, tentarEmSegundos: limite.tentarEmSegundos };
    }
  }

  // Campo-armadilha: invisível para pessoas, costuma ser preenchido por robôs. Finge sucesso.
  if (typeof entrada?.website === 'string' && entrada.website.trim() !== '') {
    log.warn('[contato] Envio descartado (campo-armadilha preenchido).');
    return { status: 200, ok: true, codigo: 'enviado', mensagem: MENSAGENS.sucesso };
  }

  // Tempo de preenchimento informado pelo navegador (ausente quando o JavaScript está desativado).
  const tempo = Number(entrada?._tempo);
  if (entrada?._tempo !== undefined && entrada?._tempo !== '' && (!Number.isFinite(tempo) || tempo < TEMPO_MINIMO_MS)) {
    return { status: 400, ok: false, codigo: 'rapido-demais', mensagem: MENSAGENS.rapido };
  }

  const { valido, dados, erros } = validarContato(entrada);
  if (!valido) {
    return { status: 400, ok: false, codigo: 'validacao', mensagem: MENSAGENS.validacao, campos: /** @type {Record<string,string>} */ (erros) };
  }

  if (!transportes.length) {
    log.error('[contato] Nenhum canal de entrega configurado (defina SMTP_HOST e/ou CONTATO_WEBHOOK_URL).');
    return { status: 503, ok: false, codigo: 'nao-configurado', mensagem: MENSAGENS.indisponivel };
  }

  const recebidoEm = new Date(agora);
  const resultado = await entregar(
    { dados, ...montarEmail(dados, { recebidoEm }), recebidoEm: recebidoEm.toISOString() },
    transportes,
    log,
  );
  if (!resultado.entregue) {
    return { status: 502, ok: false, codigo: 'falha-envio', mensagem: MENSAGENS.falha };
  }
  return { status: 200, ok: true, codigo: 'enviado', mensagem: MENSAGENS.sucesso };
}
