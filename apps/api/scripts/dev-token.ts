// Prints a local login token in the Supabase Auth format, signed with AUTH_JWT_SECRET.
// Only for development: production verifies real Supabase tokens through the project's JWKS.
//   pnpm dev-token [authUid] [phone]
import { SignJWT } from 'jose';
import { loadConfig } from '../src/config/config';

async function main() {
  const config = loadConfig();
  if (config.SUPABASE_URL || !config.AUTH_JWT_SECRET) {
    throw new Error('dev-token works only with AUTH_JWT_SECRET and no SUPABASE_URL');
  }
  const [authUid = 'dev-user-1', phone = '01012345678'] = process.argv.slice(2);
  const token = await new SignJWT({ phone, role: 'authenticated' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(authUid)
    .setIssuer(config.AUTH_JWT_ISSUER)
    .setAudience('authenticated')
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(new TextEncoder().encode(config.AUTH_JWT_SECRET));
  console.log(token);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
