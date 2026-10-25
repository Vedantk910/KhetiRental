import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  const t = useTranslations("results");
  return (
    <div className="mx-auto max-w-app px-4 py-4 sm:px-6" role="status">
      <p className="mb-3 text-small text-text-muted">{t("loading")}</p>
      <div className="grid gap-4 xl:grid-cols-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[300px] rounded-card" />
        ))}
      </div>
    </div>
  );
}
