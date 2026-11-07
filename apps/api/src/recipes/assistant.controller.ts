import { Body, Controller, HttpCode, Inject, Post, UseGuards } from '@nestjs/common';
import type { Member } from '../accounts/accounts.interfaces';
import { AI, type IAI } from '../ai/ai.interfaces';
import { AuthGuard, CurrentMember } from '../auth/auth.guard';
import { parseOrThrow } from '../common/errors';
import { AskAssistantBody } from './assistant.schemas';

@Controller('recipes/assistant')
@UseGuards(AuthGuard)
export class AssistantController {
  constructor(@Inject(AI) private readonly ai: IAI) {}

  /** US-4.02: ask the cooking assistant. The answer is a suggestion the person reads and decides on (NFR-30). */
  @Post()
  @HttpCode(200)
  ask(@CurrentMember() member: Member, @Body() body: unknown) {
    return this.ai.askCookingAssistant(parseOrThrow(AskAssistantBody, body), { userId: member.userId });
  }
}
