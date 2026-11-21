import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { criarLimitador } from '../src/lib/contato/limitador.js';
import { origemPermitida, processarContato } from '../src/lib/contato/processar.js';

const silencioso = { warn() {}, error() {} };
const entrada = {
  nome: 'Carlos Lima',
  empresa: 'Lima Comércio',
  email: 'carlos@lima.com.br',
  telefone: '(31) 98888-7777',
  servico: 'videos',
  mensagem: 'Preciso de vídeos curtos para o Instagram da loja.',
  consentimento: true,
  website: '',
  _tempo: 8000,
};

function transporteFalso({ falhar = false } = {}) {
  const recebidas = [];
  return {
    recebidas,
    transporte: {
      nome: falhar ? 'quebrado' : 'falso',
      async enviar(mensagem) {
        if (falhar) throw new Error('servidor indisponível');
        recebidas.push(mensagem);
      },
    },
  };
}

describe('processarContato', () => {
  it('entrega uma mensagem válida', async () => {
    const { recebidas, transporte } = transporteFalso();
    const resultado = await processarContato(entrada, { transportes: [transporte], log: silencioso });
    assert.equal(resultado.status, 200);
    assert.equal(resultado.ok, true);
    assert.equal(recebidas.length, 1);
    assert.equal(recebidas[0].dados.email, 'carlos@lima.com.br');
    assert.match(recebidas[0].assunto, /Edição de Vídeos/);
  });

  it('devolve os erros por campo quando os dados são inválidos', async () => {
    const { recebidas, transporte } = transporteFalso();
    const resultado = await processarContato({ ...entrada, email: 'invalido' }, { transportes: [transporte], log: silencioso });
    assert.equal(resultado.status, 400);
    assert.equal(resultado.codigo, 'validacao');
    assert.ok(resultado.campos?.email);
    assert.equal(recebidas.length, 0);
  });

  it('descarta silenciosamente envios de robôs (campo-armadilha)', async () => {
    const { recebidas, transporte } = transporteFalso();
    const resultado = await processarContato({ ...entrada, website: 'http://spam' }, { transportes: [transporte], log: silencioso });
    assert.equal(resultado.ok, true);
    assert.equal(recebidas.length, 0);
  });

  it('recusa envios rápidos demais', async () => {
    const { transporte } = transporteFalso();
    const resultado = await processarContato({ ...entrada, _tempo: 300 }, { transportes: [transporte], log: silencioso });
    assert.equal(resultado.status, 400);
    assert.equal(resultado.codigo, 'rapido-demais');
  });

  it('aceita envio sem JavaScript (sem _tempo)', async () => {
    const { recebidas, transporte } = transporteFalso();
    const { _tempo, ...semTempo } = entrada;
    const resultado = await processarContato({ ...semTempo, consentimento: 'sim' }, { transportes: [transporte], log: silencioso });
    assert.equal(resultado.ok, true);
    assert.equal(recebidas.length, 1);
  });

  it('aplica o limite de tentativas', async () => {
    const { transporte } = transporteFalso();
    const limitador = criarLimitador({ maximo: 2, janelaMs: 60_000 });
    const contexto = { chave: '1.2.3.4', limitador, transportes: [transporte], log: silencioso };
    await processarContato(entrada, contexto);
    await processarContato(entrada, contexto);
    const terceiro = await processarContato(entrada, contexto);
    assert.equal(terceiro.status, 429);
    assert.ok(terceiro.tentarEmSegundos > 0);
  });

  it('informa indisponibilidade quando nenhum canal está configurado', async () => {
    const resultado = await processarContato(entrada, { transportes: [], log: silencioso });
    assert.equal(resultado.status, 503);
    assert.equal(resultado.ok, false);
  });

  it('tem sucesso se ao menos um canal funcionar e falha se todos falharem', async () => {
    const bom = transporteFalso();
    const ruim = transporteFalso({ falhar: true });
    const parcial = await processarContato(entrada, { transportes: [ruim.transporte, bom.transporte], log: silencioso });
    assert.equal(parcial.ok, true);
    const total = await processarContato(entrada, { transportes: [ruim.transporte], log: silencioso });
    assert.equal(total.status, 502);
    assert.equal(total.ok, false);
  });
});

describe('origemPermitida', () => {
  const url = 'https://www.newtech.com.br/api/contato';
  it('aceita a mesma origem, origens extras e clientes sem Origin', () => {
    assert.equal(origemPermitida('https://www.newtech.com.br', url), true);
    assert.equal(origemPermitida('https://newtech.com.br', url, ['https://newtech.com.br']), true);
    assert.equal(origemPermitida(null, url), true);
  });
  it('recusa outras origens', () => {
    assert.equal(origemPermitida('https://site-malicioso.com', url), false);
    assert.equal(origemPermitida('null', url), false);
  });
});
