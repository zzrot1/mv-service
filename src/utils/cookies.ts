import type { CookieOptions, Response } from "express";
import config from "../config/config.js";

/**
 * Optiunile cu care emitem refresh token-ul.
 *
 * `httpOnly` il face invizibil pentru JavaScript, deci un XSS nu-l poate
 * fura. `path` il limiteaza la rutele de auth, ca sa nu fie trimis la
 * fiecare request catre API.
 */
function baseCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: config.cookie.secure,
    sameSite: config.cookie.sameSite,
    domain: config.cookie.domain,
    path: config.cookie.path,
  };
}

export function setRefreshTokenCookie(
  res: Response,
  token: string,
  expires: Date,
): void {
  res.cookie(config.cookie.refreshName, token, {
    ...baseCookieOptions(),
    expires,
  });
}

export function clearRefreshTokenCookie(res: Response): void {
  // `clearCookie` sterge doar daca name/path/domain coincid cu cele de la set.
  res.clearCookie(config.cookie.refreshName, baseCookieOptions());
}
