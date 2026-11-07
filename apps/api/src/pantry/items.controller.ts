import { Body, Controller, Delete, Get, HttpCode, Inject, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import type { Member } from '../accounts/accounts.interfaces';
import { AuthGuard, CurrentMember } from '../auth/auth.guard';
import { parseOrThrow } from '../common/errors';
import { CreatePantryItemBody, UpdatePantryItemBody } from './items.schemas';
import { PantryItemsService } from './items.service';

@Controller('pantry/items')
@UseGuards(AuthGuard)
export class PantryItemsController {
  constructor(@Inject(PantryItemsService) private readonly items: PantryItemsService) {}

  /** US-2.11: the household's pantry, soonest expiry first. */
  @Get()
  async list(@CurrentMember() member: Member) {
    return { items: await this.items.list(member) };
  }

  /** US-2.07 and the other capture methods. */
  @Post()
  create(@CurrentMember() member: Member, @Body() body: unknown) {
    return this.items.create(member, parseOrThrow(CreatePantryItemBody, body));
  }

  /** Edits, used up, donated or thrown away with a reason (US-2.10). */
  @Patch(':id')
  update(@CurrentMember() member: Member, @Param('id', new ParseUUIDPipe()) id: string, @Body() body: unknown) {
    return this.items.update(member, id, parseOrThrow(UpdatePantryItemBody, body));
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentMember() member: Member, @Param('id', new ParseUUIDPipe()) id: string) {
    await this.items.remove(member, id);
  }
}
