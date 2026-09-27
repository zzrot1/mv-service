import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StatusCodes } from "http-status-codes";
import { AuthProvider, TokenType } from "../../src/db/schema.js";
import { DrizzleUserRepository } from "../../src/api/repositories/user/index.js";
import { DrizzleTokenRepository } from "../../src/api/repositories/token/index.js";
import { DrizzleAccountRepository } from "../../src/api/repositories/account/index.js";
import { UserService } from "../../src/api/services/user.js";
import { TokenService } from "../../src/api/services/token.js";
import { AuthService } from "../../src/api/services/auth.js";
import { ApiError } from "../../src/utils/index.js";
import { createTestDb, type TestDb } from "../helpers/testDb.js";

const dbHolder = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock("../../src/config/dbConnection.js", () => ({
  get db() {
    return dbHolder.db;
  },
  pool: undefined,
}));

const { jwtStrategy } = await import("../../src/config/passport.js");

const jwtConfig = {
  secret: "test-secret",
  accessExpirationMinutes: 30,
  refreshExpirationDays: 30,
  resetPasswordExpirationMinutes: 10,
  verifyEmailExpirationMinutes: 10,
};

const googleProfile = {
  providerAccountId: "google-sub-123",
  email: "g@test.com",
  emailVerified: true,
  name: "Google User",
};

let db: TestDb;
let close: () => Promise<void>;
let userService: UserService;
let tokenService: TokenService;
let authService: AuthService;
let accountRepo: DrizzleAccountRepository;

beforeEach(async () => {
  ({ db, close } = await createTestDb());
  dbHolder.db = db;

  const userRepo = new DrizzleUserRepository(db);
  const tokenRepo = new DrizzleTokenRepository(db);
  accountRepo = new DrizzleAccountRepository(db);

  userService = new UserService(userRepo, tokenRepo, accountRepo);
  tokenService = new TokenService(tokenRepo, userRepo, jwtConfig);
  authService = new AuthService(
    userRepo,
    userService,
    tokenService,
    tokenRepo,
    accountRepo,
    { verify: async () => googleProfile },
  );
});

afterEach(async () => {
  await close();
});

const createVerifiedUser = async (email = "login@test.com", password = "Password1") => {
  const user = await userService.createUser({ email, password });
  await userService.updateUser(user.id, { isEmailVerified: true });
  return user;
};

const verifyJwt = (payload: unknown) =>
  new Promise<{ err: unknown; user: unknown }>((resolve) => {
    // _verify e callback-ul de verificare pe care passport il apeleaza
    (jwtStrategy as unknown as {
      _verify: (p: unknown, done: (err: unknown, user: unknown) => void) => void;
    })._verify(payload, (err, user) => resolve({ err, user }));
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

describe("email + password login", () => {
  it("rejects a deleted user with the same generic 401 as a wrong password", async () => {
    const user = await createVerifiedUser();
    await userService.deleteUser(user.id);

    // 401, nu 403/404, ca sa nu dezvaluie ca adresa a existat
    await expectApiError(
      authService.loginUserWithEmailAndPassword("login@test.com", "Password1"),
      StatusCodes.UNAUTHORIZED,
    );
  });

  it("logs in the new account when the email was reused after deletion", async () => {
    const old = await createVerifiedUser("reuse@test.com", "OldPassword1");
    await userService.deleteUser(old.id);
    const fresh = await createVerifiedUser("reuse@test.com", "NewPassword1");

    const logged = await authService.loginUserWithEmailAndPassword("reuse@test.com", "NewPassword1");
    expect(logged.id).toBe(fresh.id);
  });

  it("does not accept the deleted account's password for the reused email", async () => {
    const old = await createVerifiedUser("reuse@test.com", "OldPassword1");
    await userService.deleteUser(old.id);
    await createVerifiedUser("reuse@test.com", "NewPassword1");

    await expectApiError(
      authService.loginUserWithEmailAndPassword("reuse@test.com", "OldPassword1"),
      StatusCodes.UNAUTHORIZED,
    );
  });

  it("does not expose deletedAt or password in the login response", async () => {
    await createVerifiedUser();
    const logged = await authService.loginUserWithEmailAndPassword("login@test.com", "Password1");
    expect(logged).not.toHaveProperty("password");
    expect(logged).not.toHaveProperty("deletedAt");
  });
});

describe("refresh tokens", () => {
  it("cannot refresh a session after the user is deleted", async () => {
    const user = await createVerifiedUser();
    const issued = await tokenService.generateAuthTokens({ id: user.id } as never);

    await userService.deleteUser(user.id);

    await expect(authService.refreshAuth(issued.refresh!.token)).rejects.toBeInstanceOf(ApiError);
  });
});

describe("JWT strategy", () => {
  it("accepts an access token for an active user", async () => {
    const user = await createVerifiedUser();
    const { err, user: authed } = await verifyJwt({ sub: user.id, type: TokenType.ACCESS });
    expect(err).toBeNull();
    expect(authed).toMatchObject({ id: user.id });
  });

  it("rejects an access token issued before the user was deleted", async () => {
    const user = await createVerifiedUser();
    await userService.deleteUser(user.id);

    const { err, user: authed } = await verifyJwt({ sub: user.id, type: TokenType.ACCESS });
    expect(err).toBeNull();
    expect(authed).toBe(false);
  });
});

describe("Google login", () => {
  it("creates a brand new user when the linked account was deleted", async () => {
    const first = await authService.loginWithGoogle("id-token");
    await userService.deleteUser(first.id);

    const second = await authService.loginWithGoogle("id-token");

    expect(second.id).not.toBe(first.id);
    expect(second.email).toBe(googleProfile.email);
    await expect(userService.getById(second.id)).resolves.not.toBeNull();
  });

  it("links the Google identity to the new user, not the deleted one", async () => {
    const first = await authService.loginWithGoogle("id-token");
    await userService.deleteUser(first.id);
    const second = await authService.loginWithGoogle("id-token");

    const link = await accountRepo.findByProviderAccount(
      AuthProvider.GOOGLE,
      googleProfile.providerAccountId,
    );
    expect(link?.userId).toBe(second.id);
  });

  it("does not revive the deleted user when a password account reuses the email", async () => {
    const pwUser = await createVerifiedUser(googleProfile.email);
    await userService.deleteUser(pwUser.id);

    const google = await authService.loginWithGoogle("id-token");

    expect(google.id).not.toBe(pwUser.id);
    await expect(userService.getById(pwUser.id)).resolves.toBeNull();
  });
});
