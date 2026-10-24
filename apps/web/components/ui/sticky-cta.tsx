import type { ReactNode } from "react";

/** Phone: fixed bottom bar (hides the tab bar via [data-sticky-cta]). From 768 px it sits inline. */
export function StickyCTA({
  children,
  price,
  caption,
}: {
  children: ReactNode;
  price?: ReactNode;
  caption?: ReactNode;
}) {
  return (
    <>
      <div aria-hidden className="h-[88px] md:hidden" />
      <div
        data-sticky-cta
        className="fixed inset-x-0 bottom-0 z-40 bg-surface px-4 pb-[20px] pt-3 shadow-raised md:static md:bg-transparent md:p-0 md:shadow-none"
      >
        <div className="mx-auto flex max-w-app items-center gap-4">
          {price !== undefined && (
            <div className="shrink-0">
              <p className="text-[1.25rem] font-bold tabular-nums leading-7">{price}</p>
              {caption && <p className="text-caption text-text-subtle">{caption}</p>}
            </div>
          )}
          <div className="flex flex-1 [&>*]:w-full">{children}</div>
        </div>
      </div>
    </>
  );
}
