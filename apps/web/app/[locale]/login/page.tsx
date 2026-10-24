import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LoginForm, type GoogleMode } from "@/components/auth/login-form";
import type { Locale } from "@/i18n/routing";
import { mockGoogleEnabled } from "@/server/mocks/flags";
import { redirectIfSignedIn } from "@/server/page-user";

type Search = { mode?: string; next?: string; role?: string; error?: string; code?: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "login" });
  return { title: t("tab.login"), robots: { index: false } };
}

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Search>;
}) {
  const { locale } = await params;
  const q = await searchParams;
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- next/root-params needs Next 16; this is the Next 15 API
  setRequestLocale(locale as Locale);
  const next = typeof q.next === "string" ? q.next : null;
  await redirectIfSignedIn(locale, next);
  const google: GoogleMode = process.env.AUTH_GOOGLE_ID ? "real" : mockGoogleEnabled() ? "mock" : null;
  return (
    <LoginForm
      initialMode={q.mode === "signup" ? "signup" : "login"}
      initialRole={q.role === "owner" ? "owner" : "renter"}
      next={next}
      google={google}
      authFailed={q.error !== undefined && q.error !== "CredentialsSignin"}
    />
  );
}
