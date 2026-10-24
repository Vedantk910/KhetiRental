import { getTranslations } from "next-intl/server";
import { FieldStill } from "@/components/field-still";
import { ButtonLink } from "@/components/ui/button";

export default async function NotFound() {
  const t = await getTranslations();
  return (
    <div className="mx-auto flex max-w-read flex-col items-center gap-6 px-4 py-12 text-center">
      <title>{t("notFound.title")}</title>
      <FieldStill className="w-[240px] max-w-full" />
      <h1 className="text-h1">{t("errors.notFound")}</h1>
      <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
        <ButtonLink href="/rent" prefetch={false}>
          {t("bookings.findOne")}
        </ButtonLink>
        <ButtonLink href="/" variant="secondary">
          {t("common.goHome")}
        </ButtonLink>
      </div>
    </div>
  );
}
