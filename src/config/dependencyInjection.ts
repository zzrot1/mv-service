import { container } from "tsyringe";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "../db/schema.js";
import config from "./config.js";
import { db } from "./dbConnection.js";
import { DI_TOKENS, type EmailServiceConfig } from "./dependencyTokens.js";
import {
  DrizzleAccountRepository,
  DrizzleTokenRepository,
  DrizzleUserRepository,
  type IAccountRepository,
  type ITokenRepository,
  type IUserRepository,
} from "../api/repositories/index.js";
import {
  AuthService,
  EmailService,
  TokenService,
  UserService,
} from "../api/services/index.js";
import type { EmailProvider, OAuthProvider } from "../utils/index.js";
import { SmtpEmailProvider } from "../api/email/smtpProvider.js";
import {
  DisabledOAuthProvider,
  GoogleOAuthProvider,
} from "../api/oauth/googleProvider.js";

function buildEmailProvider(): EmailProvider {
  const driver = config.email.driver;

  if (driver === "disabled") {
    return { send: async () => {} };
  }

  if (!config.email.from) {
    throw new Error("EMAIL_FROM is required when EMAIL_DRIVER is enabled");
  }

  if (driver === "smtp") {
    const host = config.email.smtp.host;
    const port = config.email.smtp.port;

    if (!host || !port) {
      throw new Error(
        "SMTP_HOST and SMTP_PORT are required for EMAIL_DRIVER=smtp",
      );
    }

    return new SmtpEmailProvider({
      host,
      port,
      username: config.email.smtp.auth.user,
      password: config.email.smtp.auth.pass,
      from: config.email.from,
    });
  }

  if (driver === "postmark") {
    const token = config.email.postmark.serverToken;
    if (!token) {
      throw new Error(
        "POSTMARK_SERVER_TOKEN is required for EMAIL_DRIVER=postmark",
      );
    }

    // return new PostmarkEmailProvider(...)
  }

  throw new Error(`Unsupported EMAIL_DRIVER: ${driver}`);
}

function buildGoogleOAuthProvider(): OAuthProvider {
  if (!config.google.clientId) {
    return new DisabledOAuthProvider("Google");
  }

  return new GoogleOAuthProvider(config.google.clientId);
}

container.registerInstance<NodePgDatabase<typeof schema>>(DI_TOKENS.Db, db);
container.registerInstance(DI_TOKENS.JwtConfig, config.jwt);
container.registerInstance<EmailProvider>(
  DI_TOKENS.EmailProvider,
  buildEmailProvider(),
);
container.registerInstance<EmailServiceConfig>(DI_TOKENS.EmailServiceConfig, {
  appName: config.appName,
  clientBaseUrl: config.clientBaseUrl,
});

container.register<IUserRepository>(DI_TOKENS.UserRepository, {
  useClass: DrizzleUserRepository,
});
container.register<ITokenRepository>(DI_TOKENS.TokenRepository, {
  useClass: DrizzleTokenRepository,
});
container.register<IAccountRepository>(DI_TOKENS.AccountRepository, {
  useClass: DrizzleAccountRepository,
});

container.registerInstance<OAuthProvider>(
  DI_TOKENS.GoogleOAuthProvider,
  buildGoogleOAuthProvider(),
);

container.registerSingleton(UserService);
container.registerSingleton(TokenService);
container.registerSingleton(AuthService);
container.registerSingleton(EmailService);

export { container };
