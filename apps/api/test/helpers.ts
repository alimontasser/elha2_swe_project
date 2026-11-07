import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import type { Member } from '../src/accounts/accounts.interfaces';
import { loadConfig } from '../src/config/config';
import { PrismaService } from '../src/prisma/prisma.service';

/** The local test database (TEST_DATABASE_URL in apps/api/.env), migrated and seeded. */
export function testDb(): PrismaService {
  // Jest gives each test file its own copy of process.env, so read apps/api/.env here.
  const file = existsSync('.env') ? parseEnv(readFileSync('.env', 'utf8')) : {};
  const env = { ...file, ...process.env };
  const base = loadConfig(env);
  const url = env.TEST_DATABASE_URL;
  if (!url) throw new Error('Set TEST_DATABASE_URL to run the database tests');
  return new PrismaService({ ...base, DATABASE_URL: url });
}

/** A fresh user and household, so tests never see each other's rows. */
export async function newMember(db: PrismaService): Promise<Member> {
  const user = await db.user.create({ data: { authUid: `test-${randomUUID()}` } });
  const household = await db.household.create({ data: { ownerId: user.id } });
  await db.user.update({ where: { id: user.id }, data: { householdId: household.id } });
  return { userId: user.id, householdId: household.id, authUid: user.authUid };
}
