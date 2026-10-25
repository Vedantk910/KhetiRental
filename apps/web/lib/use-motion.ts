"use client";

import { useSyncExternalStore } from "react";
import type { Motion } from "@/lib/motion";

const subscribe = (notify: () => void) => {
  const mo = new MutationObserver(notify);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-motion"] });
  return () => {
    mo.disconnect();
  };
};

/** The page's motion level (set before paint by the inline script, and kept current if the setting changes). */
export function useMotion(): Motion {
  return useSyncExternalStore(
    subscribe,
    () => (document.documentElement.dataset.motion as Motion | undefined) ?? "lite",
    () => "lite",
  );
}
