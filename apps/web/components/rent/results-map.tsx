"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { formatRupees } from "@/lib/format";
import type { CardItem } from "./machine-card";

export type MapItem = CardItem & { mapLat?: number | null; mapLng?: number | null };

type Props = {
  items: MapItem[];
  center: { lat: number; lng: number } | null;
  selected: string | null;
  onSelect: (id: string) => void;
  onSearchArea: (c: { lat: number; lng: number }) => void;
};

/** Leaflet map with OSM tiles: price pills for machines, a blue dot for the farm (loaded only in map mode). */
export default function ResultsMap({ items, center, selected, onSelect, onSearchArea }: Props) {
  const t = useTranslations("results");
  const locale = useLocale();
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const [moved, setMoved] = useState(false);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;

  useEffect(() => {
    if (!box.current) return;
    const m = L.map(box.current, { zoomControl: true, attributionControl: true });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: "© OpenStreetMap",
    }).addTo(m);
    const here = center ?? { lat: 20.59, lng: 78.96 };
    m.setView([here.lat, here.lng], center ? 11 : 5);
    layer.current = L.layerGroup().addTo(m);
    if (center) {
      L.circle([center.lat, center.lng], {
        radius: 350,
        color: "#2c44a8",
        weight: 0,
        fillOpacity: 0.1,
      }).addTo(m);
      L.circleMarker([center.lat, center.lng], {
        radius: 7,
        color: "#fff",
        weight: 3,
        fillColor: "#2c44a8",
        fillOpacity: 1,
        interactive: false,
      }).addTo(m);
    }
    let user = false;
    m.on("dragstart zoomstart", () => {
      user = true;
    });
    m.on("moveend", () => {
      if (user) setMoved(true);
    });
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
    // The map is created once; markers follow the items below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const g = layer.current;
    const m = map.current;
    if (!g || !m) return;
    g.clearLayers();
    const pts: L.LatLngTuple[] = [];
    for (const it of items) {
      if (it.mapLat == null || it.mapLng == null) continue;
      const el = document.createElement("span");
      el.className = "kr-pin";
      el.textContent = formatRupees(it.priceRupees * 100, locale);
      if (it.id === selected) el.dataset.on = "";
      const icon = L.divIcon({ html: el, className: "", iconSize: [0, 0] });
      const mk = L.marker([it.mapLat, it.mapLng], { icon, alt: it.name, title: it.name, keyboard: true });
      mk.on("click", () => {
        selectRef.current(it.id);
      });
      mk.addTo(g);
      pts.push([it.mapLat, it.mapLng]);
    }
  }, [items, selected, locale]);

  return (
    <div className="relative h-[calc(100svh-220px)] min-h-[320px] overflow-hidden rounded-card border border-border-subtle lg:h-[calc(100svh-180px)]">
      <div ref={box} role="application" aria-label={t("mapLabel")} className="h-full w-full" />
      {moved && (
        <button
          type="button"
          onClick={() => {
            const c = map.current?.getCenter();
            if (c)
              onSearchArea({ lat: Math.round(c.lat * 1000) / 1000, lng: Math.round(c.lng * 1000) / 1000 });
            setMoved(false);
          }}
          className="absolute left-1/2 top-3 z-[500] min-h-tap -translate-x-1/2 rounded-pill bg-action px-6 text-label text-action-on shadow-raised"
        >
          {t("searchArea")}
        </button>
      )}
    </div>
  );
}
