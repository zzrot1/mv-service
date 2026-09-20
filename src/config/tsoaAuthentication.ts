import type { Request } from "express";
import passport from "passport";
import { StatusCodes } from "http-status-codes";
import type { User } from "../db/schema.js";
import { roleRights } from "./roles.js";
import { ApiError } from "../utils/index.js";

/**
 * Hook-ul cerut de tsoa pentru `@Security("bearerAuth", [...scopes])`.
 * Scopes-urile sunt aceleasi drepturi folosite de middleware-ul `auth()`.
 */
export function expressAuthentication(
  req: Request,
  securityName: string,
  scopes: string[] = [],
): Promise<User> {
  if (securityName !== "bearerAuth") {
    return Promise.reject(
      new ApiError(StatusCodes.UNAUTHORIZED, "Unsupported security scheme"),
    );
  }

  return new Promise<User>((resolve, reject) => {
    passport.authenticate(
      "jwt",
      { session: false },
      (err: unknown, user: User | false, info: unknown) => {
        if (err || info || !user) {
          return reject(
            new ApiError(StatusCodes.UNAUTHORIZED, "Please authenticate"),
          );
        }

        if (scopes.length) {
          const userRights = roleRights.get(user.role) ?? [];
          const hasRights = scopes.every((scope) =>
            userRights.includes(scope),
          );

          if (!hasRights) {
            return reject(new ApiError(StatusCodes.FORBIDDEN, "Forbidden"));
          }
        }

        req.user = user;
        resolve(user);
      },
    )(req);
  });
}
