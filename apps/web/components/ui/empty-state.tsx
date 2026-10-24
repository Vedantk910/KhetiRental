import type { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  body,
  actions,
}: {
  icon?: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
      {icon && <div className="text-text-subtle">{icon}</div>}
      <h2 className="text-h4">{title}</h2>
      {body && <p className="max-w-read text-small text-text-muted">{body}</p>}
      {actions && <div className="mt-2 flex flex-wrap justify-center gap-3">{actions}</div>}
    </div>
  );
}
