import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';

/**
 * One error shape for every API response (SDD §3.2.4): a stable code the apps translate,
 * a developer message, and per-field errors for forms.
 */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message?: string,
    readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message ?? code);
  }
}

export function parseOrThrow<T extends z.ZodType>(schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || '_';
    (fieldErrors[key] ??= []).push(issue.message);
  }
  throw new AppError(400, 'validation_error', 'The request body is not valid', fieldErrors);
}

@Catch()
export class ErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger('Errors');

  catch(error: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (error instanceof AppError) {
      res.status(error.status).json({ code: error.code, message: error.message, fieldErrors: error.fieldErrors });
      return;
    }
    if (error instanceof HttpException) {
      const status = error.getStatus();
      res.status(status).json({ code: status === 404 ? 'not_found' : 'http_error', message: error.message });
      return;
    }
    this.logger.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
    res.status(500).json({ code: 'internal_error', message: 'Something went wrong' });
  }
}
