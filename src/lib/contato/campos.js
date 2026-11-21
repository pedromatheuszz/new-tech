/**
 * Definições do formulário de contato compartilhadas entre o navegador e o servidor.
 * Alterar uma opção aqui atualiza o formulário, a validação e o e-mail recebido.
 */

/** Opções do campo "Serviço de interesse". O "valor" é o que trafega na API. */
export const SERVICOS = Object.freeze([
  Object.freeze({ valor: 'software', rotulo: 'Desenvolvimento de Software / Aplicativo' }),
  Object.freeze({ valor: 'sites', rotulo: 'Desenvolvimento de Sites' }),
  Object.freeze({ valor: 'videos', rotulo: 'Edição de Vídeos' }),
  Object.freeze({ valor: 'outro', rotulo: 'Outro' }),
]);

/** Limites de tamanho (validados no navegador e novamente no servidor). */
export const LIMITES = Object.freeze({
  nome: { min: 2, max: 100 },
  empresa: { max: 100 },
  email: { max: 254 },
  telefone: { max: 25, minDigitos: 10, maxDigitos: 15 },
  mensagem: { min: 10, max: 3000 },
});

/** Tempo mínimo (ms) entre abrir a página e enviar — envios mais rápidos costumam ser robôs. */
export const TEMPO_MINIMO_MS = 2500;

/** @param {string} valor */
export function rotuloServico(valor) {
  return SERVICOS.find((s) => s.valor === valor)?.rotulo ?? valor;
}
