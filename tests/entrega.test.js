/**
 * Testes de integração dos canais de entrega: envia de verdade para um servidor SMTP local
 * e para um webhook HTTP local, conferindo o conteúdo recebido.
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, before, describe, it } from 'node:test';
import { SMTPServer } from 'smtp-server';
import { processarContato } from '../src/lib/contato/processar.js';
import { criarTransportes } from '../src/lib/contato/transportes.js';

const silencioso = { warn() {}, error() {} };
const entrada = {
  nome: 'Beatriz Rocha',
  empresa: 'Rocha Arquitetura',
  email: 'beatriz@rocha.arq.br',
  telefone: '(41) 97777-6666',
  servico: 'sites',
  mensagem: 'Quero um site institucional com portfólio de projetos.',
  consentimento: true,
  _tempo: 12000,
};

describe('entrega por SMTP (servidor local)', () => {
  /** @type {SMTPServer} */
  let servidor;
  let porta = 0;
  const recebidos = [];

  before(async () => {
    servidor = new SMTPServer({
      authOptional: false,
      allowInsecureAuth: true,
      disabledCommands: ['STARTTLS'],
      onAuth(auth, _sessao, callback) {
        if (auth.username === 'site@newtech.local' && auth.password === 'senha-teste') return callback(null, { user: auth.username });
        return callback(new Error('Credenciais inválidas'));
      },
      onData(stream, sessao, callback) {
        const partes = [];
        stream.on('data', (p) => partes.push(p));
        stream.on('end', () => {
          recebidos.push({ envelope: sessao.envelope, bruto: Buffer.concat(partes).toString('utf8') });
          callback();
        });
      },
    });
    await new Promise((resolve) => servidor.listen(0, '127.0.0.1', resolve));
    porta = servidor.server.address().port;
  });

  after(() => new Promise((resolve) => servidor.close(resolve)));

  it('envia o e-mail com remetente, destinatário, resposta e conteúdo corretos', async () => {
    const transportes = criarTransportes(
      {
        SMTP_HOST: '127.0.0.1',
        SMTP_PORT: String(porta),
        SMTP_SECURE: 'false',
        SMTP_USER: 'site@newtech.local',
        SMTP_PASS: 'senha-teste',
        CONTATO_DESTINATARIO: 'equipe@newtech.local',
      },
      { log: silencioso },
    );
    assert.deepEqual(
      transportes.map((t) => t.nome),
      ['smtp'],
    );

    const resultado = await processarContato(entrada, { transportes, log: silencioso });
    assert.equal(resultado.ok, true, resultado.mensagem);
    assert.equal(recebidos.length, 1);

    const { envelope, bruto } = recebidos[0];
    assert.equal(envelope.mailFrom.address, 'site@newtech.local');
    assert.deepEqual(
      envelope.rcptTo.map((r) => r.address),
      ['equipe@newtech.local'],
    );
    assert.match(bruto, /^Reply-To: .*beatriz@rocha\.arq\.br/im);
    assert.match(bruto, /^Subject: /im);
    assert.ok(bruto.includes('Content-Type: text/html'), 'deveria ter versão HTML');
    assert.ok(bruto.includes('Content-Type: text/plain'), 'deveria ter versão texto');
  });

  it('retorna falha (502) quando o servidor SMTP recusa as credenciais', async () => {
    const transportes = criarTransportes(
      { SMTP_HOST: '127.0.0.1', SMTP_PORT: String(porta), SMTP_USER: 'site@newtech.local', SMTP_PASS: 'errada' },
      { log: silencioso },
    );
    const resultado = await processarContato(entrada, { transportes, log: silencioso });
    assert.equal(resultado.status, 502);
  });
});

describe('entrega por webhook (servidor HTTP local)', () => {
  let servidor;
  let url = '';
  const recebidos = [];

  before(async () => {
    servidor = createServer((req, res) => {
      let corpo = '';
      req.on('data', (p) => (corpo += p));
      req.on('end', () => {
        recebidos.push({ cabecalhos: req.headers, corpo: JSON.parse(corpo) });
        res.writeHead(req.headers.authorization === 'Bearer token-teste' ? 200 : 401).end();
      });
    });
    await new Promise((resolve) => servidor.listen(0, '127.0.0.1', resolve));
    url = `http://127.0.0.1:${servidor.address().port}/contato`;
  });

  after(() => new Promise((resolve) => servidor.close(resolve)));

  it('envia JSON com os dados do contato e o token de autorização', async () => {
    const transportes = criarTransportes(
      { CONTATO_WEBHOOK_URL: url, CONTATO_WEBHOOK_TOKEN: 'token-teste' },
      { desenvolvimento: true, log: silencioso },
    );
    const resultado = await processarContato(entrada, { transportes, log: silencioso });
    assert.equal(resultado.ok, true);
    const { corpo, cabecalhos } = recebidos.at(-1);
    assert.equal(cabecalhos['content-type'], 'application/json');
    assert.equal(corpo.evento, 'contato.recebido');
    assert.equal(corpo.contato.email, 'beatriz@rocha.arq.br');
    assert.equal(corpo.contato.servicoRotulo, 'Desenvolvimento de Sites');
  });

  it('considera falha quando o webhook responde com erro', async () => {
    const transportes = criarTransportes(
      { CONTATO_WEBHOOK_URL: url, CONTATO_WEBHOOK_TOKEN: 'token-errado' },
      { desenvolvimento: true, log: silencioso },
    );
    const resultado = await processarContato(entrada, { transportes, log: silencioso });
    assert.equal(resultado.status, 502);
  });

  it('exige https para webhooks em produção', () => {
    const transportes = criarTransportes({ CONTATO_WEBHOOK_URL: url }, { desenvolvimento: false, log: silencioso });
    assert.equal(transportes.length, 0);
  });
});
