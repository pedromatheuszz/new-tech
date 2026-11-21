/**
 * Brilho suave que acompanha o cursor nos cards com [data-brilho] (apenas mouse/trackpad).
 */
if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
  let alvo: HTMLElement | null = null;
  let x = 0;
  let y = 0;
  let agendado = false;

  const atualizar = () => {
    agendado = false;
    if (!alvo) return;
    const caixa = alvo.getBoundingClientRect();
    alvo.style.setProperty('--mx', `${x - caixa.left}px`);
    alvo.style.setProperty('--my', `${y - caixa.top}px`);
  };

  document.addEventListener(
    'pointermove',
    (evento) => {
      const elemento = (evento.target as Element | null)?.closest?.<HTMLElement>('[data-brilho]');
      if (!elemento) return;
      alvo = elemento;
      x = evento.clientX;
      y = evento.clientY;
      if (!agendado) {
        agendado = true;
        requestAnimationFrame(atualizar);
      }
    },
    { passive: true },
  );
}

export {};
