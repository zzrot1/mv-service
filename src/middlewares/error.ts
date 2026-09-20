import type { ErrorRequestHandler } from "express";
import { StatusCodes } from "http-status-codes";
import config from "../config/config.js";
import logger from "../config/logger.js";
import { ApiError } from "../utils/index.js";

export const errorConverter: ErrorRequestHandler = (err, req, res, next) => {
  let error = err;
  if (!(error instanceof ApiError)) {
    const statusCode = error.statusCode
      ? StatusCodes.BAD_REQUEST
      : StatusCodes.INTERNAL_SERVER_ERROR;
    const message = error.message || StatusCodes[statusCode];
    // (statusCode, message, details, isOperational, stack)
    error = new ApiError(statusCode, message, undefined, false, err.stack);
  }
  next(error);
};

// eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  let { statusCode, message } = err;
  let details = err.details;

  if (config.env === "production" && !err.isOperational) {
    statusCode = StatusCodes.INTERNAL_SERVER_ERROR;
    message = StatusCodes[StatusCodes.INTERNAL_SERVER_ERROR];
    // Nu scurgem detalii interne pentru erori neasteptate in productie.
    details = undefined;
  }

  res.locals.errorMessage = err.message;

  const response = {
    code: statusCode,
    message,
    // Lista de campuri invalide venita din validarea zod.
    ...(details ? { details } : {}),
    ...(config.env === "development" && { stack: err.stack }),
  };

  if (config.env === "development") {
    logger.error(err);
  }

  res.status(statusCode).send(response);
};
