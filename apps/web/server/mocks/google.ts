// "Mock Google" (D-05): with no AUTH_GOOGLE_ID, signs in the seeded demo user.
import { getSql } from "../db";
import type { SessionUser } from "../session";

const MOCK_GOOGLE_EMAIL = "demo.google@khetirental.test";

export async function mockGoogleUser(): Promise<SessionUser> {
  const [u] = await getSql()<SessionUser[]>`
    INSERT INTO users (name, email, email_verified, roles, is_sample)
    VALUES ('Demo Google User', ${MOCK_GOOGLE_EMAIL}, now(), '{renter}', true)
    ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
    RETURNING id, name, email, phone, roles`;
  return u;
}
