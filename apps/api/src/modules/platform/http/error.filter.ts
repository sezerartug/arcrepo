import {
  Catch,
  HttpException,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Response } from 'express';
import { AppError } from '../application/errors.js';

const HTTP_CODES: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
};

@Catch()
export class ErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger('Http');

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    if (exception instanceof AppError) {
      res.status(exception.status).json({
        error: { code: exception.code, message: exception.message, ...exception.extra },
      });
      return;
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      res.status(status).json({
        error: { code: HTTP_CODES[status] ?? 'HTTP_ERROR', message: exception.message },
      });
      return;
    }
    // Never leak internals; log the message only (no request data).
    this.logger.error(exception instanceof Error ? exception.message : 'unknown error');
    res.status(500).json({ error: { code: 'INTERNAL', message: 'Internal server error' } });
  }
}
