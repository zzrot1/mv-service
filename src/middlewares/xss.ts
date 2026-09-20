import type { NextFunction, Request, Response } from "express";
import xss from "xss";

/**
 * Sanitize ONLY strings, recursively, in objects/arrays.
 * Leaves numbers/booleans/null unchanged.
 */
export function sanitizeDeep<T>(input: T): T {
  if (typeof input === "string") {
    return xss(input) as unknown as T;
  }

  if (Array.isArray(input)) {
    return input.map((v) => sanitizeDeep(v)) as unknown as T;
  }

  if (input && typeof input === "object") {
    const obj = input as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = sanitizeDeep(v);
    }
    return out as T;
  }

  return input;
}

/**
 * Middleware: sanitize req.body/query/params (strings only).
 * WARNING: This can change user input and should be used carefully.
 */
export default function xssMiddleware() {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (req.body) req.body = sanitizeDeep(req.body);
    if (req.query) req.query = sanitizeDeep(req.query);
    if (req.params) req.params = sanitizeDeep(req.params);
    next();
  };
}
