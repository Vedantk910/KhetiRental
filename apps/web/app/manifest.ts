import type { MetadataRoute } from "next";

/** Web app manifest (REVIEW A-10): "Add to home screen" opens the site like an app. Colours are the Mitti tokens. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "KhetiRental",
    short_name: "KhetiRental",
    description: "Rent tractors and farm machines near your village. See the full price before you book.",
    // "/" lets the language cookie decide the locale.
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    theme_color: "#223585",
    background_color: "#FAF8F4",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
