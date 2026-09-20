import type { Account, AuthProvider } from "../../../db/schema.js";

export type CreateAccountInput = {
  userId: number;
  provider: AuthProvider;
  providerAccountId: string;
};

export interface IAccountRepository {
  findByProviderAccount(
    provider: AuthProvider,
    providerAccountId: string,
  ): Promise<Account | null>;

  findByUserAndProvider(
    userId: number,
    provider: AuthProvider,
  ): Promise<Account | null>;

  listByUser(userId: number): Promise<Account[]>;

  create(data: CreateAccountInput): Promise<Account>;

  deleteById(id: number): Promise<void>;
}
