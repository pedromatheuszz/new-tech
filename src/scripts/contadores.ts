/**
 * Contagem progressiva dos indicadores ([data-contador]) quando entram na tela.
 * O HTML já traz o valor final (acessível e indexável); a animação só começa do zero.
 */
const contadores = document.querySelectorAll<HTMLElement>('[data-contador]');
const movimentoReduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function formatar(valor: number, casas: number) {
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas }).format(valor);
}

function texto(el: HTMLElement, valor: number) {
  const casas = Number(el.dataset.casas ?? 0);
  return `${el.dataset.prefixo ?? ''}${formatar(valor, casas)}${el.dataset.sufixo ?? ''}`;
}

function animar(el: HTMLElement) {
  const alvo = Number(el.dataset.alvo);
  const duracao = 1800;
  const inicio = performance.now();
  const passo = (agora: number) => {
    const t = Math.min(1, (agora - inicio) / duracao);
    const suavizado = 1 - Math.pow(1 - t, 4);
    el.textContent = texto(el, alvo * suavizado);
    if (t < 1) requestAnimationFrame(passo);
    else el.textContent = texto(el, alvo);
  };
  requestAnimationFrame(passo);
}

if (contadores.length && !movimentoReduzido && 'IntersectionObserver' in window) {
  const observador = new IntersectionObserver(
    (entradas) => {
      for (const entrada of entradas) {
        if (!entrada.isIntersecting) continue;
        observador.unobserve(entrada.target);
        animar(entrada.target as HTMLElement);
      }
    },
    { threshold: 0.6 },
  );
  contadores.forEach((el) => {
    if (!Number.isFinite(Number(el.dataset.alvo))) return;
    el.textContent = texto(el, 0);
    observador.observe(el);
  });
}

export {};
