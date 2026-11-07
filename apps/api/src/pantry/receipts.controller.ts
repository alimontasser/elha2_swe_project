import { Body, Controller, HttpCode, Inject, Param, ParseUUIDPipe, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Member } from '../accounts/accounts.interfaces';
import { AuthGuard, CurrentMember } from '../auth/auth.guard';
import { AppError, parseOrThrow } from '../common/errors';
import { ConfirmReceiptBody, ScanReceiptBody } from './receipts.schemas';
import { MAX_PHOTO_BYTES, PHOTO_TYPES, ReceiptsService } from './receipts.service';

/** The part of a multer upload this controller reads (kept in memory, never written to disk). */
interface UploadedPhoto {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

@Controller('pantry/receipts')
@UseGuards(AuthGuard)
export class ReceiptsController {
  constructor(@Inject(ReceiptsService) private readonly receipts: ReceiptsService) {}

  /** US-2.01: masked receipt lines in, draft items with a confidence each out. */
  @Post()
  scan(@CurrentMember() member: Member, @Body() body: unknown) {
    return this.receipts.scan(member, parseOrThrow(ScanReceiptBody, body));
  }

  /** US-2.01 from a photo (multipart field "photo"). The photo is read by the AI provider and then dropped. */
  @Post('photo')
  @UseInterceptors(FileInterceptor('photo', { limits: { fileSize: MAX_PHOTO_BYTES, files: 1 } }))
  scanPhoto(@CurrentMember() member: Member, @UploadedFile() photo: UploadedPhoto | undefined) {
    if (!photo || !(PHOTO_TYPES as readonly string[]).includes(photo.mimetype)) {
      throw new AppError(400, 'invalid_photo', `Send one photo in the "photo" field: ${PHOTO_TYPES.join(', ')}, up to 6 MB`);
    }
    return this.receipts.scanPhoto(member, { mimeType: photo.mimetype, bytes: photo.buffer });
  }

  /** US-2.02: "Confirm all" saves the reviewed items to the pantry. */
  @Post(':id/confirm')
  @HttpCode(201)
  confirm(@CurrentMember() member: Member, @Param('id', new ParseUUIDPipe()) id: string, @Body() body: unknown) {
    return this.receipts.confirm(member, id, parseOrThrow(ConfirmReceiptBody, body));
  }
}
