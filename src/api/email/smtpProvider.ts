import { SMTPClient } from "smtp-client";
import { EmailMessage, EmailProvider } from "../../utils/index.js";

type SmtpConfig = {
  host: string;
  port: number;
  secure?: boolean; // false pentru MailHog
  username?: string; // de obicei gol pentru MailHog
  password?: string;
  from: string;
};

function buildMime(
  msg: Required<Pick<EmailMessage, "to" | "subject" | "text">> &
    Partial<EmailMessage> & { from: string },
) {
  const headers: string[] = [
    `From: ${msg.from}`,
    `To: ${msg.to}`,
    `Subject: ${msg.subject}`,
    `MIME-Version: 1.0`,
  ];

  if (msg.html) {
    const boundary = `----=_Part_${Date.now()}`;
    headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);

    const body =
      `--${boundary}\r\n` +
      `Content-Type: text/plain; charset="utf-8"\r\n\r\n` +
      `${msg.text}\r\n\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: text/html; charset="utf-8"\r\n\r\n` +
      `${msg.html}\r\n\r\n` +
      `--${boundary}--\r\n`;

    return headers.join("\r\n") + "\r\n\r\n" + body;
  }

  headers.push(`Content-Type: text/plain; charset="utf-8"`);
  return headers.join("\r\n") + "\r\n\r\n" + msg.text + "\r\n";
}

export class SmtpEmailProvider implements EmailProvider {
  constructor(private readonly cfg: SmtpConfig) {}

  async send(message: EmailMessage): Promise<void> {
    const from = message.from ?? this.cfg.from;

    const client = new SMTPClient({
      host: this.cfg.host,
      port: this.cfg.port,
    });

    await client.connect();

    // Auth dacă e configurat
    if (this.cfg.username && this.cfg.password) {
      await client.authPlain({
        username: this.cfg.username,
        password: this.cfg.password,
      });
    } else {
      // unele servere cer greet explicit
      await client.greet({ hostname: "localhost" });
    }

    await client.mail({ from });
    await client.rcpt({ to: message.to });

    const mime = buildMime({
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
      from,
    });

    await client.data(mime);
    await client.quit();
  }
}
