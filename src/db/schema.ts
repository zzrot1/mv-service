import {
  boolean,
  foreignKey,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const roleValues = ["USER", "ADMIN"] as const;
export const tokenTypeValues = [
  "ACCESS",
  "REFRESH",
  "RESET_PASSWORD",
  "VERIFY_EMAIL",
] as const;

export const authProviderValues = ["GOOGLE"] as const;

export type Role = (typeof roleValues)[number];
export type TokenType = (typeof tokenTypeValues)[number];
export type AuthProvider = (typeof authProviderValues)[number];

export const Role = {
  USER: "USER",
  ADMIN: "ADMIN",
} as const satisfies Record<Role, Role>;

export const TokenType = {
  ACCESS: "ACCESS",
  REFRESH: "REFRESH",
  RESET_PASSWORD: "RESET_PASSWORD",
  VERIFY_EMAIL: "VERIFY_EMAIL",
} as const satisfies Record<TokenType, TokenType>;

export const AuthProvider = {
  GOOGLE: "GOOGLE",
} as const satisfies Record<AuthProvider, AuthProvider>;

export const roleEnum = pgEnum("Role", roleValues);
export const tokenTypeEnum = pgEnum("TokenType", tokenTypeValues);
export const authProviderEnum = pgEnum("AuthProvider", authProviderValues);

export const users = pgTable(
  "User",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    name: text("name"),
    password: text("password"),
    role: roleEnum("role").notNull().default(Role.USER),

    phone: text("phone"),
    addressLine1: text("addressLine1"),
    addressLine2: text("addressLine2"),
    city: text("city"),
    county: text("county"),
    postalCode: text("postalCode"),
    country: text("country"),
    isEmailVerified: boolean("isEmailVerified").notNull().default(false),
    createdAt: timestamp("createdAt", { precision: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { precision: 3 })
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("User_email_key").on(table.email)],
);

export const tokens = pgTable(
  "Token",
  {
    id: serial("id").primaryKey(),
    tokenHash: text("tokenHash").notNull(),
    type: tokenTypeEnum("type").notNull(),
    expires: timestamp("expires", { precision: 3 }).notNull(),
    blacklisted: boolean("blacklisted").notNull().default(false),
    createdAt: timestamp("createdAt", { precision: 3 }).notNull().defaultNow(),
    userId: integer("userId").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "Token_userId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("restrict"),
  ],
);

export const accounts = pgTable(
  "Account",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull(),
    provider: authProviderEnum("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    createdAt: timestamp("createdAt", { precision: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { precision: 3 })
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("Account_provider_providerAccountId_key").on(
      table.provider,
      table.providerAccountId,
    ),
    uniqueIndex("Account_userId_provider_key").on(table.userId, table.provider),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "Account_userId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Token = typeof tokens.$inferSelect;
export type NewToken = typeof tokens.$inferInsert;
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
