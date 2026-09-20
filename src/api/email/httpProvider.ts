import type { EmailMessage, EmailProvider } from "../../utils/index.js";

type HttpConfig = {
  endpoint: string;
  apiKey: string;
  from: string;
};

export class HttpEmailProvider implements EmailProvider {
  constructor(private readonly cfg: HttpConfig) {}

  async send(message: EmailMessage): Promise<void> {
    const res = await fetch(this.cfg.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.cfg.apiKey}`,
      },
      body: JSON.stringify({
        from: message.from ?? this.cfg.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Email provider error: ${res.status} ${body}`);
    }
  }
}
