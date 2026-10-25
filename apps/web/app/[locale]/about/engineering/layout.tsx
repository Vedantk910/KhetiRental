import type { ReactNode } from "react";
import { EngineeringNav } from "@/components/engineering/engineering-nav";

/** "How we built it" (UI-SPEC §4.19, D-16): English-only engineering notes, reached from the footer. */
export default function EngineeringLayout({ children }: { children: ReactNode }) {
  return (
    <div lang="en" className="break-words">
      <EngineeringNav />
      {children}
    </div>
  );
}
