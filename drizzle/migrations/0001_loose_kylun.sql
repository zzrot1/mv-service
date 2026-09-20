CREATE TYPE "public"."AuthProvider" AS ENUM('GOOGLE');--> statement-breakpoint
CREATE TABLE "Account" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"provider" "AuthProvider" NOT NULL,
	"providerAccountId" text NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "User" ALTER COLUMN "password" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account" USING btree ("provider","providerAccountId");--> statement-breakpoint
CREATE UNIQUE INDEX "Account_userId_provider_key" ON "Account" USING btree ("userId","provider");