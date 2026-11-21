/**
 * Servidor SMTP local para testar o envio de e-mails do formulário sem uma conta real.
 *
 *   1. npm run smtp:local          (deixe rodando em um terminal)
 *   2. No arquivo .env:            SMTP_HOST=127.0.0.1  SMTP_PORT=2525  SMTP_SECURE=false
 *                                  CONTATO_DESTINATARIO=equipe@newtech.local  CONTATO_REMETENTE=site@newtech.local
 *   3. npm run dev e envie o formulário.
 *
 * Cada e-mail recebido é exibido aqui e salvo em .data/emails/*.eml (abre em qualquer cliente de e-mail).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SMTPServer } from 'smtp-server';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const pasta = join(raiz, '.data/emails');
const porta = Number(process.env.SMTP_LOCAL_PORTA ?? 2525);
mkdirSync(pasta, { recursive: true });

const servidor = new SMTPServer({
  authOptional: true,
  allowInsecureAuth: true,
  disabledCommands: ['STARTTLS'],
  banner: 'SMTP local de testes — New Tech',
  onData(stream, sessao, concluir) {
    const partes = [];
    stream.on('data', (parte) => partes.push(parte));
    stream.on('end', () => {
      const bruto = Buffer.concat(partes);
      const arquivo = join(pasta, `${new Date().toISOString().replace(/[:.]/g, '-')}.eml`);
      writeFileSync(arquivo, bruto);
      const texto = bruto.toString('utf8');
      const assunto = texto.match(/^Subject: (.+)$/im)?.[1] ?? '(sem assunto)';
      console.log(`\n✉  E-mail recebido de ${sessao.envelope.mailFrom?.address} para ${sessao.envelope.rcptTo.map((r) => r.address).join(', ')}`);
      console.log(`   Assunto: ${assunto}`);
      console.log(`   Salvo em: ${arquivo}`);
      concluir();
    });
  },
});

servidor.listen(porta, '127.0.0.1', () => {
  console.log(`SMTP local ouvindo em 127.0.0.1:${porta}. Pressione Ctrl+C para encerrar.`);
});
