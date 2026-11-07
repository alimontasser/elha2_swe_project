import type { ExecutionContext } from '@nestjs/common';
import { AppError } from '../common/errors';
import { AdminGuard } from './admin.guard';

const contextWith = (roles?: string[]) => ({ switchToHttp: () => ({ getRequest: () => ({ roles }) }) }) as unknown as ExecutionContext;

describe('AdminGuard (NFR-10)', () => {
  it('lets administrators through', () => {
    expect(new AdminGuard().canActivate(contextWith(['admin']))).toBe(true);
  });

  it('refuses everyone else with 403', () => {
    for (const roles of [undefined, [], ['businessOwner']]) {
      expect(() => new AdminGuard().canActivate(contextWith(roles))).toThrow(AppError);
    }
  });
});
