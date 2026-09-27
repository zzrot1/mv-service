import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { StatusCodes } from "http-status-codes";
import { accounts, AuthProvider, Role, tokens, TokenType, users } from "../../src/db/schema.js";
import { DrizzleUserRepository } from "../../src/api/repositories/user/index.js";
import { DrizzleTokenRepository } from "../../src/api/repositories/token/index.js";
import { DrizzleAccountRepository } from "../../src/api/repositories/account/index.js";
import { UserService } from "../../src/api/services/user.js";
import { ApiError } from "../../src/utils/index.js";
import { createTestDb, type TestDb } from "../helpers/testDb.js";

let db: TestDb;
let close: () => Promise<void>;
let repo: DrizzleUserRepository;
let tokenRepo: DrizzleTokenRepository;
let accountRepo: DrizzleAccountRepository;
let service: UserService;

beforeEach(async () => {
  ({ db, close } = await createTestDb());
  repo = new DrizzleUserRepository(db);
  tokenRepo = new DrizzleTokenRepository(db);
  accountRepo = new DrizzleAccountRepository(db);
  service = new UserService(repo, tokenRepo, accountRepo);
});

afterEach(async () => {
  await close();
});

const rawUser = async (id: number) => {
  const [row] = await db.select().from(users).where(eq(users.id, id));
  return row;
};

const createUser = (email: string, extra: Partial<Parameters<typeof repo.create>[0]> = {}) =>
  repo.create({ email, passwordHash: "hash", ...extra });

const addToken = (userId: number) =>
  db.insert(tokens).values({
    tokenHash: `hash-${userId}-${Math.random()}`,
    type: TokenType.REFRESH,
    expires: new Date(Date.now() + 60_000),
    userId,
  });

const addAccount = (userId: number, providerAccountId = `google-${userId}`) =>
  db.insert(accounts).values({
    userId,
    provider: AuthProvider.GOOGLE,
    providerAccountId,
    updatedAt: new Date(),
  });

