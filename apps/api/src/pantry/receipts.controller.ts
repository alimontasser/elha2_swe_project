import { Body, Controller, HttpCode, Inject, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import type { Member } from '../accounts/accounts.interfaces';
import { AuthGuard, CurrentMember } from '../auth/auth.guard';
import { parseOrThrow } from '../common/errors';
import { ConfirmReceiptBody, ScanReceiptBody } from './receipts.schemas';
import { ReceiptsService } from './receipts.service';

@Controller('pantry/receipts')
@UseGuards(AuthGuard)
export class ReceiptsController {
  constructor(@Inject(ReceiptsService) private readonly receipts: ReceiptsService) {}

  /** US-2.01: masked receipt lines in, draft items with a confidence each out. */
  @Post()
  scan(@CurrentMember() member: Member, @Body() body: unknown) {
    return this.receipts.scan(member, parseOrThrow(ScanReceiptBody, body));
  }

  /** US-2.02: "Confirm all" saves the reviewed items to the pantry. */
  @Post(':id/confirm')
  @HttpCode(201)
  confirm(@CurrentMember() member: Member, @Param('id', new ParseUUIDPipe()) id: string, @Body() body: unknown) {
    return this.receipts.confirm(member, id, parseOrThrow(ConfirmReceiptBody, body));
  }
}
