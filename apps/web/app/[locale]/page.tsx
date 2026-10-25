import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Counters } from "@/components/welcome/counters";
import { FieldScene } from "@/components/welcome/field-scene";
import { ScenePause } from "@/components/welcome/scene-pause";
import { Story } from "@/components/welcome/story";
import { ButtonLink } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { STATS } from "@/config/welcome";
import { pageUser } from "@/server/page-user";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "welcome" });
  return {
    title: { absolute: `KhetiRental – ${t("h1")}` },
    description: t("meta"),
    alternates: {
      canonical: `/${locale}`,
      languages: { en: "/en", hi: "/hi", mr: "/mr", "x-default": "/en" },
    },
  };
}

export default async function Welcome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- next/root-params needs Next 16; this is the Next 15 API
  setRequestLocale(locale as Locale);
  const [t, user] = await Promise.all([getTranslations("welcome"), pageUser()]);
  const owner = user?.roles.includes("owner") ?? false;

  return (
    <>
      <section className="kr-hero">
        <FieldScene />
        <ScenePause />
        <div className="relative z-10 flex flex-col items-center px-4 pt-[96px] text-center text-[#13100D] lg:pt-[14%]">
          <h1 className="max-w-[16ch] font-display text-[46px] font-bold leading-[50px] lg:max-w-none lg:text-[72px] lg:leading-[76px]">
            {t("h1")}
          </h1>
          <p className="mt-2 text-[18px] font-bold leading-[26px]">{t("tag")}</p>
          <nav aria-label={t("start")} className="mt-[14px] flex flex-wrap justify-center gap-[10px]">
            {user ? (
              <>
                <ButtonLink href="/rent" variant="pill-primary">
                  {t("find")}
                </ButtonLink>
                <ButtonLink href="/bookings" variant="pill-accent">
                  {t("bookings")}
                </ButtonLink>
              </>
            ) : (
              <>
                <ButtonLink href="/login" variant="pill-primary">
                  {t("login")}
                </ButtonLink>
                <ButtonLink href="/login?mode=signup" variant="pill-accent">
                  {t("signup")}
                </ButtonLink>
              </>
            )}
            <ButtonLink href="/#how" variant="pill-light">
              {t("how")}
            </ButtonLink>
          </nav>
        </div>
        <div className="absolute inset-x-0 top-[77.7%] z-10 lg:bottom-[8%] lg:top-auto">
          <Counters
            label={t("stats.label")}
            items={STATS.map((s) => ({
              value: s.value,
              decimals: s.decimals,
              suffix: s.suffix,
              label: t(`stats.${s.key}`),
              sr: t(`stats.${s.sr}`),
            }))}
            source={
              <Link
                href="/how-we-price#sources"
                className="inline-flex min-h-tap min-w-tap items-center justify-center underline underline-offset-4"
              >
                {t("stats.source")}
              </Link>
            }
          />
        </div>
      </section>
      <Story ownerHref={owner ? "/owner/machines/new" : "/login?mode=signup&role=owner"} />
    </>
  );
}
