import {
  Strategy as JwtStrategy,
  ExtractJwt,
  type VerifyCallback,
} from "passport-jwt";
import config from "./config.js";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "./dbConnection.js";
import { TokenType, users } from "../db/schema.js";

const jwtOptions = {
  secretOrKey: config.jwt.secret,
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
};

const JwtPayloadSchema = z.object({
  sub: z.number().min(1),
  type: z.literal(TokenType.ACCESS),
  iat: z.number().optional(),
  exp: z.number().optional(),
});

const jwtVerify: VerifyCallback = async (payload: unknown, done) => {
  try {
    const p = JwtPayloadSchema.parse(payload);
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
      })
      .from(users)
      .where(eq(users.id, p.sub))
      .limit(1);

    if (!user) return done(null, false);
    return done(null, user);
  } catch (err) {
    return done(err as Error, false);
  }
};

export const jwtStrategy = new JwtStrategy(jwtOptions, jwtVerify);
