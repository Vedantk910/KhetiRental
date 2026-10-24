"use client";

import { useEffect } from "react";

/** Stops the field animation while the tab is hidden (UI-SPEC §4.1.2). Renders nothing. */
export function ScenePause() {
  useEffect(() => {
    const sync = () => {
      document.querySelectorAll<HTMLElement>(".kr-scene").forEach((el) => {
        if (document.hidden) el.setAttribute("data-paused", "");
        else el.removeAttribute("data-paused");
      });
    };
    sync(); // a page opened in a background tab starts paused
    document.addEventListener("visibilitychange", sync);
    return () => {
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);
  return null;
}
