import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../../src/db/schema.js";

export type TestDb = NodePgDatabase<typeof schema>;

/**
 * Postgres real (WASM) in memorie, cu migrarile din drizzle/migrations
 * aplicate, ca testele sa verifice si schema, nu doar codul.
 */
export async function createTestDb(): Promise<{
  db: TestDb;
  close: () => Promise<void>;
}> {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "drizzle/migrations" });

  return {
    // Repository-urile cer tipul node-postgres; API-ul de query e acelasi.
    db: db as unknown as TestDb,
    close: () => client.close(),
  };
}
