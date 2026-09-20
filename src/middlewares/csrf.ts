import type { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import config from "../config/config.js";
import { ApiError } from "../utils/index.js";

/**
 * Apararea CSRF pentru rutele care se autentifica prin cookie.
 *
 * Cu bearer tokens CSRF nu exista, fiindca headerul se ataseaza manual. Cu
 * cookies, browserul il trimite automat la orice request, inclusiv la unul
 * pornit de pe alt site. `SameSite` acopera cazul same-site, dar cand
 * frontend-ul e pe alt domeniu suntem obligati la SameSite=none, deci
 * verificam explicit de unde vine requestul.
 *
 * Se aplica doar cand requestul chiar se bazeaza pe cookie: un client care
 * trimite refresh token-ul in body (mobil, Swagger, teste) nu e expus.
 */
export const verifyRequestOrigin = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  const usesCookie = Boolean(req.cookies?.[config.cookie.refreshName]);
  const bodyToken = (req.body as { refreshToken?: string } | undefined)
    ?.refreshToken;

  if (!usesCookie || bodyToken) return next();

  const origin = req.get("origin") ?? originOf(req.get("referer"));

  // Clientii non-browser nu trimit Origin; ei nu pot fi victima unui CSRF
  // fiindca nu au cookie-ul atasat automat de un browser.
  if (!origin) return next();

  if (!config.cors.origins.includes(origin)) {
    return next(
      new ApiError(StatusCodes.FORBIDDEN, "Request origin not allowed"),
    );
  }

  return next();
};

function originOf(referer?: string): string | undefined {
  if (!referer) return undefined;
  try {
    return new URL(referer).origin;
  } catch {
    return undefined;
  }
}
