import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (what = 'Resource') => new ApiError(404, 'not_found', `${what} not found`);
export const forbidden = (message = 'You do not have permission to do that') =>
  new ApiError(403, 'forbidden', message);

export const notFoundHandler: RequestHandler = (_req, _res, next) => next(notFound('Route'));

/** Consistent error body: { error: { code, message, details? } } (see docs/engineering/API_CONTRACT.md). */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'validation_error',
        message: 'The request was invalid',
        details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
    });
    return;
  }
  if (err instanceof ApiError) {
    res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
    return;
  }
  // Malformed JSON from body-parser
  if (typeof err === 'object' && err && 'type' in err && err.type === 'entity.parse.failed') {
    res
      .status(400)
      .json({ error: { code: 'invalid_json', message: 'Request body is not valid JSON' } });
    return;
  }
  // Never leak internals or secrets; log server-side only.
  console.error(
    JSON.stringify({ level: 'error', msg: 'unhandled', name: err?.name, message: err?.message }),
  );
  res.status(500).json({ error: { code: 'internal_error', message: 'Something went wrong' } });
};
