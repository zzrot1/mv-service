import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { inject, injectable } from "tsyringe";
import { DI_TOKENS } from "../../../config/dependencyTokens.js";
import * as schema from "../../../db/schema.js";
import { accounts, type Account, type AuthProvider } from "../../../db/schema.js";
import type { CreateAccountInput, IAccountRepository } from "./types.js";

@injectable()
export class DrizzleAccountRepository implements IAccountRepository {
  constructor(
    @inject(DI_TOKENS.Db)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async findByProviderAccount(
    provider: AuthProvider,
    providerAccountId: string,
  ): Promise<Account | null> {
    const [account] = await this.db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.provider, provider),
          eq(accounts.providerAccountId, providerAccountId),
        ),
      )
      .limit(1);

    return account ?? null;
  }

  async findByUserAndProvider(
    userId: number,
    provider: AuthProvider,
  ): Promise<Account | null> {
    const [account] = await this.db
      .select()
      .from(accounts)
      .where(and(eq(accounts.userId, userId), eq(accounts.provider, provider)))
      .limit(1);

    return account ?? null;
  }

  async listByUser(userId: number): Promise<Account[]> {
    return this.db.select().from(accounts).where(eq(accounts.userId, userId));
  }

  async create(data: CreateAccountInput): Promise<Account> {
    const [account] = await this.db
      .insert(accounts)
      .values({
        userId: data.userId,
        provider: data.provider,
        providerAccountId: data.providerAccountId,
        updatedAt: new Date(),
      })
      .returning();

    return account;
  }

  async deleteById(id: number): Promise<void> {
    await this.db.delete(accounts).where(eq(accounts.id, id));
  }
}
