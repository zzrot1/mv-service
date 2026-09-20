import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../db/schema.js";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing");
}

const { Pool } = pg;

const globalForDb = globalThis as unknown as {
  dbPool?: pg.Pool;
};

export const pool =
  globalForDb.dbPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.dbPool = pool;
}

export const db = drizzle(pool, { schema });
