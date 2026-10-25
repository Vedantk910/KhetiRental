import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");
const dev = process.env.NODE_ENV !== "production";

// REVIEW S-08. Next's RSC payload and next/font use inline <script>/<style>, so 'unsafe-inline'
// stays until nonces are wired through middleware. Dev adds eval (React Refresh) and the HMR socket.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  // OpenStreetMap tiles for the results map (UI-SPEC §4.5.4).
  "img-src 'self' data: blob: https://tile.openstreetmap.org",
  "font-src 'self'",
  `connect-src 'self'${dev ? " ws: wss:" : ""}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  // Real Google sign-in redirects there after the sign-in form posts (D-05).
  "form-action 'self' https://accounts.google.com",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  // Microphone (speak your village) and location (find me) are used from M4; nothing else.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(self), geolocation=(self), payment=(), usb=()",
  },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

// Pre-rebuild URLs (UI-SPEC §4.19, D-16): the demo and dossier pages moved under /about/engineering and the
// old marketplace demo is superseded by /rent. 308, with or without a locale prefix. Destinations are fixed
// paths, never taken from the request, so nothing here can be turned into an open redirect.
const MOVED = {
  "/dossier/:old(.*-systems)": "/about/engineering/systems",
  "/dossier/:old(.*-product)": "/about/engineering/product",
  "/dossier": "/about/engineering",
  "/architecture/h3-spatial": "/about/engineering/h3-spatial",
  "/architecture": "/about/engineering/architecture",
  "/escrow": "/about/engineering/escrow",
  "/pricing": "/about/engineering/pricing",
  "/marketplace": "/rent",
  "/marketplace/search": "/rent",
  "/marketplace/listing": "/owner/machines/new",
};
const moved = Object.entries(MOVED).flatMap(([from, to]) => [
  { source: `/:locale(en|hi|mr)${from}`, destination: `/:locale${to}`, permanent: true },
  { source: from, destination: to, permanent: true },
]);

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  poweredByHeader: false,
  async redirects() {
    return moved;
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default withNextIntl(config);
