import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { escaparHtml, linkWhatsAppDoTelefone, montarEmail } from '../src/lib/contato/email.js';
import { criarLimitador } from '../src/lib/contato/limitador.js';

describe('criarLimitador', () => {
  it('bloqueia após o máximo de tentativas e libera depois da janela', () => {
    const limitador = criarLimitador({ maximo: 2, janelaMs: 1000 });
    assert.equal(limitador.verificar('ip', 0).permitido, true);
    assert.equal(limitador.verificar('ip', 100).permitido, true);
    const bloqueado = limitador.verificar('ip', 200);
    assert.equal(bloqueado.permitido, false);
    assert.equal(bloqueado.tentarEmSegundos, 1);
    assert.equal(limitador.verificar('outro-ip', 200).permitido, true, 'cada origem tem o próprio limite');
    assert.equal(limitador.verificar('ip', 1101).permitido, true, 'libera após a janela');
  });

  it('não cresce indefinidamente', () => {
    const limitador = criarLimitador({ maximo: 1, janelaMs: 10, maxChaves: 50 });
    for (let i = 0; i < 500; i++) limitador.verificar(`ip-${i}`, i * 100);
    assert.ok(limitador.tamanho <= 51);
  });
});

describe('montarEmail', () => {
  const dados = {
    nome: 'Ana <script>alert(1)</script>\r\nBcc: x@y.com',
    empresa: '',
    email: 'ana@empresa.com',
    telefone: '(21) 99876-5432',
    servico: 'sites',
    mensagem: '<b>Olá</b> & tudo bem?',
    consentimento: true,
  };
  const email = montarEmail(dados, { recebidoEm: new Date('2026-11-21T15:30:00Z') });

  it('escapa o conteúdo do visitante no HTML', () => {
    assert.ok(!email.html.includes('<script>'));
    assert.ok(email.html.includes('&lt;b&gt;Olá&lt;/b&gt; &amp; tudo bem?'));
  });

  it('gera assunto em uma linha só (sem injeção de cabeçalhos)', () => {
    assert.ok(!/[\r\n]/.test(email.assunto));
    assert.match(email.assunto, /^Novo contato pelo site: Desenvolvimento de Sites — Ana/);
  });

  it('inclui todos os campos no texto e horário de Brasília', () => {
    for (const trecho of ['ana@empresa.com', '(21) 99876-5432', 'Desenvolvimento de Sites', 'Não informada', '21/11/2026, 12:30']) {
      assert.ok(email.texto.includes(trecho), `texto deveria conter "${trecho}"`);
    }
  });

  it('cria link de WhatsApp para números brasileiros', () => {
    assert.equal(linkWhatsAppDoTelefone('(21) 99876-5432'), 'https://wa.me/5521998765432');
    assert.equal(linkWhatsAppDoTelefone('+55 21 3333-4444'), 'https://wa.me/552133334444');
    assert.equal(linkWhatsAppDoTelefone('+1 415 555 0100'), null);
    assert.equal(escaparHtml(`"'`), '&quot;&#39;');
  });
});
