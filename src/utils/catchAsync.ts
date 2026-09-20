import type { RequestHandler } from 'express';
import type { Request, Response, NextFunction } from 'express-serve-static-core';

interface CustomParamsDictionary {
  [key: string]: any;
}

export const catchAsync =
  (fn: RequestHandler<CustomParamsDictionary, any, any, qs.ParsedQs, Record<string, any>>) =>
  (
    req: Request<CustomParamsDictionary, any, any, any, Record<string, any>>,
    res: Response<any, Record<string, any>, number>,
    next: NextFunction
  ) => {
    Promise.resolve(fn(req, res, next)).catch((err) => next(err));
  };