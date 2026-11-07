import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { AppError } from '../common/errors';
import type { AuthedRequest } from './auth.guard';

/** Administrator-only routes (NFR-10). Runs after AuthGuard: @UseGuards(AuthGuard, AdminGuard). */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const roles = context.switchToHttp().getRequest<AuthedRequest>().roles ?? [];
    if (!roles.includes('admin')) throw new AppError(403, 'forbidden', 'Administrators only');
    return true;
  }
}
