/**
 * Validação dos dados do formulário de contato.
 * O mesmo código roda no navegador (feedback imediato) e no servidor (proteção real).
 */
import { LIMITES, SERVICOS } from './campos.js';

/** Caracteres de controle (exceto tabulação e quebras de linha). */
// eslint-disable-next-line no-control-regex
const CONTROLE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\u{200B}-\u{200F}\u{2028}\u{2029}\u{FEFF}]/gu;
const EMAIL = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:".]+(\.[^\s@<>()[\]\\,;:".]+)*\.[a-z]{2,}$/i;
const TELEFONE_CARACTERES = /^[+()\d\s.-]+$/;

/**
 * Normaliza um texto recebido: remove caracteres de controle e espaços sobrando.
 * @param {unknown} valor
 * @param {{ multilinha?: boolean }} [opcoes]
 */
export function normalizarTexto(valor, { multilinha = false } = {}) {
  if (typeof valor !== 'string') return '';
  let texto = valor.normalize('NFC').replace(CONTROLE, '');
  if (multilinha) {
    texto = texto
      .replace(/\r\n?/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{4,}/g, '\n\n\n')
      .trim();
  } else {
    texto = texto.replace(/\s+/g, ' ').trim();
  }
  return texto;
}

/** @param {unknown} valor */
function aceitou(valor) {
  return valor === true || valor === 'true' || valor === 'sim' || valor === 'on';
}

/**
 * @typedef {object} DadosContato
 * @property {string} nome
 * @property {string} empresa
 * @property {string} email
 * @property {string} telefone
 * @property {string} servico
 * @property {string} mensagem
 * @property {boolean} consentimento
 */

/**
 * Valida e normaliza os dados do formulário.
 * @param {Record<string, unknown> | null | undefined} entrada
 * @returns {{ valido: boolean, dados: DadosContato, erros: Partial<Record<keyof DadosContato, string>> }}
 */
export function validarContato(entrada) {
  const e = entrada ?? {};
  /** @type {DadosContato} */
  const dados = {
    nome: normalizarTexto(e.nome),
    empresa: normalizarTexto(e.empresa),
    email: normalizarTexto(e.email),
    telefone: normalizarTexto(e.telefone),
    servico: normalizarTexto(e.servico),
    mensagem: normalizarTexto(e.mensagem, { multilinha: true }),
    consentimento: aceitou(e.consentimento),
  };

  /** @type {Partial<Record<keyof DadosContato, string>>} */
  const erros = {};

  if (!dados.nome) erros.nome = 'Informe seu nome completo.';
  else if (dados.nome.length < LIMITES.nome.min) erros.nome = 'O nome precisa ter pelo menos 2 letras.';
  else if (dados.nome.length > LIMITES.nome.max) erros.nome = `Use no máximo ${LIMITES.nome.max} caracteres.`;
  else if (!/\p{L}/u.test(dados.nome)) erros.nome = 'Informe um nome válido.';

  if (dados.empresa.length > LIMITES.empresa.max) erros.empresa = `Use no máximo ${LIMITES.empresa.max} caracteres.`;

  if (!dados.email) erros.email = 'Informe seu e-mail.';
  else if (dados.email.length > LIMITES.email.max || !EMAIL.test(dados.email)) {
    erros.email = 'Informe um e-mail válido, como nome@empresa.com.br.';
  }

  const digitos = dados.telefone.replace(/\D/g, '');
  if (!dados.telefone) erros.telefone = 'Informe um telefone ou WhatsApp.';
  else if (
    dados.telefone.length > LIMITES.telefone.max ||
    !TELEFONE_CARACTERES.test(dados.telefone) ||
    digitos.length < LIMITES.telefone.minDigitos ||
    digitos.length > LIMITES.telefone.maxDigitos
  ) {
    erros.telefone = 'Informe um número válido com DDD, como (11) 91234-5678.';
  }

  if (!dados.servico) erros.servico = 'Selecione o serviço de interesse.';
  else if (!SERVICOS.some((s) => s.valor === dados.servico)) erros.servico = 'Selecione uma das opções da lista.';

  if (!dados.mensagem) erros.mensagem = 'Conte um pouco sobre o seu projeto.';
  else if (dados.mensagem.length < LIMITES.mensagem.min) {
    erros.mensagem = `Escreva pelo menos ${LIMITES.mensagem.min} caracteres.`;
  } else if (dados.mensagem.length > LIMITES.mensagem.max) {
    erros.mensagem = `Use no máximo ${LIMITES.mensagem.max.toLocaleString('pt-BR')} caracteres.`;
  }

  if (!dados.consentimento) erros.consentimento = 'Para enviar, é preciso concordar com a Política de Privacidade.';

  return { valido: Object.keys(erros).length === 0, dados, erros };
}
