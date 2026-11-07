import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { AdminGuard } from './admin.guard';
import { AuthGuard } from './auth.guard';
import { TokenVerifier } from './token-verifier';

@Module({
  imports: [AccountsModule],
  providers: [TokenVerifier, AuthGuard, AdminGuard],
  exports: [TokenVerifier, AuthGuard, AdminGuard, AccountsModule],
})
export class AuthModule {}
