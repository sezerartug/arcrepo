import { HttpStatus } from '@nestjs/common';

// Error body shape for every failure: { error: { code, message } } (MVP-PLAN API contract).
export class AppError extends Error {
  override readonly name = 'AppError';
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly extra?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
  }
}

export const badRequest = (code: string, message: string) =>
  new AppError(HttpStatus.BAD_REQUEST, code, message);
export const unauthorized = (message = 'Authentication required') =>
  new AppError(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', message);
export const forbidden = (code = 'FORBIDDEN', message = 'Not allowed') =>
  new AppError(HttpStatus.FORBIDDEN, code, message);
export const notFound = (message = 'Not found') =>
  new AppError(HttpStatus.NOT_FOUND, 'NOT_FOUND', message);
export const conflict = (code: string, message: string) =>
  new AppError(HttpStatus.CONFLICT, code, message);
export const invalid = (message: string) =>
  new AppError(HttpStatus.UNPROCESSABLE_ENTITY, 'VALIDATION_ERROR', message);
