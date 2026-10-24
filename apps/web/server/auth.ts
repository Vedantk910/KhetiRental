// Auth.js v5 (D-05, S-02). Every sign-in (Google, Mock Google, password, phone OTP) ends in a row in
// `sessions`: jwt.encode stores a random token's hash and returns the token as the cookie value, and
// jwt.decode looks it up, so sessions are server-side and revocable while credentials sign-in still works.
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth, { CredentialsSignin, type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import type { Role } from "@/lib/domain";
import { getDb } from "./db";
import { accounts, sessions, users, verificationTokens } from "./db/schema";
import { ApiError } from "./http";
import { mockGoogleEnabled } from "./mocks/flags";
import { mockGoogleUser } from "./mocks/google";
import { signInWithOtp } from "./otp";
import { loginWithPassword } from "./passwords";
import { clientIp, limit } from "./rate-limit";
import { createSession, deleteSession, SESSION_MAX_AGE_S, type SessionUser, userFromToken } from "./session";

declare module "next-auth" {
  interface User {
    roles?: Role[];
  }
}

/** The error code lands in the login page URL (?code=…); it never says which credential was wrong. */
class SignInCode extends CredentialsSignin {
  constructor(code: string) {
    super();
    this.code = code;
  }
}

async function guarded(fn: () => Promise<SessionUser | null>) {
  try {
    const u = await fn();
    return u && { id: u.id, name: u.name, email: u.email, roles: u.roles };
  } catch (e) {
    if (e instanceof ApiError) {
      const left = e.details?.triesLeft;
      throw new SignInCode(left === undefined ? e.code : `${e.code}_${left}`);
    }
    throw e;
  }
}

const str = (v: unknown) => (typeof v === "string" ? v : "");

function providers(): NextAuthConfig["providers"] {
  const list: NextAuthConfig["providers"] = [
    Credentials({
      id: "password",
      name: "Email",
      credentials: { email: {}, password: {} },
      authorize: (c, req) => guarded(() => loginWithPassword(str(c.email), str(c.password), clientIp(req))),
    }),
    Credentials({
      id: "phone-otp",
      name: "Mobile OTP",
      credentials: { phone: {}, code: {}, name: {}, roles: {} },
      authorize: (c, req) =>
        guarded(async () => {
          await limit("otpVerifyIp", clientIp(req));
          const roles = str(c.roles) ? (str(c.roles).split(",") as Role[]) : undefined;
          return signInWithOtp({
            phone: str(c.phone),
            code: str(c.code),
            name: str(c.name) || undefined,
            roles,
          });
        }),
    }),
  ];
  if (process.env.AUTH_GOOGLE_ID) list.push(Google);
  else if (mockGoogleEnabled())
    list.push(
      Credentials({
        id: "mock-google",
        name: "Mock Google",
        credentials: {},
        authorize: () => guarded(mockGoogleUser),
      }),
    );
  return list;
}

export const { handlers } = NextAuth(() => ({
  adapter: DrizzleAdapter(getDb(), {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: providers(),
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_S },
  trustHost: true,
  // A failed sign-in is expected traffic (wrong password, wrong code), not a server error worth a stack trace.
  logger: {
    error(e) {
      if (!(e instanceof CredentialsSignin)) console.error(e);
    },
  },
  pages: { signIn: "/login", error: "/login" },
  jwt: {
    async encode({ token }) {
      if (typeof token?.sid === "string") return token.sid;
      if (!token?.sub) throw new Error("no user for session");
      return createSession(token.sub);
    },
    async decode({ token }) {
      const u = await userFromToken(token);
      return u && { sub: u.id, sid: token, name: u.name, email: u.email, roles: u.roles };
    },
  },
  callbacks: {
    session({ session, token }) {
      return { ...session, user: { ...session.user, id: token.sub ?? "", roles: token.roles as Role[] } };
    },
  },
  events: {
    async signOut(message) {
      const sid = "token" in message ? message.token?.sid : undefined;
      if (typeof sid === "string") await deleteSession(sid);
    },
  },
}));
