import { CircleAlert } from "lucide-react";
import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";

type FieldProps = { label: ReactNode; hint?: ReactNode; error?: ReactNode };

const control =
  "w-full min-w-0 rounded-control border-2 bg-surface px-[14px] text-body text-text placeholder:text-text-subtle aria-[invalid=true]:border-danger";

function useField({ hint, error }: FieldProps, ownDescribedBy?: string) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  return {
    id,
    hintId,
    errId,
    a11y: {
      id,
      "aria-invalid": error ? (true as const) : undefined,
      "aria-describedby": [errId, hintId, ownDescribedBy].filter(Boolean).join(" ") || undefined,
    },
  };
}

function Frame({
  id,
  label,
  hint,
  error,
  hintId,
  errId,
  children,
}: FieldProps & { id: string; hintId?: string; errId?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-label">
        {label}
      </label>
      {children}
      {error && (
        <p id={errId} className="flex items-start gap-1 text-caption font-bold text-danger">
          <CircleAlert aria-hidden className="mt-[3px] h-4 w-4 shrink-0" />
          {error}
        </p>
      )}
      {hint && (
        <p id={hintId} className="text-caption text-text-subtle">
          {hint}
        </p>
      )}
    </div>
  );
}

export function Input({
  label,
  hint,
  error,
  prefix,
  suffix,
  className,
  ...rest
}: FieldProps & {
  prefix?: ReactNode;
  /** A 48 × 48 control drawn inside the right edge (e.g. the password eye). */
  suffix?: ReactNode;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "prefix">) {
  const f = useField({ label, hint, error }, rest["aria-describedby"]);
  const input = (
    <input
      {...rest}
      {...f.a11y}
      className={cn(control, "h-[52px] border-border-control", suffix && "pr-[52px]", className)}
    />
  );
  const field = suffix ? (
    <div className="relative min-w-0 flex-1">
      {input}
      <div className="absolute right-[2px] top-[2px] flex h-[48px] w-[48px] items-center justify-center">
        {suffix}
      </div>
    </div>
  ) : (
    input
  );
  return (
    <Frame id={f.id} label={label} hint={hint} error={error} hintId={f.hintId} errId={f.errId}>
      {prefix ? (
        <div className="flex gap-2">
          <span className="flex h-[52px] shrink-0 items-center rounded-control border-2 border-border-control bg-surface-muted px-3 text-body font-bold">
            {prefix}
          </span>
          {field}
        </div>
      ) : (
        field
      )}
    </Frame>
  );
}

export function Select({
  label,
  hint,
  error,
  className,
  children,
  ...rest
}: FieldProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const f = useField({ label, hint, error }, rest["aria-describedby"]);
  return (
    <Frame id={f.id} label={label} hint={hint} error={error} hintId={f.hintId} errId={f.errId}>
      <select {...rest} {...f.a11y} className={cn(control, "h-[52px] border-border-control", className)}>
        {children}
      </select>
    </Frame>
  );
}

export function Textarea({
  label,
  hint,
  error,
  className,
  ...rest
}: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const f = useField({ label, hint, error }, rest["aria-describedby"]);
  return (
    <Frame id={f.id} label={label} hint={hint} error={error} hintId={f.hintId} errId={f.errId}>
      <textarea
        {...rest}
        {...f.a11y}
        className={cn(control, "min-h-[120px] border-border-control py-3", className)}
      />
    </Frame>
  );
}
