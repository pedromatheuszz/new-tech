import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizarTexto, validarContato } from '../src/lib/contato/validacao.js';

const valido = {
  nome: 'Maria Souza',
  empresa: '',
  email: 'maria@empresa.com.br',
  telefone: '(11) 91234-5678',
  servico: 'software',
  mensagem: 'Gostaria de um aplicativo para agendamentos.',
  consentimento: true,
};

describe('validarContato', () => {
  it('aceita dados completos e válidos', () => {
    const { valido: ok, erros } = validarContato(valido);
    assert.equal(ok, true);
    assert.deepEqual(erros, {});
  });

  it('exige os campos obrigatórios (empresa é opcional)', () => {
    const { valido: ok, erros } = validarContato({});
    assert.equal(ok, false);
    assert.deepEqual(Object.keys(erros).sort(), ['consentimento', 'email', 'mensagem', 'nome', 'servico', 'telefone']);
  });

  it('valida o formato do e-mail', () => {
    for (const email of ['maria', 'maria@', 'maria@empresa', 'maria@@empresa.com', 'ma ria@empresa.com', 'maria@.com']) {
      assert.ok(validarContato({ ...valido, email }).erros.email, `deveria rejeitar "${email}"`);
    }
    for (const email of ['maria@empresa.com', 'maria.souza+site@empresa.com.br', 'm@sub.dominio.io']) {
      assert.equal(validarContato({ ...valido, email }).erros.email, undefined, `deveria aceitar "${email}"`);
    }
  });

  it('valida telefone com DDD (nacional ou internacional)', () => {
    assert.ok(validarContato({ ...valido, telefone: '1234-5678' }).erros.telefone);
    assert.ok(validarContato({ ...valido, telefone: 'abc' }).erros.telefone);
    assert.equal(validarContato({ ...valido, telefone: '11 3456-7890' }).erros.telefone, undefined);
    assert.equal(validarContato({ ...valido, telefone: '+55 11 91234-5678' }).erros.telefone, undefined);
  });

  it('só aceita serviços da lista', () => {
    assert.ok(validarContato({ ...valido, servico: 'hacking' }).erros.servico);
    for (const servico of ['software', 'sites', 'videos', 'outro']) {
      assert.equal(validarContato({ ...valido, servico }).erros.servico, undefined);
    }
  });

  it('limita o tamanho da mensagem', () => {
    assert.ok(validarContato({ ...valido, mensagem: 'curta' }).erros.mensagem);
    assert.ok(validarContato({ ...valido, mensagem: 'a'.repeat(3001) }).erros.mensagem);
  });

  it('exige o consentimento com a Política de Privacidade', () => {
    assert.ok(validarContato({ ...valido, consentimento: false }).erros.consentimento);
    assert.equal(validarContato({ ...valido, consentimento: 'sim' }).erros.consentimento, undefined);
  });

  it('normaliza espaços e remove caracteres de controle', () => {
    const { dados } = validarContato({ ...valido, nome: '  Maria\u0000   Souza  ', mensagem: 'Linha 1\r\n\r\n\r\n\r\n\r\nLinha 2' });
    assert.equal(dados.nome, 'Maria Souza');
    assert.equal(dados.mensagem, 'Linha 1\n\n\nLinha 2');
    assert.equal(normalizarTexto(42), '');
  });
});
