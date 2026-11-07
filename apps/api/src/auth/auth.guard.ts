import { CanActivate, createParamDecorator, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { type IMemberDirectory, type Member, MEMBER_DIRECTORY } from '../accounts/accounts.interfaces';
import { AppError } from '../common/errors';
import { TokenVerifier } from './token-verifier';

export type AuthedRequest = Request & { member?: Member; roles?: string[] };

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(TokenVerifier) private readonly verifier: TokenVerifier,
    @Inject(MEMBER_DIRECTORY) private readonly members: IMemberDirectory,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) throw new AppError(401, 'unauthenticated', 'Sign in first');
    const login = await this.verifier.verify(token);
    if (!login) throw new AppError(401, 'unauthenticated', 'The login token is not valid');
    req.member = await this.members.resolve(login.authUid, login.phone);
    req.roles = login.roles;
    return true;
  }
}

/** The signed-in member, set by AuthGuard. */
export const CurrentMember = createParamDecorator((_: unknown, context: ExecutionContext): Member => {
  const member = context.switchToHttp().getRequest<AuthedRequest>().member;
  if (!member) throw new AppError(401, 'unauthenticated', 'Sign in first');
  return member;
});
