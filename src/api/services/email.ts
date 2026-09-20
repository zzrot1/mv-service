import { inject, injectable } from "tsyringe";
import {
  DI_TOKENS,
  type EmailServiceConfig,
} from "../../config/dependencyTokens.js";
import type { EmailProvider } from "../../utils/index.js";

@injectable()
export class EmailService {
  constructor(
    @inject(DI_TOKENS.EmailProvider)
    private readonly provider: EmailProvider,
    @inject(DI_TOKENS.EmailServiceConfig)
    private readonly cfg: EmailServiceConfig,
  ) {}

  async sendResetPasswordEmail(
    email: string,
    resetToken: string,
  ): Promise<void> {
    const url = `${this.cfg.clientBaseUrl}/reset-password?token=${encodeURIComponent(resetToken)}`;

    await this.provider.send({
      to: email,
      subject: `${this.cfg.appName} — Reset password`,
      text: `Reset your password using this link: ${url}\nIf you did not request this, ignore this email.`,
      html: `
        <p>Reset your password using this link:</p>
        <p><a href="${url}">${url}</a></p>
        <p>If you did not request this, ignore this email.</p>
      `,
    });
  }

  async sendVerificationEmail(
    email: string,
    verifyToken: string,
  ): Promise<void> {
    const url = `${this.cfg.clientBaseUrl}/verify-email?token=${encodeURIComponent(verifyToken)}`;

    await this.provider.send({
      to: email,
      subject: `${this.cfg.appName} — Verify email`,
      text: `Verify your email using this link: ${url}`,
      html: `
        <p>Verify your email using this link:</p>
        <p><a href="${url}">${url}</a></p>
      `,
    });
  }
}
