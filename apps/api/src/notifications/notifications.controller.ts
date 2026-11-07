import { Body, Controller, Delete, Get, HttpCode, Inject, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import type { Member } from '../accounts/accounts.interfaces';
import { AuthGuard, CurrentMember } from '../auth/auth.guard';
import { AppError, parseOrThrow } from '../common/errors';
import { type AppConfig, CONFIG } from '../config/config';
import { DEMO_VALUES } from './messages';
import { RegisterDeviceBody, TestPushBody } from './notifications.schemas';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  /** US-11.05: the last 30 days, newest first. */
  @Get()
  async list(@CurrentMember() member: Member) {
    return { items: await this.notifications.list(member.userId) };
  }

  @Post(':id/read')
  @HttpCode(204)
  async markRead(@CurrentMember() member: Member, @Param('id', new ParseUUIDPipe()) id: string) {
    await this.notifications.markRead(member.userId, id);
  }

  /** US-11.01: this device wants pushes (called after sign-in and when FCM rotates the token). */
  @Post('devices')
  @HttpCode(204)
  async register(@CurrentMember() member: Member, @Body() body: unknown) {
    const { token, platform } = parseOrThrow(RegisterDeviceBody, body);
    await this.notifications.registerDevice(member.userId, token, platform);
  }

  /** Sign-out: this device stops receiving the user's pushes. */
  @Delete('devices/:token')
  @HttpCode(204)
  async remove(@CurrentMember() member: Member, @Param('token') token: string) {
    await this.notifications.removeDevice(member.userId, token);
  }

  /** Demo only: sends the signed-in user a sample push of the given type. Off in production. */
  @Post('test')
  async test(@CurrentMember() member: Member, @Body() body: unknown) {
    if (this.config.NODE_ENV === 'production') throw new AppError(404, 'not_found', 'Not available');
    const { type } = parseOrThrow(TestPushBody, body);
    const language = await this.notifications.languageOf(member.userId);
    return this.notifications.send(member.userId, type, DEMO_VALUES[type][language]);
  }
}
