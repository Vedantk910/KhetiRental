import type { Metadata } from "next";
import { H3Map } from "@/components/h3-map";

export const metadata: Metadata = { title: "H3 Spatial Sandbox" };

export default function H3SpatialPage() {
  return (
    <section className="mx-auto max-w-app px-4 py-12">
      <h1 className="text-h1 tracking-tight">Find the nearest free tractor with H3 hexagons</h1>
      <p className="mt-3 text-body font-bold">
        In plain words: a practice map that shows how we find the closest free tractor by looking at
        neighbouring hexagons.
      </p>
      <p className="mt-2 max-w-prose text-text-muted">
        The farmer&apos;s point maps to one hexagon. The dispatcher reads that hexagon and its neighbours (a
        k-ring) from Redis in a single pipeline, trims to the radius and ranks by distance, horsepower fit and
        owner reputation. Same constants as the Go matching engine. All tractors here are synthetic demo data.
      </p>
      <div className="mt-8">
        <H3Map />
      </div>
    </section>
  );
}
