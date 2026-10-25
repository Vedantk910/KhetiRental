import type { ReactNode } from "react";

/** The reading column shared by Help, How we price, Terms and Privacy (max 38 rem, UI-SPEC §4.18). */
export function ReadPage({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-read flex-col gap-6 px-4 py-6 sm:px-6 lg:py-12">
      <h1 className="text-h1">{title}</h1>
      {children}
    </div>
  );
}
