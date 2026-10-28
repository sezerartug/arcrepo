import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Logger } from '@nestjs/common';

export interface Mail {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
}

// Outbound e-mail port. MVP implementation only writes to the console and .data/mail/ (no real mail).
export interface MailPort {
  send(mail: Mail): Promise<void>;
}
export const MAIL_PORT = Symbol('MAIL_PORT');

export class ConsoleMailPort implements MailPort {
  private readonly logger = new Logger('Mail');
  private n = 0;

  constructor(
    private readonly dir = process.env.MAIL_DIR ?? path.resolve(process.cwd(), '../../.data/mail'),
  ) {}

  async send(mail: Mail): Promise<void> {
    const body = `To: ${mail.to}\nSubject: ${mail.subject}\n\n${mail.text}\n`;
    this.logger.log(`\n${body}`);
    await mkdir(this.dir, { recursive: true });
    const name = `${new Date().toISOString().replace(/[:.]/g, '-')}-${String(++this.n)}.txt`;
    await writeFile(path.join(this.dir, name), body, { flag: 'wx' });
  }
}
