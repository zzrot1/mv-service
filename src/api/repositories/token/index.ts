import { and, eq, lt } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { inject, injectable } from "tsyringe";
import { DI_TOKENS } from "../../../config/dependencyTokens.js";
import * as schema from "../../../db/schema.js";
import { tokens, type Token, type TokenType } from "../../../db/schema.js";
import type { ITokenRepository } from "./types.js";

@injectable()
export class DrizzleTokenRepository implements ITokenRepository {
  constructor(
    @inject(DI_TOKENS.Db)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async create(data: {
    tokenHash: string;
    userId: number;
    expires: Date;
    type: TokenType;
    blacklisted?: boolean;
  }): Promise<Token> {
    const [token] = await this.db
      .insert(tokens)
      .values({
        tokenHash: data.tokenHash,
        userId: data.userId,
        expires: data.expires,
        type: data.type,
        blacklisted: data.blacklisted ?? false,
      })
      .returning();

    return token;
  }

  async findValid(params: {
    tokenHash: string;
    type: TokenType;
    userId: number;
  }): Promise<Token | null> {
    const [token] = await this.db
      .select()
      .from(tokens)
      .where(
        and(
          eq(tokens.tokenHash, params.tokenHash),
          eq(tokens.type, params.type),
          eq(tokens.userId, params.userId),
          eq(tokens.blacklisted, false),
        ),
      )
      .limit(1);

    return token ?? null;
  }

  async blacklistById(id: number): Promise<void> {
    await this.db
      .update(tokens)
      .set({ blacklisted: true })
      .where(eq(tokens.id, id));
  }

  
  async blacklistManyByUserAndType(userId: number, type: TokenType): Promise<number> {
    const updated = await this.db
      .update(tokens)
      .set({ blacklisted: true })
      .where(
        and(
          eq(tokens.userId, userId),
          eq(tokens.type, type),
          eq(tokens.blacklisted, false),
        ),
      )
      .returning({ id: tokens.id });

    return updated.length;
  }

  async deleteByUserId(userId: number): Promise<number> {
    const deleted = await this.db
      .delete(tokens)
      .where(eq(tokens.userId, userId))
      .returning({ id: tokens.id });

    return deleted.length;
  }

  async deleteExpired(now: Date = new Date()): Promise<number> {
    const deleted = await this.db
      .delete(tokens)
      .where(lt(tokens.expires, now))
      .returning({ id: tokens.id });

    return deleted.length;
  }
}
