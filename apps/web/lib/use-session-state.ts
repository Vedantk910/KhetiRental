"use client";

import { useEffect, useState } from "react";

const SWITCH_KEY = "kr:lang-switched";
const SWITCH_WINDOW_MS = 15_000;

/** Called by the language switch: the next page to mount may restore what was typed. */
export function markLanguageSwitch() {
  try {
    sessionStorage.setItem(SWITCH_KEY, String(Date.now()));
  } catch {
    // storage blocked: switching still works, typed text just isn't carried over
  }
}

const justSwitched = () => {
  try {
    return Date.now() - Number(sessionStorage.getItem(SWITCH_KEY)) < SWITCH_WINDOW_MS;
  } catch {
    return false;
  }
};

/**
 * useState that survives a remount within the tab (sessionStorage), so switching language keeps form input.
 * Reads after mount to keep server and client HTML identical.
 * `onlyAfterSwitch`: for a form that starts from a URL or a cookie. The stored text is restored only right after a language
 * switch, never on a later visit, so it cannot override the link the user came from.
 */
export function useSessionState<T>(
  key: string,
  initial: T,
  { onlyAfterSwitch = false }: { onlyAfterSwitch?: boolean } = {},
) {
  const k = `kr:${key}`;
  const [value, setValue] = useState(initial);
  useEffect(() => {
    if (onlyAfterSwitch && !justSwitched()) return;
    try {
      const raw = sessionStorage.getItem(k);
      if (raw !== null) setValue(JSON.parse(raw) as T);
    } catch {
      // private mode or corrupt value: keep the initial value
    }
  }, [k, onlyAfterSwitch]);
  const set = (v: T | ((prev: T) => T)) => {
    setValue((prev) => {
      const next = typeof v === "function" ? (v as (p: T) => T)(prev) : v;
      try {
        sessionStorage.setItem(k, JSON.stringify(next));
      } catch {
        // storage full or blocked: the value still lives in memory
      }
      return next;
    });
  };
  return [value, set] as const;
}
