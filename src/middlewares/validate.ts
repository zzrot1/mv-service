import type { NextFunction, Request, RequestHandler, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { z, type ZodTypeAny } from "zod";
import { ApiError } from "../utils/index.js";

type RequestPart = "params" | "query" | "body";

export type ValidateSchema = Partial<Record<RequestPart, ZodTypeAny>>;

type InferPart<T> = T extends ZodTypeAny ? z.infer<T> : unknown;

type InferSchema<S extends ValidateSchema> = {
  params: InferPart<S["params"]>;
  query: InferPart<S["query"]>;
  body: InferPart<S["body"]>;
};

export type ValidatedRequest<S extends ValidateSchema> = Request<
  InferSchema<S>["params"],
  any,
  InferSchema<S>["body"],
  InferSchema<S>["query"]
>;

function formatZodIssues(issues: z.ZodIssue[], fallbackPrefix: string) {
  return issues.map((i) => {
    const path = i.path.length ? i.path.join(".") : fallbackPrefix;
    return { path: path || fallbackPrefix, message: i.message, code: i.code };
  });
}

export const validate =
  <S extends ValidateSchema>(schema: S): RequestHandler =>
  (req: Request, _res: Response, next: NextFunction) => {
    const errors: Array<{ path: string; message: string; code: string }> = [];

    const parsed: Partial<Record<RequestPart, unknown>> = {};

    (["params", "query", "body"] as const).forEach((key) => {
      const partSchema = schema[key];
      if (!partSchema) return;

      const result = partSchema.safeParse((req as any)[key]);
      if (!result.success) {
        errors.push(...formatZodIssues(result.error.issues, key));
        return;
      }
      parsed[key] = result.data;
    });

    if (errors.length) {
      return next(
        new ApiError(StatusCodes.BAD_REQUEST, "Validation error", errors),
      );
    }

    if (parsed.params) (req as any).params = parsed.params;
    if (parsed.query) (req as any).query = parsed.query;
    if (parsed.body) (req as any).body = parsed.body;

    return next();
  };

export const withValidation =
  <S extends ValidateSchema>(
    schema: S,
    handler: (
      req: ValidatedRequest<S>,
      res: Response,
      next: NextFunction,
    ) => unknown | Promise<unknown>,
  ): RequestHandler =>
  (req, res, next) => {
    validate(schema)(req, res, (err) => {
      if (err) return next(err);
      Promise.resolve(handler(req as ValidatedRequest<S>, res, next)).catch(
        next,
      );
    });
  };
