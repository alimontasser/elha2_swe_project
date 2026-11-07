// Prints a local login token in the Supabase Auth format, signed with AUTH_JWT_SECRET.
// Only for development: production verifies real Supabase tokens through the project's JWKS.
//   pnpm dev-token [authUid] [phone]          a household user
//   pnpm dev-token --admin [authUid] [phone]  an administrator (app_metadata.roles = ["admin"])
import { SignJWT } from 'jose';
import { loadConfig } from '../src/config/config';

async function main() {
  const config = loadConfig();
  if (config.SUPABASE_URL || !config.AUTH_JWT_SECRET) {
    throw new Error('dev-token works only with AUTH_JWT_SECRET and no SUPABASE_URL');
  }
  const args = process.argv.slice(2);
  const admin = args.includes('--admin');
  const [authUid = admin ? 'dev-admin-1' : 'dev-user-1', phone = admin ? '01000000000' : '01012345678'] = args.filter(
    (a) => a !== '--admin',
  );
  const claims = { phone, role: 'authenticated', ...(admin ? { app_metadata: { roles: ['admin'] } } : {}) };
  const token = await new SignJWT(claims)
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
