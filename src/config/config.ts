import dotenv from "dotenv";
import path from "node:path";
import { z } from "zod";

dotenv.config({ path: path.join(process.cwd(), ".env") });

const numberFromEnv = (defaultValue?: number) =>
  z.preprocess((val) => {
    if (val === undefined || val === null || val === "") return defaultValue;
    const n = Number(val);
    return Number.isFinite(n) ? n : val;
  }, z.number());

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(["production", "development", "test"]),
    PORT: numberFromEnv(3000),

    // app metadata (folosit în email templates + links)
    APP_NAME: z.string().min(1).default("MyApp"),
    CLIENT_BASE_URL: z.string().url().default("http://localhost:3000"),

    // jwt
    JWT_SECRET: z.string().min(1),
    JWT_ACCESS_EXPIRATION_MINUTES: numberFromEnv(30),
    JWT_REFRESH_EXPIRATION_DAYS: numberFromEnv(30),
    JWT_RESET_PASSWORD_EXPIRATION_MINUTES: numberFromEnv(10),
    JWT_VERIFY_EMAIL_EXPIRATION_MINUTES: numberFromEnv(10),

    // Google OAuth (ID token verification)
    GOOGLE_CLIENT_ID: z.string().optional(),

    // email driver + from
    EMAIL_DRIVER: z.enum(["disabled", "smtp", "postmark"]).default("disabled"),
    EMAIL_FROM: z.string().optional(),

    // Postmark
    POSTMARK_SERVER_TOKEN: z.string().optional(),
    POSTMARK_MESSAGE_STREAM: z.string().optional(),

    // SMTP (MailHog or real SMTP)
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: numberFromEnv().optional(),
    SMTP_USERNAME: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
  })
  .loose();

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  const message = parsed.error.issues
    .map((i) => `${i.path.join(".")}: ${i.message}`)
    .join("; ");
  throw new Error(`Config validation error: ${message}`);
}

const envVars = parsed.data;

// Validări logice (nu doar tipuri)
if (envVars.EMAIL_DRIVER !== "disabled" && !envVars.EMAIL_FROM) {
  throw new Error("EMAIL_FROM is required when EMAIL_DRIVER is enabled");
}

if (envVars.EMAIL_DRIVER === "smtp") {
  if (!envVars.SMTP_HOST || !envVars.SMTP_PORT) {
    throw new Error(
      "SMTP_HOST and SMTP_PORT are required when EMAIL_DRIVER=smtp",
    );
  }
}

if (envVars.EMAIL_DRIVER === "postmark") {
  if (!envVars.POSTMARK_SERVER_TOKEN) {
    throw new Error(
      "POSTMARK_SERVER_TOKEN is required when EMAIL_DRIVER=postmark",
    );
  }
}

export default {
  env: envVars.NODE_ENV,
  port: envVars.PORT,

  appName: envVars.APP_NAME,
  clientBaseUrl: envVars.CLIENT_BASE_URL,

  jwt: {
    secret: envVars.JWT_SECRET,
    accessExpirationMinutes: envVars.JWT_ACCESS_EXPIRATION_MINUTES,
    refreshExpirationDays: envVars.JWT_REFRESH_EXPIRATION_DAYS,
    resetPasswordExpirationMinutes:
      envVars.JWT_RESET_PASSWORD_EXPIRATION_MINUTES,
    verifyEmailExpirationMinutes: envVars.JWT_VERIFY_EMAIL_EXPIRATION_MINUTES,
  },

  google: {
    enabled: Boolean(envVars.GOOGLE_CLIENT_ID),
    clientId: envVars.GOOGLE_CLIENT_ID,
  },

  email: {
    driver: envVars.EMAIL_DRIVER,
    from: envVars.EMAIL_FROM,

    postmark: {
      serverToken: envVars.POSTMARK_SERVER_TOKEN,
      messageStream: envVars.POSTMARK_MESSAGE_STREAM,
    },

    smtp: {
      host: envVars.SMTP_HOST,
      port: envVars.SMTP_PORT,
      auth: { user: envVars.SMTP_USERNAME, pass: envVars.SMTP_PASSWORD },
    },
  },
} as const;
