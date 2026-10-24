"use client";

import { useEffect, useState } from "react";

/**
 * useState that survives a remount within the tab (sessionStorage), so switching language keeps form input.
 * Reads after mount to keep server and client HTML identical.
 */
export function useSessionState<T>(key: string, initial: T) {
  const k = `kr:${key}`;
  const [value, setValue] = useState(initial);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(k);
      if (raw !== null) setValue(JSON.parse(raw) as T);
    } catch {
      // private mode or corrupt value: keep the initial value
    }
  }, [k]);
  const set = (v: T) => {
    setValue(v);
    try {
      sessionStorage.setItem(k, JSON.stringify(v));
    } catch {
      // storage full or blocked: the value still lives in memory
    }
  };
  return [value, set] as const;
}
