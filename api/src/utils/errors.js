/**
 * Application error with an HTTP status code and a stable machine-readable
 * `code`. The global error handler serializes these into the standard shape:
 *   { error: { code, message } }
 */
export class AppError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export const errors = {
  badRequest: (message = 'Bad request', code = 'BAD_REQUEST') =>
    new AppError(400, code, message),
  unauthorized: (message = 'Unauthorized', code = 'UNAUTHORIZED') =>
    new AppError(401, code, message),
  forbidden: (message = 'Forbidden', code = 'FORBIDDEN') =>
    new AppError(403, code, message),
  notFound: (message = 'Not found', code = 'NOT_FOUND') =>
    new AppError(404, code, message),
  conflict: (message = 'Conflict', code = 'CONFLICT') =>
    new AppError(409, code, message),
};
