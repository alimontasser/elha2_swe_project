import { Module } from '@nestjs/common';
import { MEMBER_DIRECTORY } from './accounts.interfaces';
import { AccountsService } from './accounts.service';

@Module({
  providers: [AccountsService, { provide: MEMBER_DIRECTORY, useExisting: AccountsService }],
  exports: [MEMBER_DIRECTORY],
})
export class AccountsModule {}
