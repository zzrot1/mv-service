export class ApiError extends Error {
  statusCode: number;
  isOperational: boolean;
   details?: unknown;

  constructor(statusCode: number, message: string | undefined,  details?: unknown, isOperational = true, stack = '') {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;
    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}


