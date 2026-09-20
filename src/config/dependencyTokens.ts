export const DI_TOKENS = {
  Db: "Db",
  JwtConfig: "JwtConfig",
  EmailProvider: "EmailProvider",
  EmailServiceConfig: "EmailServiceConfig",
  UserRepository: "UserRepository",
  TokenRepository: "TokenRepository",
} as const;

export type EmailServiceConfig = {
  appName: string;
  clientBaseUrl: string;
};
