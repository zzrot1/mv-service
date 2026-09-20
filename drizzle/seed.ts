import "dotenv/config";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, pool } from "../src/config/dbConnection.js";
import { Role, users } from "../src/db/schema.js";

async function main() {
  const email = process.env.ADMIN_EMAIL ?? "admin@example.com";
  const rawPassword = process.env.ADMIN_PASSWORD;

  if (!rawPassword) {
    throw new Error("Missing ADMIN_PASSWORD in .env");
  }

  const passwordHash = await bcrypt.hash(rawPassword, 12);
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(users)
      .set({ role: Role.ADMIN, updatedAt: new Date() })
      .where(eq(users.email, email));
    return;
  }

  await db.insert(users).values({
    email,
    name: "Admin",
    password: passwordHash,
    role: Role.ADMIN,
    isEmailVerified: true,
    updatedAt: new Date(),
  });

  console.log(`Seeded admin user: ${email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
