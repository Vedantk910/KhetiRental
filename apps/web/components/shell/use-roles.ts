"use client";

import { useEffect, useState } from "react";
import { usePathname } from "@/i18n/navigation";
import type { Role } from "@/lib/domain";
import { isAppRoute } from "@/lib/nav";

let known: Promise<Role[] | null> | null = null;

/** The signed-in user's roles on app pages (null while unknown, or signed out). One request per page load. */
export function useRoles(): Role[] | null {
  const app = isAppRoute(usePathname());
  const [roles, setRoles] = useState<Role[] | null>(null);
  useEffect(() => {
    if (!app) return;
    known ??= fetch("/api/me")
      .then((r) => (r.ok ? (r.json() as Promise<{ roles: Role[] }>) : null))
      .then((j) => j?.roles ?? null)
      .catch(() => null);
    let live = true;
    void known.then((r) => {
      if (live) setRoles(r);
    });
    return () => {
      live = false;
    };
  }, [app]);
  return roles;
}
