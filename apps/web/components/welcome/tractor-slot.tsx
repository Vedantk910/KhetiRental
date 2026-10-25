"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { ComponentKey } from "@/config/welcome";
import { whenIdle } from "@/lib/idle";
import { useMotion } from "@/lib/use-motion";
import { cn } from "@/lib/utils";

import { PriceLine, type Part } from "./prices";
import type { TagRefs } from "./tractor-scene";

const TractorScene = dynamic(() => import("./tractor-scene"), { ssr: false });

class Boundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** True when this browser can make a WebGL context at all (the probe context is released straight away). */
function hasWebGL() {
  try {
    const gl =
      document.createElement("canvas").getContext("webgl2") ??
      document.createElement("canvas").getContext("webgl");
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    return !!gl;
  } catch {
    return false;
  }
}

/**
 * The S2 picture (UI-SPEC §4.1.5): the still tractor for everyone, replaced by the 3D one only when motion is rich,
 * WebGL works, and S2 is within a viewport. The slot keeps its size throughout, so nothing shifts.
 */
export function TractorSlot({ parts }: { parts: Part[] }) {
  const t = useTranslations("story.s2");
  const motion = useMotion();
  const tags: NonNullable<TagRefs["current"]> = useRef({}).current;
  const [chosen, setChosen] = useState<ComponentKey>();
  const host = useRef<HTMLDivElement>(null);
  const [load, setLoad] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const fail = useCallback(() => {
    setFailed(true);
  }, []);
  const show = useCallback(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    const el = host.current;
    if (motion !== "rich" || failed || !el) return;
    if (!hasWebGL()) {
      setFailed(true);
      return;
    }
    let cancel: () => void = () => undefined;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        cancel = whenIdle(() => {
          setLoad(true);
        });
      },
      { rootMargin: "100% 0px" },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancel();
      setLoad(false);
      setReady(false);
    };
  }, [motion, failed]);

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={host}
        data-tractor-slot=""
        aria-hidden="true"
        className="relative flex h-[200px] items-center justify-center overflow-hidden rounded-card bg-surface-muted md:h-[320px]"
      >
        <svg
          viewBox="0 0 170 110"
          className={cn("h-4/5 max-w-full transition-opacity", ready && "opacity-0")}
        >
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
        {load && host.current && !failed && (
          <Boundary onError={fail}>
            <div className={cn("absolute inset-0 transition-opacity", ready ? "opacity-100" : "opacity-0")}>
              <TractorScene
                host={host.current}
                tags={{ current: tags }}
                onReady={show}
                onActive={setChosen}
                onLost={fail}
              />
              {parts.map(
                (p) =>
                  (p.key === "tractor" || p.key === chosen) && (
                    <div
                      key={p.key}
                      ref={(el) => {
                        tags[p.key] = el;
                        return () => {
                          tags[p.key] = null;
                        };
                      }}
                      data-tag={p.key}
                      className={cn(
                        "pointer-events-none absolute left-0 whitespace-nowrap rounded-control border border-border-subtle bg-surface px-2 py-1 text-[11px] leading-[14px] text-text-muted md:text-caption [&:not([data-anchor])]:opacity-0",
                        p.key === "tractor" ? "top-2" : "bottom-2",
                      )}
                    >
                      <strong className="block text-text">{p.name}</strong>
                      <PriceLine part={p} />
                    </div>
                  ),
              )}
            </div>
          </Boundary>
        )}
      </div>
      <ul aria-label={t("pricesLabel")} className="grid gap-2 sm:grid-cols-2">
        {parts.map((p) => (
          <li
            key={p.key}
            data-part={p.key}
            data-active={p.key === chosen || undefined}
            className="flex flex-wrap items-baseline justify-between gap-x-3 rounded-control border border-border-subtle px-3 py-2 text-small data-[active]:border-selected-border data-[active]:bg-surface-muted"
          >
            <strong>{p.name}</strong>
            <span className="text-text-muted">
              <PriceLine part={p} />
            </span>
          </li>
        ))}
      </ul>
      <p className="text-caption text-text-subtle">{t("pricesNote")}</p>
    </div>
  );
}
