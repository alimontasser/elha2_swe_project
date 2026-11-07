import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { IMemberDirectory, Member } from './accounts.interfaces';

@Injectable()
export class AccountsService implements IMemberDirectory {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  async resolve(authUid: string, phone?: string): Promise<Member> {
    const existing = await this.db.user.findUnique({ where: { authUid } });
    if (existing?.householdId) {
      return { userId: existing.id, householdId: existing.householdId, authUid };
    }
    return this.db.$transaction(async (tx) => {
      const user = existing ?? (await tx.user.create({ data: { authUid, phone: phone ?? null } }));
      const household = await tx.household.create({ data: { ownerId: user.id } });
      await tx.user.update({ where: { id: user.id }, data: { householdId: household.id } });
      return { userId: user.id, householdId: household.id, authUid };
    });
  }

  async language(userId: string): Promise<'ar' | 'en'> {
    const user = await this.db.user.findUnique({ where: { id: userId }, select: { language: true } });
    return user?.language === 'en' ? 'en' : 'ar';
  }
}
