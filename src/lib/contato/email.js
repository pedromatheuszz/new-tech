/**
 * Monta a mensagem (assunto, texto e HTML) enviada à equipe da New Tech.
 * Todo conteúdo vindo do visitante é escapado antes de entrar no HTML.
 */
import { rotuloServico } from './campos.js';

/** @param {unknown} valor */
export function escaparHtml(valor) {
  return String(valor).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );
}

/** Remove quebras de linha (evita injeção de cabeçalhos em assuntos e nomes). */
const umaLinha = (valor) => String(valor).replace(/[\r\n]+/g, ' ').trim();

/** Link de WhatsApp para números brasileiros (DDD + 8/9 dígitos, com ou sem +55). */
export function linkWhatsAppDoTelefone(telefone) {
  const texto = String(telefone).trim();
  const digitos = texto.replace(/\D/g, '');
  const comCodigoBrasil = digitos.startsWith('55') && (digitos.length === 12 || digitos.length === 13);
  if (texto.startsWith('+')) return comCodigoBrasil ? `https://wa.me/${digitos}` : null;
  if (digitos.length === 10 || digitos.length === 11) return `https://wa.me/55${digitos}`;
  return comCodigoBrasil ? `https://wa.me/${digitos}` : null;
}

/**
 * @param {import('./validacao.js').DadosContato} dados
 * @param {{ recebidoEm?: Date, nomeSite?: string }} [opcoes]
 */
export function montarEmail(dados, { recebidoEm = new Date(), nomeSite = 'New Tech' } = {}) {
  const servico = rotuloServico(dados.servico);
  const quando = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(recebidoEm);
  const whatsapp = linkWhatsAppDoTelefone(dados.telefone);

  const assunto = umaLinha(`Novo contato pelo site: ${servico} — ${dados.nome}`).slice(0, 180);

  const campos = [
    ['Nome', dados.nome],
    ['Empresa', dados.empresa || 'Não informada'],
    ['E-mail', dados.email],
    ['Telefone/WhatsApp', dados.telefone],
    ['Serviço de interesse', servico],
    ['Recebido em', `${quando} (horário de Brasília)`],
  ];

  const texto = [
    `Nova mensagem enviada pelo formulário do site ${nomeSite}.`,
    '',
    ...campos.map(([rotulo, valor]) => `${rotulo}: ${valor}`),
    '',
    'Mensagem:',
    dados.mensagem,
    '',
    '—',
    'O visitante concordou com a Política de Privacidade ao enviar.',
    `Responda este e-mail para falar diretamente com ${umaLinha(dados.nome)}.`,
    whatsapp ? `WhatsApp: ${whatsapp}` : '',
  ]
    .filter((linha, i, lista) => !(linha === '' && lista[i - 1] === ''))
    .join('\n')
    .trim();

  const linhasTabela = campos
    .map(
      ([rotulo, valor]) =>
        `<tr><td style="padding:8px 12px 8px 0;color:#6b7690;font-size:13px;white-space:nowrap;vertical-align:top">${escaparHtml(rotulo)}</td>` +
        `<td style="padding:8px 0;color:#0b1020;font-size:15px;font-weight:600">${escaparHtml(valor)}</td></tr>`,
    )
    .join('');

  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escaparHtml(assunto)}</title></head>
<body style="margin:0;padding:24px;background:#eef2f8;font-family:Arial,Helvetica,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden">
    <tr><td style="background:#040509;padding:20px 28px;border-bottom:3px solid #018afc">
      <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:1px">NEW <span style="color:#018afc">TECH</span></span>
      <span style="display:block;color:#a6afc0;font-size:13px;margin-top:4px">Novo contato pelo site</span>
    </td></tr>
    <tr><td style="padding:24px 28px">
      <table role="presentation" cellpadding="0" cellspacing="0">${linhasTabela}</table>
      <p style="margin:20px 0 8px;color:#6b7690;font-size:13px">Mensagem</p>
      <div style="padding:16px;border-radius:10px;background:#f4f7fb;color:#0b1020;font-size:15px;line-height:1.6;white-space:pre-wrap">${escaparHtml(dados.mensagem)}</div>
      <p style="margin:24px 0 0">
        <a href="mailto:${escaparHtml(encodeURIComponent(dados.email).replace(/%40/g, '@'))}" style="display:inline-block;padding:10px 18px;border-radius:999px;background:#0a62f6;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px">Responder por e-mail</a>
        ${whatsapp ? `<a href="${escaparHtml(whatsapp)}" style="display:inline-block;margin-left:8px;padding:10px 18px;border-radius:999px;background:#e7f6ee;color:#0b7a44;text-decoration:none;font-weight:600;font-size:14px">Chamar no WhatsApp</a>` : ''}
      </p>
    </td></tr>
    <tr><td style="padding:16px 28px;background:#f8fafc;color:#8089a0;font-size:12px">O visitante concordou com a Política de Privacidade ao enviar esta mensagem.</td></tr>
  </table>
</body></html>`;

  return { assunto, texto, html };
}
