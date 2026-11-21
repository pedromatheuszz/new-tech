/**
 * Cabeçalho: fundo ao rolar, menu mobile acessível e destaque da seção visível.
 */
const cabecalho = document.querySelector<HTMLElement>('[data-cabecalho]');

if (cabecalho) {
  iniciarFundoAoRolar(cabecalho);
  iniciarMenuMobile(cabecalho);
  iniciarSecaoAtiva(cabecalho);
}

/** Ativa o fundo de vidro assim que a página sai do topo (sem ouvir o evento de rolagem). */
function iniciarFundoAoRolar(cabecalho: HTMLElement) {
  const sentinela = document.createElement('div');
  sentinela.setAttribute('aria-hidden', 'true');
  Object.assign(sentinela.style, {
    position: 'absolute',
    top: '0',
    left: '0',
    width: '1px',
    height: '16px',
    pointerEvents: 'none',
  });
  document.body.prepend(sentinela);
  new IntersectionObserver(([entrada]) => {
    cabecalho.classList.toggle('rolado', !entrada.isIntersecting);
  }).observe(sentinela);
}

function iniciarMenuMobile(cabecalho: HTMLElement) {
  const botao = cabecalho.querySelector<HTMLButtonElement>('[data-menu-botao]');
  const menu = cabecalho.querySelector<HTMLElement>('[data-menu]');
  const rotulo = cabecalho.querySelector<HTMLElement>('[data-menu-rotulo]');
  if (!botao || !menu) return;

  const desktop = window.matchMedia('(min-width: 1120px)');
  const foraDoMenu = () =>
    [document.querySelector('main'), document.querySelector('footer'), document.querySelector('[data-whatsapp]')].filter(
      (el): el is HTMLElement => el instanceof HTMLElement,
    );

  const estaAberto = () => botao.getAttribute('aria-expanded') === 'true';

  function definir(aberto: boolean, { devolverFoco = true } = {}) {
    if (aberto === estaAberto()) return;
    botao!.setAttribute('aria-expanded', String(aberto));
    if (rotulo) rotulo.textContent = aberto ? 'Fechar menu' : 'Abrir menu';
    cabecalho.classList.toggle('menu-aberto', aberto);
    document.documentElement.classList.toggle('menu-aberto', aberto);
    // Enquanto o menu está aberto, o restante da página fica inacessível ao teclado e leitores de tela.
    foraDoMenu().forEach((el) => el.toggleAttribute('inert', aberto));
    if (aberto) {
      menu!.querySelector<HTMLElement>('a')?.focus({ preventScroll: true });
    } else if (devolverFoco) {
      botao!.focus({ preventScroll: true });
    }
  }

  botao.addEventListener('click', () => definir(!estaAberto()));

  menu.addEventListener('click', (evento) => {
    if ((evento.target as Element).closest('a') && !desktop.matches) definir(false, { devolverFoco: false });
  });

  document.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape' && estaAberto()) definir(false);
  });

  desktop.addEventListener('change', (evento) => {
    if (evento.matches) definir(false, { devolverFoco: false });
  });
}

/** Destaca no menu a seção que está no centro da tela. */
function iniciarSecaoAtiva(cabecalho: HTMLElement) {
  const links = Array.from(cabecalho.querySelectorAll<HTMLAnchorElement>('[data-secao-link]'));
  const secoes = links
    .map((link) => document.getElementById(link.dataset.secaoLink ?? ''))
    .filter((secao): secao is HTMLElement => secao !== null);
  if (!secoes.length) return;

  const visiveis = new Set<string>();
  const marcar = (id: string | undefined) => {
    for (const link of links) {
      const ativo = link.dataset.secaoLink === id;
      link.classList.toggle('ativo', ativo);
      if (ativo) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    }
  };

  const observador = new IntersectionObserver(
    (entradas) => {
      for (const entrada of entradas) {
        if (entrada.isIntersecting) visiveis.add(entrada.target.id);
        else visiveis.delete(entrada.target.id);
      }
      const atual = [...secoes].reverse().find((secao) => visiveis.has(secao.id));
      if (atual) marcar(atual.id);
    },
    { rootMargin: '-42% 0px -56% 0px' },
  );
  secoes.forEach((secao) => observador.observe(secao));
}

export {};
