// Checks the web app's database login (routeguard_app) against the real
// database, the same way src/server/db/index.ts uses it:
//
//   npm run db:orm-check
//
// Needs DATABASE_URL in .env.local (docs/runbook.md, "App database login").
// Read-only: every check runs in a READ ONLY transaction that is rolled back.
// It never prints the URL or the password.
import postgres from 'postgres';

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error('DATABASE_URL is not set. Put it in .env.local (docs/runbook.md, "App database login").');
  process.exit(1);
}

let user = '';
try {
  user = decodeURIComponent(new URL(url).username).split('.')[0];
} catch {
  console.error('DATABASE_URL is not a valid postgres URL.');
  process.exit(1);
}
if (user !== 'routeguard_app') {
  console.error(`DATABASE_URL should log in as routeguard_app, not "${user}".`);
  process.exit(1);
}

const sql = postgres(url, { prepare: false, max: 1, connect_timeout: 10, ssl: 'require', onnotice: () => {} });
const FAKE_SUB = 'user_orm_check_not_a_real_user';
let failed = 0;

function check(name, ok, detail = '') {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
  if (!ok) failed += 1;
}

// One read-only transaction as `role` with these JWT claims, rolled back.
async function as(role, claims, fn) {
  try {
    await sql.begin('read only', async (tx) => {
      if (role) {
        await tx`select set_config('role', ${role}, true), set_config('request.jwt.claims', ${JSON.stringify(claims)}, true)`;
      }
      await fn(tx);
      throw new Rollback();
    });
  } catch (err) {
    if (!(err instanceof Rollback)) throw err;
  }
}
class Rollback extends Error {}

try {
  const [{ current_user: me, bypass }] = await sql`
    select current_user, (select rolbypassrls or rolsuper from pg_roles where rolname = current_user) as bypass`;
  check('logs in as routeguard_app', me === 'routeguard_app', me);
  check('cannot bypass RLS', bypass === false);

  // Without switching role it must read nothing.
  await as(null, null, async (tx) => {
    const err = await tx`select count(*) from public.zones`.then(() => null, (e) => e);
    check('reads nothing before switching role', err?.code === '42501', err ? err.code : 'query worked');
  });

  await as('anon', { role: 'anon' }, async (tx) => {
    const [{ n: zones }] = await tx`select count(*)::int as n from public.zones`;
    check('anon: reads zones', zones > 0, `${zones} zones`);
    const [{ n: risk }] = await tx`select count(*)::int as n from public.latest_risk`;
    check('anon: reads latest_risk', risk >= 0, `${risk} rows`);
    const users = await tx`select count(*)::int as n from public.users`.then(([r]) => r.n, (e) => e.code);
    check('anon: sees no users', users === 0 || users === '42501', String(users));
  });

  await as('authenticated', { role: 'authenticated', sub: FAKE_SUB, metadata: { role: 'driver' } }, async (tx) => {
    const [{ total, own }] = await tx`
      select count(*)::int as total, count(*) filter (where id = ${FAKE_SUB})::int as own from public.users`;
    check('signed in: sees only their own users row', total === own, `${total} visible`);
  });

  // Anything else is refused by the role grants.
  const err = await sql.begin('read only', (tx) => tx`select set_config('role', 'service_role', true)`).then(() => null, (e) => e);
  check('cannot switch to service_role', err?.code === '42501', err ? err.code : 'switch worked');
} catch (err) {
  console.error(`FAIL could not run the checks: ${err.code ?? err.name}`);
  failed += 1;
} finally {
  await sql.end({ timeout: 5 });
}

console.log(failed ? `${failed} check(s) failed` : 'all checks passed');
process.exit(failed ? 1 : 0);
