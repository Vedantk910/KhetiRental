"use client";

import { Mic } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useSpeech } from "./use-speech";

export interface PlaceOption {
  pin: string;
  village: string;
  label: string;
  lat: number;
  lng: number;
}

type Props = {
  value: string;
  onText: (text: string) => void;
  onPick: (p: PlaceOption) => void;
};

const DEVA = /[०-९]/g;
const asciiDigits = (s: string) => s.replace(DEVA, (d) => String(d.charCodeAt(0) - 0x0966));
export const enoughToSearch = (s: string) => {
  const q = asciiDigits(s.trim());
  return /^\d+$/.test(q) ? q.length >= 3 : q.length >= 2;
};

/** PIN or village with an autocomplete listbox (WAI-ARIA combobox) and an optional mic button. */
export function PlaceInput({ value, onText, onPick }: Props) {
  const t = useTranslations("search");
  const locale = useLocale();
  const id = useId();
  const [options, setOptions] = useState<PlaceOption[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const abort = useRef<AbortController | null>(null);
  const picked = useRef<string | null>(null);
  const speech = useSpeech(locale, (text) => {
    onText(text);
  });

  useEffect(() => {
    if (picked.current === value || !enoughToSearch(value)) {
      setOptions([]);
      return;
    }
    const timer = setTimeout(() => {
      abort.current?.abort();
      const ac = new AbortController();
      abort.current = ac;
      fetch(`/api/places?q=${encodeURIComponent(value.trim())}`, { signal: ac.signal })
        .then((r) => (r.ok ? (r.json() as Promise<{ items: PlaceOption[] }>) : { items: [] }))
        .then((j) => {
          setOptions(j.items);
          setActive(-1);
        })
        .catch(() => undefined);
    }, 200);
    return () => {
      clearTimeout(timer);
    };
  }, [value]);

  const choose = (o: PlaceOption) => {
    picked.current = `${o.pin} · ${o.village}`;
    onPick(o);
    setOpen(false);
    setOptions([]);
  };

  const showList = open && options.length > 0;
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" && options.length > 0) {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (a + 1) % options.length);
    } else if (e.key === "ArrowUp" && showList) {
      e.preventDefault();
      setActive((a) => (a <= 0 ? options.length - 1 : a - 1));
    } else if (e.key === "Enter" && showList && active >= 0) {
      e.preventDefault();
      choose(options[active]);
    } else if (e.key === "Escape" && showList) {
      e.stopPropagation();
      setOpen(false);
    }
  };

  return (
    <div className="flex gap-2">
      <div className="relative min-w-0 flex-1">
        <input
          id={id}
          role="combobox"
          aria-expanded={showList}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={showList && active >= 0 ? `${id}-o${active}` : undefined}
          aria-label={t("where")}
          autoComplete="off"
          inputMode="text"
          maxLength={60}
          placeholder={t("placePh")}
          value={value}
          onChange={(e) => {
            picked.current = null;
            onText(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
          }}
          onBlur={() => {
            // Options use onMouseDown, so a click lands before this closes the list.
            setOpen(false);
          }}
          onKeyDown={onKeyDown}
          className="h-[52px] w-full min-w-0 rounded-control border-2 border-border-control bg-surface px-[14px] text-body text-text placeholder:text-text-subtle"
        />
        {showList && (
          <div
            id={`${id}-list`}
            role="listbox"
            aria-label={t("suggestions")}
            className="absolute inset-x-0 top-full z-30 mt-1 max-h-[60svh] overflow-y-auto rounded-control border-2 border-border-control bg-surface shadow-sheet"
          >
            {options.map((o, i) => (
              <div
                key={`${o.pin}-${o.village}`}
                id={`${id}-o${i}`}
                role="option"
                tabIndex={-1}
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(o);
                }}
                className={cn(
                  "flex min-h-tap cursor-pointer items-center px-[14px] text-small",
                  i === active ? "bg-selected text-selected-on" : "hover:bg-surface-muted",
                )}
              >
                {o.label}
              </div>
            ))}
          </div>
        )}
      </div>
      {speech.supported && (
        <button
          type="button"
          aria-label={t("speak")}
          aria-pressed={speech.listening}
          onClick={speech.toggle}
          className={cn(
            "flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-control border-2 border-border-control text-text hover:bg-surface-muted",
            speech.listening && "border-action bg-selected text-selected-on",
          )}
        >
          <Mic aria-hidden className="h-6 w-6" />
        </button>
      )}
    </div>
  );
}
