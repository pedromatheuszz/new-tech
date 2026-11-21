/**
 * Limite de envios por origem (janela deslizante, em memória).
 * Em hospedagem serverless cada instância tem a própria memória: é uma barreira simples contra
 * abuso, complementada pelo campo-armadilha e pelo tempo mínimo de preenchimento.
 *
 * @param {{ maximo?: number, janelaMs?: number, maxChaves?: number }} [opcoes]
 */
export function criarLimitador({ maximo = 6, janelaMs = 10 * 60 * 1000, maxChaves = 5000 } = {}) {
  /** @type {Map<string, number[]>} */
  const registros = new Map();

  function limpar(agora) {
    const inicio = agora - janelaMs;
    for (const [chave, tempos] of registros) {
      if (!tempos.length || tempos[tempos.length - 1] <= inicio) registros.delete(chave);
    }
    while (registros.size > maxChaves) registros.delete(registros.keys().next().value);
  }

  return {
    /**
     * Registra uma tentativa e informa se ela é permitida.
     * @param {string} chave
     * @param {number} [agora]
     * @returns {{ permitido: true, restantes: number } | { permitido: false, tentarEmSegundos: number }}
     */
    verificar(chave, agora = Date.now()) {
      const inicio = agora - janelaMs;
      const tempos = (registros.get(chave) ?? []).filter((t) => t > inicio);
      if (tempos.length >= maximo) {
        registros.set(chave, tempos);
        return { permitido: false, tentarEmSegundos: Math.max(1, Math.ceil((tempos[0] + janelaMs - agora) / 1000)) };
      }
      tempos.push(agora);
      registros.delete(chave);
      registros.set(chave, tempos);
      if (registros.size > maxChaves) limpar(agora);
      return { permitido: true, restantes: maximo - tempos.length };
    },
    /** Quantidade de origens monitoradas (útil em testes). */
    get tamanho() {
      return registros.size;
    },
  };
}
