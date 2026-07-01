// FILE: src/middleware/error-handler-middleware.js
// Central error responder. Sits at the bottom of the middleware stack.

import { IS_PRODUCTION } from '../env.js';

// HttpError — throw this from any handler to control the response status.
// `code` is an optional stable machine-readable error code (UPPER_SNAKE_CASE)
// that clients can branch on; omitting it preserves the existing behaviour.
export class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    if (code) this.code = code;
  }
}

// 404 catch-all — mount AFTER all routes, BEFORE errorHandler.
export function notFound(req, res, next) {
  next(new HttpError(404, `Not found: ${req.method} ${req.originalUrl}`));
}

// Final error responder.
export function errorHandler(err, req, res, _next) {
  const status = err.status || 500;
  if (status >= 500) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
  }
  res.status(status).json({
    error: err.message || 'Internal server error',
    ...(err.code ? { code: err.code } : {}),
    ...(IS_PRODUCTION ? {} : { stack: err.stack }),
  });
}
