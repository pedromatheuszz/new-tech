/**
 * Formulário de contato: validação em tempo real, máscara de telefone, envio para /api/contato
 * e mensagens de sucesso/erro acessíveis. Sem JavaScript, o formulário continua funcionando
 * (envio HTML padrão para a mesma API).
 */
import { LIMITES, SERVICOS } from '../lib/contato/campos.js';
import { validarContato } from '../lib/contato/validacao.js';

type Campo = 'nome' | 'empresa' | 'email' | 'telefone' | 'servico' | 'mensagem' | 'consentimento';
const CAMPOS: Campo[] = ['nome', 'empresa', 'email', 'telefone', 'servico', 'mensagem', 'consentimento'];
const ERRO_CONEXAO = 'Não foi possível conectar. Verifique sua internet e tente novamente.';
const ERRO_PADRAO = 'Não foi possível enviar sua mensagem agora. Tente novamente em instantes.';

const formulario = document.querySelector<HTMLFormElement>('[data-formulario-contato]');
if (formulario) iniciar(formulario);

function iniciar(form: HTMLFormElement) {
  form.noValidate = true; // a validação passa a ser feita aqui, com mensagens em português
  const inicio = performance.now();
  const tocados = new Set<Campo>();
  let enviando = false;

  const area = form.closest<HTMLElement>('[data-area-formulario]');
  const sucesso = area?.querySelector<HTMLElement>('[data-sucesso]');
  const sucessoNome = area?.querySelector<HTMLElement>('[data-sucesso-nome]');
  const alerta = form.querySelector<HTMLElement>('[data-alerta]');
  const alertaTexto = form.querySelector<HTMLElement>('[data-alerta-texto]');
  const botao = form.querySelector<HTMLButtonElement>('[data-enviar]');
  const contador = form.querySelector<HTMLElement>('[data-contador-mensagem]');

  const elemento = (campo: Campo) => form.elements.namedItem(campo) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;

  function lerDados() {
    const dados = new FormData(form);
    return {
      nome: String(dados.get('nome') ?? ''),
      empresa: String(dados.get('empresa') ?? ''),
      email: String(dados.get('email') ?? ''),
      telefone: String(dados.get('telefone') ?? ''),
      servico: String(dados.get('servico') ?? ''),
      mensagem: String(dados.get('mensagem') ?? ''),
      consentimento: dados.get('consentimento') === 'sim',
      website: String(dados.get('website') ?? ''),
    };
  }

  function mostrarErro(campo: Campo, mensagem: string | undefined) {
    const el = elemento(campo);
    const caixa = form.querySelector<HTMLElement>(`[data-erro="${campo}"]`);
    if (!el || !caixa) return;
    el.setAttribute('aria-invalid', mensagem ? 'true' : 'false');
    el.closest('.campo')?.classList.toggle('campo--erro', Boolean(mensagem));
    caixa.textContent = mensagem ?? '';
  }

  function validarCampo(campo: Campo) {
    const { erros } = validarContato(lerDados());
    mostrarErro(campo, erros[campo]);
  }

  function esconderAlerta() {
    if (alerta) alerta.hidden = true;
  }

  function mostrarAlerta(mensagem: string) {
    if (!alerta || !alertaTexto) return;
    alertaTexto.textContent = mensagem;
    alerta.hidden = false;
  }

  // Valida ao sair do campo (se algo foi digitado) e, depois do primeiro erro, a cada alteração.
  form.addEventListener('focusout', (evento) => {
    const campo = (evento.target as HTMLInputElement).name as Campo;
    if (!CAMPOS.includes(campo)) return;
    const valor = (evento.target as HTMLInputElement).value;
    if (campo !== 'consentimento' && !valor && !tocados.has(campo)) return;
    tocados.add(campo);
    validarCampo(campo);
  });

  form.addEventListener('input', (evento) => {
    const alvo = evento.target as HTMLInputElement;
    const campo = alvo.name as Campo;
    if (campo === 'telefone') aplicarMascara(alvo);
    if (campo === 'mensagem') atualizarContador();
    if (CAMPOS.includes(campo) && (tocados.has(campo) || alvo.getAttribute('aria-invalid') === 'true')) validarCampo(campo);
    esconderAlerta();
  });

  form.addEventListener('change', (evento) => {
    const campo = (evento.target as HTMLInputElement).name as Campo;
    if (campo === 'servico' || campo === 'consentimento') {
      tocados.add(campo);
      validarCampo(campo);
    }
  });

  function atualizarContador() {
    if (!contador) return;
    const tamanho = (elemento('mensagem')?.value ?? '').length;
    contador.textContent = `${tamanho.toLocaleString('pt-BR')}/${LIMITES.mensagem.max.toLocaleString('pt-BR')}`;
    contador.classList.toggle('contador--limite', tamanho > LIMITES.mensagem.max);
  }
  atualizarContador();

  function definirEnviando(ativo: boolean) {
    enviando = ativo;
    form.setAttribute('aria-busy', String(ativo));
    if (botao) {
      botao.disabled = ativo;
      botao.classList.toggle('btn--carregando', ativo);
      const rotulo = botao.querySelector('[data-rotulo]');
      if (rotulo) rotulo.textContent = ativo ? 'Enviando…' : 'Enviar mensagem';
    }
  }

  function mostrarSucesso(nome: string) {
    if (!sucesso) return;
    if (sucessoNome) sucessoNome.textContent = nome.split(' ')[0] ?? '';
    form.hidden = true;
    sucesso.hidden = false;
    sucesso.querySelector<HTMLElement>('[data-sucesso-titulo]')?.focus();
  }

  area?.querySelector('[data-nova-mensagem]')?.addEventListener('click', () => {
    form.reset();
    tocados.clear();
    CAMPOS.forEach((campo) => mostrarErro(campo, undefined));
    atualizarContador();
    esconderAlerta();
    if (sucesso) sucesso.hidden = true;
    form.hidden = false;
    elemento('nome')?.focus();
  });

  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    if (enviando) return;
    esconderAlerta();

    const dados = lerDados();
    const { valido, erros } = validarContato(dados);
    CAMPOS.forEach((campo) => {
      tocados.add(campo);
      mostrarErro(campo, erros[campo]);
    });
    if (!valido) {
      const primeiro = CAMPOS.find((campo) => erros[campo]);
      if (primeiro) elemento(primeiro)?.focus();
      return;
    }

    definirEnviando(true);
    try {
      const resposta = await fetch(form.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ ...dados, _tempo: Math.round(performance.now() - inicio) }),
        signal: 'timeout' in AbortSignal ? AbortSignal.timeout(25_000) : undefined,
      });
      const corpo = (await resposta.json().catch(() => null)) as {
        ok?: boolean;
        mensagem?: string;
        campos?: Partial<Record<Campo, string>>;
      } | null;

      if (resposta.ok && corpo?.ok) {
        mostrarSucesso(dados.nome);
        return;
      }
      if (corpo?.campos) {
        CAMPOS.forEach((campo) => mostrarErro(campo, corpo.campos?.[campo]));
        const primeiro = CAMPOS.find((campo) => corpo.campos?.[campo]);
        if (primeiro) elemento(primeiro)?.focus();
      }
      mostrarAlerta(corpo?.mensagem ?? ERRO_PADRAO);
    } catch {
      mostrarAlerta(ERRO_CONEXAO);
    } finally {
      definirEnviando(false);
    }
  });

  // Botões "Tenho interesse": pré-selecionam o serviço no formulário.
  const selecionarServico = (valor: string | null | undefined) => {
    const select = elemento('servico') as HTMLSelectElement | null;
    if (!select || !valor || !SERVICOS.some((s) => s.valor === valor)) return false;
    select.value = valor;
    mostrarErro('servico', undefined);
    const campo = select.closest('.campo');
    campo?.classList.remove('campo--destaque');
    void (campo as HTMLElement | null)?.offsetWidth; // reinicia a animação de destaque
    campo?.classList.add('campo--destaque');
    return true;
  };

  document.addEventListener('click', (evento) => {
    const link = (evento.target as Element).closest<HTMLElement>('[data-servico]');
    if (!link) return;
    if (!selecionarServico(link.dataset.servico)) return;
    if (form.hidden) area?.querySelector<HTMLButtonElement>('[data-nova-mensagem]')?.click();
    // Em computadores, leva o foco ao primeiro campo depois da rolagem suave.
    if (window.matchMedia('(pointer: fine)').matches) {
      const atraso = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 700;
      window.setTimeout(() => elemento('nome')?.focus({ preventScroll: true }), atraso);
    }
  });

  // Também aceita ?servico=sites na URL (links compartilhados).
  selecionarServico(new URLSearchParams(window.location.search).get('servico'));
}

/** Formata números brasileiros enquanto a pessoa digita: (11) 91234-5678. */
function aplicarMascara(campo: HTMLInputElement) {
  const valor = campo.value;
  if (valor.trim().startsWith('+')) return; // número internacional: mantém como digitado
  const d = valor.replace(/\D/g, '').slice(0, 11);
  let formatado = d;
  if (d.length > 2) formatado = `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length > 6) {
    const meio = d.length === 11 ? 7 : 6;
    formatado = `(${d.slice(0, 2)}) ${d.slice(2, meio)}-${d.slice(meio)}`;
  }
  if (formatado !== valor) campo.value = formatado;
}
