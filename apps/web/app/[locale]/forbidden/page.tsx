import { getTranslations } from "next-intl/server";
import { FieldStill } from "@/components/field-still";
import { ButtonLink } from "@/components/ui/button";

/** Wrong role or not the owner (UI-SPEC §10): the 404 style with its own message. */
export default async function Forbidden() {
  const t = await getTranslations();
  return (
    <div className="mx-auto flex max-w-read flex-col items-center gap-6 px-4 py-12 text-center">
      <title>{t("errors.forbidden")}</title>
      <FieldStill className="w-[240px] max-w-full" />
      <h1 className="text-h1">{t("errors.forbidden")}</h1>
      <ButtonLink href="/">{t("common.goHome")}</ButtonLink>
    </div>
  );
}
