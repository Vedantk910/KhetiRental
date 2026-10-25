"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";

/** A small map with a draggable pin; tapping the map moves it too (dragging is hard on a phone). */
export default function PinMap({
  lat,
  lng,
  onMove,
}: {
  lat: number;
  lng: number;
  onMove: (lat: number, lng: number) => void;
}) {
  const t = useTranslations("list");
  const box = useRef<HTMLDivElement>(null);
  const marker = useRef<L.Marker | null>(null);
  const map = useRef<L.Map | null>(null);
  const move = useRef(onMove);
  move.current = onMove;

  useEffect(() => {
    if (!box.current) return;
    const m = L.map(box.current, { zoomControl: true, attributionControl: true }).setView([lat, lng], 13);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: "© OpenStreetMap",
    }).addTo(m);
    const icon = L.divIcon({
      className: "",
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      html: '<span style="display:block;width:28px;height:28px;border-radius:999px;background:#2c44a8;border:4px solid #fff;box-shadow:0 1px 6px rgb(0 0 0/.4)"></span>',
    });
    const mk = L.marker([lat, lng], { icon, draggable: true, keyboard: false, alt: "" }).addTo(m);
    const round = (n: number) => Math.round(n * 1e5) / 1e5;
    mk.on("dragend", () => {
      const p = mk.getLatLng();
      move.current(round(p.lat), round(p.lng));
    });
    m.on("click", (e: L.LeafletMouseEvent) => {
      mk.setLatLng(e.latlng);
      move.current(round(e.latlng.lat), round(e.latlng.lng));
    });
    marker.current = mk;
    map.current = m;
    return () => {
      m.remove();
    };
    // Created once; later position changes come from the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const mk = marker.current;
    if (!mk) return;
    const p = mk.getLatLng();
    if (Math.abs(p.lat - lat) > 1e-6 || Math.abs(p.lng - lng) > 1e-6) {
      mk.setLatLng([lat, lng]);
      map.current?.setView([lat, lng]);
    }
  }, [lat, lng]);

  return (
    <div className="h-[220px] overflow-hidden rounded-card border border-border-subtle">
      <div ref={box} role="application" aria-label={t("where")} className="h-full w-full" />
    </div>
  );
}
