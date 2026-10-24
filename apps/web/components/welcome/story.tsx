import { useLocale, useTranslations } from "next-intl";
import type { CSSProperties, ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button";
import { config } from "@/config/site";
import { formatRupees } from "@/lib/format";
import { cn } from "@/lib/utils";

const k = (n: number) => ({ "--k": n }) as CSSProperties;
const SQUARES = Array.from({ length: 182 }, (_, i) => i);

function Section({
  id,
  tone,
  className,
  children,
  labelledBy,
}: {
  id?: string;
  tone: "bg" | "surface";
  className?: string;
  children: ReactNode;
  labelledBy: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={cn(tone === "bg" ? "bg-bg" : "bg-surface", "px-4 py-[40px] md:py-24", className)}
    >
      <div className="kr-reveal mx-auto flex max-w-[720px] flex-col gap-4 md:gap-6">{children}</div>
    </section>
  );
}

const H2 = ({ id, children }: { id: string; children: ReactNode }) => (
  <h2 id={id} className="font-display text-[28px] font-bold leading-[34px] md:text-[40px] md:leading-[48px]">
    {children}
  </h2>
);

/** S1–S7 (UI-SPEC §4.1.4). The 3D tractor (S2) is a later milestone; its slot shows the still. */
export function Story({ ownerHref }: { ownerHref: string }) {
  const t = useTranslations("story");
  const locale = useLocale();
  const rupees = (n: number) => formatRupees(n * 100, locale);
  const helpline = config.helplinePhone;
  const dialable = /^[+\d\s-]{6,}$/.test(helpline);
  const tb = useTranslations("booking");

  return (
    <div id="story">
      <Section id="how" tone="bg" labelledBy="s1">
        <p className="text-[14px] font-bold leading-5 tracking-[1px] text-warning">{t("problem")}</p>
        <H2 id="s1">{t("s1.title")}</H2>
        <div aria-hidden="true" className="grid grid-cols-[repeat(26,minmax(0,1fr))] gap-[3px] pt-2">
          {SQUARES.map((i) =>
            i % 12 === 0 ? (
              <span
                key={i}
                className="kr-fill h-[10px] rounded-[2px] bg-[rgb(var(--sarson-400))]"
                style={k(i / 12)}
              />
            ) : (
              <span key={i} className="h-[10px] rounded-[2px] bg-[rgb(var(--n-200))]" />
            ),
          )}
        </div>
        <p className="text-small text-text-muted">{t("s1.caption")}</p>
      </Section>

      <Section tone="surface" labelledBy="s2">
        <H2 id="s2">{t("s2.title")}</H2>
        {/* Slot for the 3D tractor (rich motion only, a later milestone); the still stays for everyone else. */}
        <div
          aria-hidden="true"
          className="flex h-[160px] items-center justify-center rounded-card bg-surface-muted md:h-[360px]"
        >
          <svg viewBox="0 0 170 110" className="h-4/5 max-w-full">
            <rect x="20" y="66" width="34" height="10" rx="2" fill="#483F37" />
            <rect x="54" y="48" width="86" height="30" rx="6" fill="#223585" />
            <path
              d="M88 48 V20 H124 L132 48"
              fill="#FFD45C"
              stroke="#13100D"
              strokeWidth="4"
              strokeLinejoin="round"
            />
            <rect x="92" y="18" width="5" height="18" fill="#13100D" />
            <circle cx="76" cy="80" r="26" fill="#13100D" />
            <circle cx="76" cy="80" r="10" fill="#FBC02D" />
            <circle cx="138" cy="90" r="16" fill="#13100D" />
            <circle cx="138" cy="90" r="6" fill="#FBC02D" />
          </svg>
        </div>
        <div>
          <div className="flex justify-between text-small">
            <span>{t("s2.buy")}</span>
            <strong>{rupees(640000)}</strong>
          </div>
          <div className="kr-grow mt-[6px] h-[18px] rounded-[9px] bg-[#483F37]" />
        </div>
        <div>
          <div className="flex justify-between text-small">
            <span>{t("s2.rent")}</span>
            <strong className="text-success">{rupees(2839)}</strong>
          </div>
          <div className="kr-grow mt-[6px] h-[18px] w-[12px] rounded-[9px] bg-success" />
        </div>
      </Section>

      <Section tone="bg" labelledBy="s3">
        <H2 id="s3">{t("s3.title")}</H2>
        <svg
          viewBox="0 0 358 220"
          role="img"
          aria-label={t("s3.alt")}
          className="h-auto w-full max-w-[720px] rounded-card"
        >
          <rect width="358" height="220" rx="16" fill="#F3EEE6" />
          <path
            d="M0 160 C80 140 140 180 220 150 S330 110 358 120"
            stroke="#8DA2E3"
            strokeWidth="10"
            fill="none"
            opacity="0.6"
          />
          <path d="M40 0 L120 220 M0 76 H358" stroke="#CFC4B4" strokeWidth="5" />
          <polygon
            points="179,90 199,102 199,126 179,138 159,126 159,102"
            fill="#FFD45C"
            stroke="#223585"
            strokeWidth="2"
          />
          {["179,42 199,54 199,78 179,90 159,78 159,54", "219,66 239,78 239,102 219,114 199,102 199,78"].map(
            (pts, i) => (
              <polygon
                key={pts}
                className="kr-draw"
                pathLength="1"
                style={k(i)}
                points={pts}
                fill="none"
                stroke="#7C7062"
                strokeWidth="1.5"
              />
            ),
          )}
          <circle cx="179" cy="114" r="7" fill="#223585" />
          {[
            { x: 232, y: 34, w: 58, label: rupees(710) },
            { x: 70, y: 114, w: 58, label: rupees(650) },
            { x: 250, y: 150, w: 62, label: rupees(1400) },
          ].map((p, i) => (
            <g key={p.x} className="kr-pop" style={k(i)}>
              <rect x={p.x} y={p.y} width={p.w} height="26" rx="13" fill="#13100D" />
              <text
                x={p.x + p.w / 2}
                y={p.y + 18}
                textAnchor="middle"
                fontWeight="700"
                fontSize="14"
                fill="#fff"
                style={{ fontFamily: "var(--font-ui)" }}
              >
                {p.label}
              </text>
            </g>
          ))}
        </svg>
      </Section>

      <Section tone="surface" labelledBy="s4">
        <H2 id="s4">{t("s4.title")}</H2>
        <dl className="flex flex-col gap-3 rounded-card bg-bg p-[18px] text-body">
          {[
            [
              tb("rent", { qty: new Intl.NumberFormat(`${locale}-IN`).format(4), rate: rupees(710) }),
              rupees(2840),
              false,
            ],
            [tb("diesel"), tb("included"), true],
            [`${tb("deposit")} ${tb("depositNote")}`, rupees(1950), false],
          ].map(([label, value, good], i) => (
            <div key={String(label)} className="kr-row flex justify-between gap-4" style={k(i)}>
              <dt>{label}</dt>
              <dd className={cn("shrink-0", good && "font-bold text-success")}>{value}</dd>
            </div>
          ))}
          <div
            className="kr-row flex justify-between gap-4 border-t-2 border-text pt-[10px] text-[22px] font-bold"
            style={k(3)}
          >
            <dt>{tb("youPay")}</dt>
            <dd>{rupees(2840)}</dd>
          </div>
        </dl>
      </Section>

      <Section tone="bg" labelledBy="s5">
        <H2 id="s5">{t("s5.title")}</H2>
        <ol className="grid grid-cols-3 gap-2 md:gap-4">
          {(["handover", "work", "return"] as const).map((key, i) => (
            <li
              key={key}
              className="kr-stamp flex flex-col items-center gap-2 rounded-card border-2 border-action p-3 text-center"
              style={k(i)}
            >
              <span
                aria-hidden="true"
                className="flex h-[44px] w-[44px] items-center justify-center rounded-pill bg-action font-bold text-action-on"
              >
                {new Intl.NumberFormat(`${locale}-IN`).format(i + 1)}
              </span>
              <span className="text-label">{t(`s5.${key}`)}</span>
              <span className="text-caption text-text-muted">{t(`s5.${key}Note`)}</span>
            </li>
          ))}
        </ol>
      </Section>

      <section aria-labelledby="s6" className="bg-[#223585] px-4 py-[40px] text-white md:py-24">
        <div className="kr-reveal mx-auto flex max-w-[720px] flex-col items-start gap-4 md:gap-6">
          <H2 id="s6">{t("s6.title")}</H2>
          <p className="text-body text-[#DCE3F7]">{t("s6.body")}</p>
          <ButtonLink
            href={ownerHref}
            size="lg"
            className="bg-[rgb(var(--sarson-400))] text-[rgb(var(--n-950))] hover:bg-[rgb(var(--sarson-300))] active:bg-[rgb(var(--sarson-300))]"
          >
            {t("s6.cta")}
          </ButtonLink>
        </div>
      </section>

      <Section tone="bg" labelledBy="s7">
        <H2 id="s7">{t("s7.title")}</H2>
        <div>
          {dialable ? (
            <ButtonLink href={`tel:${helpline.replace(/[^+\d]/g, "")}`} variant="outline-dark" size="lg">
              {t("s7.call", { phone: helpline })}
            </ButtonLink>
          ) : (
            <span className="inline-flex min-h-tap-lg items-center rounded-control border-2 border-text px-6 text-body font-bold">
              {t("s7.call", { phone: helpline })}
            </span>
          )}
        </div>
      </Section>
    </div>
  );
}
