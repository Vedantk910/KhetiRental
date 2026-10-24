"use client";

import { BadgeCheck, UploadCloud } from "lucide-react";
import { useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  checkDocument,
  HP_OPTIONS,
  IMPLEMENTS,
  validateListing,
  type ListingForm,
} from "@/lib/marketplace-kyc";

const field = "mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-fg";
const lbl = "block text-sm font-medium";
const errCls = "mt-1 text-sm font-medium text-red-700 dark:text-red-400";

type Doc = { state: "empty" } | { state: "bad"; message: string } | { state: "verified"; name: string };

export function DocDrop({ label, doc, onFile }: { label: string; doc: Doc; onFile: (f: File) => void }) {
  const id = useId();
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  return (
    <div>
      <p id={`${id}-l`} className="text-sm font-medium">
        {label}
      </p>
      <div
        role="presentation"
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => {
          setOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const f = e.dataTransfer.files.item(0);
          if (f) onFile(f);
        }}
        className={cn(
          "mt-1 flex flex-col items-start gap-2 rounded-lg border-2 border-dashed p-4",
          over ? "bg-primary/5 border-primary" : "border-line",
        )}
      >
        {doc.state === "verified" ? (
          <p className="flex items-center gap-2 font-semibold text-primary" role="status">
            <BadgeCheck aria-hidden className="h-5 w-5 shrink-0" /> {label} verified{" "}
            <span className="font-normal text-muted">({doc.name})</span>
          </p>
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted">
            <UploadCloud aria-hidden className="h-5 w-5" /> Drop a PDF, JPG or PNG here, or choose a file.
          </p>
        )}
        <input
          ref={input}
          id={`${id}-f`}
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          className="sr-only"
          aria-labelledby={`${id}-l`}
          aria-describedby={doc.state === "bad" ? `${id}-e` : undefined}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="rounded-md border border-line px-3 py-1.5 text-sm font-medium hover:bg-bg"
        >
          {doc.state === "verified" ? "Replace file" : "Choose file"}
        </button>
        {doc.state === "bad" && (
          <p id={`${id}-e`} role="alert" className={errCls}>
            {doc.message}
          </p>
        )}
      </div>
    </div>
  );
}

const EMPTY: ListingForm = {
  make: "",
  model: "",
  year: "",
  hp: "",
  implements: [],
  cost: "",
  listerName: "",
  rcName: "",
};

export function ListingFormView() {
  const [f, setF] = useState<ListingForm>(EMPTY);
  const [aadhaar, setAadhaar] = useState<Doc>({ state: "empty" });
  const [rc, setRc] = useState<Doc>({ state: "empty" });
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [listed, setListed] = useState(false);
  const form = useRef<HTMLFormElement>(null);

  const set = (k: keyof ListingForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setF({ ...f, [k]: e.target.value });
  };
  // Only the file's name, type and size are inspected. The content is never read or sent anywhere.
  const verify = (setter: (d: Doc) => void) => (file: File) => {
    const r = checkDocument(file);
    setter(r.ok ? { state: "verified", name: file.name } : { state: "bad", message: r.message });
  };

  function submit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const errs: Partial<Record<string, string>> = { ...validateListing(f) };
    if (aadhaar.state !== "verified") errs.aadhaar = "Add your Aadhaar to verify who you are.";
    if (rc.state !== "verified") errs.rc = "Add the tractor's RC to verify ownership.";
    setErrors(errs);
    const first = Object.keys(errs)[0];
    if (first) {
      requestAnimationFrame(() =>
        form.current?.querySelector<HTMLElement>(`[data-field="${first}"]`)?.focus(),
      );
      return;
    }
    setListed(true);
  }

  if (listed) {
    return (
      <div role="status" className="rounded-xl border border-primary bg-surface p-6">
        <h2 className="flex items-center gap-2 text-xl font-bold">
          <BadgeCheck aria-hidden className="h-6 w-6 text-primary" /> Your {f.make} {f.model} is listed
        </h2>
        <p className="mt-2 text-muted">
          Both documents passed the demo check and the RC owner matches your name. Nothing was saved or sent.
        </p>
      </div>
    );
  }

  const err = (k: string) =>
    errors[k] && (
      <p id={`${k}-err`} className={errCls}>
        {errors[k]}
      </p>
    );
  const a11y = (k: string) => ({
    "data-field": k,
    "aria-invalid": !!errors[k],
    "aria-describedby": errors[k] ? `${k}-err` : undefined,
  });
  const summary = Object.keys(errors).length;
  const text = (
    k: keyof ListingForm,
    label: string,
    extra: React.InputHTMLAttributes<HTMLInputElement> = {},
    cls?: string,
  ) => (
    <div className={cls}>
      <label htmlFor={k} className={lbl}>
        {label}
      </label>
      <input id={k} className={field} value={f[k]} onChange={set(k)} {...extra} {...a11y(k)} />
      {err(k)}
    </div>
  );

  return (
    <form
      ref={form}
      onSubmit={submit}
      noValidate
      className="space-y-5 rounded-xl border border-line bg-surface p-5"
    >
      {summary > 0 && (
        <p role="alert" className={errCls}>
          Fix {summary} {summary === 1 ? "thing" : "things"} below to list your tractor.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {text("make", "Make")}
        {text("model", "Model")}
        {text("year", "Year bought or made", { inputMode: "numeric" })}
        <div>
          <label htmlFor="hp" className={lbl}>
            Horsepower tier
          </label>
          <select id="hp" className={field} value={f.hp} onChange={set("hp")} {...a11y("hp")}>
            <option value="">Choose one</option>
            {HP_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {err("hp")}
        </div>
        {text("cost", "What you paid for it (₹)", { inputMode: "numeric" }, "sm:col-span-2")}
      </div>

      <fieldset aria-describedby={errors.implements ? "implements-err" : undefined}>
        <legend className="text-sm font-medium">Implements you rent out with it</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {IMPLEMENTS.map((name, i) => (
            <label
              key={name}
              className="flex items-center gap-2 rounded-md border border-line px-3 py-1.5 text-sm"
            >
              <input
                type="checkbox"
                checked={f.implements.includes(name)}
                className="accent-[var(--primary)]"
                {...(i === 0 ? { "data-field": "implements" } : {})}
                onChange={(e) => {
                  setF({
                    ...f,
                    implements: e.target.checked
                      ? [...f.implements, name]
                      : f.implements.filter((x) => x !== name),
                  });
                }}
              />
              {name}
            </label>
          ))}
        </div>
        {err("implements")}
      </fieldset>

      <div className="space-y-4 rounded-lg border border-line p-4">
        <h2 className="text-base font-bold">Verify you own it</h2>
        <p className="text-sm text-muted">
          Demo: nothing leaves your device. We check the file type and size in your browser and discard the
          file.
        </p>
        {text("listerName", "Your full name")}
        <DocDrop label="Aadhaar" doc={aadhaar} onFile={verify(setAadhaar)} />
        {err("aadhaar")}
        <DocDrop label="Registration certificate (RC)" doc={rc} onFile={verify(setRc)} />
        {err("rc")}
        {text("rcName", "Owner name printed on the RC")}
      </div>

      <button type="submit" className="rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-fg">
        List my tractor
      </button>
    </form>
  );
}
