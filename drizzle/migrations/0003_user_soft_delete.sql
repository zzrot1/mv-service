DROP INDEX "User_email_key";--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "deletedAt" timestamp (3);--> statement-breakpoint
CREATE UNIQUE INDEX "User_email_key" ON "User" USING btree ("email") WHERE "User"."deletedAt" IS NULL;