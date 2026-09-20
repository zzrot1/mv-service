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

export type Role = (typeof roleValues)[number];
export type TokenType = (typeof tokenTypeValues)[number];

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

export const roleEnum = pgEnum("Role", roleValues);
export const tokenTypeEnum = pgEnum("TokenType", tokenTypeValues);

export const users = pgTable(
  "User",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    name: text("name"),
    password: text("password").notNull(),
    role: roleEnum("role").notNull().default(Role.USER),
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

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Token = typeof tokens.$inferSelect;
export type NewToken = typeof tokens.$inferInsert;
