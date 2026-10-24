"use client";

import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "success" | "info" | "error";
type Item = { id: number; tone: Tone; message: ReactNode };
type ToastFn = (t: { tone: Tone; message: ReactNode }) => void;

const Ctx = createContext<ToastFn | null>(null);
const AUTO_MS = 5000;
const ICON = { success: CircleCheck, info: Info, error: CircleAlert };
const TONE = {
  success: "border-success text-text",
  info: "border-info text-text",
  error: "border-danger text-text",
};

export function useToast(): ToastFn {
  const fn = useContext(Ctx);
  if (!fn) throw new Error("useToast needs a <ToastProvider> above it");
  return fn;
}

/** Success/info: role=status, gone after 5 s. Errors: role=alert, stay until dismissed (UI-SPEC §5.10). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const t = useTranslations("common");
  const [items, setItems] = useState<Item[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setItems((xs) => xs.filter((x) => x.id !== id));
  }, []);

  const toast = useCallback<ToastFn>(
    ({ tone, message }) => {
      const id = nextId.current++;
      // Keep the stack short: at most 3 visible.
      setItems((xs) => [...xs, { id, tone, message }].slice(-3));
      if (tone !== "error")
        timers.current.set(
          id,
          setTimeout(() => {
            dismiss(id);
          }, AUTO_MS),
        );
    },
    [dismiss],
  );

  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach(clearTimeout);
    };
  }, []);

  const list = (errors: boolean) =>
    items
      .filter((x) => (x.tone === "error") === errors)
      .map((x) => {
        const Icon = ICON[x.tone];
        return (
          <div
            key={x.id}
            className={cn(
              "kr-toast pointer-events-auto flex w-full items-center gap-3 rounded-card border-2 bg-surface py-2 pl-4 pr-2 text-small shadow-sheet",
              TONE[x.tone],
            )}
          >
            <Icon
              aria-hidden
              className={cn(
                "h-6 w-6 shrink-0",
                x.tone === "error" ? "text-danger" : x.tone === "success" ? "text-success" : "text-info",
              )}
            />
            <p className="flex-1">{x.message}</p>
            <button
              type="button"
              aria-label={t("dismiss")}
              onClick={() => {
                dismiss(x.id);
              }}
              className="flex h-tap w-tap shrink-0 items-center justify-center rounded-pill hover:bg-surface-muted"
            >
              <X aria-hidden className="h-5 w-5" />
            </button>
          </div>
        );
      });

  return (
    <Ctx.Provider value={toast}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-[88px] z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6">
        <div role="status" className="flex w-full max-w-[480px] flex-col gap-2 empty:hidden">
          {list(false)}
        </div>
        <div role="alert" className="flex w-full max-w-[480px] flex-col gap-2 empty:hidden">
          {list(true)}
        </div>
      </div>
    </Ctx.Provider>
  );
}
