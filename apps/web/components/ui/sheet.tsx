"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  /** A submit is in flight: Escape, ✕ and the overlay must not close (REVIEW F-34). */
  busy?: boolean;
};

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Bottom sheet on phones, centred dialog from 768 px (UI-SPEC §5.6). */
export function Sheet({ open, onClose, title, children, busy = false }: Props) {
  const t = useTranslations("common");
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const first = panel.current?.querySelector<HTMLElement>(`[data-autofocus], ${FOCUSABLE}`);
    (first ?? panel.current)?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      if (opener?.isConnected) opener.focus();
    };
  }, [open]);

  if (!open) return null;

  const tryClose = () => {
    if (!busyRef.current) closeRef.current();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      tryClose();
      return;
    }
    if (e.key !== "Tab" || !panel.current) return;
    const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (items.length === 0) {
      e.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const inside = panel.current.contains(document.activeElement);
    if (e.shiftKey && (document.activeElement === first || !inside)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (document.activeElement === last || !inside)) {
      e.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    // The wrapper only routes keys for the trap; the dialog role sits on the panel.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      data-sheet-open
      className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6"
      onKeyDown={onKeyDown}
    >
      <div
        data-overlay
        aria-hidden
        className="kr-overlay absolute inset-0 bg-overlay/60"
        onMouseDown={(e) => {
          e.preventDefault(); // keep focus inside the dialog
        }}
        onClick={tryClose}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-busy={busy || undefined}
        tabIndex={-1}
        className="kr-sheet relative max-h-[90svh] w-full overflow-y-auto rounded-t-card bg-surface px-4 pb-6 pt-3 text-text shadow-sheet md:max-w-[480px] md:rounded-card md:p-6"
      >
        <div aria-hidden className="mx-auto mb-3 h-[5px] w-[44px] rounded-pill bg-chip md:hidden" />
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id={titleId} className="pt-2 text-h2">
            {title}
          </h2>
          <button
            type="button"
            aria-label={t("close")}
            aria-disabled={busy || undefined}
            onClick={tryClose}
            className="flex h-tap w-tap shrink-0 items-center justify-center rounded-pill border-2 border-chip text-text hover:bg-surface-muted aria-disabled:cursor-not-allowed aria-disabled:text-text-subtle"
          >
            <X aria-hidden className="h-6 w-6" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
