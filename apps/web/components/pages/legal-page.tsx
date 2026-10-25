import { getTranslations } from "next-intl/server";
import { ReadPage } from "./page-shell";

/** Terms and Privacy (UI-SPEC §4.18): max 38 rem, h2 sections, placeholder text marked [LEGAL REVIEW NEEDED]. */
export async function LegalPage({ doc }: { doc: "terms" | "privacy" }) {
  const t = await getTranslations("legal");
  return (
    <ReadPage title={t(`${doc}.title`)}>
      <p role="note" className="rounded-control bg-warning-bg p-3 text-small font-bold text-warning">
        {t("review")}
      </p>
      {([1, 2, 3, 4, 5, 6] as const).map((n) => (
        <section key={n} aria-labelledby={`${doc}-${n}`} className="flex flex-col gap-2">
          <h2 id={`${doc}-${n}`} className="text-h2">
            {t(`${doc}.s${n}.h`)}
          </h2>
          <p className="text-body">{t(`${doc}.s${n}.p`)}</p>
        </section>
      ))}
    </ReadPage>
  );
}