const expectApiError = async (promise: Promise<unknown>, status: number) => {
  const err = await promise.then(
    () => {
      throw new Error("expected promise to reject");
    },
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(ApiError);
  expect((err as ApiError).statusCode).toBe(status);
};

describe("schema", () => {
  it("new users start with deletedAt = null", async () => {
    const user = await createUser("a@test.com");
    expect((await rawUser(user.id)).deletedAt).toBeNull();
  });

  it("rejects two active users with the same email", async () => {
    await createUser("dup@test.com");
    await expect(createUser("dup@test.com")).rejects.toThrow();
  });

  it("allows an active user to reuse the email of a deleted one", async () => {
    const old = await createUser("reuse@test.com");
    await repo.softDeleteById(old.id);
    await expect(createUser("reuse@test.com")).resolves.toMatchObject({
      email: "reuse@test.com",
    });
  });

  it("allows several deleted users to share an email", async () => {
    for (let i = 0; i < 3; i++) {
      const u = await createUser("many@test.com");
      await repo.softDeleteById(u.id);
    }
    const rows = await db.select().from(users).where(eq(users.email, "many@test.com"));
    expect(rows).toHaveLength(3);
  });
});

describe("DrizzleUserRepository", () => {
  describe("softDeleteById", () => {
    it("keeps the row and sets deletedAt", async () => {
      const user = await createUser("keep@test.com");
      await repo.softDeleteById(user.id);

      const row = await rawUser(user.id);
      expect(row).toBeDefined();
      expect(row.deletedAt).toBeInstanceOf(Date);
    });

    it("sets deletedAt to roughly now", async () => {
      const user = await createUser("now@test.com");
      const before = Date.now();
      await repo.softDeleteById(user.id);
      const after = Date.now();

      const { deletedAt } = await rawUser(user.id);
      // precizie de milisecunde in coloana, deci o marja mica e suficienta
      expect(deletedAt!.getTime()).toBeGreaterThanOrEqual(before - 5);
      expect(deletedAt!.getTime()).toBeLessThanOrEqual(after + 5);
    });

    it("does not move deletedAt when called twice", async () => {
      const user = await createUser("twice@test.com");
      await repo.softDeleteById(user.id);
      const first = (await rawUser(user.id)).deletedAt!.getTime();

      await new Promise((r) => setTimeout(r, 15));
      await repo.softDeleteById(user.id);

      expect((await rawUser(user.id)).deletedAt!.getTime()).toBe(first);
    });

    it("does not throw for an id that does not exist", async () => {
      await expect(repo.softDeleteById(424242)).resolves.not.toThrow();
    });

    it("only affects the targeted user", async () => {
      const a = await createUser("a@test.com");
      const b = await createUser("b@test.com");
      await repo.softDeleteById(a.id);
      expect((await rawUser(b.id)).deletedAt).toBeNull();
    });
  });

  describe("lookups", () => {
    it("findById returns null for a deleted user", async () => {
      const user = await createUser("gone@test.com");
      await repo.softDeleteById(user.id);
      await expect(repo.findById(user.id)).resolves.toBeNull();
    });

    it("findByEmail returns null for a deleted user", async () => {
      const user = await createUser("gone@test.com");
      await repo.softDeleteById(user.id);
      await expect(repo.findByEmail("gone@test.com")).resolves.toBeNull();
    });

    it("findByEmail returns the active user when a deleted one has the same email", async () => {
      const old = await createUser("same@test.com", { name: "old" });
      await repo.softDeleteById(old.id);
      const fresh = await createUser("same@test.com", { name: "new" });

      const found = await repo.findByEmail("same@test.com");
      expect(found?.id).toBe(fresh.id);
      expect(found?.name).toBe("new");
    });
  });

  describe("count and query", () => {
    it("count ignores deleted users", async () => {
      const a = await createUser("a@test.com");
      await createUser("b@test.com");
      await repo.softDeleteById(a.id);
      await expect(repo.count()).resolves.toBe(1);
    });

    it("count with a filter ignores deleted users", async () => {
      const admin = await createUser("admin@test.com", { role: Role.ADMIN });
      await createUser("admin2@test.com", { role: Role.ADMIN });
      await createUser("user@test.com");
      await repo.softDeleteById(admin.id);

      await expect(repo.count({ role: Role.ADMIN })).resolves.toBe(1);
    });

    it("count returns 0 when every user is deleted", async () => {
      const a = await createUser("a@test.com");
      await repo.softDeleteById(a.id);
      await expect(repo.count()).resolves.toBe(0);
    });

    it("query ignores deleted users", async () => {
      const a = await createUser("a@test.com");
      const b = await createUser("b@test.com");
      await repo.softDeleteById(a.id);

      const result = await repo.query({}, {});
      expect(result.map((u) => u.id)).toEqual([b.id]);
    });

    it("query with a filter ignores deleted users", async () => {
      const verified = await createUser("v@test.com", { isEmailVerified: true });
      await createUser("v2@test.com", { isEmailVerified: true });
      await repo.softDeleteById(verified.id);

      const result = await repo.query({ isEmailVerified: true }, {});
      expect(result).toHaveLength(1);
      expect(result[0].email).toBe("v2@test.com");
    });

    it("query pagination is computed over active users only", async () => {
      const created = [];
      for (let i = 0; i < 5; i++) created.push(await createUser(`p${i}@test.com`));
      await repo.softDeleteById(created[0].id);
      await repo.softDeleteById(created[1].id);

      const page1 = await repo.query({}, { page: 1, limit: 2, sortBy: "email", sortOrder: "asc" });
      const page2 = await repo.query({}, { page: 2, limit: 2, sortBy: "email", sortOrder: "asc" });

      expect(page1.map((u) => u.email)).toEqual(["p2@test.com", "p3@test.com"]);
      expect(page2.map((u) => u.email)).toEqual(["p4@test.com"]);
    });

    it("query results expose neither password nor deletedAt", async () => {
      await createUser("safe@test.com");
      const [user] = await repo.query({}, {});
      expect(user).not.toHaveProperty("password");
      expect(user).not.toHaveProperty("deletedAt");
    });
  });

  describe("writes on deleted users", () => {
    it("updateById does not modify a deleted user", async () => {
      const user = await createUser("w@test.com", { name: "before" });
      await repo.softDeleteById(user.id);

      await repo.updateById(user.id, { name: "after" }).catch(() => undefined);

      expect((await rawUser(user.id)).name).toBe("before");
    });

    it("updatePasswordById does not modify a deleted user", async () => {
      const user = await createUser("pw@test.com");
      await repo.softDeleteById(user.id);

      await repo.updatePasswordById(user.id, "new-hash").catch(() => undefined);

      expect((await rawUser(user.id)).password).toBe("hash");
    });
  });
});

describe("UserService delete", () => {
  it("soft deletes the user instead of removing the row", async () => {
    const user = await service.createUser({ email: "svc@test.com", password: "Password1" });
    await service.deleteUser(user.id);

    expect(await rawUser(user.id)).toBeDefined();
    expect((await rawUser(user.id)).deletedAt).not.toBeNull();
  });

  it("makes the user unreachable through the service", async () => {
    const user = await service.createUser({ email: "svc@test.com", password: "Password1" });
    await service.deleteUser(user.id);

    await expect(service.getById(user.id)).resolves.toBeNull();
    await expectApiError(service.getUserById(user.id), StatusCodes.NOT_FOUND);
  });

  it("revokes all of the user's tokens", async () => {
    const user = await service.createUser({ email: "svc@test.com", password: "Password1" });
    await addToken(user.id);
    await addToken(user.id);

    await service.deleteUser(user.id);

    const left = await db.select().from(tokens).where(eq(tokens.userId, user.id));
    expect(left).toEqual([]);
  });

  it("removes the user's OAuth links", async () => {
    const user = await service.createUser({ email: "svc@test.com", password: "Password1" });
    await addAccount(user.id);

    await service.deleteUser(user.id);

    const left = await db.select().from(accounts).where(eq(accounts.userId, user.id));
    expect(left).toEqual([]);
  });

  it("does not touch other users' tokens or accounts", async () => {
    const a = await service.createUser({ email: "a@test.com", password: "Password1" });
    const b = await service.createUser({ email: "b@test.com", password: "Password1" });
    await addToken(b.id);
    await addAccount(b.id);

    await service.deleteUser(a.id);

    expect(await db.select().from(tokens).where(eq(tokens.userId, b.id))).toHaveLength(1);
    expect(await db.select().from(accounts).where(eq(accounts.userId, b.id))).toHaveLength(1);
  });

  it("throws 404 for an unknown user", async () => {
    await expectApiError(service.deleteUser(987654), StatusCodes.NOT_FOUND);
  });

  it("throws 404 when deleting the same user twice", async () => {
    const user = await service.createUser({ email: "svc@test.com", password: "Password1" });
    await service.deleteUser(user.id);
    await expectApiError(service.deleteUser(user.id), StatusCodes.NOT_FOUND);
  });

  it("lets a new user register with the email of a deleted one", async () => {
    const user = await service.createUser({ email: "again@test.com", password: "Password1" });
    await service.deleteUser(user.id);

    const fresh = await service.createUser({ email: "again@test.com", password: "Password1" });
    expect(fresh.id).not.toBe(user.id);
  });

  it("refuses to update a deleted user", async () => {
    const user = await service.createUser({ email: "svc@test.com", password: "Password1" });
    await service.deleteUser(user.id);
    await expectApiError(service.updateUser(user.id, { name: "x" }), StatusCodes.NOT_FOUND);
  });

  it("refuses to change the password of a deleted user", async () => {
    const user = await service.createUser({ email: "svc@test.com", password: "Password1" });
    await service.deleteUser(user.id);
    await expectApiError(service.changePassword(user.id, "Password2"), StatusCodes.NOT_FOUND);
  });

  it("allows an active user to take the email of a deleted one on update", async () => {
    const old = await service.createUser({ email: "taken@test.com", password: "Password1" });
    const other = await service.createUser({ email: "other@test.com", password: "Password1" });
    await service.deleteUser(old.id);

    await expect(
      service.updateUser(other.id, { email: "taken@test.com" }),
    ).resolves.toMatchObject({ email: "taken@test.com" });
  });

  it("excludes deleted users from paged listings and their totals", async () => {
    const a = await service.createUser({ email: "a@test.com", password: "Password1" });
    await service.createUser({ email: "b@test.com", password: "Password1" });
    await service.createUser({ email: "c@test.com", password: "Password1" });
    await service.deleteUser(a.id);

    const page = await service.getAllPaged({ page: 1, limit: 2, skip: 0, take: 2 });
    expect(page.total).toBe(2);
    expect(page.totalPages).toBe(1);
    expect(page.data.map((u) => u.email)).not.toContain("a@test.com");
  });

  it("never exposes deletedAt or password on returned users", async () => {
    const user = await service.createUser({ email: "svc@test.com", password: "Password1" });
    expect(user).not.toHaveProperty("password");
    expect(user).not.toHaveProperty("deletedAt");

    const fetched = await service.getUserById(user.id);
    expect(fetched).not.toHaveProperty("password");
    expect(fetched).not.toHaveProperty("deletedAt");
  });
});
