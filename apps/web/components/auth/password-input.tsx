"use client";

import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type ComponentProps } from "react";
import { Input } from "@/components/ui/field";

/** Password field with a 48 × 48 show/hide button. */
export function PasswordInput(props: Omit<ComponentProps<typeof Input>, "type" | "suffix">) {
  const t = useTranslations("login");
  const [shown, setShown] = useState(false);
  const Icon = shown ? EyeOff : Eye;
  return (
    <Input
      {...props}
      type={shown ? "text" : "password"}
      suffix={
        <button
          type="button"
          aria-label={shown ? t("hidePassword") : t("showPassword")}
          onClick={() => {
            setShown(!shown);
          }}
          className="flex h-full w-full items-center justify-center rounded-control text-text-muted hover:text-text"
        >
          <Icon aria-hidden className="h-6 w-6" />
        </button>
      }
    />
  );
}
