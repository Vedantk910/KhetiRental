import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { CSSProperties, ReactNode } from "react";
import { FieldScene } from "@/components/welcome/field-scene";
import { LanguageSwitch } from "@/components/ui/language-switch";
import { Link } from "@/i18n/navigation";

/** Phone: back arrow + language switch over a single column. Desktop: still field on the left, centred card on the right. */
export default async function LoginLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations("common");
  return (
    <div className="lg:grid lg:min-h-svh lg:grid-cols-2">
      <div aria-hidden="true" className="hidden lg:block">
        <div
          className="kr-hero sticky top-0"
          style={{ "--travel": "calc(50vw - var(--u) * 165)" } as CSSProperties}
        >
          <FieldScene still />
        </div>
      </div>
      <div className="flex flex-col">
        <div className="flex h-[60px] items-center justify-between px-2 sm:px-4">
          <Link
            href="/"
            aria-label={t("back")}
            className="flex h-tap w-tap items-center justify-center rounded-pill text-text hover:bg-surface-muted"
          >
            <ArrowLeft aria-hidden className="h-6 w-6" />
          </Link>
          <LanguageSwitch name="login" tight />
        </div>
        <div className="mx-auto flex w-full max-w-[440px] flex-1 flex-col px-4 pb-8 pt-1 lg:justify-center">
          <div className="lg:rounded-card lg:bg-surface lg:p-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
