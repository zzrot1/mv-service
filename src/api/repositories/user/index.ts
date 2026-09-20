import { and, asc, count, desc, eq, type SQL } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { inject, injectable } from "tsyringe";
import { DI_TOKENS } from "../../../config/dependencyTokens.js";
import * as schema from "../../../db/schema.js";
import { users, type User } from "../../../db/schema.js";
import type { CreateUserInput, IUserRepository, QueryUsersOptions, SafeUser, UpdateUserInput } from "./types.js";

const safeUserColumns = {
  id: users.id,
  email: users.email,
  name: users.name,
  role: users.role,
  isEmailVerified: users.isEmailVerified,
  phone: users.phone,
  addressLine1: users.addressLine1,
  addressLine2: users.addressLine2,
  city: users.city,
  county: users.county,
  postalCode: users.postalCode,
  country: users.country,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
} as const;

@injectable()
export class DrizzleUserRepository implements IUserRepository {
  constructor(
    @inject(DI_TOKENS.Db)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async findById(id: number): Promise<User | null> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    return user ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    return user ?? null;
  }

  async create(data: CreateUserInput): Promise<User> {
    const [user] = await this.db
      .insert(users)
      .values({
        email: data.email,
        name: data.name ?? null,
        password: data.passwordHash ?? null,
        role: data.role ?? schema.Role.USER,
        isEmailVerified: data.isEmailVerified ?? false,
        phone: data.phone ?? null,
        addressLine1: data.addressLine1 ?? null,
        addressLine2: data.addressLine2 ?? null,
        city: data.city ?? null,
        county: data.county ?? null,
        postalCode: data.postalCode ?? null,
        country: data.country ?? null,
        updatedAt: new Date(),
      })
      .returning();

    return user;
  }

  async updateById(id: number, data: UpdateUserInput): Promise<User> {
    const [user] = await this.db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();

    return user;
  }

  async updatePasswordById(id: number, passwordHash: string): Promise<User> {
    const [user] = await this.db
      .update(users)
      .set({ password: passwordHash, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();

    return user;
  }

  async deleteById(id: number): Promise<void> {
    await this.db.delete(users).where(eq(users.id, id));
  }

  async count(
    filter: Partial<Pick<User, "role" | "isEmailVerified">> = {},
  ): Promise<number> {
    const conditions = this.buildFilterConditions(filter);
    const query = this.db.select({ total: count() }).from(users).$dynamic();

    if (conditions.length > 0) {
      query.where(and(...conditions));
    }

    const [result] = await query;
    return result?.total ?? 0;
  }

  async query(
    filter: Partial<Pick<User, "role" | "isEmailVerified">>,
    options: QueryUsersOptions,
  ): Promise<SafeUser[]> {
    const page = options.page ?? 1;
    const limit = options.limit ?? 10;

    const skip = (page - 1) * limit;

    const conditions = this.buildFilterConditions(filter);

    const orderColumn = options.sortBy ? users[options.sortBy] : users.createdAt;
    const orderBy =
      (options.sortOrder ?? "desc") === "asc"
        ? asc(orderColumn)
        : desc(orderColumn);

    const query = this.db
      .select(safeUserColumns)
      .from(users)
      .$dynamic()
      .limit(limit)
      .offset(skip)
      .orderBy(orderBy);

    if (conditions.length > 0) {
      query.where(and(...conditions));
    }

    return query;
  }

  private buildFilterConditions(
    filter: Partial<Pick<User, "role" | "isEmailVerified">>,
  ): SQL[] {
    const conditions: SQL[] = [];

    if (filter.role) conditions.push(eq(users.role, filter.role));
    if (filter.isEmailVerified !== undefined) {
      conditions.push(eq(users.isEmailVerified, filter.isEmailVerified));
    }

    return conditions;
  }
}
