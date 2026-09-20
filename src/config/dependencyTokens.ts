export const DI_TOKENS = {
  Db: "Db",
  JwtConfig: "JwtConfig",
  EmailProvider: "EmailProvider",
  EmailServiceConfig: "EmailServiceConfig",
  UserRepository: "UserRepository",
  TokenRepository: "TokenRepository",
  AccountRepository: "AccountRepository",
  GoogleOAuthProvider: "GoogleOAuthProvider",
} as const;

export type EmailServiceConfig = {
  appName: string;
  clientBaseUrl: string;
};
