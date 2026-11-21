/**
 * Revela elementos [data-revelar] quando entram na tela.
 * Os estilos ficam em global.css; com "movimento reduzido" ativo, nada é animado.
 */
const elementos = document.querySelectorAll<HTMLElement>('[data-revelar]');
const movimentoReduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (elementos.length && !movimentoReduzido) {
  // Se o script carregou depois da animação de segurança (2,5 s), apenas mantém tudo visível.
  if (performance.now() > 2300 || !('IntersectionObserver' in window)) {
    elementos.forEach((el) => el.classList.add('visivel'));
  } else {
    document.documentElement.classList.add('revelar-ativo');
    const observador = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          if (!entrada.isIntersecting) continue;
          entrada.target.classList.add('visivel');
          observador.unobserve(entrada.target);
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.1 },
    );
    elementos.forEach((el) => observador.observe(el));
  }
}

export {};
