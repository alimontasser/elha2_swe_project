import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { AuthGuard } from './auth.guard';
import { TokenVerifier } from './token-verifier';

@Module({
  imports: [AccountsModule],
  providers: [TokenVerifier, AuthGuard],
  exports: [TokenVerifier, AuthGuard, AccountsModule],
})
export class AuthModule {}
