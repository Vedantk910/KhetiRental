"use client";

import { useLocale } from "next-intl";
import { useEffect } from "react";
import { whenIdle } from "@/lib/idle";
import { useMotion } from "@/lib/use-motion";

/**
 * Rich mode only: after idle, loads GSAP and pins S1, S2 and S5 (UI-SPEC §4.1.4). Lite and none never fetch it, and the
 * CSS reveals stay in charge there. Rebuilds when the language changes (the text, and so the heights, change).
 */
export function StoryMotion() {
  const motion = useMotion();
  const locale = useLocale();
  useEffect(() => {
    if (motion !== "rich") return;
    let stop: (() => void) | undefined;
    let dead = false;
    const cancel = whenIdle(() => {
      import("./story-pins")
        .then((m) => {
          if (!dead) stop = m.startPins();
        })
        .catch(() => undefined); // offline or blocked: the CSS reveals still work
    });
    return () => {
      dead = true;
      cancel();
      stop?.();
    };
  }, [motion, locale]);
  return null;
}
