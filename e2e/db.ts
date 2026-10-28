import pg from 'pg';
import { e2eDatabaseUrl } from './global-setup';

/** Direct database access for the few things the product deliberately has no UI for. */
export async function setRole(
  username: string,
  role: 'user' | 'moderator' | 'admin',
): Promise<void> {
  const client = new pg.Client({ connectionString: e2eDatabaseUrl() });
  await client.connect();
  try {
    const res = await client.query(`UPDATE users SET role = $1::"UserRole" WHERE username = $2`, [
      role,
      username,
    ]);
    if (res.rowCount !== 1) throw new Error(`No user "${username}" in the e2e database yet`);
  } finally {
    await client.end();
  }
}
