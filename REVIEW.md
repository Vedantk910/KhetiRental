# KhetiRental: final review and build brief

> **Status: FINAL (24 October 2026).** This file has two parts:
> - **Part 0**, right below: the decisions made after the review, plus instructions for whoever builds them (Claude Code).
> - **The full review**, everything after Part 0, with every finding, its location and its fix.
>
> **Where Part 0 and the review disagree, Part 0 wins.** Superseded passages in the review are marked **[UPDATED]** or **[SUPERSEDED]**.
>
> **Companion files:**
> - `UI-SPEC.md`: every page, element, button, state, string and animation of the agreed UI.
> - `design/*.dc.html`: visual mockups of the agreed screens (reference only; see UI-SPEC §0).

---

# Part 0: Final decisions and build brief

## 0.1 Instructions for Claude Code (read before changing anything)

1. **Read in this order:** Part 0 → `UI-SPEC.md` (all of it) → the review findings referenced by the milestone you are working on.
2. **Work milestone by milestone** (Phase 3 §8, rewritten below as M0–M8). Don't start a milestone before the previous one passes its checks.
3. **After each milestone,** run `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` and `npm run test:e2e` in the web app, and fix everything they report. Then make one commit per milestone with a conventional message, e.g. `feat(web): M3 welcome page and login`. **Do not push** unless the owner asks.
4. **This is a website, not a native app.** Build one responsive Next.js site, mobile-first, that works from 360 px to 1440 px. Wherever the review says "app screen", it means a page of this website.
5. **Every external service must have a local mock** that works with no keys: Google sign-in, SMS OTP, payments, notifications and map tiles. Real keys only switch the mock off. The project must run with `docker compose up` plus `npm run dev` and nothing else.
6. **No real money, no real KYC.** Payments are a simulated step (decision D-08). Aadhaar is never collected (F-16).
7. **Every user-visible string goes in the message files** (`messages/en.json`, `hi.json`, `mr.json`). No hard-coded copy in components. Hindi and Marathi strings come from `UI-SPEC.md` §11. Where a string is missing there, add the English text and mark the Hindi and Marathi values with a `"TODO-translate"` prefix. Never machine-translate silently.
8. **Don't delete the Go services, the PRD, the ADRs or the audit.** Move them to `showcase/` (M0); they are portfolio material. The only changes allowed in them are the security fixes S-01, S-05 and S-06, and only if the services stay runnable.
9. **If something in the review and UI-SPEC still conflicts, UI-SPEC wins for look and behaviour, and the review wins for correctness and security.** Note any conflict you resolve in the commit message.
10. **Ask the owner before:** adding a paid service, changing the colour palette or fonts, removing a page listed in UI-SPEC, or changing the booking or payment rules in D-06 to D-08.

## 0.2 Decisions (final)

| ID | Topic | Decision | Replaces or updates |
|---|---|---|---|
| D-01 | Product form | **A responsive website only** (Next.js App Router), mobile-first, 360–1440 px. No native app for now. Making it installable as a PWA is optional and comes later. | All "app" wording; A-10 becomes optional |
| D-02 | Visual design | **"Mitti" design system approved**: warm earth neutrals, deep indigo `#223585` for actions, mustard `#FFD45C`/`#FBC02D` for highlights and selected states. Fonts: Mukta for the UI, Baloo 2 for display text. Tokens are in Phase 3 §1 and UI-SPEC §2. | V-01 to V-12 |
| D-03 | Languages | **Marathi, Hindi and English, switchable on every page** with a three-way switch (मराठी · हिंदी · English). Set by URL prefix (`/mr`, `/hi`, `/en`) and remembered in a cookie. First visit uses the browser language if it is mr or hi, otherwise English. | A-07 |
| D-04 | Start flow | **Welcome page (public) → Log in / Sign up → the site.** Every renter and owner page needs a login. Public pages: welcome (with the story), login, forgot password, how we price, help, terms, privacy, 404, and "How we built it". | F-01, Phase 3 §2–3 |
| D-05 | Login methods | **Continue with Google**, **mobile number + 6-digit OTP**, or **email + password**. Sign-up also asks for full name and role ("Rent machines" or "List my machines"); a user can turn on the other role later in Settings. | S-02 |
| D-06 | Booking model | Each machine's owner picks its price unit: **per hour, per acre or per day**. A renter picks a **date range plus a slot** (Morning · Afternoon · Full day), with an optional field size or hours estimate. Prices show in whole rupees. | F-06, F-14, F-26 |
| D-07 | Availability | Search and detail pages only offer machines that are **free for the chosen dates**. Overlaps are blocked in the database with an `EXCLUDE` constraint. | F-07, F-08, F-09 |
| D-08 | Payments | **No real payment gateway** (no Razorpay or similar). Booking step 3 offers **UPI, Debit/credit card, Net banking or Pay after work**. The online methods run a **simulated payment** (a mock screen, ~1.5 s, then success). There is a dev-only "simulate failure" switch. The payment is stored as `status = 'paid_demo'` or `'pay_later'`. A banner on the step reads "Demo payment: no real money moves." | F-15, §5 #15, §7 Payments |
| D-09 | 3D tractor | **Kept.** It appears in the "buy vs rent" story section, only in rich-motion mode (desktop and fast phones), lazy-loaded, with a still fallback. | Phase 3 §2 |
| D-10 | Welcome page | Full-screen **live field scene**: the tractor ploughs the field in rounds (right along row 1, turn, left along row 2, turn back) with smooth easing and no jumps. On top: a short two-word heading, a one-line tagline, and three small pill buttons near the top (Log in · Sign up · How it works). Below them, three **floating counters** that count up from 0: **86%** small farms · **1.08** hectare avg. farm · **47%** mechanised, with a tiny source line. The story sections follow below. Exact spec: UI-SPEC §4.1. | Phase 3 §2 |
| D-11 | Notifications | **In-app notifications plus a server log** (a mock). SMS and WhatsApp stay optional and behind an interface. "Call" opens `tel:`; "WhatsApp" opens `https://wa.me/<number>` (owner's number shown only after the booking is confirmed). | F-10, F-19 |
| D-12 | KYC | No Aadhaar. Owners upload an **RC photo**, which shows "Uploaded – pending review". A demo admin page can mark it "RC checked". | F-16, F-17 |
| D-13 | Data | **Postgres 16 + PostGIS** through Drizzle ORM, with Docker Compose locally (Neon or Supabase in production). Seed **sample data** for Latur and Pune (Maharashtra) and Jaipur (Rajasthan), labelled "Sample" in the UI. | F-08, F-09, Phase 3 §4 |
| D-14 | Maps | Results are a list first, with a Map toggle using **Leaflet + OpenStreetMap tiles**. Leaflet is lazy-loaded. | V-14 |
| D-15 | Places | PIN code and village search from a **seeded subset of the India Post PIN directory** (the three sample districts) plus browser geolocation. | F-02 |
| D-16 | Portfolio material | The dossiers, H3 sandbox, escrow simulator and pricing maths move to **`/about/engineering`**, reached from the footer link "How we built it". The "Resume bullets" and "Interview defence" sections are **removed from the public site** (kept in `docs/`). | F-01, AI-11 |
| D-17 | Go services | Move to `showcase/go/` unchanged, apart from the S-01, S-05 and S-06 fixes. Not on the website's request path. | C-08, F-31 |

## 0.3 What changed in the review because of these decisions

Each passage below is also marked **[UPDATED]** or **[SUPERSEDED]** where it appears in the review.

- **F-15 (payments):** the Razorpay and settlement-hold recommendation is replaced by D-08 (simulated payment).
- **S-02 (auth):** phone OTP only → Google + mobile OTP + email/password (D-05). Sessions and rate limits stay as written.
- **A-10 (offline):** optional for now (D-01). Do it after M8 if time allows.
- **Phase 3 §2 (landing page):** the welcome page and live field in D-10 / UI-SPEC §4.1 come first. The seven story scenes stay as the sections below it. The separate "Scene 0" language screen is dropped; the switch lives in the welcome page header.
- **Phase 3 §3.4 (booking):** step 3 is now "How do you want to pay?" (D-08). Phone OTP happens at login, not during booking.
- **Phase 3 §5 (upgrades):** #4 is the three login methods; #15 is the simulated payment step; #16 (PWA) is optional.
- **Phase 3 §7 (tools):** the Payments row is replaced by "none, mock only". Auth.js is added. SMS and WhatsApp providers are optional. Serwist is optional.
- **Phase 3 §8 (rollout):** replaced by build milestones M0–M8.
- **Phase 4 (Top 15):** #7 and #15 updated.

## 0.4 Global definition of done

Every item must be true before the work is called finished:

- [ ] Every page in UI-SPEC §3 exists and matches its spec at **360, 390, 768, 1024 and 1440 px**, with no horizontal scroll at any width.
- [ ] All three languages work on every page. Switching keeps the user on the same page and keeps their form input.
- [ ] Every tappable element is at least **48 × 48 px**, and every primary action button is **56 px** tall on phones.
- [ ] Contrast: body text ≥ 7:1, all text ≥ 4.5:1, control borders ≥ 3:1. **axe** reports zero violations on every page.
- [ ] `prefers-reduced-motion: reduce` turns off every animation; the content stays complete and the counters show their final values.
- [ ] Lighthouse mobile (simulated Slow 4G, 4× CPU): Performance ≥ 85 on app pages, ≥ 75 on the welcome page. LCP ≤ 2.5 s on app pages, ≤ 3.5 s on welcome. CLS < 0.05.
- [ ] JS budget: ≤ 120 KB gzipped first load per app page. Welcome page ≤ 90 KB in lite mode, excluding the lazy 3D chunk.
- [ ] Double booking is impossible: a concurrent test with 20 parallel requests creates exactly 1 booking (DB constraint).
- [ ] Every write endpoint needs a session, and owner-only endpoints check ownership.
- [ ] Unit tests, plus Playwright e2e tests for: welcome → login (each method, mocked) → search → book (each payment method) → my bookings → cancel; owner: list a machine → accept a request.
- [ ] No `TODO-translate` strings are left in Hindi or Marathi, or a list of the remaining ones is handed to the owner.
- [ ] The README explains how to run it locally in under 5 commands.

---

# The full review (with updates marked)

## Review findings (original audit, 24 October 2026)

Reviewed on 24 October 2026, at commit `8bb4e69` (38 commits). Nothing in the repository was changed; this file is the only addition.

The review was written by one reviewer working through five roles: staff engineer, product designer, UX researcher, content designer and "AI-slop" detector. Every finding gives a file path and line number from the commit above. Line numbers will drift once you start editing, so fix from the top of each file down, or search for the quoted code.

---

## Read this first: the one problem behind most of the others

This repository holds two different products, and the farmer is losing to the portfolio.

1. **An engineering portfolio.** It has three Go services (H3 matching, Redlock with fencing tokens, a saga with an outbox, a CRDT telemetry gateway), four ADRs, a PRD, an audit, k6 load tests, a "Zero-Leak Dual-Track Ownership Matrix", resume bullets and an "Interview defence" section. The work is careful, the tests pass, and the Go code is among the best-written parts of the repository.
2. **A farmer-facing rental app.** It is three screens (`/marketplace`, `/marketplace/search`, `/marketplace/listing`) running on an in-memory `Map`, with 60 synthetic tractors around Jaipur, six hard-coded villages, a 4 km search limit, no login, no payment, no "my bookings" page, no owner dashboard, and no Hindi or Marathi.

Everything a farmer sees is shaped by the first product. The navigation reads "H3 Spatial Sandbox · Pricing Engine · 3-Stage Escrow · Architecture & ADRs · Track B: Vedant (Product) · Track A: Tarun (Systems)". The home page headline is "booked in milliseconds". The four largest numbers on the home page are a k6 user count, a p99 latency, a test count and an unvalidated savings figure. The browser tab says "Agritech Sharing & Architecture Showcase".

None of the Go services are on the path a farmer's request takes. The portal never calls them: `/api/machines/near` is a TypeScript port running over a seeded array, and `/api/bookings` writes to `globalThis.__kheti_market`. The booking orchestrator has no `main` package (`services/booking-orchestrator/cmd/orchestrator/` is an empty folder). There are no Dockerfiles, and `deploy/k8s/` is empty.

**The single highest-impact change:** split the repository into a farmer product and a portfolio. Then rebuild the farmer product around one Postgres database with PostGIS and an exclusion constraint. That one constraint prevents double bookings without Redlock, Kafka or a saga. Details are in F-01, F-08, F-09 and Phase 3 §4.

This is not a "rewrite it all" verdict. A lot here is genuinely good and should be kept (see "What is already good" below). But the owner's dissatisfaction is aimed at the right thing. The site looks and reads like a careful engineering demo because that is what it is.

---

## What is already good (keep these)

Being brutal includes saying what works, so you don't throw it away by accident.

- **Code health is high for a vibe-coded project.** ESLint is clean, `tsc --noEmit` is clean, all 202 Vitest tests pass, and `gofmt` and `go vet` are clean in all three services. Every Go test that needs only Redis passes with `-race`.
- **The booking modal does the hard parts right.** It has a real focus trap (`booking-modal.tsx:32-58`), returns focus to the opener, and sends an idempotency key per modal (`booking-modal.tsx:20`). A double-click sent exactly one POST in testing.
- **Text contrast is strong.** Body text on the background is 17.06:1, muted text 7.24:1, and the primary button 5.48:1. Every text pair passes WCAG AA, and most pass AAA. The *borders* fail (see V-02).
- **The copy is honest.** It labels assumptions as assumptions and avoids hype. The tone needs simplifying for farmers, but the instinct is right.
- **Prices are worked out in integer paise, and the escrow ledger is conserved.** That is the correct engineering foundation for money.
- **The layout never scrolls sideways** at 375, 768, 1024, 1280 or 1440 px. I measured all eleven routes.

---

## Phase 0: what I explored and ran

### Stack and layout

| Part | Tech | Entry point | Runs in production? |
|---|---|---|---|
| `services/client-portal` | Next.js 15.5.28 (App Router), React 19.1, TypeScript 5.9 strict, Tailwind 3.4, lucide-react, recharts 3, h3-js 4.5, Vitest 5, Playwright 1.64 | `app/layout.tsx` | Yes. It is the only part that is deployed (to Vercel, via `.github/workflows/deploy-portal.yml`) |
| `services/matching-engine` | Go 1.22, uber/h3-go v4, go-redis v9 | `cmd/match-service/main.go` | No. The portal doesn't call it |
| `services/booking-orchestrator` | Go 1.22, pgx v5, go-redis v9 | **none** (`cmd/orchestrator/` is empty) | No. It is a library with no binary |
| `services/telemetry-gateway` | Go 1.22, gorilla/websocket | `cmd/telemetry-gateway/main.go` | No |
| `deploy/sql` | Postgres 17 migrations 001–005 | `test_migrations.sh` | Only in tests |
| `analytics/` | Python 3.12 pricing model and KPIs | `pricing.py`, `kpis.py` | Offline |
| `contracts/` | OpenAPI 3.1, event JSON schemas, escrow spec | none | Documentation |
| `.claude/`, `.scratch/`, `graphify-out/` | AI-agent skills, hooks, an e2e harness for the skills, a code graph | none | Tooling leftovers (D-05) |

Portal routes: `/`, `/marketplace`, `/marketplace/search`, `/marketplace/listing`, `/pricing`, `/escrow`, `/architecture`, `/architecture/h3-spatial`, `/dossier/track-a-systems`, `/dossier/track-b-product`, and the APIs `/api/machines/near`, `/api/bookings` and `/api/escrow/[booking_id]/settle`.

### What I ran, and the results

Your computer's shell wasn't ready when I started, so I copied the repository into a cloud sandbox and ran everything there. Results:

| Check | Result |
|---|---|
| `npm ci` | OK (488 packages; warning that eslint 9.39.5 is deprecated) |
| `npm run lint` | **Clean** |
| `npm run typecheck` | **Clean** |
| `npx vitest run` | **22 files, 202 tests, all pass** (23.3 s; jsdom is re-created 22 times, which is 55 % of the run) |
| `npm run build` | Passes. The sandbox can't reach Google Fonts, so I swapped `next/font/google` Figtree for the same Figtree woff2 served locally, in my copy only. The route sizes are in P-01 |
| Playwright suite (`npm run test:e2e`) | 2 of 27 ran and passed (the two API tests). The other 25 couldn't start because the sandbox's Chromium build doesn't match the one `@playwright/test@1.64.1` pins. That is an environment problem, not a bug in your code. Your own last run on disk (`test-results/.last-run.json`) says `"status": "passed"` |
| Go `gofmt -l`, `go vet ./...` (all 3 services) | Clean |
| Go `go test -race ./...` with Redis on :6390 | All pass. 8 Postgres integration tests were skipped because the sandbox has no Postgres |
| `python3 -m unittest discover -s analytics` | 12 tests pass |
| `python3 docs/check_docs.py` | Passes on your computer |
| Live probes against the Go matching engine (built and run against Redis) | Found S-01, F-33 and S-05 (below) |
| Second pass: long text, Back button, refresh during booking, API limits, 768 px tablet layout, response headers, pricing-page errors | Found F-37, F-38, F-39, F-40, P-06, T-07 and V-22 |
| Secret scan: every tracked file plus the full git history (all branches) for common key formats | Nothing found (see "Security checks that passed") |

### Browser testing

I used Playwright with Chromium in the sandbox:

- Full-page screenshots of all 11 routes (including a 404) at 1440, 768 and 375 px in light mode, plus 375 px in dark mode: 44 screenshots.
- Click-through scripts for the renter flow: location denied, invalid dates, booking, a double-click on "Authorise escrow", re-booking the same tractor, a reload, going offline, every village, and odd inputs.
- The owner flow: empty submit, documents missing, a Devanagari name, a fake "Aadhaar" file, a successful listing.
- The navigation at 1024 and 1280 px.
- **Slow 3G (400 ms round trip, 400 kbps) with the CPU slowed 4×, cold cache**, for six routes.

What I could not test: a real budget Android phone, real Hindi and Marathi input methods, real GPS. Geolocation was tested as denied only.

---

## Phase 0: inventory

### Screens and flows

| Screen | Route | Audience it actually serves |
|---|---|---|
| Home ("evidence ledger") | `/` | Recruiters and judges |
| Marketplace chooser | `/marketplace` | Farmers and owners |
| Search and results (no map) | `/marketplace/search` | Farmers |
| Booking modal | inside search | Farmers |
| Listing form with "KYC" | `/marketplace/listing` | Owners |
| Pricing calculator with a Greek-letter formula | `/pricing` | Engineers and investors |
| Escrow simulator | `/escrow` | Engineers |
| Architecture and ADR list | `/architecture` | Engineers |
| H3 sandbox (an SVG of hexagons, not a map) | `/architecture/h3-spatial` | Engineers |
| Systems dossier with resume bullets | `/dossier/track-a-systems` | Recruiters |
| Product dossier with resume bullets and "Interview defence" | `/dossier/track-b-product` | Recruiters |
| Not found | any unknown route | Nobody. It is the default Next.js 404 with the home page's title |

**Renter flow, as it exists:** `/` → "Try the marketplace" → `/marketplace` → "Find a tractor" → search (pick a job, dates, acres, one of six villages) → "Book" → modal (hours) → "Authorise escrow" → "Escrow authorised. Booking bk_3a51e35e-d4fe-4878-bae3-d5a614634d1f." → "Done" → **dead end**. There is no way to see the booking again, cancel it, contact the owner or pay.

**Owner flow, as it exists:** `/marketplace` → "List my tractor" → form → "Your Mahindra 575 DI is listed … Nothing was saved or sent." → **dead end**. The tractor never appears in search (verified). There are no requests, no calendar and no earnings.

**Flows that are missing entirely:** sign-up and login, OTP, my bookings, booking detail, cancel and reschedule, rate and review, contacting the owner, the owner seeing and accepting requests, an owner calendar, editing a listing, owner photos, payouts, disputes, help and support, and switching language.

### Components

`Navbar` (`components/navbar.tsx`), `MarketplaceSearch` and `ResultCard` (`_components/search.tsx`), `BookingModal` and `Row` (`_components/booking-modal.tsx`), `ListingFormView` and `DocDrop` (`_components/listing-form.tsx`), `PricingCalculator` and `RateCard` (`components/pricing-calculator.tsx`), `EscrowStateMachine` and `Action` (`components/escrow-state-machine.tsx`), `H3Map` and `StatusBadge` (`components/h3-map.tsx`), `LatencyChart` (`dossier/track-a-systems/latency-chart.tsx`), and the inline `H3Diagram`, `FencingDiagram` and `SagaDiagram` (`dossier/track-a-systems/page.tsx`).

There is **no shared Button, Input, Select, Card, Badge or Toast component.** Every screen re-types its own Tailwind recipes.

### Colors used

| Hex | Token | Tailwind stock name | Where |
|---|---|---|---|
| `#047857` | `--primary` (light) | emerald-700 | Every primary button, active nav link, logo icon, evidence numbers, `--viz-1` |
| `#ffffff` | `--primary-fg`, `--surface` (light) | white | Button text, cards |
| `#78350f` | `--soil` (light) | amber-900 | "Demo mode" badge, dispute and warning states, pricing error |
| `#f8fafc` | `--bg` (light) | slate-50 | Page background |
| `#0f172a` | `--fg` (light) | slate-900 | Body text |
| `#475569` | `--muted` (light) | slate-600 | Secondary text, broker bar in the chart |
| `#cbd5e1` | `--line` (light) | slate-300 | **Every border, including input borders** |
| `#1d4ed8` | `--viz-2` (light) | blue-700 | Diesel segment, "dispatched" on the H3 map |
| `#b45309` | `--viz-3` (light) | amber-700 | Wear segment, "in use" |
| `#34d399` / `#04241a` | primary / primary-fg (dark) | emerald-400 / custom | Dark buttons |
| `#f59e0b` | soil (dark) | amber-500 | Dark badges |
| `#0b0f17` / `#111827` | bg / surface (dark) | custom / gray-900 | Dark backgrounds |
| `#f1f5f9` / `#94a3b8` / `#1e293b` | fg / muted / line (dark) | slate-100 / 400 / 800 | Dark text and borders |
| `#059669`, `#3b82f6`, `#d97706` | viz 1–3 (dark) | emerald-600, blue-500, amber-600 | Dark charts |
| `text-red-700` (`#b91c1c`), `text-red-400` (`#f87171`) | **no token** | red-700 / red-400 | Six error messages (V-04) |
| `bg-black/60` | **no token** | black | Modal overlay |
| `#fff` literal | **no token** | white | H3 map letters, diagram labels |

Every single color is a stock Tailwind swatch (V-06).

### Typography

- **Font families:** Figtree (Latin subset only, through `next/font/google`, `layout.tsx:6`) and `ui-monospace` for `<code>`.
- **Sizes (Tailwind class → px/line height, number of uses):** `text-xs` 12/16 (15), `text-sm` 14/20 (**76**), `text-base` 16/24 (3), `text-lg` 18/28 (7), `text-xl` 20/28 (4), `text-2xl` 24/32 (16), `text-3xl` 30/36 (7), `text-4xl` 36/40 (5), `text-5xl` 48/48 (2). Nine sizes in total.
- **Weights:** 400 (`font-normal`, 6, plus the default), 500 (`font-medium`, 46), 600 (`font-semibold`, 48), 700 (`font-bold`, 26). All four are used, often side by side in a single card.
- **Letter spacing:** `tracking-tight` (−0.025em) on 11 headings. **Line height:** Tailwind defaults, plus `leading-tight` on the home H1 and `leading-5` on the pipeline `<pre>`.
- **Measured at 375 px on `/marketplace/search`:** the most common text size on the page is **14 px** (52 text nodes). Form inputs render at 14 px because they sit inside `<label class="text-sm">`.

### Spacing (Tailwind steps × 4 px)

Values used: 2, 4, 6, 8, 10, 12, 16, 20, 24, 28, 32, 40, 48, 56 px. That is **fourteen distinct steps**. Off-system values: 6 px (`*-1.5`, 5 uses), 10 px (`*-2.5`, 7), 20 px (`*-5`, 32), 28 px (`mt-7`, 1) and 56 px (`py-14`/`mt-14`, 3).

**Page containers:** `max-w-3xl` (listing), `max-w-4xl` (marketplace), `max-w-5xl` (home, architecture, dossiers), `max-w-7xl` (search, pricing, escrow, H3) and `max-w-screen-2xl` (nav). That is five widths. At 1440 px the H1's left edge sits at x = 224, 288, 96, 352 or 96 px depending on the page.

**Vertical page padding:** `py-14` (home), `py-12` (marketplace, architecture, dossiers) and `py-10` (everything else).

### Radius, borders, shadows

- **Radius:** `rounded` 4 px (1 use), `rounded-sm` 2 px (1), `rounded-md` 6 px (16), `rounded-lg` 8 px (14), `rounded-xl` 12 px (19), `rounded-2xl` 16 px (2), `rounded-t-2xl` (modal on mobile), `rounded-full` (badge). Some cards have no radius at all (home track cards, ADR list, dossier articles).
- **Borders:** 1 px `border-line` almost everywhere; `border-2` (RateCard, H3 results, file drop); `border-l-4` (home track cards, resume bullets); `border-dashed` on both the price breakdown and the file drop zone.
- **Shadows:** exactly one, `shadow-xl` on the booking modal.

### Breakpoints

Tailwind defaults `sm` 640 (15 uses), `md` 768 (4), `lg` 1024 (4), `xl` 1280 (1), plus a custom **`nav: 1360px`** (`tailwind.config.ts:16`, 4 uses).


---

# Phase 1: The audit

Severity scale: **Critical** means it blocks real use or loses money or data. **High** means a core flow is wrong or a major group of users is excluded. **Medium** means a visible defect or debt that will bite soon. **Low** means polish.

## 1A. Functionality and correctness

### F-01 [Critical] [Product scope / information architecture]
**Where:** `components/navbar.tsx:9-19` (the top nav on every page); `app/page.tsx:4-19, 42-79` (home); `app/layout.tsx:8-10` (title and meta); `app/dossier/track-a-systems/page.tsx:160-166` ("Resume bullets"); `app/dossier/track-b-product/page.tsx:151-169` ("Resume bullets", "Interview defence").
**Current:**
```ts
const PAGES = [
  { label: "Marketplace Demo", href: "/marketplace" },
  { label: "H3 Spatial Sandbox", href: "/architecture/h3-spatial" },
  { label: "Pricing Engine", href: "/pricing" },
  { label: "3-Stage Escrow", href: "/escrow" },
  { label: "Architecture & ADRs", href: "/architecture" },
];
const TRACKS = [
  { label: "Track B: Vedant (Product)", href: "/dossier/track-b-product" },
  { label: "Track A: Tarun (Systems)", href: "/dossier/track-a-systems" },
];
```
`title = "KhetiRental v2.0 | Agritech Sharing & Architecture Showcase"`
**Problem:** *Farmer:* 6 of the 7 links mean nothing to them. The one useful link is labelled "Demo". *Owner:* there is no "List your tractor" in the nav at all. *Recruiter:* fine, but recruiters are not your users. One site cannot speak to both audiences, and the nav is where that shows first. It also forces the custom 1360 px nav breakpoint (V-18).
**Fix:** Two route groups, or two apps.
```
app/(product)/            ← farmer + owner app, default at /
  page.tsx                ← story landing (Phase 3 §2)
  rent/                   ← search, results, detail, booking
  bookings/               ← my bookings
  owner/                  ← listings, requests, earnings
app/(showcase)/about/engineering/...   ← H3 sandbox, escrow sim, pricing maths, dossiers
```
Product nav (mobile bottom bar, desktop top bar): **Rent · My bookings · List your machine · [हिंदी ▾]**. Move every dossier, sandbox and "Track" link into a single footer link, "How we built it". Change the title to `"KhetiRental – Rent a tractor near your village"`. Delete "Resume bullets" and "Interview defence" from any public route. Put them in a private `docs/` folder or a separate portfolio site.
**Effort:** M

### F-02 [Critical] [Location search: no manual fallback outside six villages]
**Where:** `lib/marketplace-places.ts:4-11`; `app/marketplace/_components/search.tsx:19, 88-98, 49-57` (the "Village" select and "Use my location", left column of the search form).
**Current:**
```ts
export const VILLAGES: Place[] = [
  { name: "Sanganer", ... }, { name: "Jagatpura", ... }, { name: "Muhana", ... },
  { name: "Goner", ... }, { name: "Pratap Nagar", ... }, { name: "Sitapura", ... },
];
```
Location denied: "We could not get your location. Pick a village instead." (verified)
**Problem:** *Farmer in Maharashtra or anywhere else in India:* the only fallback is a dropdown of six Jaipur-district localities. Several of them are city neighbourhoods (Pratap Nagar, Jagatpura, Sitapura is an industrial area). If location is allowed, they get "My location" and "No tractors within 4 km. Try another village.", which tells them to pick a Rajasthan village. If location is denied (common on shared phones and for privacy-wary users), they are stuck.
**Fix:** Make PIN code first, with village search and GPS as alternatives.
```tsx
<label>Your PIN code or village
  <input inputMode="numeric" autoComplete="postal-code" placeholder="413512 or Latur" … />
</label>
<button type="button">📍 Use my phone's location</button>
```
Back it with the India Post PIN directory (data.gov.in "All India Pincode Directory", about 155k rows with district, state and an office lat/lng) loaded into Postgres. For villages, use LGD (Local Government Directory) village codes. Remember the last place in `localStorage` (wrapped in try/catch) and in the user profile. Once you have data outside Jaipur, show "We are not in your district yet – leave your number and we'll call when we are" instead of an empty list.
**Effort:** M

### F-03 [Critical] [Search radius capped at 4 km and not adjustable]
**Where:** `lib/marketplace-places.ts:29-31`; `services/matching-engine/internal/store/store.go:111-121`; `app/api/machines/near/route.ts:20-26`; results header "Tractors near Sanganer **within 4 km**" (top of the results column).
**Current:**
```ts
// At H3 Res 8 the matching engine reads at most a k=5 ring (~4 km), so asking
// for a wider radius returns nothing more
export const SEARCH_RADIUS_KM = 4;
```
```go
kByRadius := int(radius/edgeKm) + 1
if kByRadius > 5 { kByRadius = 5 }
```
**Problem:** *Farmer:* 4 km is roughly the next village. In sparse districts, and at peak sowing or harvest when nearby machines are taken, the right answer is often 10–25 km away. Your own demo shows it: Sitapura returns 3 tractors, Sanganer 6. *Developer:* the API accepts `radius_km=50` and quietly returns at most about 4 km of results with HTTP 200 (verified). The contract lies. The cap exists only because k is clamped to 5 at Res 8, which is an implementation detail leaking into the product.
**Fix:** Product: radius chips **5 km · 10 km · 25 km**, defaulting to 10. When the result count is under 3, show "Only 2 nearby. Show machines up to 25 km away?" Engineering, short term: choose the resolution from the radius (`res = r <= 4 ? 8 : r <= 10 ? 7 : 6`, where Res 7 with k = 5 covers about 10 km and Res 6 with k = 5 about 28 km) and index each machine at Res 6, 7 and 8. Long term (recommended): PostGIS.
```sql
SELECT id, ST_Distance(location, $1::geography)/1000 AS km
FROM machines
WHERE ST_DWithin(location, $1::geography, $2 * 1000) AND active
ORDER BY location <-> $1::geography
LIMIT 50;   -- GiST index on location
```
**Effort:** S (chips plus resolution switch) / M (PostGIS)

### F-04 [High] [Result order is an opaque score; the user can't sort]
**Where:** `lib/h3-dispatch.ts:36-46`, `services/matching-engine/internal/ranker/ranker.go:62-80`; the results grid on `/marketplace/search`.
**Current:** The order seen for Sanganer is 0.9 km, **2.0 km (2.2★)**, 1.3 km, 3.4 km, 3.7 km, 3.8 km. Score = 0.5·e^(−d/2) + 0.3·hpScore + 0.2·reputation. There is no sort control.
**Problem:** *Farmer:* the second card is further away *and* worse rated than the third, with no visible reason. Farmers compare on distance, price and "is it free on my dates". The score bundles horsepower fit and a fake rating into the order and shows none of it.
**Fix:** A segmented control above the results, **Nearest · Cheapest · Best rated**, defaulting to *Nearest*. Within each, sort only machines that are **free on the chosen dates** (F-07) and put busy ones last under a "Busy on your dates" divider. Keep the score internal, for a future "Recommended" tab only once there is real reputation data.
**Effort:** S

### F-05 [Medium] [Horsepower match formula caps HP influence at half its weight; HP is never sent]
**Where:** `services/matching-engine/internal/ranker/ranker.go:67-68`; `lib/h3-dispatch.ts:40`; `app/api/machines/near/route.ts:22` (`hp` defaults to 45); `store.go:92`.
**Current:** `hpScore := 1.0 / (1.0 + math.Exp(hpGap/3.0))`. At a perfect match (gap 0) this is **0.5**, not 1, so the "0.3 HP weight" can contribute at most 0.15. The farmer never picks HP (`nearUrl` sends no `hp`), so every search ranks as if the farmer asked for 45 HP. The 75 HP 4WD is penalised for a farmer who needs it for black-cotton soil.
**Problem:** *Developer:* the documented weights (`DefaultWeights{0.5,0.3,0.2}`) are not the effective weights. *Farmer:* ranking quietly favours 45 HP machines.
**Fix:** `hpScore := math.Exp(-hpGap / 15.0)` (1.0 at a match, 0.51 at a 10 HP gap). Only apply it when the user picked an HP or a job that implies one; otherwise drop the term and renormalise the weights. Show HP as a filter chip ("Any · 35+ · 45+ · 55+ HP").
**Effort:** S

### F-06 [Critical] [Booking ignores the "To" date; every booking is "start date, 6 am, N hours"]
**Where:** `app/marketplace/_components/search.tsx:71-79, 125`; `app/marketplace/_components/booking-modal.tsx:70, 126`.
**Current:**
```tsx
{booking && <BookingModal machine={booking} activity={activity} hours={hours} startDate={from} … />}
…
start_at: `${startDate}T06:00:00+05:30`,
```
Verified: I picked 2 Nov → 4 Nov, and the modal said "Starts 2026-11-02 at 6 am", "Rental, 4 h".
**Problem:** *Small farmer persona ("tractor for 2 days next week"):* the form asks for dates and then throws away the end date. The booking is 4 hours on day 1. The owner would expect them for 4 hours and they would turn up on day 2 to an empty shed. This is the core promise of the product and it is silently wrong.
**Fix:** Pick one booking model and make the UI say it. **Recommended:** a booking covers one or more *days* (or half-days) for a date range, with an optional estimated hours or acres used for the price estimate. Send `start_at` and `end_at`:
```ts
body: JSON.stringify({ machine_id, start_date: from, end_date: to, slot: "full_day" | "morning" | "afternoon", acres })
```
In the modal: "**Mon 2 Nov – Wed 4 Nov · 3 days · from 7 am**". Remove the hours input, or move it under "Change estimate".
**Effort:** M

### F-07 [Critical] [Search shows machines that are already booked]
**Where:** `app/api/machines/near/route.ts:12-34` (no date parameters); `services/matching-engine/internal/h3geo/spatial.go:124-147` (returns every indexed machine); `search.tsx:147-153`.
**Current:** I booked M-037 for 2 Nov, reloaded search for 2 Nov, and M-037 still showed an enabled **Book** button. The second attempt failed only at the last step: "Someone has already booked this tractor for that time."
**Problem:** *Farmer on 3G:* they fill the form, wait about 7 s for results, open a tractor, wait again and are told it's taken. That is the worst way to learn something the server already knew.
**Fix:** `GET /api/machines/near?…&from=2026-11-02&to=2026-11-04` should return `available: boolean` and `next_free_date`, computed in SQL:
```sql
… LEFT JOIN LATERAL (
  SELECT 1 FROM bookings b
  WHERE b.machine_id = m.id AND b.state NOT IN ('CANCELLED','FAILED_PAYMENT_RELEASED','FAILED_INVENTORY')
    AND b.during && tstzrange($from, $to, '[)')
  LIMIT 1) busy ON true
```
The card shows a green "Free 2–4 Nov" chip or a grey "Busy · free from 6 Nov" chip, and busy cards go below the free ones.
**Effort:** M

### F-08 [Critical] [Bookings live in process memory; serverless loses them and allows double bookings]
**Where:** `lib/marketplace-bookings.ts:1, 54-56, 79-83`.
**Current:**
```ts
// DEMO STORE. shortcut: in-process memory, unbounded, lost on restart; replace with the booking-orchestrator API.
const G = globalThis as unknown as { __kheti_market?: Store };
const store = (): Store => (G.__kheti_market ??= { bookings: new Map(), … });
```
**Problem:** On Vercel, each serverless instance has its own `globalThis`, and instances are recycled. Two farmers hitting two warm instances can both book M-037 for the same morning. Every booking disappears on the next cold start. The overlap check (`:79-83`) only sees bookings in its own instance. The comment admits this, but the site is deployed with a "Book" button.
**Fix:** One Postgres (Neon or Supabase; both have a free tier and PostGIS). A `bookings` table with an exclusion constraint (F-09). The route handler becomes:
```ts
const { rows } = await sql`
  INSERT INTO bookings (id, machine_id, renter_id, during, idempotency_key, state)
  VALUES (${id}, ${m}, ${userId}, tstzrange(${start}, ${end}, '[)'), ${key}, 'REQUESTED')
  ON CONFLICT (idempotency_key) DO UPDATE SET idempotency_key = EXCLUDED.idempotency_key
  RETURNING id, state`;
// exclusion_violation (23P01) → 409 machine_unavailable
```
Until that exists, remove the "Book" button from production and show "Request this tractor" that creates a lead (name, phone) for manual follow-up.
**Effort:** M

### F-09 [Critical] [The bookings schema can't express "this machine, this time"]
**Where:** `deploy/sql/001_bookings.sql:4-21`.
**Current:** Columns: `booking_id, machine_id, renter_id, idempotency_key, state, fencing_token, payload, created_at, updated_at`. **No start, end or time range.** No `machines`, `users`, `listings`, `reviews` or `payments` tables exist anywhere.
**Problem:** Double-booking prevention currently depends entirely on a Redis distributed lock held around application code. The database, which is the system of record, can't detect an overlap. Redlock plus fencing protects the *write ordering of one booking row*. It does not stop two different booking rows overlapping in time on the same machine.
**Fix:**
```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE bookings ADD COLUMN during tstzrange NOT NULL;
ALTER TABLE bookings ADD CONSTRAINT no_overlap
  EXCLUDE USING gist (machine_id WITH =, during WITH &&)
  WHERE (state NOT IN ('CANCELLED','FAILED_PAYMENT_RELEASED','FAILED_INVENTORY','SETTLED_REFUNDED'));
CREATE INDEX ON bookings USING gist (machine_id, during);
```
With this constraint, a concurrent second insert fails with SQLSTATE 23P01 regardless of locks. Redlock and fencing become unnecessary for booking creation. Add the missing core tables: `users(id, phone, name, lang, role)`, `machines(id, owner_id, category, make, model, hp, location geography(Point,4326), village, pin, price_unit, price_paise, operator_included, photos text[], active)`, `reviews`, `payments`.
**Effort:** M

### F-10 [High] [No "My bookings"; the confirmation is a UUID, then nothing]
**Where:** `app/marketplace/_components/booking-modal.tsx:150-158`; no `/bookings` route exists.
**Current:** "Escrow authorised. Booking bk_3a51e35e-d4fe-4878-bae3-d5a614634d1f." → **Done** → back to search. The only links on the search page are the nav links (verified).
**Problem:** *Every persona:* "Did it work? When is it? Who do I call? Can I cancel?" None of this is answerable. A 40-character ID is unreadable over the phone.
**Fix:** After confirming, go to `/bookings/[id]`:
```
Booked ✓  Mahindra 275 DI · Bhanwar Lal Jat
Mon 2 Nov – Wed 4 Nov · from 7 am · Sanganer
Booking code  KR-4821        [Call owner]  [WhatsApp]
You pay ₹2,839 + ₹1,950 deposit (returned after the job)
[Add to calendar]   [Cancel booking – free until Sun 1 Nov 6 pm]
```
Use a 4-digit human code (`KR-` plus 4 digits, unique per active period), plus an SMS and WhatsApp confirmation (Phase 3 §5).
**Effort:** M

### F-11 [High] [Listing a tractor saves nothing and is missing the fields that matter]
**Where:** `app/marketplace/_components/listing-form.tsx:65-77, 79-86`; `lib/marketplace-kyc.ts:19-21`.
**Current:** `submit()` validates, then `setListed(true)`. The success card says "Nothing was saved or sent." The form asks for make, model, year, HP tier, purchase price, implements, name, Aadhaar, RC and RC name. Verified: the listed "Mahindra 575 DI" never appears in search.
**Problem:** *Owner persona:* the four things an owner most needs to set are absent: **where the tractor is**, **what to charge** (per hour, acre or day), **when it is available**, and **photos**. There is also no phone number, so a renter can't reach them, and no "operator included?" choice, although most rentals in India come with a driver.
**Fix:** A 4-step wizard, one question group per screen:
1. *Machine:* category (big icons: Tractor, Rotavator, Harvester, Sprayer, Seed drill, Trolley), make and model (autocomplete), HP, year.
2. *Photos:* 3 photos (front, side, hour meter) with `capture="environment"`, compressed client-side to ≤ 200 KB each.
3. *Where and when:* PIN or village plus a map pin; available days (calendar, default all); "I will drive it (operator included)" toggle.
4. *Price:* "per hour / per acre / per day", pre-filled with the pricing model's suggestion ("Similar tractors near you charge ₹700–₹900/hour") and editable.
Then verification (F-16), then "Your tractor is live. Farmers within 10 km can now book it."
**Effort:** L

### F-12 [High] [No owner dashboard]
**Where:** Missing route.
**Problem:** *Owner persona:* "Someone booked my tractor? When? Do I accept? What did I earn?" None of these screens exist.
**Fix:** `/owner` containing: Requests (accept or decline within 2 h, otherwise auto-decline), Calendar (busy and free per machine, tap a day to block it), Machines (edit price, photos, pause), and Earnings (this month, paid out, pending, held deposits). The wireframe is in Phase 3 §3.
**Effort:** L

### F-13 [High] [Only tractors are rentable; implements and harvesters can't be searched]
**Where:** `lib/marketplace-fleet.ts:21-30` (four HP tiers only); `lib/marketplace-kyc.ts:2` (implements as checkboxes only); `lib/marketplace-quote.ts:5` (`["Plowing","Sowing","Harvesting"]`); the search "What do you need done" select.
**Problem:** Your own brief names harvesters and sprayers. A farmer needs "tractor **with rotavator**" or "a combine harvester for 6 acres of wheat". Today they can pick "Harvesting", and the app shows plain tractors with a 1.45× surge price.
**Fix:** `machines.category` (`tractor | combine_harvester | rotavator | sprayer | seed_drill | baler | trolley | thresher`) plus `attachments text[]`. Search starts with **"What work?"** as a grid of picture tiles (Ploughing, Rotavating, Sowing, Spraying, Harvesting, Transport). Each tile maps to the categories and attachments that can do it.
**Effort:** M

### F-14 [High] [Per-hour pricing only]
**Where:** `lib/pricing-engine.ts:52-65`; `lib/marketplace-quote.ts:15, 21-22` (`HOURS_PER_ACRE = 0.75`).
**Problem:** Custom-hiring rates for rotavating, harvesting and threshing are commonly quoted per acre or per day, not per engine hour. The app converts acres to hours with a fixed 0.75 h/acre for every job, soil and machine, and then labels the result an estimate.
**Fix:** `price_unit: 'hour' | 'acre' | 'day' | 'trip'`, set by the owner. The quote shows the owner's unit and the farmer's total: "₹1,400 per acre × 5 acres = ₹7,000". Keep the pricing model as a *suggestion* to owners (F-11 step 4), not as the price.
**Effort:** M

### F-15 [High] [No payment; the "escrow" asks for a lot of money up front]
**Where:** `app/marketplace/_components/booking-modal.tsx:60-91, 130-141`.
**Current:** "Authorise escrow" posts to the in-memory store. Verified quote for a 4-hour job: Rental ₹2,838.80 + **deposit ₹1,950 (tier floor)** = **Held in escrow ₹4,788.80**.
**Problem:** *Small farmer:* there is no payment step, and the price blocks 69 % more than the job costs, for a 4-hour job. Many small farmers pay cash after the work. *Owner:* nothing guarantees they get paid.
**[UPDATED by D-08]** No real gateway: build the simulated payment step (UPI / card / net banking / pay after work, stored as `paid_demo` or `pay_later`, with the banner "Demo payment: no real money moves"). Keep the deposit cap below. The original recommendation follows for reference only.
**Fix (original, superseded):** Phase 1: **pay later** (cash or UPI to the owner at handover) with a small booking fee (₹49) by UPI to cut no-shows. Phase 2: UPI through a licensed payment aggregator. For example, Razorpay Route lets you hold a transfer's settlement (`on_hold: true`) and release it (`on_hold: false`) after the return check, so you never hold funds yourself. Cap the deposit at the lower of the tier floor and 25 % of rental for jobs under 8 hours.
**Effort:** M (pay-later) / L (UPI hold)

### F-16 [High] [Trust: "Aadhaar verified" is shown for any file]
**Where:** `app/marketplace/_components/listing-form.tsx:27-30, 60-63`; `lib/marketplace-kyc.ts:10-17`.
**Current:** I uploaded an 8-byte file named `cat.png` as Aadhaar → "**Aadhaar verified** (cat.png)".
**Problem:** *Owner:* learns that "verified" means nothing. *Renter:* will later see "Verified owner" badges and trust them. *Legal:* collecting Aadhaar images has obligations under the Aadhaar Act and UIDAI rules (masking, purpose limitation, storage). A form that trains users to upload Aadhaar to an unknown site is a liability even in a demo.
**Fix:** Never say "verified" for a client-side check. Copy: "**Uploaded** – we check documents within 24 hours." Real path: phone OTP for identity, DigiLocker for Aadhaar and RC, or a licensed KYC provider for RC lookup against Vahan. Store only the result and a masked reference, never the image.
**Effort:** S (copy) / L (real KYC)

### F-17 [Medium] [RC name match rejects Devanagari names, initials and name order]
**Where:** `lib/marketplace-kyc.ts:7-8, 35-37`.
**Current:** "रमेश पाटील" vs "PATIL RAMESH" → "The RC owner name does not match your name, so we cannot list this tractor." (verified). "B. L. Jat" vs "Bhanwar Lal Jat" would also fail.
**Problem:** *Owner more comfortable in Marathi or Hindi:* blocked from listing at the last step, for typing their own name in their own script.
**Fix:** Don't hard-block. If the names don't match after transliteration and initial-matching, accept with `needs_review = true` and say "We'll confirm the RC name with you on a call."
**Effort:** S

### F-18 [Medium] [Ratings are invented and shown without counts]
**Where:** `lib/marketplace-fleet.ts:48`; `lib/h3-dispatch.ts:88`; `search.tsx:145` ("☆ 4.8 / 5").
**Problem:** *Renter:* "4.8 / 5" with no review count looks real. The demo note is 12 px muted text at the bottom. When real data arrives, a new owner with 1 review at 5.0 will outrank an owner with 40 reviews at 4.7.
**Fix:** Show "★ 4.7 (40)". Below 3 reviews, show "New on KhetiRental". Rank on a Bayesian average: `(C·m + Σr)/(C + n)` with `C = 5`, `m = 4.2`. Use a filled star, because an outline star reads as "unrated".
**Effort:** S

### F-19 [High] [No way to contact the owner or the platform]
**Where:** Nowhere in the app.
**Problem:** *Every persona:* the first question after booking is "can I talk to them?" Rural rentals run on phone calls. No contact path means no trust.
**Fix:** After a booking is accepted, show **Call** and **WhatsApp** buttons using a masked number (a virtual-number provider), so neither side's real number leaks before the deal. Put a "Help" link with a phone number and WhatsApp in the footer of every app screen.
**Effort:** M

### F-20 [Medium] [The search error state has no retry and can get stuck]
**Where:** `app/marketplace/_components/search.tsx:32-42, 113`.
**Current:** Offline gives "We could not load nearby tractors. Check your connection and try again." But there is no button. Re-selecting the same village does nothing, because `place` didn't change, so the effect doesn't re-run. Verified: after going back online, the error stayed with an empty status line.
**Fix:**
```tsx
const [attempt, setAttempt] = useState(0);
useEffect(() => { … }, [place, attempt]);
…
{load.status === "error" && (<div role="alert">…<button onClick={() => setAttempt(a => a + 1)}>Try again</button></div>)}
```
Also retry automatically on the `online` event.
**Effort:** S

### F-21 [Medium] [Dates in the past are accepted]
**Where:** `search.tsx:73` (the "From" input has no `min`); `lib/marketplace-bookings.ts:32-34`.
**Fix:** `min={todayIso}` on From. The server rejects `start < now() - interval '1 hour'` with "Pick today or a later date."
**Effort:** S

### F-22 [Medium] [Farm size allows 1,000 acres but booking caps at 720 hours]
**Where:** `search.tsx:45` (`acresNum <= 1000`); `lib/marketplace-quote.ts:16` (`MAX_HOURS = 720`).
**Current:** 1,000 acres → "so 750 h for your farm". The modal then opens in an error state: "Enter a whole number from 1 to 720."
**Fix:** Derive the acres limit from the hours cap (`MAX_ACRES = Math.floor(MAX_HOURS / HOURS_PER_ACRE)` = 960), or better, cap at 100 acres with "For more than 100 acres, call us".
**Effort:** S

### F-23 [Medium] [Number fields reject Devanagari digits and decimal commas]
**Where:** `search.tsx:44-45` (acres); `booking-modal.tsx:25-26` (hours); `lib/marketplace-kyc.ts:27, 31` (year, cost).
**Current:** "२" and "2,5" → "Enter farm size in acres, from 0.1 to 1,000." (verified).
**Problem:** *Marathi or Hindi keyboard users* (Gboard in Devanagari layout) can type native digits. Rejecting them looks like the app is broken.
**Fix:**
```ts
export const toAsciiNumber = (s: string) =>
  Number(s.trim().replace(/[०-९]/g, d => String(d.charCodeAt(0) - 0x0966)).replace(/,/g, "."));
```
Use it everywhere a number is parsed. For acres, also offer steppers (− 5 +) so typing is optional.
**Effort:** S

### F-24 [Medium] [The listing form doesn't move focus to missing documents]
**Where:** `listing-form.tsx:71-74` (focus by `[data-field]`), `:138-141` (DocDrop has no `data-field`).
**Current:** With everything filled except the documents, Submit leaves focus on the submit button (verified). The errors render about 600 px above.
**Fix:** Pass `data-field="aadhaar"` and `data-field="rc"` to the DocDrop button, and scroll it into view (`el.scrollIntoView({ block: "center" })`) before `focus()`.
**Effort:** S

### F-25 [Low] [Search loads results for Sanganer before asking where the farmer is]
**Where:** `search.tsx:19` (`useState<Place>(VILLAGES[0])`).
**Fix:** With no remembered place, show only the "Where is your farm?" step. Don't fetch until a place exists.
**Effort:** S

### F-26 [Medium] [Start time is fixed at 6 am]
**Where:** `booking-modal.tsx:70, 126`.
**Fix:** Offer "Morning (from 7 am) · Afternoon (from 1 pm) · Full day" chips, and let the owner propose a time on acceptance.
**Effort:** S

### F-27 [Low] [Straight-line distance shown as if it were travel distance]
**Where:** `search.tsx:144` ("📍 3.4 km").
**Fix:** Label it "3.4 km away" and add a tooltip or footnote "straight line". Later, round to 0.5 km and show the owner's village ("in Muhana, 3.5 km"), which farmers understand better than a number.
**Effort:** S

### F-28 [Low] [No not-found page]
**Where:** missing `app/not-found.tsx`. The 404 keeps the home page's title.
**Fix:** "We couldn't find that page. [Find a tractor] [Go home]", translated.
**Effort:** S

### F-29 [Low] [The escrow simulator contradicts the booking flow]
**Where:** `components/escrow-state-machine.tsx:14-15, 125` (comment says "M-101", ledger says "15% deposit") vs `booking-modal.tsx:134` ("tier floor, 0.5 % of tractor value"). M-101 doesn't exist (the fleet is M-001 to M-060).
**Fix:** Run the simulator from a real `quoteRental(fleetMachine("M-037"), …)` so both show the same deposit rule.
**Effort:** S

### F-30 [Medium] ["Not bookable in this demo" cards]
**Where:** `search.tsx:137-153`.
**Current:** If the API returns an id not in `FLEET`, the card shows "Tractor M-099 · Owner details not available · Rate not available · [Not bookable in this demo]".
**Fix:** Filter these out server-side. A result the user can't act on should never be rendered.
**Effort:** S

### F-31 [Medium] [The saga and outbox aren't wired to anything]
**Where:** `services/booking-orchestrator/cmd/orchestrator/` (empty); `internal/events/outbox.go:31-45` (`Poller` stores an interval and does nothing); `ARCHITECTURE.md:43` ("client not yet wired").
**Problem:** *Developer:* about 650 lines of lock, saga and outbox code plus about 35 tests protect a path no request takes. The README and home page present it as the system.
**Fix:** Decide (Phase 3 §4). Either (a) keep it as a portfolio module under `showcase/` and take it off the product's README, or (b) if you ever need it, wire it behind the Next API. For a pilot, (a) plus the F-09 constraint is the right call.
**Effort:** S (decide and move)

### F-32 [Medium] [The job type sets the season surcharge]
**Where:** `lib/marketplace-quote.ts:7-11`.
**Current:** `Plowing: "off_season", Sowing: "sowing", Harvesting: "harvest_compressed"`. Choosing "Harvesting" always adds 45 %, even in an off-season month. Choosing "Plowing" never surges, even in peak kharif prep.
**Fix:** Derive the season from the booking dates and district crop calendar (a table `season_calendar(district, month, multiplier)`). The job decides the machine and attachment, not the surcharge.
**Effort:** S

### F-33 [Medium] [Matching engine: a moved machine is returned at both its old and new spots]
**Where:** `services/matching-engine/internal/h3geo/spatial.go:104-113`.
**Current:** `Index()` only does `HSET` on the new cell. Verified: indexing FAKE-1 at 26.84 N and then 26.90 N returns it from **both** places.
**Fix:**
```go
// keep machine → cell in a hash; move atomically
prev, _ := s.rdb.HGet(ctx, "machines:cell", m.ID).Result()
pipe := s.rdb.TxPipeline()
if prev != "" && prev != fmt.Sprint(uint64(cell)) { pipe.HDel(ctx, "machines:h3:"+prev, m.ID) }
pipe.HSet(ctx, s.key(cell), m.ID, v)
pipe.HSet(ctx, "machines:cell", m.ID, uint64(cell))
_, err = pipe.Exec(ctx)
```
**Effort:** S

### F-34 [Medium] [Closing the modal during "Authorise" loses the result]
**Where:** `booking-modal.tsx:35-36` (Escape always closes), `:112` (the Close button is never disabled).
**Problem:** On a slow network the farmer taps ✕ while the request is in flight. The booking may have been created, and they never find out.
**Fix:** While `status.kind === "submitting"`, disable Close and Escape, and show "Booking… don't close this screen". If closed anyway, show a toast on the search page once the request resolves.
**Effort:** S

### F-35 [High] [No information about the machine's condition]
**Where:** `lib/marketplace-fleet.ts:9-19` (the `FleetMachine` type: id, label, owner, village, hp, ageYears, acquisitionCostInr, soil, rating); `lib/marketplace-kyc.ts:19-21` (`ListingForm`); result cards and the booking modal.
**Current:** A renter sees the model name, HP, distance, a rating and a price. There is nothing about age, hour-meter reading, last service, tyre condition, insurance or whether the implement is in working order. The age (`ageYears`) is used for pricing but never shown.
**Problem:** *Renter:* condition is the second question after price ("Is it in good shape? Will it break down in my field?"). *Owner:* has no way to show that a well-kept machine is worth more.
**Fix:** Listing fields "Year of manufacture", "Hour-meter reading" (with a photo of the meter), "Last serviced" (month and year), "Tyres: good / worn", "Insured: yes / no". Show on the card as one line: "2019 · 2,340 hrs · serviced Aug 2026". At handover, the renter and owner both take 3 photos (your escrow rule P1 already says this), which are kept on the booking as the condition record.
**Effort:** M

### F-36 [Medium] [No way to report a problem or raise a dispute in the product]
**Where:** Nowhere in the farmer or owner flow. The nine dispute rules exist only in the escrow simulator (`components/escrow-state-machine.tsx`) and the contract (`contracts/escrow-state-machine.md`).
**Problem:** *Renter:* the machine didn't come, broke down halfway, or the owner charged more than shown. *Owner:* the machine came back damaged or with an empty tank. Today neither has anywhere to go.
**Fix:** "Report a problem" on the booking detail page with picture choices: **Machine didn't come · Broke down · Damage · Charged more · Other**, a photo upload and a free-text box (with voice input). Each report opens a ticket the team resolves by phone in the pilot. Automate only after you've seen 50 real cases; your D-rules will then be grounded in reality.
**Effort:** M

### F-37 [Medium] [Search filters aren't in the URL; Back resets the search]
**Where:** `app/marketplace/_components/search.tsx:15-22` (all filters are `useState`; nothing reads or writes the URL).
**Current:** Verified: I set the village to Muhana and the field to 12 acres, went to another page and pressed Back. The search came back as Sanganer and 5 acres. The URL never changes (`/marketplace/search`).
**Problem:** *Farmer on a slow phone:* pressing Back loses everything they typed. *Son booking for his father:* he can't send the search to his father on WhatsApp.
**Fix:** Keep the filters in the query string: `/rent/results?work=rotavate&pin=413512&from=2026-11-02&to=2026-11-04&r=10`. Read them with `useSearchParams()` (or from `searchParams` in the Server Component, P-02) and write them with `router.replace()` on change. Every search is then shareable, bookmarkable and survives Back and refresh.
**Effort:** S

### F-38 [Medium] [Long text breaks the layout]
**Where:** `app/marketplace/_components/listing-form.tsx:91-97` (text inputs have no `maxLength`); `:82` (the success heading); `lib/marketplace-kyc.ts:23-38` (no length checks).
**Current:** Verified: a 240-character make with no spaces is accepted, and on the success card the heading runs off the screen. The page becomes 2,627 px wide at a 375 px viewport, so the whole page scrolls sideways.
**Fix:** `maxLength` on every text input (make 40, model 40, names 80, village 60), the same limits in server validation, and `break-words` / `min-w-0` on every heading or card title that shows user text. On cards, clamp machine names to 2 lines (`line-clamp-2`).
**Effort:** S

### F-39 [Low] [Refreshing during a booking loses the booking context]
**Where:** `app/marketplace/_components/search.tsx:125` (the modal is local state).
**Current:** Verified: with the booking modal open, a refresh brings back the search page with the modal closed and the default filters.
**Fix:** Make booking a route (`/rent/m/[id]/book?step=2&from=…&to=…`) so refresh and Back restore the exact step. Keep the idempotency key in `sessionStorage` (wrapped in try/catch) for that route, so a refresh after tapping Confirm can't create a second booking.
**Effort:** S

### F-40 [Low] [The search API silently ignores bad parameters]
**Where:** `app/api/machines/near/route.ts:19-26`; `services/matching-engine/internal/store/store.go:86-109`.
**Current:** Verified: `limit=1000` silently becomes 20 (19 results returned). `k=9` becomes 2, and an invalid `radius_km` becomes 5. The comment says this mirrors the Go handler on purpose.
**Problem:** *Developer:* a client asking for 1,000 results gets 20 and can't tell why. This is how the 4 km radius cap (F-03) went unnoticed.
**Fix:** Return 400 for out-of-range values with a message (`"limit must be 1–100"`), or clamp and echo what was applied: `{ "applied": { "radius_km": 4, "k": 5, "limit": 20 }, "candidates": [...] }`.
**Effort:** S

### F-41 [Medium] [No pagination; the UI shows at most 12 machines]
**Where:** `lib/marketplace-places.ts:33-34` (`limit = 12`); `search.tsx:115-119`.
**Problem:** In a busy district at harvest there may be 80 machines within 10 km. The farmer sees 12, chosen by the opaque score (F-04), and has no "show more".
**Fix:** 20 per page with a **Show more** button (not infinite scroll, which is hard on slow phones), a cursor from the server (`?after=<distance>,<id>`), and the total ("Showing 20 of 83").
**Effort:** S

### Booking lifecycle: what each side sees today

| Moment | Renter sees | Owner sees | Should see |
|---|---|---|---|
| Renter taps Book | Modal with hours and price | Nothing | Owner: push + SMS "New request from Sunil, 2 Nov, ₹2,840 – accept within 2 h" |
| Booking created | "Escrow authorised. Booking bk_…" | Nothing | Renter: "Waiting for Ramesh to accept (up to 2 h)"; owner: the request card (F-12) |
| Owner accepts | (no such step) | (no such step) | Renter: SMS + WhatsApp with the code, date, owner's masked number |
| Day before | Nothing | Nothing | Both: reminder with time and place |
| Handover | Nothing | Nothing | Both: OTP + 3 photos (your rule P1) |
| Work done | Nothing | Nothing | Renter: final amount, deposit returned, rate the owner; owner: earnings, rate the renter |
| Cancellation | Not possible | Not possible | Both: clear rules and a button (F-10) |
| Problem | Not possible | Not possible | Both: "Report a problem" (F-36) |

### Screen states matrix

✓ handled · ⚠ handled badly · ✗ missing · – not applicable. "Verified" means I triggered it in the browser.

| Screen | Loading | Empty | Error | Success | Partial data | Very long text | 0 items | 1,000 items | Slow network | Offline |
|---|---|---|---|---|---|---|---|---|---|---|
| Home `/` | – (static) | – | – | ✓ | – | – | – | – | ⚠ FCP 1.5 s, 186 KB JS for a static page | ✗ browser error page |
| Search results | ⚠ text "Looking for tractors..." only, no skeleton (`search.tsx:110`) | ⚠ dead-end message (`:114`) | ⚠ no retry; can get stuck (F-20, verified) | ✓ | ⚠ unknown machines show "Rate not available" cards (F-30) | ⚠ titles not clamped; names are fixed demo data so untested in UI | ✓ "0 found" + message | ✗ capped at 12, no paging (F-41) | ⚠ results at 6.9 s on Slow 3G (P-02) | ⚠ error message, no cached results (A-10) |
| Booking modal | ✓ spinner on the button | – | ✓ specific 409 / 400 / network messages | ⚠ raw booking ID, then nothing (F-10) | ✓ price rows hide while hours are invalid | ✓ | – | – | ⚠ can be closed mid-request (F-34) | ✓ "Could not reach the server…" |
| Listing form | – (nothing is sent) | ✓ empty form | ✓ field errors + summary | ⚠ claims success, saves nothing (F-11) | – | ✗ layout breaks (F-38, verified) | – | – | – | ⚠ "succeeds" offline because nothing is sent |
| Pricing calculator | – | – | ⚠ shows a raw developer message (T-07, verified) | ✓ | – | – | – | – | ⚠ 228 KB JS (P-03) | ✗ |
| Escrow simulator | – | ✓ "No events yet." | ✓ rejected events logged | ✓ | – | – | – | – | – | ✗ |
| H3 sandbox | – | ✓ "No Available tractor in this ring…" | – | ✓ | – | – | ✓ | – | – | ✗ |
| My bookings | ✗ screen missing | | | | | | | | | |
| Owner dashboard | ✗ screen missing | | | | | | | | | |
| Not found | ✓ default 404 | | | | | | | | | ⚠ home title, no way back except the nav (F-28) |

**Distance calculation check:** `haversineKm` (`lib/h3-dispatch.ts:14-18`) and `HaversineKm` (`spatial.go:168-179`) are correct great-circle formulas with R = 6371 km, clamped with `Math.min(1, …)` against rounding. The distance is straight-line, not road distance (F-27). The ring is trimmed by true distance after the H3 lookup (`store.go:134-136`), which is correct.

**Date and time check:** dates are built in local time and sent with a fixed `+05:30` offset (`booking-modal.tsx:70`), which is right for India only. Overlap is half-open (`r.startMs < endMs && startMs < r.endMs`, `marketplace-bookings.ts:80`), which is correct: a booking ending at 10:00 doesn't clash with one starting at 10:00. Past dates are accepted (F-21). There is no time zone, DST or midnight issue for an India-only product.

---

## Security

### S-01 [Critical] [Anyone can insert, move or delete machines in the matching engine]
**Where:** `services/matching-engine/internal/store/store.go:42-44, 163-187`.
**Current:** `POST /machines/index` and `DELETE /machines/unindex` have no auth and no validation. Verified: posting `{"id":"FAKE-1","lat":26.84,"lng":75.83,"hp":45,"reputation":99}` returned 204, and the fake machine came back with **score 20.45**, ranking first for every nearby search. A DELETE removes any real machine.
**Fix:**
```go
func requireServiceToken(next http.Handler) http.Handler {
  tok := os.Getenv("INTERNAL_TOKEN")
  return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
    if subtle.ConstantTimeCompare([]byte(r.Header.Get("Authorization")), []byte("Bearer "+tok)) != 1 { http.Error(w, "unauthorized", 401); return }
    next.ServeHTTP(w, r)
  })
}
mux.Handle("POST /machines/index", requireServiceToken(http.HandlerFunc(h.handleIndex)))
```
Also validate `-90 ≤ lat ≤ 90`, `-180 ≤ lng ≤ 180`, `0 ≤ reputation ≤ 1`, `10 ≤ hp ≤ 150`, and bind the service to a private network only.
**Effort:** S

### S-02 [Critical] [Booking API: no login; the renter id is made up by the browser]
**Where:** `booking-modal.tsx:21` (`renter-${crypto.randomUUID().slice(0, 8)}`); `app/api/bookings/route.ts:4-11`.
**Problem:** Anyone can book every machine for 720 hours with a script, which takes the entire supply offline. No booking can be tied to a person, so cancellation, disputes and contact are impossible.
**[UPDATED by D-05]** Login methods are Google + mobile OTP + email/password, each mocked in dev. The session, `renter_id` and rate-limit rules below still apply.
**Fix:** Phone-number OTP login (an SMS OTP provider; register a DLT template, which India's SMS rules require). A server-side session cookie (`httpOnly`, `secure`, `sameSite=lax`). `renter_id` comes from the session, never from the body. Rate-limit to 5 booking attempts per user per hour.
**Effort:** M

### S-03 [High] [Settlement endpoint has no auth]
**Where:** `app/api/escrow/[booking_id]/settle/route.ts:4-11`.
**Fix:** Only the platform's back office (or a signed webhook from the payment provider) can settle. Remove the public route, or require an admin session plus an audit log row.
**Effort:** S

### S-04 [Critical (if deployed)] [Telemetry WebSocket accepts anyone, any origin, unlimited data]
**Where:** `services/telemetry-gateway/internal/ws/sync.go:70-72, 91-127, 134-145`; `cmd/telemetry-gateway/main.go:37`.
**Current:** `CheckOrigin: func(*http.Request) bool { return true }, // … auth is at the gateway`. There is no gateway (`ARCHITECTURE.md:50`). `/ws?machine=ANY` creates a new in-memory CRDT per id. `withSamples` keeps every sample forever. There is no `conn.SetReadLimit`.
**Problem:** These frames are the *evidence* for escrow rules D-01 and D-02. Anyone can inject a geofence breach for a machine and freeze a renter's deposit. Anyone can also exhaust memory by opening sockets for random machine ids.
**Fix:** A per-device token issued at handover and checked on upgrade. `conn.SetReadLimit(64<<10)`. A per-connection rate limit. Reject unknown `machine` ids. Cap the in-memory samples (ring buffer) and persist them to `telemetry_points`.
**Effort:** M

### S-05 [Medium] [Internal errors returned to clients; bad coordinates return 500]
**Where:** `store.go:127` (`"h3 lookup failed: "+err.Error()`), `sync.go:112`.
**Current:** `?lat=NaN` → 500 with the internal h3 error text. `?lat=500` → 200 with `"candidates": null` (it should be 400, and `null` breaks the contract's required array).
**Fix:** Validate ranges before calling H3 (`if math.IsNaN(lat) || lat < -90 || lat > 90 { 400 }`), log the detail server-side, and return `{"code":"internal","message":"Search failed"}`. Initialise `Candidates: []CandidateJSON{}`.
**Effort:** S

### S-06 [Medium] [Go HTTP servers have no timeouts]
**Where:** `services/matching-engine/cmd/match-service/main.go:47`; `services/telemetry-gateway/cmd/telemetry-gateway/main.go:37`.
**Fix:** `&http.Server{Addr: listen, Handler: h, ReadHeaderTimeout: 5*time.Second, ReadTimeout: 10*time.Second, WriteTimeout: 10*time.Second, IdleTimeout: 60*time.Second}`.
**Effort:** S

### S-07 [Medium] [Owner location can be worked out from distances]
**Where:** `app/api/machines/near/route.ts:31` (`dist_km` to many decimals); `search.tsx:144`.
**Problem:** A tractor is usually parked at the owner's home. Querying from three points and reading the exact `dist_km` back pins the house down.
**Fix:** Round `dist_km` server-side to 0.5 km and add ±150 m of stable per-machine jitter to the stored search point. Show village names, not coordinates. Reveal the exact address only after a confirmed booking.
**Effort:** S

### S-08 [Low] [No rate limiting or security headers]
**Where:** `next.config.mjs:1-3`; all `app/api/*` routes.
**Fix:**
```js
const config = { reactStrictMode: true, poweredByHeader: false,
  async headers() { return [{ source: "/(.*)", headers: [
    { key: "Content-Security-Policy", value: "default-src 'self'; img-src 'self' data: blob: https:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Permissions-Policy", value: "geolocation=(self), camera=(self)" } ] }]; } };
```
Add rate limiting on `/api/*` with a Redis-backed limiter (for example 60 searches per minute per IP).
**Effort:** S

### Security checks that passed

These were checked and are fine, so you don't need to spend time on them:

- **No secrets in the code or history.** I searched every tracked file for API-key, secret, password and token assignments, and the full git history (all branches) for AWS, Google, Razorpay, Stripe and GitHub key formats and private-key headers. Nothing found.
- **No API keys in the frontend.** No `NEXT_PUBLIC_*` variable is read anywhere, and there is no map or third-party key.
- **No XSS found.** There is no `dangerouslySetInnerHTML`; all user text is rendered through React, which escapes it. A 240-character make and Devanagari names rendered as plain text.
- **No SQL injection found.** All Go SQL uses pgx placeholders (`$1, $2, …`) (`pgstore/store.go:24-27, 47-49`; `fenced_store.go:36-45`).
- **No insecure browser storage.** Nothing is written to `localStorage` or `sessionStorage`.
- **CORS is closed by default.** Neither the Next.js API routes nor the Go services send `Access-Control-Allow-Origin`, so other sites can't call them from a browser. (Scripts and servers still can, which is why S-01 and S-02 matter.)
- **Request bodies are size-limited** on the booking API (8 KB, `lib/marketplace-http.ts:3-15`).
- **Idempotency keys are validated as UUIDs** and a reused key with a different body is rejected (`marketplace-bookings.ts:66-76`).
- **No leftover `console.log` calls, no commented-out code blocks**, and only two "shortcut:" notes (`marketplace-bookings.ts:1`, `ws/sync.go:132`), both honest about what's missing.
- **No large or binary files are tracked.** The biggest tracked file is `package-lock.json` (296 KB); screenshots, `.next`, `graphify-out` and build files are ignored.

One small thing found during these checks: every response carries `X-Powered-By: Next.js`. The `poweredByHeader: false` line in S-08 removes it.

---

## Performance

| Route (Slow 3G + 4× CPU, 375 px, cold cache) | First paint | `load` | Results visible | Transferred | of which JS |
|---|---|---|---|---|---|
| `/` | 1.52 s | 4.0 s | – | 220.9 KB | 186.0 KB |
| `/marketplace` | 1.50 s | 4.0 s | – | 231.7 KB | 194.8 KB |
| `/marketplace/search` | 1.44 s | 5.4 s | **6.9 s** | 223.3 KB | 189.7 KB |
| `/marketplace/listing` | 1.47 s | 4.1 s | – | 155.3 KB | 122.4 KB |
| `/pricing` | 1.52 s | 6.3 s | – | 260.9 KB | 227.6 KB |
| `/architecture/h3-spatial` | 1.50 s | 5.3 s | – | 222.2 KB | 186.0 KB |

These numbers are good for a Next.js app and close to acceptable for 3G. The problems are where the bytes go and the order things happen in.

### P-01 [High] [The farmer's search page downloads the whole H3 library to label demo cards]
**Where:** `app/marketplace/_components/search.tsx:5` → `lib/marketplace-fleet.ts:5` → `lib/h3-dispatch.ts:2` (`import … from "h3-js"`). Build output: `/marketplace/search` first-load JS is **176 kB**. Chunk `8ffc485e…js` is h3-js at **62.8 KB gzipped, about 33 % of that page's JavaScript**.
**Problem:** *Farmer on 3G:* about 1.3 s of download (at 400 kbps) for code that runs only to rebuild the demo fleet's names and prices in the browser.
**Fix:** The API returns everything a card needs (`label, owner_village, price_paise, unit, distance_km, rating, review_count, photo_url, available`). The client imports no `lib/h3-*` or `lib/marketplace-fleet`. Expected `/marketplace/search` first load: about 110 kB, below the 120 kB budget.
**Effort:** S

### P-02 [Medium] [Results wait for hydration, then a client fetch]
**Where:** `search.tsx:24-42`.
**Problem:** The results request starts only after about 190 KB of JS has downloaded and React has hydrated. That is why results appear 1.5 s after `load`.
**Fix:** Make the results list a Server Component that reads the remembered place from a cookie and queries the database directly, streaming with `<Suspense>`. Keep only the filters as a client island. Expected results-visible time on Slow 3G: about 3 s.
**Effort:** M

### P-03 [Medium] [recharts, 109 KB gzipped, for two bars]
**Where:** `components/pricing-calculator.tsx:4, 102-121`; `app/dossier/track-a-systems/latency-chart.tsx`.
**Fix:** Two `<div>` bars with `style={{ inlineSize: \`${pct}%\` }}` and text labels, or a 30-line SVG. That saves about 109 KB gzipped on `/pricing`.
**Effort:** S

### P-04 [Low] [Sticky header uses `backdrop-blur` on every scroll frame]
**Where:** `components/navbar.tsx:61`.
**Problem:** Backdrop blur re-blurs everything behind the header on every scroll frame, which is noticeably janky on Mali and Adreno 5xx GPUs. The intended background isn't applied anyway (V-03).
**Fix:** Use a solid `background: var(--surface)` and drop the blur.
**Effort:** S

### P-05 [Low] [Test run spends 55 % of its time building jsdom]
**Where:** `vitest.config.ts:8-14`.
**Fix:** Split into two Vitest `projects`: a `node` project for `lib/**/*.test.ts` and a `jsdom` project for components (or add the `// @vitest-environment node` pragma to the lib tests), and use `pool: "vmThreads"` for the component tests. That should take the run from about 23 s to about 10 s.
**Effort:** S

### P-06 [Low] [Search results are never cached]
**Where:** `app/api/machines/near/route.ts:30-33` (no `Cache-Control`; verified with `curl -I`).
**Problem:** *Farmer on 2G:* switching back to a village they already searched waits a full round trip again.
**Fix:** For anonymous searches, `Cache-Control: public, s-maxage=30, stale-while-revalidate=120` (availability changes, so keep it short). On the client, keep the last 5 results in memory keyed by the query string, show them instantly, and refresh in the background.
**Effort:** S

### P-07 [Low] [Work repeated on every render]
**Where:** `search.tsx:130-134` (every `ResultCard` re-runs `quoteRental()`, which runs the pricing engine and builds an escrow, each time the parent re-renders, for example on every keystroke in the acres box); `h3-map.tsx:78, 97-98` (`rankOf`, `ringSet` and the `excluded` count, which calls `latLngToCell` for 15 tractors, are rebuilt every render).
**Problem:** Negligible at 12 cards on a laptop. On a 2 GB Android phone with 4× slower CPU, typing in the acres box re-prices every card on every key.
**Fix:** Have the API return the price (P-01), which removes the work entirely. In the sandbox, wrap `rankOf`, `ringSet` and `excluded` in `useMemo` keyed on `near` and `res`.
**Effort:** S

---

## Dead code, duplication and leftovers

| ID | Where | What | Fix |
|---|---|---|---|
| X-01 | `lib/marketplace-quote.ts:57-60`, `components/pricing-calculator.tsx:27-28`, `components/escrow-state-machine.tsx:31-32`, `app/dossier/track-b-product/page.tsx:109` | **Four** different rupee formatters (`formatInr`, `inr`, `rupees`, inline `toLocaleString`). They round differently: "₹709.70" vs "₹2,069" vs "₹6,40,000.00" | One `lib/format/money.ts` with `formatRupees(paise, { decimals: "never" \| "auto" })`. Show whole rupees to farmers |
| X-02 | `lib/marketplace-fleet.ts:57`, `components/pricing-calculator.tsx:23` | `HP_LABEL` defined twice | Import the one in `lib/catalog.ts` |
| X-03 | `lib/marketplace-kyc.ts:3-5`, `components/h3-map.tsx:32` | HP options defined twice, with different types (string vs number) | One `HP_TIERS` with `{ value, label, hp }` |
| X-04 | `search.tsx:11`, `listing-form.tsx:8`, `pricing-calculator.tsx:30`, `h3-map.tsx:42` | The same `field` class string pasted 4× | An `<Input>` / `<Select>` component (Phase 3 §1) |
| X-05 | `spatial.go:168-179`, `geo/anomaly.go:95-103`, `lib/h3-dispatch.ts:14-18` | Haversine implemented 3× | Fine across languages, but keep one per language in a `geo` package |
| X-06 | `store.go:199-210`, `lib/h3-dispatch.ts:5` | H3 edge-length table duplicated, approximate | Use the library's average-edge-length function (`getHexagonEdgeLengthAvg(res, UNITS.km)` in h3-js; the equivalent in h3-go) |
| X-07 | `redlock.go:212-214` | `ReleaseForced` is just `Release` | Delete |
| X-08 | `saga.go:206` | `(&redlock.SQLFencedBookingStore{}).ApplyTransition(rows)` creates an empty struct to call a 3-line function that checks `rows == 0` | `if rows == 0 { return fmt.Errorf("%w …", redlock.ErrStaleFencing) }` |
| X-09 | `internal/events/outbox.go:16-45` | `Publisher` and `Inbox` interfaces with no implementation; `Poller` only stores a duration | Delete until there is a publisher |
| X-10 | `lib/marketplace-bookings.ts:113-116` | Settlement replays a fake handover ("photos: 3 … kycOk: true") to compute a ledger | Compute the settlement from recorded events, or delete the demo route (S-03) |
| X-11 | `lib/marketplace-bookings.ts:57-62` | Test hooks (`resetStore`, `setBookingState`) exported from production code | Move to `lib/__test__/` or inject the store |
| X-12 | `lib/marketplace-quote.ts:55` | `export { DEPOSIT_RATE }` re-export used only to build a label | Import from `escrow-machine` where it's needed |
| X-13 | `saga.go:135` | Failed reservation emits `evtReserveInventory` (`booking.reserve_inventory`), the success event's name | Add `evtInventoryFailed = "booking.inventory_failed"` |
| X-14 | README.md:81 | `NEXT_PUBLIC_APP_ENV` and `NEXT_PUBLIC_DEMO_MODE` documented but never read; the "Demo mode" badge is hard-coded at `navbar.tsx:68` | Read `process.env.NEXT_PUBLIC_DEMO_MODE === "true"` or delete from the README |
| X-15 | `.scratch/skills-stack-e2e/` (22 tracked files), `.claude/skills/*` (8), `.claude/verify-skills.py` | An end-to-end harness for AI agent skills, run by `test-all.sh:24, 29` and CI `ci.yml:82` | Move to a separate tooling repo; the product's CI should test the product |


---

## 1B. Code readability and architecture

### C-01 [High] [Folder structure answers "who wrote it", not "what does it do"]
**Where:** Repository root; `README.md:35-45` (the "Zero-Leak Dual-Track Ownership Matrix"); `.claude/hooks/commit-guard.sh`.
**Problem:** *New developer, 5-minute test:* the first things they meet are a two-person ownership matrix, a commit hook that rejects commits by author, AI-skill folders, and three Go services that the running app doesn't use. They can't answer "where is the code that runs when a farmer taps Book?" (answer: `lib/marketplace-bookings.ts`, a demo store) without reading `ARCHITECTURE.md` to the end.
**Fix:** The target structure is in Phase 3 §4. The README's first screen should say what the product is, how to run it (`pnpm i && pnpm dev`), and where the request path lives.
**Effort:** M

### C-02 [Medium] [Vague or misleading names]

| Where | Current | Rename to | Why |
|---|---|---|---|
| `search.tsx:49` | `useMyLocation` | `requestBrowserLocation` | `use*` means a React hook; this is an event handler |
| `listing-form.tsx:51` | `f`, `setF` | `form`, `setForm` | Single letter for the main state |
| `listing-form.tsx:58` | `set` | `bindField` | Shadows nothing but says nothing |
| `listing-form.tsx:88-91` | `err`, `a11y`, `text` | `fieldError`, `fieldA11yProps`, `renderTextField` | |
| `listing-form.tsx:90` | `summary` | `errorCount` | It's a number |
| `marketplace-bookings.ts:41, 52, 55, 72` | `Rec`, `Store`, `G`, `fp` | `BookingRecord`, `DemoBookingStore`, `globalStore`, `requestFingerprint` | |
| `api/machines/near/route.ts:20-25` | `r`, `l`, `kk` | `radiusParam`, `limitParam`, `kParam` | |
| `search.tsx:10` | `Load` | `NearbyQueryState` | |
| `search.tsx:130` | `c`, `m` | `candidate`, `machine` | |
| `h3-map.tsx:78, 129` | `rankOf`, `rk` | `rankById`, `rank` | |
| `marketplace/page.tsx:6` vs `navbar.tsx:24` | `btn` (class string) vs `btn` (a ref) | `buttonClass` / `menuButtonRef` | Same name, two meanings |
| `booking-modal.tsx:60` | `authorise` | `submitBooking` | The function creates a booking |
| `lib/marketplace-kyc.ts` | file name "kyc" | `lib/listing/validate.ts` | It's listing validation, not KYC |
| `lib/marketplace-*.ts` | prefix on 6 files | `lib/rental/{places,catalog,quote,bookings}.ts` | Use a folder instead of a prefix |
| `--soil` token | `soil` | `--warning` | It's used for disputes, errors and badges, not "soil" |

**Effort:** S

### C-03 [Medium] [Files doing too much]
- `components/h3-map.tsx` (257 lines): projection maths, hit-testing, keyboard control, SVG, latency card, Redis pipeline card, form, results list and table. Split into `useFarmerPosition()`, `HexMap.tsx` (SVG only), `RankedList.tsx`, `PipelineCard.tsx` and `SandboxControls.tsx`.
- `app/dossier/track-a-systems/page.tsx` (169 lines): three hand-drawn SVG diagrams inline. Move them to `components/diagrams/*.tsx`.
- `app/marketplace/_components/search.tsx` (156 lines): fetching, validation, geolocation and cards. Extract `useNearbyMachines(place, dates)`, `SearchFilters.tsx` and `MachineCard.tsx`.
- `components/escrow-state-machine.tsx`: the reducer wrapper, log, buttons and ledger. Acceptable as a demo, but it belongs in the showcase area.

**Effort:** S each

### C-04 [Medium] [Inconsistent API error shapes]
**Where:** `app/api/machines/near/route.ts:10` returns `{ error }`. `lib/marketplace-bookings.ts:11` and `app/api/*/route.ts` return `{ code, message }`. Go returns `{ error }`.
**Fix:** Use one shape everywhere, `{ code: string, message: string, field?: string }`, with `message` as an i18n key (`"errors.machine_unavailable"`), so the client renders it in the user's language.
**Effort:** S

### C-05 [Medium] [The OpenAPI contract doesn't match the routes]
**Where:** `contracts/openapi.yaml:11, 18, 56, 82`.
**Current:** `servers: url: https://api.khetirental.in/v1` plus paths `/v1/bookings` gives `/v1/v1/bookings`. `/machines/near` has no `/v1`. There are no `securitySchemes`. Go returns `"candidates": null`, which breaks `required: [candidates]` (verified).
**Fix:** Use paths without `/v1`, add `components.securitySchemes.session` (cookie), and add `GET /bookings`, `GET /bookings/{id}`, `POST /bookings/{id}/cancel`, the machines CRUD and `/auth/otp`. Generate types with `openapi-typescript` so the portal can't drift.
**Effort:** S

### C-06 [Medium] [Type-safety gaps]

| Where | Current | Fix |
|---|---|---|
| `lib/marketplace-bookings.ts:38` | `return { ok: true, value: o as unknown as BookingCreate }` | Parse with `zod`: `BookingCreate.safeParse(b)` |
| `lib/marketplace-places.ts:24-26` | Type guard trusts `hp`/`reputation`/`score` without checks | `zod` schema for `NearResponse` |
| `listing-form.tsx:54` | `Partial<Record<string, string>>` | `Partial<Record<keyof ListingForm \| "aadhaar" \| "rc", string>>` |
| `lib/marketplace-fleet.ts:36` | `tierFromHp(d.hp)!` | Throw a descriptive error at build time instead of `!` |
| `pricing-calculator.tsx:96-108` | `result.rate!`, `result.net!`, `result.broker!` | A discriminated union `{ ok: true, rate, net, broker } \| { ok: false, error }` |
| `search.tsx:66` | `e.target.value as Activity` | `ACTIVITIES.find(a => a === e.target.value) ?? activity` |

**Effort:** S

### C-07 [High] [Hard-coded values that should be config, tokens or translations]
- **Every visible string is inline English** (about 250 strings across 14 files). There is no i18n layer at all (see A-07).
- `DIESEL_PRICE_INR = 91` (`marketplace-quote.ts:14`) and `useState("91")` (`pricing-calculator.tsx:38`). Move to config, refreshed weekly per state (diesel prices vary by state).
- `"13.5%"` typed as text in `pricing-calculator.tsx:171` and `escrow-state-machine.tsx:119`. Derive from `DEFAULT_TAKE_RATE`.
- `BROKER_MARKUP = 0.38` in `pricing-calculator.tsx:22` and as a default parameter in `pricing-engine.ts:81`.
- `T06:00:00+05:30` (`booking-modal.tsx:70`). Should be a slot or time setting.
- `VILLAGES` (`marketplace-places.ts:4`) should be data, not code.
- Colors outside tokens: `text-red-700`, `text-red-400`, `bg-black/60`, `fill="#fff"` (V-04).

**Effort:** M (i18n) / S (the rest)

### C-08 [High] [Over-engineered for the stage; under-engineered where it matters]
**Over-engineered** (none of it serves a request today):
- Redlock with quorum-minted fencing tokens and heartbeats (`redlock.go`, 270 lines plus 20 tests) for a lock that one Postgres constraint makes unnecessary (F-09).
- A saga with a transactional outbox and an idempotent inbox, with no Kafka client and no publisher.
- An LWW-Element-Set CRDT for telemetry from devices that don't exist yet.
- A commit hook that enforces per-person file ownership on a two-person project.
- `lib/evidence.ts` plus tests that pin resume bullet text.

**Under-engineered** (all needed for a first real booking):
- Identity and auth, a product database, a `machines` table, a booking time range and overlap constraint, i18n, image upload, notifications, payments and the owner side.

**Fix:** Freeze the Go services as a showcase. Build the product on Next.js route handlers plus Postgres/PostGIS (Phase 3 §4). Revisit Go only when one Postgres can't keep up, which for a few thousand machines per district will not happen soon.
**Effort:** decision S, migration M

### C-09 [Low] [Comments that contradict the code]
- `redlock.go:8-10` and `fenced_store.go:4-8` say a write needs a token "strictly greater than" the stored one. The SQL at `fenced_store.go:42` uses `fencing_token <= $3` (greater **or equal**). The SQL is right for same-holder re-writes, so fix the comments.
- `ARCHITECTURE.md:64` says "PostgreSQL 15". Everywhere else says 17.
- `match-service/main.go:7` says k=2 is "≈ 0.9 km radius at Res8". k=2 at Res 8 is about 1.6–1.8 km centre to centre.

**Effort:** S

---

## 1C. Visual design

### V-01 [High] [The overall look: competent, generic, not a brand]
**Where:** Every screen. Screenshots at 1440 px: `/` and `/marketplace/search`.
**Current:** Slate-50 background, white rounded-xl cards with a 1 px slate-300 border, emerald-700 buttons, Figtree, lucide icons, no images. Every hex value is a stock Tailwind swatch (inventory above).
**Problem:** *Designer:* this is the default "Tailwind dashboard" look with the colors renamed. Nothing on screen says rural India, machinery, soil, season or people. *Owner (you):* "Apple / Stripe / Awwwards" is the brief, and this is a well-kept admin panel. *Farmer:* nothing visual (photos, machine silhouettes, job icons) helps a low-literacy user recognise what they're looking at.
**Fix:** The new palette, type and imagery system is in Phase 3 §1. In short: warm "mitti" neutrals instead of blue-grey slate, a deep indigo ("neel") for actions, mustard ("sarson") for highlights and selected states, real photography of the listed machine on every card, and a hand-drawn machine-icon set for job types.
**Effort:** L

### V-02 [High] [Input and card borders are almost invisible, especially in sunlight]
**Where:** `app/globals.css:14` (`--line: #cbd5e1`), `:30` (dark `#1e293b`); used by every `field` class (`search.tsx:11`, `listing-form.tsx:8`) and every card.
**Current:** `#cbd5e1` on `#ffffff` = **1.48:1**. On `#f8fafc` = **1.42:1**. Dark mode `#1e293b` on `#111827` = **1.21:1**. WCAG 1.4.11 needs **3:1** for the boundary of a form control.
**Problem:** *Farmer outdoors at noon:* the input boxes on the search form and the listing form dissolve into the white card. People can't see where to tap.
**Fix:** Use two border tokens: `--border-control: #7C7062` (4.83:1 on white) for inputs, selects and checkboxes, and `--border-subtle: #E5DDD1` for decorative card edges. Dark: `--border-control: #A39684` (about 6:1 on `#211C18`).
**Effort:** S

### V-03 [High] [Opacity variants of the color tokens are silently dropped]
**Where:** `tailwind.config.ts:7-15` (`primary: { DEFAULT: "var(--primary)" }` and the others); used at `navbar.tsx:61` (`bg-bg/95`), `booking-modal.tsx:151` (`bg-primary/10`), `listing-form.tsx:25` (`bg-primary/5`).
**Current:** Tailwind 3 can't apply `/95` to `var(--bg)`, so it **generates no CSS** for those classes. Verified in the built CSS, and verified at runtime: the sticky header's computed background is `rgba(0, 0, 0, 0)`, so content scrolls underneath it, blurred. The booking success message has no tint, and the drop zone gets no drag highlight.
**Fix:**
```css
:root { --primary: 34 53 133; --bg: 250 248 244; /* channels, no rgb() */ }
```
```ts
colors: { primary: "rgb(var(--primary) / <alpha-value>)", bg: "rgb(var(--bg) / <alpha-value>)", … }
```
**Effort:** S

### V-04 [Medium] [Error red and the overlay bypass the token system]
**Where:** `search.tsx:80, 85, 113`; `booking-modal.tsx:125, 147`; `listing-form.tsx:10` (`text-red-700 dark:text-red-400`); `booking-modal.tsx:97` (`bg-black/60`); `h3-map.tsx:137` (`fill="#fff"`).
**Fix:** `--danger` (light `#B42318`, dark `#F97066`), `--overlay: 19 16 13 / 0.6`, `--on-color: #fff`. Replace all 6 `text-red-*` uses with `text-danger`.
**Effort:** S

### V-05 [Medium] [Disabled buttons fade out with no reason given]
**Where:** `search.tsx:148-150` ("Book", `disabled:opacity-50`, about 2.16:1); `components/escrow-state-machine.tsx:142` (`disabled:opacity-40`, 1.83:1).
**Problem:** *Farmer:* after typing an invalid date, all six "Book" buttons fade to pale green and nothing says why. The date error is 300+ px above, in the form.
**Fix:** Keep "Book" enabled. When tapped with invalid inputs, scroll to the first invalid field and focus it. For truly unavailable states, use a neutral style (`bg: var(--n100); color: var(--n600)`, 6.96:1) with a reason: "Busy on your dates".
**Effort:** S

### V-06 [Medium] [Every color is a stock Tailwind swatch]
**Where:** `app/globals.css:6-36`.
**Current:** `#047857` emerald-700, `#0f172a` slate-900, `#475569` slate-600, `#cbd5e1` slate-300, `#f8fafc` slate-50, `#78350f` amber-900, `#1d4ed8` blue-700, `#b45309` amber-700, `#34d399` emerald-400, `#94a3b8` slate-400, `#1e293b` slate-800.
**Problem:** This combination (slate plus emerald) is the default palette of thousands of generated dashboards. That is a big part of why the site "looks AI".
**Fix:** The palette in Phase 3 §1. Every value there is checked for contrast.
**Effort:** S (tokens) once V-03 is fixed

### V-07 [High] [Type is too small for the audience and has no Devanagari]
**Where:** `app/layout.tsx:6` (`Figtree({ subsets: ["latin"] })`); `search.tsx:63-103` (`text-sm` labels wrapping their inputs); `search.tsx:85-87`, `:120-122` (`text-xs`).
**Current:** The most common size on the search page is **14 px**. Inputs render at **14 px**, because they inherit `text-sm` from the wrapping `<label>`. Help text such as "We assume about 0.75 hour per acre…" is **12 px**. Figtree has no Devanagari glyphs, so Hindi or Marathi text would fall back to the phone's system font at a different size and weight, mid-sentence.
**Problem:** *Farmer, 40+, outdoor, budget phone:* 12–14 px grey text is hard to read in sunlight. iOS zooms the page when a focused input is under 16 px. Mixed scripts look broken.
**Fix:** Body text at 18 px, never below 14 px, inputs at 18 px. A font with Latin and Devanagari designed together (Mukta, or Hind) for app screens. The type scale is in Phase 3 §1. Move inputs out of `text-sm` labels:
```tsx
<label htmlFor="acres" className="text-label">Farm size</label>
<input id="acres" className="text-body …" />
```
**Effort:** M

### V-08 [Medium] [Too many type sizes and weights for the amount of content]
**Where:** Inventory above: 9 sizes and 4 weights. For example the search card (`search.tsx:137-153`) uses 600 (title), 400 (owner), 700 (price), 400 (unit), 400 (meta) and 600 (button) inside 300 px.
**Fix:** Use two weights, 400 and 700 (600 only for buttons and labels if the font has it), and seven sizes (Phase 3 §1).
**Effort:** S

### V-09 [Medium] [Fourteen spacing steps and five page widths]
**Where:** Inventory above. `py-14` (`page.tsx:23`), `mt-7` (`page.tsx:32`), `*-5` (20 px, 32 uses), `py-2.5` (7 uses), and the `max-w-3xl/4xl/5xl/7xl/screen-2xl` containers.
**Current:** At 1440 px the H1's left edge sits at **224 px** (home), **288 px** (marketplace), **96 px** (search), **352 px** (listing) and **96 px** (pricing). The page appears to jump sideways as you navigate.
**Fix:** A spacing scale of 4/8/12/16/24/32/48/64/96 px. Change `p-5` and `gap-5` (20) to `p-4` (16) on mobile and `p-6` (24) on desktop, `py-2.5` (10) to `py-3` (12), `mt-7` (28) to `mt-8` (32), and `py-14`/`mt-14` (56) to `py-16`/`mt-16` (64). Use one app container `max-w-[72rem] px-4 sm:px-6` (1152 px) and one reading width `max-w-prose` *inside* it, so the H1's left edge is identical on every app page.
**Effort:** S

### V-10 [Medium] [Inconsistent radius, and boxes with no radius at all]
**Where:** Primary buttons: `rounded-md` (`page.tsx:33`, `navbar.tsx:52`) and `rounded-lg` (`marketplace/page.tsx:6`, `search.tsx:150`, `booking-modal.tsx:158-168`). Cards: `rounded-xl` (search cards, forms), `rounded-2xl` (`pricing-calculator.tsx:149`), `rounded-lg` (dossier diagrams), **none** (`page.tsx:70` home track cards, `architecture/page.tsx:48` ADR items, `track-b-product/page.tsx:92`).
**Fix:** Three radii only. `--radius-control: 10px` (buttons, inputs, chips), `--radius-card: 16px` (cards, sheets, modal), `--radius-pill: 999px` (badges, filter chips). Apply `--radius-card` to every bordered or filled surface.
**Effort:** S

### V-11 [Low] [Shadows]
**Where:** `booking-modal.tsx:105` (`shadow-xl`) is the only shadow.
**Fix:** Keep the flat style. Define `--shadow-sheet: 0 -8px 24px rgb(19 16 13 / 0.14)` for bottom sheets and modals, and `--shadow-raised: 0 2px 8px rgb(19 16 13 / 0.08)` for the sticky "Book" bar only. Nothing else.
**Effort:** S

### V-12 [Low] [The price breakdown looks like a file drop zone]
**Where:** `booking-modal.tsx:131` (`border border-dashed`) and `listing-form.tsx:25` (`border-2 border-dashed`).
**Fix:** Dashed borders mean "drop here or empty slot". Give the price breakdown a solid `--n50` filled panel with a top rule above the total.
**Effort:** S

### V-13 [High] [Equipment cards can't be scanned in 2 seconds]
**Where:** `app/marketplace/_components/search.tsx:130-155` (results grid; at 375 px each card is 309 × about 190 px).
**Current:** The order is: model name (16/600) → owner and village (14 muted) → **price** (24/700, with paise: "₹709.70", "₹1,239.30", but "₹2,069") → HP · distance · rating (14 muted, one line) → full-width "Book". No photo, no availability, no attachments, no operator info, no review count.
**Problem:** *Farmer comparing three tractors:* they need four things, *how far, how much, free on my day, can I trust him*. Distance and trust are the smallest text on the card. Availability isn't there at all. Paise on an hourly tractor rate is noise.
**Fix:**
```
┌──────────────────────────────┐
│ [photo 16:9, 120 px tall]    │  ← real photo, lazy, ≤ 40 KB AVIF
│ Free 2–4 Nov ●               │  ← green chip on the photo, top-left
├──────────────────────────────┤
│ ₹710 / hour   ·  with driver │  ← 24/700, whole rupees
│ Mahindra 275 DI · 35 HP      │  ← 18/400
│ 📍 0.9 km · Sanganer          │  ← 16/400, icon 20 px
│ ★ 4.8 (23)  · Bhanwar Lal    │  ← 16/400
│ [ Book for 2–4 Nov ]  56 px  │
└──────────────────────────────┘
```
Round prices with `Math.round(paise/100)`.
**Effort:** M

### V-14 [High] [No map in the farmer flow; the "map" is an engineering diagram]
**Where:** `/marketplace/search` has no map. `components/h3-map.tsx:104-146` is an SVG of hexagons with "A/D/U" letters at 0.3 user units and no roads, villages or landmarks.
**Problem:** *Farmer:* "3.4 km" means little without "towards Muhana, past the canal". *Owner:* wants to see where demand is.
**Fix:** Results are **list first**, with a "Map" toggle (not a split view on mobile). The map uses lightweight raster tiles with Leaflet (about 42 KB gz), lazy-loaded only when toggled. Markers are circles 36 px across with a machine-category glyph and the price label ("₹710"). Cluster above 30 markers. Tapping a marker opens a bottom sheet with the same card as the list. The farmer's location is a pulsing ring, plus a "Search this area" button after panning. Keep the hex sandbox for the showcase site.
**Effort:** M

### V-15 [Medium] [No component library; buttons have 4 sizes and no hover or pressed states]
**Where:** Primary buttons: `px-4 py-2.5` (`page.tsx:33`, `booking-modal.tsx:158, 163`), `px-5 py-3` (`marketplace/page.tsx:6`), `px-3 py-2 text-sm` (`search.tsx:150`, `escrow-state-machine.tsx:142`), `px-5 py-2.5` (`listing-form.tsx:145`). None of the `bg-primary` buttons has a `hover:` or `active:` style (grep: the only `hover:` classes in the app are on nav links, "Use my location" and "Choose file").
**Fix:** One `<Button variant="primary|secondary|ghost|danger" size="md|lg" loading>`. `lg` is 56 px tall, 18 px text (all farmer CTAs); `md` is 48 px, 16 px. Hover is primary-600 to 700. Pressed is `translate-y-px` plus 800. Focus is a 3 px outline offset by 2 px. Disabled is the neutral fill plus a reason. Loading shows a spinner and keeps the width. The same goes for `<Input>`, `<Select>`, `<ChipGroup>`, `<Sheet>`, `<Toast>` and `<Card>`. Sizes and tokens are in Phase 3 §1.
**Effort:** M

### V-16 [Low] [Icons: one consistent set, but generic, with mixed sizes]
**Where:** All lucide (good, consistent 2 px stroke). Sizes `h-3.5` (`search.tsx:144-145`), `h-4`, `h-5`, `h-6` (`navbar.tsx:65`). The logo is the stock lucide `Sprout` (`navbar.tsx:65`). The rating star is an outline.
**Fix:** Icons at 20 px inline and 24 px in buttons and navigation. A custom wordmark plus symbol (for example a stylised tractor rear wheel), never a library icon. A filled star for ratings. A dedicated illustrated set of 8 machine and job pictograms (Phase 3 §1). That is where personality should live.
**Effort:** M

### V-17 [High] [No images anywhere: no photos, favicon, Open Graph image or manifest icon]
**Where:** There is no `public/` folder and no `app/icon.*` or `app/opengraph-image.*`.
**Problem:** *Farmer:* can't see the machine, which is the single biggest trust signal in equipment rental. *Sharing:* a WhatsApp share of the link shows a grey box. *Browser tab:* default icon.
**Fix:** Require 3 owner photos per listing (F-11). Add `app/icon.svg`, `app/apple-icon.png` (180 px), `app/opengraph-image.tsx` (1200×630: a tractor photo plus "Rent a tractor near your village" in Hindi and English), and `app/manifest.ts`.
**Effort:** S (icons) / M (photo pipeline)

### V-18 [High] [Laptops get the phone menu; mobile search buries the results]
**Where:** `tailwind.config.ts:16` (`screens: { nav: "1360px" }`); `navbar.tsx:70-83`; `search.tsx:62-103`.
**Current:** At **1024 px and 1280 px** the desktop nav is hidden and a hamburger appears (verified, screenshot `nav-open-1280`). At 375 px the search form is about 700 px tall, so the first result card starts at y ≈ 860 px, below the fold on every phone.
**Fix:** Once F-01 cuts the nav to 3 items it fits at `md`, so delete the `nav` breakpoint. On mobile, put the search in a compact sticky summary bar ("Rotavator · 2–4 Nov · Sanganer · 10 km [Change]") that opens a full-screen sheet. Results start at y ≈ 140 px.
**Effort:** M

### V-19 [Low] [Dark mode exists but isn't designed for this audience]
**Where:** `app/globals.css:21-36` (system preference only, no toggle).
**Current:** Mostly complete. Failures: borders 1.21:1 (V-02), and the H3 map's white letters on `#059669` at 3.77:1.
**Recommendation:** Keep it and fix the borders, but treat **light as the designed default**, because the main use is outdoors in daylight. Dark mode does save battery on AMOLED budget phones, which is a real benefit, so keep following the system setting. Add a manual toggle in Settings, not in the header.
**Effort:** S

### V-20 [Low] [Motion]
**Where:** The only animation is the spinner (`booking-modal.tsx:165`, `animate-spin`). The modal and mobile menu appear and disappear with no transition.
**Fix:** The app keeps motion minimal and purposeful: the sheet slides up 200 ms `cubic-bezier(.2,.8,.2,1)`, toasts fade 150 ms, and the selected chip fills 120 ms. Everything sits inside `@media (prefers-reduced-motion: no-preference)`. The landing page carries the motion (Phase 3 §2).
**Effort:** S

### V-21 [High] [Home page hierarchy points the eye at engineering metrics]
**Where:** `app/page.tsx:25-66` (screenshots `light-1440_.png`, `light-375_.png`).
**Current:** What the eye sees first: (1) the 48 px H1 "…booked in milliseconds…", (2) four 30 px green numbers, "5,000", "2.91 ms", "20 / 20" and "27.5 %", with file paths in monospace beside them, (3) two cards named after the founders. The primary CTA, "Try the marketplace", is a 177 × 44 px button.
**What it should be:** (1) a photo or illustration of a tractor working a small field, with "Need a tractor? Rent one from your village", (2) a PIN or village input with a big **Find tractors** button, (3) "Own a tractor? Earn when it's idle", (4) three steps with pictures, (5) a phone number. That is the storytelling page in Phase 3 §2.
**Effort:** L

### V-22 [Medium] [Tablet and landscape (768 px) layout wastes space and hides results]
**Where:** `app/marketplace/_components/search.tsx:62` (`lg:grid-cols-[18rem_minmax(0,1fr)]`, so side-by-side only from 1024 px), `:70` (`grid gap-4` keeps From and To stacked at every width); `components/escrow-state-machine.tsx:55` (`sm:grid-cols-5`). Screenshot `light-768_marketplace_search.png`.
**Current:** At 768 px the search form is one column of 694 px-wide inputs. The 12 px help text runs the full width. The results heading starts at y ≈ 785 px. On `/escrow` the five stage pills are 141 × 78 px each, with their labels wrapped onto 3 lines.
**Fix:** From `md` (768 px), put From and To on one row (`md:grid-cols-2`) and the farm size and village on one row, which cuts the form height by about 40 %. Better still, the mobile pattern in V-18 (a summary bar plus a sheet) works at every width up to `lg`. On the escrow page, use a vertical stepper below `lg`.
**Effort:** S

### V-23 [Low] [Component-by-component inventory]
Each component type the brief asked about, and its state today:

| Component | What exists | Missing states / problems | Fix |
|---|---|---|---|
| Buttons | 4 primary recipes, 1 secondary, the escrow `Action` (`escrow-state-machine.tsx:139-144`), text links | No hover or pressed on primary; disabled = opacity only; loading only in the modal | `<Button>` (V-15) |
| Text inputs | Raw `<input>` with the `field` class (4 copies) | 1.48:1 border (V-02); 14 px text inside labels (V-07); no `maxLength` (F-38) | `<Input>` |
| Dropdowns | Native `<select>` (job, village, HP, presets) | Fine on Android (native picker), but 37 px tall and text-only | `<Select>` 52 px; for jobs use picture tiles |
| Date pickers | Native `<input type="date">` | Good on Android (localised calendar). It shows the browser's format (mm/dd/yyyy on an English-US phone) and allows past dates (F-21) | Keep native; add quick chips (Tomorrow / This week) and `min` |
| Checkboxes | Native, 13 × 13 px (`listing-form.tsx:123`) | Too small (A-01) | `<ChipGroup multiple>` |
| File upload | Hidden input + "Choose file" button + drop zone | "Drop" copy on phones; no camera option (A-09) | "Take photo" / "Choose from gallery" |
| Modal | Booking modal: bottom sheet on mobile, centred on desktop, proper focus trap | No open or close transition; can close mid-request (F-34) | `<Sheet>` built from this one |
| Toasts | None | Success and errors are inline only | `<Toast>` |
| Tables | Home evidence table (`page.tsx:43-65`, header hidden with `sr-only`), H3 tractor table, dossier tables | Fine semantically; not needed in the product | Showcase only |
| Navigation | Sticky header, desktop links from 1360 px, hamburger below | Transparent background (V-03); hamburger on laptops (V-18); no active state on sub-pages (A-05) | 3-item nav, bottom bar on mobile |
| Badges | "Demo mode" pill (`navbar.tsx:68`) | Only one badge; status (free/busy/new) has no component | `<Badge>` |
| Icons | lucide only | Sizes 14–24 px mixed (V-16) | 20 / 24 px rule |
| Charts | recharts bar charts (pricing, dossier), CSS stacked bar in `RateCard` | 109 KB for two bars (P-03) | Inline SVG |
| Empty states | Text only | No illustration or next action | `<EmptyState>` |


---

## 1D. "Looks AI-generated" hunt

**Honest verdict first.** The classic slop is **absent**: no purple gradients, no glassmorphism cards, no emoji in headings, no "Unlock the power of", no fake testimonials, no "10,000+ happy farmers". Someone already cleaned that up. What's left is a subtler set of tells: **engineering-portfolio vocabulary pushed into product UI, over-hedging, comments that cite AI skills, and stock-Tailwind sameness.** Each one is below with a human rewrite.

| ID | Where | Exact current text or code | Why it reads as generated | Human version |
|---|---|---|---|---|
| AI-01 | `app/page.tsx:25-27` (home H1) | "Tractors for small farms, booked in milliseconds and paid for only by the verified hour." | Two technical boasts (latency, verification) in one sentence aimed at farmers. Nobody books a tractor "in milliseconds" | **"Need a tractor? Rent one from your village."** Sub: "See the price first. Pay the owner after the work is done." |
| AI-02 | `app/page.tsx:44-48` | "Evidence ledger · Every number on this site comes from a file in the repository." | Audit language aimed at a reviewer, not a user | Remove from the product. On the showcase site: "How we measured this" |
| AI-03 | `README.md:35` | "Zero-Leak Dual-Track Ownership Matrix" | Grandiose capitalised coined term | "Who owns which folder" (and move it to CONTRIBUTING.md) |
| AI-04 | `ARCHITECTURE.md:6` | "expanded to a production-grade distributed system in 2026" | The orchestrator has no binary and there is no deploy config (F-31, D-04) | "Rebuilt in 2026 as Go services with tests; not yet deployed" |
| AI-05 | `contracts/openapi.yaml:22`, `ARCHITECTURE.md:42` | "O(1) H3 spatial query" | Big-O name-dropping; the k-ring read is O(k² + machines in ring) | "Fixed number of Redis reads per search" |
| AI-06 | `services/telemetry-gateway/internal/geo/anomaly.go:2` | "skills/marketplace-risk-escrow (Amazon INVEST standard)" | INVEST is a checklist for user stories and has nothing to do with geofencing. Authority name-dropping | "Rules D-01 and D-02 from contracts/escrow-state-machine.md §3" |
| AI-07 | `saga.go:6`, `outbox.go:2`, `redlock.go:3, 49`, `spatial.go:2, 32`, `store.go:198`, `telemetry main.go:11`, `002_outbox_inbox.sql:1`, `globals.css:15` | "per kafka-saga-orchestrator skill", "per the skill spec", "values from skills/go-systems-architect/SKILL.md", "validated (dataviz skill)" | Code comments that cite the AI agent's prompt files as the authority. A reader can't evaluate "per the skill spec" | Cite the ADR or the measured reason: "// Edge lengths: H3 docs, average hexagon edge per resolution", "// CVD-safe: ΔE ≥ 22 under deuteranopia simulation" |
| AI-08 | `search.tsx:86`, `booking-modal.tsx:126, 144`, `search.tsx:121`, `marketplace/page.tsx:27` | "That is our estimate, not a measurement." / "The estimate is our assumption; change it if the owner agrees a different time." / "(an assumption)" ×3 / "This is a demo. Tractors, owners and ratings are made up…" | The hedging is honest but repeated so often it sounds like a model protecting itself, and it confuses farmers | One line under the price: "Estimated. You pay for the hours actually used." Put all assumptions on one "How we price" page |
| AI-09 | `app/pricing/page.tsx:11` | "Rate = (B_base × μ_season × δ_soil) + (D_wear × κ_age) + (F × P_diesel)" | Greek-letter formula on a farmer-reachable page | Farmer version: "Your price = owner's rate + diesel used. No hidden charges." The formula moves to the showcase |
| AI-10 | `navbar.tsx:65-66`, `layout.tsx:8` | Stock lucide `Sprout` logo plus "KhetiRental **v2.0**" | Library icon as logo; version number as part of the brand | A custom mark; "KhetiRental" (versions belong in the footer or changelog) |
| AI-11 | `app/dossier/*` | "Resume bullets", "Interview defence: The four questions a case interviewer is most likely to push on" | Interview prep published on the product's domain | Remove from the public site (F-01) |
| AI-12 | Every surface | `rounded-xl border border-line bg-surface p-5` on the form, the cards, the ledger, the event log, the sandbox panels and the pricing cards | "Everything in a bordered rounded box": the default generated layout | Use boxes only for things you can tap. Let headings and whitespace separate sections. Full-bleed photos on cards |
| AI-13 | `components/h3-map.tsx:10` | Status "In-use" | Odd hyphenation of a generated label | "Busy" |
| AI-14 | `marketplace-fleet.ts:31` | Eight made-up owner names cycled through 60 machines, with ratings from `rnd()` | Fake data shown with the same weight as real data | Keep it in tests. In the demo, show "Sample owner" plus a "Sample data" ribbon on each card |
| AI-15 | `.scratch/skills-stack-e2e/`, `.claude/skills/dual-track-resume-quantifier/`, `graphify-out/` (2.2 MB, ignored) | AI tooling experiments inside the product repository | Leftover scaffolding | Move to a separate tooling repo (D-05) |

**Code comments in general** are actually *better* than typical AI output. Most explain *why* (for example `search.tsx:25` "Set on mount so server and client markup agree", `booking-modal.tsx:19` "a retry after a dropped connection can never create a second booking"). Keep that style. Only the skill citations (AI-07) need to go.

---

## 1E. Content and microcopy

### T-01 [High] [Jargon everywhere a farmer reads]
Words a farmer may not know, or that mean something else to them: **escrow, authorise, pre-auth, deposit tier floor, telematics, geofence, HP tier, acquisition cost, implements, listing, marketplace, demo, dossier, sandbox, ADR, take rate, ΔH, k-ring, Res 8**. Full rewrites are in the copy table in Phase 3 §6.

### T-02 [Medium] [Inconsistent capitalisation]
Nav items use Title Case ("Marketplace Demo", "Pricing Engine", "Architecture & ADRs"). Headings use sentence case ("Find a tractor near you"). The same concept is written two ways: "3-Stage Escrow" (nav) and "3-stage milestone escrow" (H1 at `escrow/page.tsx:9`). **Rule:** sentence case everywhere, including buttons and nav.

### T-03 [Medium] [Error messages leak developer language or are vague]

| Where | Current | Problem | Rewrite |
|---|---|---|---|
| `booking-modal.tsx:82` | `We could not accept this booking. ${data.message}` → "…hours must be a whole number from 1 to 720." | Concatenates a server string written for developers. It can't be translated | "Hours must be a whole number from 1 to 720." (one translated key per error code) |
| `booking-modal.tsx:85` | "Something went wrong on our side. Try again in a moment." | OK, but no next step if it keeps failing | "Something went wrong on our side. Try again, or call us on 1800-XXX-XXXX." |
| `booking-modal.tsx:88` | "Could not reach the server. Check your connection and try again. Retrying cannot book twice." | "Server" is jargon. The last sentence reassures, but awkwardly | "No internet connection. Your booking wasn't sent. Tap **Try again** when you have signal – you won't be charged twice." |
| `search.tsx:39` | "We could not load nearby tractors. Check your connection and try again." | No button to try again (F-20) | Same text plus a **[Try again]** button |
| `search.tsx:114` | "No tractors within 4 km. Try another village." | A dead end | "No tractors free within 10 km on these dates. [Search up to 25 km] [Try other dates]" |
| `marketplace-kyc.ts:36` | "The RC owner name does not match your name, so we cannot list this tractor. Use the RC that is registered to you." | Accusatory, and a hard block (F-17) | "The name on the RC looks different from yours. We'll call you to check – your tractor will go live after that." |
| `api/machines/near/route.ts:15` | "lat is required and must be a number in [-90, 90]" | Fine for an API; must never reach the UI | Keep, but map it to a user message in the client |

### T-04 [Medium] [Not ready for translation]
- **Concatenation and inline plurals:** `listing-form.tsx:101` (`` `Fix ${summary} ${summary === 1 ? "thing" : "things"} below…` ``); `search.tsx:86, 107, 111, 114, 148`; `booking-modal.tsx:109, 110, 118, 126, 132, 134, 152`. Hindi and Marathi word order differs ("Sanganer ke paas tractors"), so templates need named placeholders and ICU plurals: `"{count, plural, one {# problem} other {# problems}} to fix"`.
- **Dates shown in ISO format:** `booking-modal.tsx:126` → "Starts 2026-11-02 at 6 am". Use `Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short" })` → "सोम, 2 नव॰" / "Mon, 2 Nov".
- **Numbers:** `toLocaleString("en-IN")` is hard-coded (`marketplace-quote.ts:59`). Use the active locale. Hindi and Marathi users may prefer Latin digits; make that a setting with Latin digits as the default, and still parse Devanagari input (F-23).
- No text is baked into images (because there are no images). Keep it that way.

### T-05 [Low] [Page titles and meta]

| Route | Current `<title>` | Rewrite |
|---|---|---|
| `/` | KhetiRental v2.0 \| Agritech Sharing & Architecture Showcase | KhetiRental – Rent a tractor near your village |
| `/marketplace/search` | Find a tractor \| KhetiRental v2.0 | Tractors near Sanganer · 2–4 Nov – KhetiRental (dynamic) |
| `/marketplace/listing` | List your tractor \| KhetiRental v2.0 | Earn from your tractor – KhetiRental |
| `/does-not-exist` | (the home title) | Page not found – KhetiRental |

Meta description (`layout.tsx:9-10`): "Explore how KhetiRental matches farmers with nearby tractors…" → **"Find tractors, rotavators and harvesters for rent near your village. See the full price before you book. Owners: earn from idle machines."** Add a Hindi `alternates.languages` entry.

### T-06 [Low] [Copy on the showcase pages (escrow, sandbox, pricing, architecture, dossiers)]
These pages are for engineers and reviewers, so jargon is acceptable there. But they are public and linked from a farmer product, so each one needs a one-line plain-language opening, and a few labels are confusing even for engineers.

| Where | Current | Rewrite |
|---|---|---|
| `escrow/page.tsx:10-13` (intro) | "Money moves only when each stage is verified: handover, the telematics window, then the return audit. Try the breach and tamper buttons to see dispute rules D-01 and D-02 freeze settlement." | "This simulator shows how a booking's money is held and released. Press the buttons in order, or try the problem buttons to see what happens when something goes wrong." |
| `escrow-state-machine.tsx:80` | "Complete handover (OTP + 3 photos + meter lock)" | "Hand over the machine" (details in a hint below) |
| `escrow-state-machine.tsx:85, 89` | "Simulate geofence breach >500 m" / "Simulate hour tamper >10%" | "Machine taken too far from the field" / "Hour meter doesn't match GPS" |
| `escrow-state-machine.tsx:95` | "Engine hours used (ΔH): 8 h of 10" | "Hours used: 8 of 10 booked" |
| `escrow-state-machine.tsx:72` | "Rule fired: none" | "Problem detected: none" |
| `escrow-state-machine.tsx:19` | "Pre-auth: funds held" | "Money held" |
| `architecture/h3-spatial/page.tsx:9` | "Find the nearest free tractor with H3 hexagons" | (keep; it's clear) |
| `h3-map.tsx:22-24` | "Res 8: village dispatch, ~460 m edge" | "Small hexagons (about 460 m)", with "Res 8" in brackets for engineers |
| `h3-map.tsx:198` | "K-ring depth" | "How many rings of neighbours to search" |
| `h3-map.tsx:220` | "Ring: 19 cells = 3k(k+1)+1 at k=2, edge ~460 m" | (keep for engineers; add a tooltip) |
| `pricing-calculator.tsx:62, 70` | "Season surge (μ = 1.45)" / "Soil type (δ = 1.00)" | "Season (harvest: ×1.45)" / "Soil (loam: ×1.00)" |
| `architecture/page.tsx:24-27` | "Three Go services, a Postgres system of record with a transactional outbox, Redis for spatial search and locks, and this portal." | Keep, but add a plain first line: "How the app finds machines, stops double bookings and keeps money safe." |
| `track-a-systems/page.tsx:123-126` | "How KhetiRental finds a tractor in under 3 ms at harvest-surge load…" | Keep on the showcase; remove from anywhere a farmer can reach |

### T-07 [Medium] [The pricing page shows a raw developer error]
**Where:** `components/pricing-calculator.tsx:40-47, 93`.
**Current:** Verified: clear the diesel field and the page shows **"Check the inputs: dieselPriceInr must be a finite number in [1, 1000], got 0"**. Typing 5000 gives the same message with "got 5000".
**Problem:** A variable name and interval notation shown to users. It also shows the internal check fired, rather than the form preventing the bad value.
**Fix:** Validate the field in the form and show "Enter a diesel price between ₹1 and ₹1,000 a litre." next to it. Keep `RangeError` for programming mistakes only. Never render `e.message` to users; map known errors to message keys and fall back to "Something went wrong."
**Effort:** S

---

## 1F. User interviews (role-played)

These are role-played walkthroughs of the current build, written in each persona's voice. They are not real interviews. Run real ones (Phase 3 §8, Phase 2 tasks).

### Persona 1: Sunil, small farmer, 2.5 acres near Latur (Maharashtra)
Redmi 9A (2 GB RAM), Jio 3G that drops to 2G in the field, comfortable in Marathi, reads basic English slowly. Needs a tractor with a rotavator for 2 days next week.

> "My nephew sends me the link on WhatsApp. It shows a grey box, no picture. I open it. White page for a second, then big black English: 'Tractors for small farms, booked in milliseconds…'. I know 'tractor'. Below it are big green numbers, 5,000, 2.91 ms, 20 / 20. Is that a price? A phone number? I don't know. There are two buttons. I press the green one.
>
> 'Rent a tractor from a neighbour.' Good. 'I need a tractor', 'Find a tractor'. Press.
>
> Lots of boxes. 'What do you need done': Sowing. I need rotavator work. There's Plowing, Sowing, Harvesting. No rotavator. I pick Plowing. Dates, fine, I can do that. 'Farm size (acres)': I type २.५ on my Marathi keyboard and it goes red. I don't understand why. My nephew switches the keyboard. 'Village': Sanganer, Jagatpura… I've never heard of these. Latur isn't there. I press 'Use my location'. It asks for permission, I say yes. 'Tractors near My location within 4 km. 0 found. No tractors within 4 km. Try another village.' Which village? They're all in Rajasthan. I close it."

| Flow | Ease | Clarity | Trust | Come back |
|---|---|---|---|---|
| Find a tractor | 2 | 2 | 2 | 1 |

**Top 5 complaints:** (1) Not in Marathi. (2) My village and district aren't there, and there's no PIN code box. (3) No rotavator option. (4) "My number didn't work" (Devanagari digits). (5) The first page is numbers I don't understand.
**One thing he'd love:** "If it worked here, seeing the full price before calling anyone. That's better than the broker."

### Persona 2: Harpreet, medium farmer, 22 acres near Jaipur (inside the demo area)
Comfortable with apps. Comparing harvesters for wheat in March.

> "Home page talks about latency. Whatever, I go to the marketplace. Harvesting, dates, 22 acres, Jagatpura. 12 tractors. **Tractors**, not combines. A 75 HP 4WD at ₹2,069 an hour 'for harvesting'? A tractor doesn't harvest wheat. Do they mean with a reaper attachment? It doesn't say. No photos. I want to compare three. There's no sort by price; the order jumps around in distance, 0.9 then 2.0 then 1.3. I tap one: '22 acres × 0.75 = 17 hours', Rental ₹35,000, deposit, 'Held in escrow'. Held where? Do I pay now? There's no UPI. I press 'Authorise escrow' and get 'Escrow authorised. Booking bk_…'. Then nothing. No SMS. The owner's number isn't shown. Did the owner even get told? I can't find this booking again."

| Flow | Ease | Clarity | Trust | Come back |
|---|---|---|---|---|
| Compare and book | 5 | 4 | 3 | 3 |

**Top 5 complaints:** (1) No combine harvesters, only tractors. (2) Can't sort or filter by price, HP or attachment. (3) No photos or reviews with counts. (4) No confirmation, no "my bookings", no owner contact. (5) "Escrow" and "Authorise": what am I agreeing to, and is money leaving my account?
**One thing he'd love:** the itemised price (rent, diesel, deposit returned). "If brokers showed this I'd trust them more."

### Persona 3: Ramesh, owner of a Swaraj 744 and a rotavator, idle about 200 days a year
Smartphone, WhatsApp-savvy, Hindi first, RC in his name.

> "Home page has no button for owners. In the menu I see 'Track A: Tarun (Systems)'. Who is Tarun? I find 'Marketplace Demo' → 'List my tractor'. Make, model, year 'bought or made'? Which one? Horsepower, the price I paid, tick 'Rotavator'. My name: I type it in Hindi, रमेश. RC name: I type it as printed, RAMESH KUMAR. Red: 'does not match your name, so we cannot list this tractor.' It's the same name! I type English. Aadhaar: 'Drop a PDF here'. Drop? On a phone? I press 'Choose file' and pick a photo. 'Aadhaar verified'. That fast? Who verified it? 'Your Swaraj 744 FE is listed. Nothing was saved or sent.' So is it listed or not? It never asked where my tractor is, what I want to charge, or when it's free. I'd never give my Aadhaar to a site that says 'demo'."

| Flow | Ease | Clarity | Trust | Come back |
|---|---|---|---|---|
| List machine | 4 | 3 | 1 | 2 |

**Top 5 complaints:** (1) It never asks my price, location or free days. (2) It rejected my name in Hindi. (3) "Verified" in 1 second feels fake. (4) There's nowhere to see who wants my tractor or what I'll earn. (5) No photos of my tractor, and no way to say "I'll drive it".
**One thing he'd love:** the pricing page's "Owner keeps ₹596 per hour after diesel and fee". "Put that on the listing form, not on a page with Greek letters."

### Persona 4: Aditya, 22, engineering student, booking for his father
Fast phone, fluent English, sceptical of new apps.

> "Honestly the home page looks like a GitHub README. 'Evidence ledger', 'p99'. Is this a startup or someone's portfolio? Nav says 'Track A: Tarun (Systems)'. OK, portfolio. The search works and is fast on my phone, and the booking modal is nice: keyboard focus works, the price breakdown is clear. But it ignored the end date I picked, so Dad would get 4 hours on day one, not 2 days. No login, so how does the owner know who's coming? No 'my bookings'. I'd screenshot the booking ID and hope. I'd use it only if there were a phone number to call."

| Flow | Ease | Clarity | Trust | Come back |
|---|---|---|---|---|
| Book for father | 7 | 6 | 3 | 4 |

**Top 5 complaints:** (1) It feels like a portfolio, not a service. (2) The end date is ignored. (3) No account, no "my bookings", no SMS to Dad. (4) No owner contact. (5) The demo disclaimer is tiny and the ratings look real.
**One thing he'd love:** "The price breakdown and that it didn't double-book when I double-tapped."

### Flow ratings matrix (all personas, every core flow)

Scores are ease / clarity / trust / would-come-back, each out of 10. "–" means the persona would not reach that flow, or the flow doesn't exist.

| Flow | Sunil (small farmer, Marathi, 3G) | Harpreet (medium farmer, apps) | Ramesh (owner) | Aditya (son, tech-savvy) |
|---|---|---|---|---|
| Understand the home page | 2 / 1 / 2 / 1 | 4 / 3 / 4 / 3 | 3 / 2 / 3 / 2 | 5 / 4 / 3 / 3 |
| Search (place, job, dates) | 2 / 2 / 2 / 1 | 6 / 5 / 4 / 4 | – | 7 / 6 / 4 / 4 |
| Compare results | – | 4 / 4 / 3 / 3 | – | 6 / 5 / 3 / 4 |
| Book | – | 6 / 4 / 3 / 3 | – | 7 / 5 / 3 / 4 |
| After booking (confirm, contact, find again) | – | 1 / 1 / 1 / 2 | – | 1 / 2 / 1 / 2 |
| List a machine | – | – | 4 / 3 / 1 / 2 | – |
| Manage requests and earnings | – | – | – (doesn't exist) | – |

The pattern: the booking modal itself is the best-rated piece for the two app-comfortable personas. Everything around it (understanding the site, finding your own place, what happens after) is what drives the low scores.

---

## 1G. Accessibility and inclusion

### A-01 [High] [Touch targets under 48 px] (measured at 375 px)

| Element | Where | Size | Fix |
|---|---|---|---|
| Menu (hamburger) | `navbar.tsx:80` | 38 × 38 | `p-3` plus a 24 px icon → 48 × 48 |
| Modal close ✕ | `booking-modal.tsx:112` | 30 × 30 | 48 × 48 |
| "Book" on each card | `search.tsx:150` | 309 × **36** | 56 px tall (`py-4 text-lg`) |
| "Use my location" | `search.tsx:99` | 151 × 38 | Full width, 48 px |
| Selects and inputs on search | `search.tsx:11` | 37–40 px tall | 52 px (`py-3.5 text-lg`) |
| Listing inputs | `listing-form.tsx:8` | 42 px | 52 px |
| Implement checkboxes | `listing-form.tsx:121-123` | box **13 × 13** in a 34 px label | Make the whole label a 48 px chip with a visible 24 px checkbox |
| "Choose file" | `listing-form.tsx:39` | 97 × 34 | 48 px, plus "Take photo" |
| Track card links | `page.tsx:74` | 291 × 24 | (removed by F-01) |

### A-02 [Medium] [No skip link]
**Where:** `layout.tsx:24-25`. `<main id="main">` exists but nothing links to it.
**Fix:** `<a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 …">Skip to content</a>` as the first child of `<body>`.

### A-03 [Medium] [Contrast failures (text passes; these don't)]

| Pair | Ratio | Needs | Where |
|---|---|---|---|
| Input and card borders `#cbd5e1` / `#fff` | 1.48 | 3.0 (non-text) | All forms (V-02) |
| Dark borders `#1e293b` / `#111827` | 1.21 | 3.0 | All forms, dark |
| Disabled "Book" text `#fff` on 50 % primary | 2.16 | (exempt, but users can't tell it's a button) | `search.tsx:150` |
| Escrow disabled buttons at 40 % | 1.83 | (exempt) | `escrow-state-machine.tsx:142` |
| Dark map letters `#fff` on `#059669` / `#3b82f6` / `#d97706` | 3.77 / 3.68 / 3.19 | 4.5 | `h3-map.tsx:137` |

All the text tokens pass: fg/bg 17.06, muted/bg 7.24, primary text on bg 5.24, white on primary 5.48, soil 8.67, red 6.47; dark mode is similar or better. **For outdoor use, aim for 7:1 on all body text.** The new palette does that.

### A-04 [Medium] [Duplicate accessible names]
**Where:** `search.tsx:148` (`aria-label={\`Book ${m.label}\`}`). Two cards produce identical "Book Mahindra 275 DI" (verified in the Sanganer results).
**Fix:** `aria-label={\`Book ${m.label}, ${m.owner}, ${dist} km\`}`, or use `aria-describedby` pointing at the card title.

### A-05 [Low] [Active nav state only on exact path]
**Where:** `navbar.tsx:49` (`pathname === l.href`). On `/marketplace/search` nothing is marked current (verified: 0 elements with `aria-current`).
**Fix:** `aria-current={pathname === l.href || pathname.startsWith(l.href + "/") ? "page" : undefined}`.

### A-06 [Medium] [The error summary doesn't link to the fields]
**Where:** `listing-form.tsx:101`.
**Fix:** Render a list of links (`<a href="#make">Make: enter the make</a>`) inside the `role="alert"` box.

### A-07 [Critical] [No Hindi, Marathi or any regional language]
**Where:** `layout.tsx:22` (`<html lang="en">`); every component; no message files; Figtree is Latin-only (V-07). The PRD promised "Vernacular voice-first flows" and an "icon-led crop picker, voice input" (`docs/PRD.md:76, 104`). None of it exists.
**Problem:** *Personas 1 and 3:* the app is unusable or untrustworthy in English only. This one issue excludes most of the stated audience.
**Fix:** `next-intl` with `app/[locale]/…`; locales `hi`, `mr`, `en` (then `pa`, `gu`, `kn`, `te`, `ta`); default chosen from `Accept-Language`, then remembered in a cookie. The language switcher is a top-right pill showing the *target language in its own script*, "हिंदी ▾" (never a flag), and it is also the very first screen on first visit as three big buttons: **मराठी · हिंदी · English**. Set `lang` per locale. Use a font with Devanagari (Phase 3 §1). Have translations reviewed by native speakers *from farming families*, not just a translation agency.
**Effort:** M (plumbing) + ongoing (translation)

### A-08 [High] [Low-literacy support is absent]
**Where:** Search form (`search.tsx:63-103`), cards, listing.
**Current:** The text-only select "What do you need done"; no pictures of machines; prices with paise; 12–14 px help text.
**Fix:**
- Job picker as **picture tiles** (an illustration plus a 1–2 word label): Ploughing, Rotavating, Sowing, Spraying, Harvesting, Transport.
- Every card has a photo.
- Prices in whole rupees, 24 px, with the unit as an icon (🕐 per hour, 🌾 per acre).
- **A 🎤 button** next to the village field (Web Speech API `SpeechRecognition` with `lang="hi-IN"` / `"mr-IN"`; it works in Chrome on Android, so hide it where unsupported).
- **A "🔊 Read aloud" button** on the booking summary (`speechSynthesis` with a `hi-IN` voice).
- A **"Call us to book"** fallback number on every screen. For a meaningful share of users, the app should end in a phone call.

### A-09 [Medium] [File inputs don't offer the camera]
**Where:** `listing-form.tsx:35`.
**Fix:** Two buttons. "📷 Take photo" uses `accept="image/*" capture="environment"`. "Choose from gallery" has no `capture`. Change the copy from "Drop a PDF, JPG or PNG here" to "Take a clear photo of your RC".

### A-10 [High] [No offline or poor-network support]
**Where:** No service worker, no `manifest`, no cached shell. Offline shows the browser's dinosaur page. The search page shows an error with no retry (F-20).
**[UPDATED by D-01]** Optional; do it after M8. For now the site must show a clear offline message and keep the user's form input.
**Fix:** A PWA through Serwist (Phase 3 §7). Cache the app shell, the last search results (shown with "Saved at 10:42 – may have changed") and "My bookings". Queue booking requests with Background Sync and show them as "Waiting for signal…". Payload budgets are in Phase 3 §2–3.

### A-11 [Low] [Reduced motion]
**Where:** The only animation, `animate-spin` (`booking-modal.tsx:165`), is acceptable to keep. There is no `prefers-reduced-motion` handling yet. Required for the landing page (Phase 3 §2).

### A-12 [Low] [Semantics are mostly good]
Positives to keep: labelled inputs; `aria-invalid` and `aria-describedby` on errors; a proper `role="dialog"` with a focus trap; `role="status"` and `aria-busy` on results; a captioned table on home; an `aria-label` on charts. Fix: the two empty `role="status"` paragraphs (`search.tsx:102, 109`) are both live regions, so screen readers announce both. Keep one live region per screen.

---

## 1H. Developer experience and project hygiene

### D-01 [High] [The README is written for recruiters]
**Where:** `README.md:1-86`.
**Current:** Badge → product paragraph → "Live pages" (8 links, 5 of them showcase) → "Headline numbers" (k6, p99, audit) → "Zero-Leak Dual-Track Ownership Matrix" → repository map → quick start (needs Go 1.22, Node 24, Python 3, Redis on **6390**, Postgres 17 on **5440**) → Vercel → Provenance.
**Fix:** First screen: what it is (2 lines), a screenshot, "Run the app: `cp .env.example .env && pnpm i && pnpm dev`", then "Project map". The headline numbers and ownership go to `docs/`. Add `.env.example` (`DATABASE_URL`, `NEXT_PUBLIC_DEMO_MODE`, `SMS_API_KEY`, `RAZORPAY_KEY_ID`, …) and a `docker-compose.yml` with Postgres + PostGIS and Redis on standard ports.
**Effort:** S

### D-02 [High] [The `.gitignore` will silently drop future source files]
**Where:** `.gitignore:13-14`.
**Current:** `*secret*` and `*token*`.
**Problem:** The moment you add `styles/tokens.css`, `design-tokens.ts`, `lib/auth/token.ts` or `refresh-token.test.ts`, Git ignores it. It will look committed locally and be missing in CI and on Vercel. Ironically, the first file this review asks you to create (Phase 3 §1) is `tokens.css`.
**Fix:** Replace both lines with explicit secrets patterns (`.env*` is already there, plus `*.pem`, `*.key`), add `!.env.example`, and use secret scanning (Phase 3 §7) instead of name-guessing.
**Effort:** S

### D-03 [Medium] [Agent docs point to files that don't exist]
**Where:** `CLAUDE.md:11`, `docs/agents/domain.md:7-8` (both reference `GLOSSARY.md`, which doesn't exist).
**Fix:** Create `GLOSSARY.md` (escrow, deposit, take rate, HP tier, RC, CHC, …), or remove the reference.
**Effort:** S

### D-04 [Medium] [The backend can't be run as a system]
**Where:** `deploy/docker/README.md:16-18` ("Intentionally left as a directory scaffold"); `deploy/k8s/` (empty); `services/booking-orchestrator/cmd/orchestrator/` (empty).
**Fix:** Either remove these from the product repo, or add a `compose.yaml` that runs postgres, redis and match-service with one command. Add a `go.work` at the root so the three modules build together.
**Effort:** S

### D-05 [Medium] [The product's CI tests AI-agent tooling]
**Where:** `test-all.sh:24, 29`; `.github/workflows/ci.yml:82-83` (`python3 .claude/verify-skills.py`, `.claude/hooks/test_commit_guard.sh`).
**Fix:** Move `.claude/skills`, `.scratch/skills-stack-e2e` and the commit-guard tests to their own repository or an optional local script. Keep `.claude/settings.json` (the git-guard hook) if you like it.
**Effort:** S

### D-06 [Medium] [No formatter or pre-commit lint; deprecated ESLint]
**Where:** `services/client-portal/package.json`; no Prettier or lint-staged; `eslint@9.39.5` prints a deprecation warning on install.
**Fix:** Prettier plus `prettier-plugin-tailwindcss`; `lefthook` running `eslint --fix`, `prettier --write` and `tsc --noEmit` on staged files; upgrade ESLint (Phase 3 §7).
**Effort:** S

### D-07 [Low] [Docs drift]
"Nine dispute rules" (`README.md:5`) vs `Rule` = D-01…D-07 in `escrow-machine.ts:14`; PostgreSQL 15 vs 17 (C-09); "strictly greater" vs `<=` (C-09).
**Fix:** Have one source per fact. `docs/check_docs.py` already exists, so extend it to check these.
**Effort:** S

### D-08 [Low] [Good hygiene to keep]
Pinned GitHub Actions by SHA (`ci.yml:46`), `permissions: contents: read`, `concurrency` groups, exact dependency versions, `engines` set, an ignored `.claude/settings.local.json`, and a secrets-free history as far as I could see. Nice.


---

# Phase 2: Scorecard

| Area | Now | Why (one line) | Target |
|---|---|---|---|
| Functionality | 3 | Search and book work for one district on demo data; the end date is ignored, nothing persists, there are no accounts | 8 |
| Location / search | 2 | Six Jaipur villages, a 4 km cap, no PIN code, opaque order, no availability | 8 |
| Booking flow | 3 | A good modal and idempotency, but no dates, payment, confirmation, my-bookings or cancel | 8 |
| Owner experience | 1 | A form that saves nothing; no price, location, photos, requests or earnings | 7 |
| Code readability | 7 | Clean lint and types, 202 tests, sensible comments; short names and duplication in places | 8 |
| Architecture | 4 | Well-built Go pieces that aren't connected; the deployed app runs on a `Map`; no DB constraint for overlaps | 8 |
| Visual design | 4 | Tidy but generic Tailwind; no imagery or brand | 8 |
| Typography | 4 | One Latin-only font, 14 px dominant, 9 sizes and 4 weights | 8 |
| Color | 5 | Text contrast is excellent; borders fail; stock swatches; opacity tokens broken | 8 |
| Spacing / layout | 5 | No overflow anywhere; 14 spacing steps and 5 container widths; results below the fold on mobile | 8 |
| Consistency | 5 | No shared components; 4 button recipes, 4 money formatters, 3 radii on cards | 8 |
| Content | 5 | Honest and calm, but jargon-heavy, hedged, English only, not translation-ready | 8 |
| Human feel / not AI-looking | 4 | No classic slop, but reads as an engineering portfolio in stock Tailwind | 8 |
| UX for farmers | 2 | English only, no pictures, no local places, nobody to call | 8 |
| Accessibility and inclusion | 3 | Good semantics and text contrast; no Indian languages, small targets and text, no voice, no offline | 8 |
| Performance on low-end devices | 6 | About 190 KB JS per route and results at 6.9 s on Slow 3G; h3-js and recharts are unnecessary weight | 9 |
| Security | 2 | No auth on any write; open Go index and WebSocket; fake "verified" | 8 |
| DX | 5 | One-command test runner and good CI; README aimed at recruiters, unusual ports, `.gitignore` trap, AI tooling mixed in | 8 |

---

# Phase 3: Improvement plan

## 1. Design system ("Mitti")

**Concept.** Warm earth neutrals instead of blue-grey slate, so the UI feels like soil and paper, not a SaaS dashboard. A deep indigo ("neel") for every action: dark enough to read in direct sunlight (white text on it is 10.96:1) and clearly different from the green that every agri-app uses. A mustard yellow ("sarson") for highlights, selected states and the landing page. It's the colour of Rajasthan's mustard fields in your pilot district and of farm-machinery paint, and in dark mode it becomes the action colour. All the pairs below were checked with the WCAG formula.

### Colour tokens

| Token | Hex | Use | Contrast check |
|---|---|---|---|
| `n-50` | `#FAF8F4` | Page background | – |
| `n-100` | `#F3EEE6` | Subtle fills, disabled fill | – |
| `n-200` | `#E5DDD1` | Decorative card border, dividers | 1.35 vs white (decorative only) |
| `n-300` | `#CFC4B4` | Skeletons | – |
| `n-400` | `#A39684` | Placeholder icons | – |
| `n-500` | `#7C7062` | **Control borders** (inputs, selects, checkboxes) | 4.83 vs white ✓ 3:1 |
| `n-600` | `#5E544A` | Captions, meta text | 7.39 vs white, 6.96 vs n-50 |
| `n-700` | `#483F37` | Secondary body text | 9.70 vs n-50 ✓ AAA |
| `n-800` | `#332C26` | – | 12.95 |
| `n-900` | `#211C18` | Headings (light), surface (dark) | 15.92 |
| `n-950` | `#13100D` | Body text (light), background (dark) | 17.87 vs n-50 |
| `neel-50` | `#EEF1FB` | Selected row tint | – |
| `neel-100` | `#DCE3F7` | Info background | – |
| `neel-300` | `#8DA2E3` | Links (dark mode) | 7.59 on dark bg |
| `neel-500` | `#3A56C5` | Focus halo (dark mode) | – |
| `neel-600` | `#2C44A8` | Info text | 8.40 vs white |
| `neel-700` | `#223585` | **Primary button, links (light)** | White text 10.96 ✓; 10.33 vs n-50 |
| `neel-800` | `#1B2A66` | Primary hover | 13.38 |
| `neel-900` | `#141F4A` | Primary pressed; **focus ring** | 14.95 vs n-50 |
| `sarson-100` | `#FFF4CC` | Highlight background (price saved, tip) | – |
| `sarson-300` | `#FFD45C` | **Selected chip and tile fill** (plus a 2 px neel-700 border, because the fill alone is 1.34 vs n-50) | n-950 text 13.38 ✓ |
| `sarson-400` | `#FBC02D` | **Primary button in dark mode**; landing accent | n-950 text 11.45 ✓ |
| `sarson-600` | `#C98A00` | Illustration shading | – |
| `sarson-700` | `#8F5F00` | Sarson text on light (rare) | 5.52 vs white |
| `success` / `success-bg` | `#1E7B3C` / `#E7F4EA` | "Free on your dates", "Booked" | 5.31 vs white; 4.69 on its bg |
| `warning` / `warning-bg` | `#B4500A` / `#FDEEE2` | "Few left", "Deposit held" | 5.13 / 4.52 |
| `error` / `error-bg` | `#B42318` / `#FDECEA` | Field errors, failed payment | 6.57 / 5.75 |
| `info` / `info-bg` | `#2C44A8` / `#EAEFFB` | Tips, "How pricing works" | 8.40 / 7.30 |
| Dark: `success` / `warning` / `error` | `#6CCB8A` / `#F59E5B` / `#F97066` | Same uses, on `#211C18` | 8.48 / 7.98 / 6.06 |

### Type

- **App screens:** **Mukta** (Ek Type, Latin and Devanagari designed together; the Devanagari reads clearly at small sizes). Load weights 400 and 700 only, subsets `latin` and `devanagari`, `display: "swap"`, `adjustFontFallback`. Fallback: `"Noto Sans Devanagari", Roboto, system-ui`. Android already ships Noto Devanagari, so the fallback looks close.
- **Landing display only:** **Baloo 2** 700 (warm, rounded, made for Indian scripts). Use it only for large headlines, never for body text.
- **Numbers:** `font-variant-numeric: tabular-nums` on prices and dates.
- Devanagari needs about 10–15 % more line height than Latin because of the matras above and below the line. The line heights below already allow for that.

| Token | Size / line height (mobile → ≥768 px) | Weight | Use |
|---|---|---|---|
| `display` | 40/48 → 64/72, Baloo 2, −0.5 px | 700 | Landing scenes only |
| `h1` | 30/40 → 40/52 | 700 | One per screen |
| `h2` | 24/34 → 28/38 | 700 | Section titles, sheet titles |
| `h3` | 20/30 | 700 | Card titles |
| `h4` | 18/28 | 700 | Small group titles |
| `body` | **18/30** | 400 | Default text and inputs |
| `small` | 16/26 | 400 | Meta lines (distance, owner) |
| `caption` | 14/22 | 400 | Fine print. **Never smaller** |
| `label` | 16/24 | 700 | Form labels, chips |
| `price` | 28/34 | 700 tabular | Price on cards and in the summary |
| `button` | 18/24 | 700 | All buttons |

### Spacing, radius, shadow, size

- **Spacing (px):** `1`=4, `2`=8, `3`=12, `4`=16, `6`=24, `8`=32, `12`=48, `16`=64, `24`=96. Delete 6, 10, 20, 28 and 56.
- **Radius:** `control` 10 px (buttons, inputs, chips), `card` 16 px (cards, sheets, modals, photos), `pill` 999 px (badges).
- **Shadow:** `sheet` `0 -8px 24px rgb(19 16 13 / .14)`; `raised` `0 2px 8px rgb(19 16 13 / .08)` (sticky CTA bar only).
- **Tap targets:** at least 48 × 48. Primary CTA 56 px tall. Card "Book" 56 px.
- **Containers:** app `max-w-[72rem]` (1152 px) with 16 px gutters (24 px from 640 px up). Reading text `max-w-[38rem]`.
- **Breakpoints:** `sm` 640, `md` 768, `lg` 1024, `xl` 1280. Delete `nav`.

### Code: `app/tokens.css`

(Rename `.gitignore`'s `*token*` rule first, D-02.)

```css
/* app/tokens.css — Mitti design tokens. Channels (no rgb()) so Tailwind opacity works. */
:root {
  --n-50: 250 248 244;  --n-100: 243 238 230; --n-200: 229 221 209; --n-300: 207 196 180;
  --n-400: 163 150 132; --n-500: 124 112 98;  --n-600: 94 84 74;    --n-700: 72 63 55;
  --n-800: 51 44 38;    --n-900: 33 28 24;    --n-950: 19 16 13;
  --neel-50: 238 241 251; --neel-100: 220 227 247; --neel-300: 141 162 227; --neel-500: 58 86 197;
  --neel-600: 44 68 168;  --neel-700: 34 53 133;   --neel-800: 27 42 102;   --neel-900: 20 31 74;
  --sarson-100: 255 244 204; --sarson-300: 255 212 92; --sarson-400: 251 192 45;
  --sarson-600: 201 138 0;   --sarson-700: 143 95 0;

  /* semantic (light) */
  --bg: var(--n-50);          --surface: 255 255 255;   --surface-muted: var(--n-100);
  --text: var(--n-950);       --text-muted: var(--n-700); --text-subtle: var(--n-600);
  --border-control: var(--n-500); --border-subtle: var(--n-200);
  --action: var(--neel-700);  --action-hover: var(--neel-800); --action-pressed: var(--neel-900);
  --on-action: 255 255 255;   --link: var(--neel-700);
  --selected: var(--sarson-300); --on-selected: var(--n-950); --selected-border: var(--neel-700);
  --focus: var(--neel-900);   --focus-halo: var(--sarson-300);
  --success: 30 123 60;  --success-bg: 231 244 234;
  --warning: 180 80 10;  --warning-bg: 253 238 226;
  --danger: 180 35 24;   --danger-bg: 253 236 234;
  --info: 44 68 168;     --info-bg: 234 239 251;
  --overlay: 19 16 13;

  --radius-control: 10px; --radius-card: 16px; --radius-pill: 999px;
  --shadow-sheet: 0 -8px 24px rgb(19 16 13 / .14);
  --shadow-raised: 0 2px 8px rgb(19 16 13 / .08);
  --tap: 48px; --tap-lg: 56px;
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: var(--n-950); --surface: var(--n-900); --surface-muted: 43 37 32;
    --text: var(--n-100); --text-muted: var(--n-300); --text-subtle: var(--n-400);
    --border-control: var(--n-500); --border-subtle: 51 44 38;
    --action: var(--sarson-400); --action-hover: var(--sarson-300); --action-pressed: var(--sarson-600);
    --on-action: var(--n-950); --link: var(--neel-300);
    --focus: var(--sarson-300); --focus-halo: var(--neel-500);
    --success: 108 203 138; --warning: 245 158 91; --danger: 249 112 102; --info: 141 162 227;
    color-scheme: dark;
  }
}
:root[data-theme="dark"] { /* same values as the media query block, for a manual toggle */ }

html { font-size: 100%; }
body { background: rgb(var(--bg)); color: rgb(var(--text)); font: 400 1.125rem/1.667 var(--font-ui); }
:focus-visible { outline: 3px solid rgb(var(--focus)); outline-offset: 2px; box-shadow: 0 0 0 6px rgb(var(--focus-halo) / .6); }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; scroll-behavior: auto !important; } }
```

### Code: `tailwind.config.ts`

```ts
import type { Config } from "tailwindcss";
const c = (v: string) => `rgb(var(--${v}) / <alpha-value>)`;

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    screens: { sm: "640px", md: "768px", lg: "1024px", xl: "1280px" },
    spacing: { 0: "0", px: "1px", 1: "4px", 2: "8px", 3: "12px", 4: "16px", 6: "24px", 8: "32px", 12: "48px", 16: "64px", 24: "96px", tap: "48px", "tap-lg": "56px" },
    borderRadius: { none: "0", control: "var(--radius-control)", card: "var(--radius-card)", pill: "var(--radius-pill)" },
    boxShadow: { none: "none", sheet: "var(--shadow-sheet)", raised: "var(--shadow-raised)" },
    fontFamily: { ui: ["var(--font-ui)", "Noto Sans Devanagari", "Roboto", "system-ui", "sans-serif"], display: ["var(--font-display)", "var(--font-ui)", "sans-serif"] },
    fontSize: {
      caption: ["0.875rem", { lineHeight: "1.375rem" }],
      small: ["1rem", { lineHeight: "1.625rem" }],
      label: ["1rem", { lineHeight: "1.5rem", fontWeight: "700" }],
      body: ["1.125rem", { lineHeight: "1.875rem" }],
      h4: ["1.125rem", { lineHeight: "1.75rem", fontWeight: "700" }],
      h3: ["1.25rem", { lineHeight: "1.875rem", fontWeight: "700" }],
      h2: ["1.5rem", { lineHeight: "2.125rem", fontWeight: "700" }],
      h1: ["1.875rem", { lineHeight: "2.5rem", fontWeight: "700" }],
      price: ["1.75rem", { lineHeight: "2.125rem", fontWeight: "700" }],
      display: ["2.5rem", { lineHeight: "3rem", fontWeight: "700", letterSpacing: "-0.01em" }],
    },
    fontWeight: { normal: "400", bold: "700" },
    extend: {
      colors: {
        bg: c("bg"), surface: { DEFAULT: c("surface"), muted: c("surface-muted") },
        text: { DEFAULT: c("text"), muted: c("text-muted"), subtle: c("text-subtle") },
        border: { control: c("border-control"), subtle: c("border-subtle") },
        action: { DEFAULT: c("action"), hover: c("action-hover"), pressed: c("action-pressed"), on: c("on-action") },
        link: c("link"), selected: { DEFAULT: c("selected"), on: c("on-selected"), border: c("selected-border") },
        success: { DEFAULT: c("success"), bg: c("success-bg") }, warning: { DEFAULT: c("warning"), bg: c("warning-bg") },
        danger: { DEFAULT: c("danger"), bg: c("danger-bg") }, info: { DEFAULT: c("info"), bg: c("info-bg") },
        overlay: c("overlay"),
      },
      maxWidth: { app: "72rem", read: "38rem" },
    },
  },
} satisfies Config;
```
Responsive headings: in `globals.css`, `@media (min-width:768px){ .text-h1{font-size:2.5rem;line-height:3.25rem} .text-h2{font-size:1.75rem;line-height:2.375rem} .text-display{font-size:4rem;line-height:4.5rem} }`.

### Code: fonts in `app/[locale]/layout.tsx`

```tsx
import { Mukta, Baloo_2 } from "next/font/google";
const ui = Mukta({ subsets: ["latin", "devanagari"], weight: ["400", "700"], variable: "--font-ui", display: "swap" });
const display = Baloo_2({ subsets: ["latin", "devanagari"], weight: ["700"], variable: "--font-display", display: "swap", preload: false });
// <html lang={locale} className={`${ui.variable} ${display.variable}`}>
```

### Component variants (build these first, in `components/ui/`)

| Component | Variants and sizes | States |
|---|---|---|
| `Button` | `primary` (action fill), `secondary` (surface + 2 px `border-control`), `ghost` (text link style), `danger`; sizes `md` 48 px / `lg` 56 px; `fullWidth` | hover, pressed, focus-visible, disabled (surface-muted + text-subtle + reason), loading (spinner, fixed width, `aria-busy`) |
| `Input`, `Select`, `Textarea` | 52 px tall, 18 px text, 2 px `border-control`, `radius-control` | focus (3 px focus ring), invalid (2 px danger border, error text below with an icon), disabled |
| `ChipGroup` | single or multi select; 48 px chips | selected = `selected` fill + 2 px `selected-border` + ✓ icon |
| `Tile` | picture tile for jobs and machine types: 1:1, illustration plus label | selected (as chip) |
| `Card` | `machine`, `booking`, `info`; radius-card, 1 px `border-subtle`, photo slot | pressable variant has a pressed state |
| `Sheet` | bottom sheet (mobile), centred modal (≥ 768 px), drag handle | open and close 200 ms, focus trap (reuse the existing one, it's good) |
| `Toast` | success, error, info; bottom, above the sticky bar | auto-dismiss 5 s except errors |
| `Badge` | `free`, `busy`, `new`, `verified`, `sample` | – |
| `PriceRow` | label, value, optional "info" button | – |
| `StickyCTA` | bottom bar with price summary plus button | `shadow-raised` |
| `Stepper` | − value + for acres and hours (48 px buttons) | min and max |
| `LanguageSwitcher` | pill "हिंदी ▾" showing the target language in its own script | – |
| `EmptyState` | illustration, title, 1–2 actions | – |

**Icons:** lucide at 2 px stroke, 20 px inline, 24 px in navigation and buttons. Plus a commissioned set of **8 machine and job pictograms** (tractor, rotavator, harvester, sprayer, seed drill, trolley, ploughing, harvesting) in the same 2 px stroke with one sarson accent fill. That set is where the brand shows. Commission it from an Indian illustrator, or draw it in Figma from photographs of real machines in the pilot district.

**Imagery:** real photographs, ideally shot in the pilot villages (owners with their machines, fields at sowing). No stock photos of American farms. Card photos are 16:9, lazy-loaded, ≤ 40 KB AVIF with a blur placeholder.

---

## 2. Storytelling landing page [UPDATED]

**[UPDATED by D-09/D-10]** The first screen is the **welcome page with the live field scene** (the tractor ploughs in rounds, a two-word heading, three small pill buttons near the top, three floating counters). The full spec is in UI-SPEC §4.1. The scenes below become the **story sections under the welcome screen**. Scene 0 (a separate language screen) is **superseded**: the three-way language switch sits in the welcome page header. The 3D tractor is kept (rich mode only).

**Principle:** the landing page tells one story in seven short scenes. **It works fully with zero JavaScript.** CSS scroll-driven animations (`animation-timeline: view()`) run on the compositor in Chrome for Android, which is the browser most of your users have. GSAP and 3D are progressive layers for capable devices only. The app screens get none of this.

**Who decides the experience:** a tiny inline script sets `data-motion` on `<html>`:
```js
const c = navigator.connection, m = matchMedia("(prefers-reduced-motion: reduce)").matches;
const rich = !m && !(c && (c.saveData || /2g|3g/.test(c.effectiveType))) && (navigator.deviceMemory ?? 4) >= 4 && (navigator.hardwareConcurrency ?? 4) >= 6;
document.documentElement.dataset.motion = m ? "none" : rich ? "rich" : "lite";
```
- `none`: static images and text. Every scene is still complete.
- `lite` (default for most farmers): SVG plus CSS scroll-driven animation. No extra JS.
- `rich` (desktop and 4G mid-range phones): GSAP ScrollTrigger pins and one lazy 3D scene.

### Scenes

The copy is English first, with Hindi and Marathi for the key lines. The Hindi and Marathi drafts need review by native speakers from farming families before launch.

**[SUPERSEDED] Scene 0, language (first visit only).** A full screen with three large buttons: **मराठी · हिंदी · English**, and a line drawing of a tractor. No animation.

**Scene 1, "The shed".** *On screen:* a line illustration of a tractor in a shed, and a strip of 365 small squares (a year) beneath it. *As you scroll:* the squares fill in mustard for days the tractor works. Only about 1 in 12 fill (250 hours ≈ 31 working days); the rest stay grey. *Copy:* "**A tractor costs ₹6–7 lakh.** Most of the year, it waits in the shed." / Hindi: "**ट्रैक्टर ₹6–7 लाख का आता है।** साल के ज़्यादातर दिन वह खड़ा रहता है।" *Source note (show it small):* "Price: a 45 HP tractor in our pricing model; working days: the pricing model's 250 hours a year. Replace with surveyed figures." Don't invent a statistic.
*Lite:* SVG squares with `animation-timeline: view()` filling `fill`. *Rich:* the same, with the shed door sliding open (GSAP).

**Scene 2, "Your field needs it for a few hours".** *On screen:* split. On the left, a small field (2.5 acres) with a clock showing "4 hours". On the right, the price of buying (₹6.4 lakh) versus renting (₹2,839 for 4 hours, from your own quote engine). *As you scroll:* the "buy" bar shrinks to the "rent" bar. *Copy:* "**You don't need to own it. You need it on time.**" / Marathi: "**ट्रॅक्टर विकत घेण्याची गरज नाही. वेळेवर मिळणं महत्त्वाचं.**"

**Scene 3, "It's already near you".** *On screen:* a stylised village map (roads, a canal, village names in the user's language). *As you scroll:* the camera zooms from the district to the user's village, hexagons light up ring by ring (your H3 work, turned into a story), and 3–5 machine pins pop in with prices. *Copy:* "**Tractors, rotavators and harvesters within 10 km.** See who has one free on your dates." Inline: a **PIN code or village input with a "Find" button**. This is the first conversion point; it opens search pre-filled.
*Lite:* a pre-rendered SVG map with CSS staggered `opacity` and `scale`. *Rich:* MapLibre is not needed; use an SVG with GSAP stagger, or a single static WebP and SVG overlay.

**Scene 4, "The full price, before you say yes".** *On screen:* a paper receipt that prints line by line: Rent 4 h × ₹710 → ₹2,839 · Diesel included · Deposit ₹1,950 (*comes back to you*) · **You pay ₹2,839**. *Copy:* "**No broker. No surprises.** Every rupee is shown before you book."

**Scene 5, "Money moves only when the work is done".** *On screen:* three stamps appear in sequence: 📷 *Handover* (photo + OTP), 🕐 *Work* (hours counted), ✅ *Return*, then "Owner paid". *Copy:* "**The owner is paid after the job, not before.** If the machine doesn't come, you get everything back." (This is your escrow, explained without the word "escrow".)

**Scene 6, the owner side, "Your idle tractor can earn".** *On screen:* flip to the owner. The calendar from Scene 1 fills with bookings and an earnings counter rolls up (labelled "Example: 45 HP tractor, 400 rented hours a year"). *Copy:* "**List it once. Choose your price and your days.** We find the farmers; you decide who to accept." Button: **List your tractor**. Marathi: "**तुमचा ट्रॅक्टर भाड्याने द्या.**"

**Scene 7, trust and help.** Real owner photos (with permission), the number of machines and villages *once real*, a phone number and a WhatsApp button: "**Prefer to talk? Call 1800-XXX-XXXX.** We'll book it for you." Footer: language switch, "How we built it" (the showcase), privacy.

**One optional 3D moment (rich mode only):** in Scene 2, a low-poly tractor (≤ 25k triangles) rotates as you scroll and its rotavator lowers. Built with React Three Fiber, `@react-three/drei` (`useGLTF`, `Environment` with a 64 px HDR), loaded with `next/dynamic(() => import("./TractorScene"), { ssr: false })` after `requestIdleCallback`, and only when `data-motion="rich"`. Fallback: an AVIF image sequence (12 frames scrubbed by scroll, about 180 KB) or simply the static illustration.

### Libraries and when to use each

| Need | Use | Why | Fallback |
|---|---|---|---|
| Scroll reveals, fills, simple parallax | **CSS scroll-driven animations** (`animation-timeline: view()/scroll()`) | 0 KB JS, runs off the main thread, supported in Chrome and Android Chrome | `@supports not (animation-timeline: view())` → content simply visible |
| Pinned scenes, timelines, staggered sequences | **GSAP 3 + ScrollTrigger** (all of GSAP is free, including commercial use) | Reliable pinning and scrubbing | `data-motion="lite"` never loads it |
| Small looping illustrations (receipt printing, stamps) | **Rive** (`@rive-app/react-canvas-lite`), state machine, ≤ 50 KB `.riv` | Smaller than Lottie for interactive pieces; a single file holds every state | First-frame PNG/SVG |
| Designer-made one-off animations | **dotLottie** (`@lottiefiles/dotlottie-web`), ≤ 60 KB per `.lottie` | Designers export straight from After Effects | Static SVG |
| 3D tractor | **React Three Fiber + drei**, GLB compressed with `gltf-transform` (meshopt + KTX2) | Fits React | Image sequence or still |
| Prototype the 3D look before coding | **Spline** (design only, export to an image sequence), **Blender** for the final model | Fast iteration | – |

### Performance budget (landing)

| Item | Budget |
|---|---|
| HTML + CSS + critical SVG, first view | ≤ 60 KB compressed |
| JS on first load (`lite`) | ≤ 90 KB gzipped total (framework included) |
| GSAP + ScrollTrigger (`rich` only, lazy) | ≈ 45 KB gzipped |
| 3D chunk (three + r3f + drei subset, `rich` only, after idle) | ≤ 250 KB gzipped |
| Tractor GLB | **≤ 400 KB**, ≤ 25k triangles, textures KTX2 ≤ 512 px |
| Each Rive / dotLottie file | ≤ 50 / 60 KB |
| Hero image | AVIF ≤ 80 KB at 1x mobile, `fetchpriority="high"` |
| Fonts | Mukta 400 + 700 Devanagari + Latin ≤ 120 KB; Baloo 2 700 ≤ 60 KB, `preload: false` |
| LCP | ≤ 2.5 s on 4G, ≤ 4 s on Slow 3G (`lite`) |
| CLS | < 0.05 |
| `prefers-reduced-motion: reduce` | All scroll animation off; GSAP and 3D never load; content complete |

---

## 3. App screens (fast and simple, no immersive effects)

**Rules for every app screen:** JS ≤ 120 KB gzipped per route; server-rendered first paint; one primary action per screen, in a sticky bottom bar on mobile; 18 px body text; 56 px CTAs; a language pill and a "Help (call)" link always reachable.

### 3.0 Welcome page and login [UPDATED: added after the UI decisions; the full spec is in UI-SPEC §4.1–§4.3]
```
WELCOME (public, full screen, live scene)        LOG IN / SIGN UP
┌─────────────────────────────────┐            ┌─────────────────────────────────┐
│ ◎ KhetiRental   [मराठी|हिंदी|EN]│            │ ←               [मराठी|हिंदी|EN]│
│        ☁ (clouds drift)         │            │ Welcome to KhetiRental          │
│       Farm, made easy.          │            │ [  Log in  |  Sign up  ]        │
│  Rent machines from your village│            │ [ G  Continue with Google ]     │
│ (Log in)(Sign up)(How it works↓)│            │ ───────────── OR ────────────── │
│   ~~~ hills ~~~  ☀ rising       │            │ (Mobile number) (Email)         │
│ ▮▮▮▮ crops sway ▮▮▮▮▮▮▮▮▮▮▮▮▮▮ │            │ [Full name]        ← sign-up    │
│ 🚜→→→ ploughing row 1 →→→       │            │ [+91][98765 43210]              │
│ ←←← row 2 ←←←←←←←←←🚜 (turned)  │            │ We'll send a 6-digit OTP by SMS │
│                                 │            │ I want to: [Rent][List machines]│
│   86%       1.08       47%      │            │ [        Send OTP          ]    │
│ small farms  ha avg  mechanised │            │ By continuing you agree to …    │
│ Agriculture Census 2015–16 · …  │            └─────────────────────────────────┘
└─────────────────────────────────┘
  ↓ story sections (scroll)
```

### 3.1 Search (`/rent`)
Wizard-style, one decision per row, each a big tap target. The last-used values are remembered.
```
┌─────────────────────────────────┐
│ KhetiRental          [हिंदी ▾]  │ 56px header
├─────────────────────────────────┤
│ What work?                      │ h2
│ [🚜 Plough][🌀 Rotavate][🌱 Sow]│ 3×2 picture tiles, 104px tall
│ [💧 Spray] [🌾 Harvest][🛻 Haul]│
│                                 │
│ Where is your farm?             │
│ [ 413512 or village name   🎤 ] │ 52px input
│ [📍 Use my phone's location ]   │ 48px secondary
│                                 │
│ When?                           │
│ [Tomorrow][This week][Pick dates]│ chips → calendar sheet
│                                 │
│ How big is the field? (optional)│
│ [ − ]   2.5 acres   [ + ]       │ stepper
├─────────────────────────────────┤
│ [      Find machines       ]    │ sticky 56px primary
└─────────────────────────────────┘
```
Remove: the free-text date inputs as the first choice, "hours per acre" help text, the demo footnote (move it to a ribbon), and the six villages.

### 3.2 Results, list and map (`/rent/results?…`)
```
┌─────────────────────────────────┐
│ ← Rotavate · 2–4 Nov · Latur  ✎ │ sticky summary, tap = edit sheet
│ [Nearest▾] [10 km▾] [Map ⇄]     │ 48px chips
├─────────────────────────────────┤
│ 8 free on your dates            │ caption
│ ┌─────────────────────────────┐ │
│ │ [ photo 16:9 ]  ● Free 2–4 Nov│ │
│ │ ₹710/hour · with driver      │ │ price 28/700
│ │ Swaraj 744 FE + rotavator    │ │ 18
│ │ 📍 3.5 km · Muhana           │ │ 16
│ │ ★ 4.6 (23) · Ramesh K.       │ │ 16
│ │ [   Book for 2–4 Nov   ]     │ │ 56px
│ └─────────────────────────────┘ │
│ … more cards …                  │
│ ── Busy on your dates ──        │
│ (greyed cards, "Free from 6 Nov")│
│ Not finding one? [Search 25 km] │
│ [📞 Call us – we'll find one]   │
└─────────────────────────────────┘
Map ⇄ : full-screen Leaflet map, price-label markers, bottom sheet = same card.
```
Remove: the opaque score order, HP-only metadata, "Not bookable in this demo" cards, and paise.

### 3.3 Equipment detail (`/rent/m/[id]`)
```
┌─────────────────────────────────┐
│ [ photo carousel 4:3, 3 photos ]│
│ Swaraj 744 FE · 48 HP · 2019    │ h1
│ ★ 4.6 (23 reviews)  ✔ RC checked│
├─────────────────────────────────┤
│ ₹710 / hour   or  ₹1,400 / acre │ price
│ Driver included · Diesel included│ badges
│ Comes with: Rotavator, Trolley  │
│ 📍 Muhana · 3.5 km from you      │ (exact spot after booking)
│ Availability (next 14 days)     │ 14 dots: ● free ○ busy
│ Owner: Ramesh K. · 3 yrs on app │ photo
│ "Reviews" (3 shown, see all)    │
├─────────────────────────────────┤
│ ₹2,840 est. for 4 h   [ Book ]  │ sticky bar
└─────────────────────────────────┘
```

### 3.4 Booking (sheet, 3 steps) [UPDATED: step 3 is now payment, D-08; login already happened, D-05]
```
Step 3  How do you want to pay?
┌──────────────────────────────┐
│ (•) UPI                      │  GPay, PhonePe, Paytm or any UPI app
│ ( ) Debit / credit card      │  Visa, Mastercard, RuPay
│ ( ) Net banking              │  All major banks
│ ( ) Pay after work           │  Cash or UPI to the owner when the job is done
│ Demo payment: no real money moves. Free cancellation until Sun 1 Nov, 6 pm.
│ [ Pay ₹2,840 and book ]   (or "Confirm booking" for Pay after work)
│ Back                         │
└──────────────────────────────┘
Online methods → mock payment screen (~1.5 s) → success → /bookings/[code]
```
The original version is below for reference.
```
Step 1  When              Step 2  Price                 Step 3  Confirm
┌────────────────────┐   ┌──────────────────────┐     ┌──────────────────────┐
│ Mon 2 – Wed 4 Nov  │   │ Rent 4 h × ₹710 ₹2,840│     │ Your phone           │
│ [Morning][Full day]│   │ Diesel     included  │     │ [ 98xxxxxx12 ] [OTP] │
│ Estimate: 4 hours  │   │ Deposit*   ₹1,950    │     │ Pay now: ₹49 booking │
│  [−]  4 h  [+]     │   │ *comes back after job│     │ fee (UPI)            │
│                    │   │ ──────────────────── │     │ Pay owner after work:│
│                    │   │ Pay after work ₹2,840│     │ ₹2,840 (cash or UPI) │
│                    │   │ 🔊 Read aloud         │     │ Free cancel until    │
│                    │   │                      │     │ Sun 1 Nov, 6 pm      │
│ [ Next ]           │   │ [ Next ]             │     │ [ Confirm booking ]  │
└────────────────────┘   └──────────────────────┘     └──────────────────────┘
→ /bookings/KR-4821 (F-10) + SMS + WhatsApp
```
Remove: "Authorise escrow", "tier floor, 0.5 % of tractor value", the ISO date, the hours text field.

### 3.5 My bookings (`/bookings`)
```
┌─────────────────────────────────┐
│ My bookings                     │
│ [Upcoming (1)] [Past]           │ tabs
│ ┌─────────────────────────────┐ │
│ │ ● Confirmed   KR-4821       │ │ status chip colour + text
│ │ Mon 2 – Wed 4 Nov · 7 am    │ │
│ │ Swaraj 744 FE · Ramesh K.   │ │
│ │ [📞 Call] [WhatsApp] [Cancel]│ │
│ └─────────────────────────────┘ │
│ Waiting for owner (1)           │ requested, with "Owner has 2 h to reply"
└─────────────────────────────────┘
```
Statuses farmers understand: *Waiting for owner → Confirmed → On the way → Working → Done → Rate it.*

### 3.6 Owner listing (`/owner/new`, 4-step wizard)
```
1 Machine            2 Photos               3 Where & when           4 Price
[🚜][🌀][🌾][💧]     [📷 Front ][📷 Side ]   [ PIN / village   🎤 ]   ( ) per hour (•) per acre
Make  [Swaraj ▾]     [📷 Hour meter    ]     [📍 Pin on map      ]    ₹ [ 1,400 ]
Model [744 FE ▾]     Tip: daylight, whole    Free days: [calendar]    Nearby similar:
HP    [48     ]      machine in frame        [x] I will drive it      ₹1,200–1,600/acre
Year  [2019   ]                              Comes with: [Rotavator]  You keep ₹1,211/acre
[Next]               [Next]                  [Next]                   [Publish]
```
Then: "Verify (takes 2 minutes): phone OTP ✓ · RC via DigiLocker". The listing goes live once the phone is verified, and the RC badge appears once the RC is checked.

### 3.7 Owner dashboard (`/owner`)
```
┌─────────────────────────────────┐
│ Namaste, Ramesh                 │
│ This month ₹18,400  ·  Paid ₹12,000 · Pending ₹6,400 │
├─────────────────────────────────┤
│ New requests (2)                │
│ ┌─────────────────────────────┐ │
│ │ Sunil P. · 2.5 acres · 4 km  │ │
│ │ Mon 2 Nov, morning · ₹2,840  │ │
│ │ [ Accept ]   [ Decline ]     │ │ replies within 2 h or auto-decline
│ └─────────────────────────────┘ │
│ Calendar  ◀ November ▶          │ tap a day to block it
│ My machines (2)  [+ Add]        │ pause / edit price / photos
└─────────────────────────────────┘
```

---

## 4. Architecture refactor

**Decision:** the product runs on **Next.js (App Router) and one Postgres database with PostGIS**, deployed on Vercel plus Neon or Supabase. The Go services move to `showcase/` unchanged, with their tests and docs, as the engineering portfolio. Nothing is deleted, but nothing a farmer does depends on them. Revisit this when one Postgres can't keep up.

```
/
├─ apps/
│  ├─ web/                          # the product (Next.js)
│  │  ├─ app/[locale]/(marketing)/page.tsx           # story landing
│  │  ├─ app/[locale]/(app)/rent/…                   # search, results, detail
│  │  ├─ app/[locale]/(app)/bookings/…               # my bookings
│  │  ├─ app/[locale]/(app)/owner/…                  # owner dashboard + listing wizard
│  │  ├─ app/api/…                                   # route handlers (thin)
│  │  ├─ components/ui/                              # Button, Input, Sheet… (§1)
│  │  ├─ components/rent/ components/owner/          # feature components
│  │  ├─ server/                                     # db queries, auth, services (server-only)
│  │  │  ├─ db/schema.ts (drizzle)  db/migrations/
│  │  │  ├─ machines.ts  bookings.ts  pricing.ts  notify.ts  payments.ts  auth.ts
│  │  ├─ messages/{en,hi,mr}.json                    # next-intl
│  │  └─ app/tokens.css  tailwind.config.ts
│  └─ showcase/                    # optional: the portfolio site (dossiers, H3 sandbox, escrow sim)
├─ packages/
│  ├─ domain/                      # pure TS: pricing-engine, quote, escrow reducer, money format (+ tests)
│  └─ contracts/                   # OpenAPI + generated types
├─ showcase/go/                    # matching-engine, booking-orchestrator, telemetry-gateway (as-is)
├─ docs/                           # PRD, ADRs, audit, GLOSSARY.md, interview/ (private)
├─ compose.yaml                    # postgres+postgis, redis (only for showcase)
└─ .github/workflows/
```

**Patterns to standardise on:**
- **Data:** read in Server Components through `server/*.ts`; write through Server Actions or route handlers; validate with `zod`; one error shape (C-04).
- **Database:** Drizzle ORM with SQL migrations. PostGIS `geography(Point,4326)` with a GiST index. A `tstzrange` booking window with an `EXCLUDE` constraint (F-09). Money in integer paise.
- **Auth:** phone OTP, a session cookie, roles `renter | owner | admin`.
- **Styling:** tokens plus `components/ui` only. No raw colour classes (enforce with an ESLint rule or a grep check in CI).
- **i18n:** every string is a message key. ICU plurals. Dates and numbers through `Intl`.
- **Delete or move:** `lib/h3-dispatch.ts` and `lib/marketplace-fleet.ts` (to showcase), `lib/marketplace-bookings.ts` (replaced by the DB), `lib/evidence.ts` (showcase), X-07 to X-11 (dead code), the `nav` breakpoint, `.scratch/skills-stack-e2e` and `.claude/skills` (separate repo).
- **Keep and move to `packages/domain`:** `pricing-engine.ts` (as the *suggested price* for owners), `escrow-machine.ts` (as the deposit and settlement calculator), and their tests, which are the best tests in the repository.

---

## 5. Functionality upgrades (sorted by impact, then effort)

| # | Feature | Impact | Effort | Notes |
|---|---|---|---|---|
| 1 | Hindi + Marathi (then Punjabi, Gujarati, Kannada, Telugu, Tamil) | ★★★★★ | M | next-intl; native-speaker review |
| 2 | Real persistence + overlap constraint + date availability in search | ★★★★★ | M | F-07, F-08, F-09 |
| 3 | PIN code / village search, adjustable radius | ★★★★★ | M | F-02, F-03 |
| 4 | Login: Google + mobile OTP + email/password (D-05) [UPDATED] | ★★★★★ | M | S-02 |
| 5 | SMS + WhatsApp confirmations and reminders (booked, accepted, day-before, on the way) | ★★★★★ | M | WhatsApp Business Cloud API templates; DLT-registered SMS |
| 6 | Call / WhatsApp the owner (masked number) + platform helpline | ★★★★★ | S–M | F-19 |
| 7 | Owner listing that saves (location, price unit, photos, availability, operator) | ★★★★★ | L | F-11 |
| 8 | Owner requests: accept / decline with an auto-timeout | ★★★★★ | M | F-12 |
| 9 | My bookings + cancel / reschedule with clear rules | ★★★★☆ | M | F-10 |
| 10 | Machine categories + attachments (harvester, rotavator, sprayer…) | ★★★★☆ | M | F-13 |
| 11 | Per-acre / per-day / per-trip pricing | ★★★★☆ | S | F-14 |
| 12 | "Book by phone" assisted booking (call centre or village agent mode) | ★★★★☆ | M | Many users will prefer a call |
| 13 | Operator-included toggle and driver details | ★★★★☆ | S | Most rentals include a driver |
| 14 | Ratings and reviews (both directions) with counts | ★★★★☆ | M | F-18 |
| 15 | Simulated payment step: UPI / card / net banking / pay after work (D-08) [UPDATED] | ★★★★☆ | S | F-15 |
| 16 | PWA offline shell + queued requests (optional, after M8; D-01) [UPDATED] | ★★★☆☆ | M | A-10 |
| 17 | Seasonal availability and pricing (owner sets a harvest-season rate) | ★★★☆☆ | S | F-32 |
| 18 | Voice input and read-aloud | ★★★☆☆ | S | A-08 |
| 19 | Real KYC (DigiLocker RC/Aadhaar via a licensed provider) | ★★★☆☆ | L | F-16 |
| 20 | Group booking for neighbouring fields (one trip, several farmers) | ★★★☆☆ | L | Cuts transport cost, a real differentiator |
| 21 | Disputes and damage reports with photos | ★★★☆☆ | M | Your escrow rules, simplified |
| 22 | Owner earnings and payouts | ★★★☆☆ | M | – |
| 23 | Custom Hiring Centre (CHC) accounts with many machines | ★★☆☆☆ | M | B2B supply |

---

## 6. Copy rewrite (before → after)

The English below is the source text. Write Hindi and Marathi from the meaning, not word by word.

| Where | Before | After |
|---|---|---|
| `layout.tsx:8` title | KhetiRental v2.0 \| Agritech Sharing & Architecture Showcase | KhetiRental – Rent a tractor near your village |
| `layout.tsx:9-10` meta | Explore how KhetiRental matches farmers with nearby tractors, prices rentals fairly and protects payments with escrow. | Find tractors, rotavators and harvesters for rent near your village. See the full price before you book. |
| `navbar.tsx:66` brand | KhetiRental v2.0 | KhetiRental |
| `navbar.tsx:68` | Demo mode | Sample data (only while it's true; as a ribbon, not in the brand) |
| `navbar.tsx:10` | Marketplace Demo | Rent |
| `navbar.tsx:11-18` | H3 Spatial Sandbox / Pricing Engine / 3-Stage Escrow / Architecture & ADRs / Track B… / Track A… | (removed; footer link "How we built it") |
| (new nav) | – | My bookings · List your machine · Help |
| `page.tsx:25-27` H1 | Tractors for small farms, booked in milliseconds and paid for only by the verified hour. | Need a tractor? Rent one from your village. |
| `page.tsx:28-31` | KhetiRental matches a farmer to a nearby machine, holds the money in a three-stage escrow and releases it only when the handover, the work and the return are proven by telematics. | See the full price first. The owner is paid only after the work is done. |
| `page.tsx:34` | Try the marketplace | Find a tractor |
| `page.tsx:37` | See the H3 sandbox | I own a tractor |
| `page.tsx:45-48` | Evidence ledger · Every number on this site comes from a file in the repository… | (removed) |
| `marketplace/page.tsx:11` | Rent a tractor from a neighbour | (keep, it's good) |
| `marketplace/page.tsx:13` | Farmers find a nearby tractor, see the full price up front and pay into escrow. Owners list a tractor once and get paid after every clean return. | Find a machine near you and see the full price first. Own one? List it once and earn when it would sit idle. |
| `marketplace/page.tsx:18` | Pick the job, your village and dates. The rate and refundable deposit are shown before you commit. | Choose the work, your village and dates. You'll see the full price before you book. |
| `marketplace/page.tsx:23` | Add your tractor and verify your Aadhaar and RC. The RC must be in your name. | Add your machine, set your price and the days it's free. Keep your RC handy. |
| `marketplace/page.tsx:27` | This is a demo. Tractors, owners and ratings are made up, and no payment or document leaves your browser. | Sample data – these machines and owners aren't real yet. |
| `search/page.tsx:9` | Find a tractor near you | Find a machine near you |
| `search/page.tsx:10` | Choose the job and where your farm is. Prices include fuel and show the refundable deposit before you book. | Tell us the work, where and when. |
| `search.tsx:65` | What do you need done | What work? |
| `search.tsx:66` options | Plowing / Sowing / Harvesting | Ploughing · Rotavating · Sowing · Spraying · Harvesting · Transport (picture tiles) |
| `search.tsx:72, 76` | From / To | Start date / End date (or chips: Tomorrow · This week · Pick dates) |
| `search.tsx:82` | Farm size (acres) | Field size (optional) |
| `search.tsx:86` | We assume about 0.75 hour per acre, so 4 h for your farm. That is our estimate, not a measurement. | About 4 hours of work. |
| `search.tsx:89` | Village | Your PIN code or village |
| `search.tsx:100` | Use my location | Use my phone's location |
| `search.tsx:51` | Finding you... | Finding your location… |
| `search.tsx:54` | We could not get your location. Pick a village instead. | Couldn't get your location. Type your PIN code or village instead. |
| `search.tsx:50` | This browser cannot share your location. Pick a village instead. | Location isn't available on this phone. Type your PIN code or village. |
| `search.tsx:107` | Tractors near {place} within 4 km | Machines near {place} · within {radius} km |
| `search.tsx:110` | Looking for tractors... | Finding machines near you… |
| `search.tsx:111` | 6 found | {count, plural, one {# machine free} other {# machines free}} on your dates |
| `search.tsx:114` | No tractors within 4 km. Try another village. | No machines free within {radius} km on these dates. [Search up to 25 km] [Try other dates] [Call us] |
| `search.tsx:121` | Rates come from the pricing model at diesel ₹91 a litre (an assumption) and include fuel. Owners and ratings are demo data. | Prices include diesel. [How we price] |
| `search.tsx:138` | Owner details not available | (never shown; filter the card out) |
| `search.tsx:140` | Rate not available | (never shown) |
| `search.tsx:145` | ☆ 4.8 / 5 / No rating yet | ★ 4.8 (23) / New on KhetiRental |
| `search.tsx:152` | Book / Not bookable in this demo | Book for {dates} |
| `booking-modal.tsx:109` | Book {machine} | Book {machine} |
| `booking-modal.tsx:118` | {activity} hours | How many hours? |
| `booking-modal.tsx:126` | Starts 2026-11-02 at 6 am. The estimate is our assumption; change it if the owner agrees a different time. | Mon 2 Nov, from 7 am. You pay only for the hours used. |
| `booking-modal.tsx:126` (error) | Enter a whole number from 1 to 720. | Enter hours from 1 to 720. |
| `booking-modal.tsx:132` | Rental, 4 h × ₹709.70/h | Rent: 4 hours × ₹710 |
| `booking-modal.tsx:134` | Refundable deposit (tier floor, 0.5 % of tractor value) | Deposit – you get it back after the job |
| `booking-modal.tsx:138` | Held in escrow | Total held until the job is done |
| `booking-modal.tsx:144` | Demo prices from the pricing model, with diesel at ₹91 a litre (an assumption). The deposit comes back after a clean return. No real money moves. | (Sample data ribbon only) |
| `booking-modal.tsx:152` | Escrow authorised. Booking bk_3a51e35e-…. | Booked! Your code is KR-4821. We've sent it by SMS. |
| `booking-modal.tsx:166` | Authorise escrow | Confirm booking |
| `booking-modal.tsx:80` | Someone has already booked this tractor for that time. Pick other dates or another tractor. | Just booked by someone else. Pick other dates or another machine. |
| `listing/page.tsx:9` | List your tractor | Earn from your machine |
| `listing/page.tsx:10` | Tell us about the tractor, then verify that you own it. We block listings where the RC owner is not the person listing. | Takes about 5 minutes. Keep your RC and phone handy. |
| `listing-form.tsx:103-104` | Make / Model | Company (e.g. Mahindra) / Model (e.g. 575 DI) |
| `listing-form.tsx:105` | Year bought or made | Year of manufacture (on the RC) |
| `listing-form.tsx:107` | Horsepower tier | Horsepower (HP) |
| `listing-form.tsx:114` | What you paid for it (₹) | (remove; ask for the price you want to charge) |
| `listing-form.tsx:118` | Implements you rent out with it | What comes with it? |
| `listing-form.tsx:135` | Verify you own it | Check ownership |
| `listing-form.tsx:136` | Demo: nothing leaves your device. We check the file type and size in your browser and discard the file. | (remove) |
| `listing-form.tsx:32` | Drop a PDF, JPG or PNG here, or choose a file. | Take a clear photo of your RC |
| `listing-form.tsx:29` | {label} verified | Uploaded ✓ – we'll check it within 24 hours |
| `listing-form.tsx:101` | Fix 10 things below to list your tractor. | {count, plural, one {# thing} other {# things}} to fix (each a link) |
| `listing-form.tsx:83` | Both documents passed the demo check and the RC owner matches your name. Nothing was saved or sent. | Your Swaraj 744 FE is live. Farmers within 10 km can now book it. |
| `pricing/page.tsx:9` | Dynamic depreciation pricing | How we price a rental |
| `pricing/page.tsx:11` | Rate = (B_base × μ_season × δ_soil) + … | Price = owner's rate + diesel used. No hidden charges. (Formula moves to the showcase) |
| `pricing-calculator.tsx:82` | Acquisition cost: ₹6,40,000.00 | Tractor price: ₹6.4 lakh |
| `pricing-calculator.tsx:171` | Owner keeps ₹595.99 per hour after diesel and the 13.5% platform fee. | You keep ₹596 an hour after diesel and our fee. |
| `escrow/page.tsx:9` | 3-stage milestone escrow | (showcase only) "How your money is protected" for the product version |
| `h3-map.tsx:10` | In-use | Busy |
| `api/bookings/route.ts:9` | Something went wrong. Try again. | Something went wrong on our side. Try again, or call {helpline}. |

---

## 7. Tools to add

| Category | Tool | Why this project | Set up | Catches or improves |
|---|---|---|---|---|
| Format | **Prettier** + `prettier-plugin-tailwindcss` | Consistent class order makes token misuse visible in review | `npm i -D prettier prettier-plugin-tailwindcss` · `.prettierrc`: `{"plugins":["prettier-plugin-tailwindcss"],"printWidth":110}` | Formatting noise in diffs |
| Hooks | **lefthook** | Faster and simpler than husky; works for Go too | `npm i -D lefthook && npx lefthook install` · `lefthook.yml`: `pre-commit: { parallel: true, commands: { lint: { glob: "*.{ts,tsx}", run: "npx eslint --fix {staged_files}" }, fmt: { run: "npx prettier --write {staged_files}" }, go: { glob: "*.go", run: "gofmt -l {staged_files}" } } }` | Broken commits before CI |
| Lint | **ESLint 9 flat** + `eslint-plugin-jsx-a11y` (strict) + `@typescript-eslint/strict-type-checked` | a11y regressions, unsafe `as` casts (C-06) | `npm i -D eslint@latest eslint-plugin-jsx-a11y typescript-eslint` | Missing labels, `as unknown as` |
| Dead code | **knip** | Finds unused exports and files (X-07 to X-12) | `npx knip` (add a `knip.json` with the Next.js plugin) | Unused files, exports, dependencies |
| Validation | **zod** | One schema for API input, forms and env | `npm i zod` | Bad input; replaces the hand-written validators |
| Unit tests | **Vitest** (have it) | Keep `packages/domain` at ~100 % | Two Vitest projects (P-05) | – |
| E2E | **Playwright** (have it) + `@axe-core/playwright` | Automated a11y on every route | `npm i -D @axe-core/playwright`; in each spec: `expect((await new AxeBuilder({page}).analyze()).violations).toEqual([])` | Contrast, labels, ARIA |
| Visual regression | Playwright `toHaveScreenshot()` at 375 / 768 / 1280 | Catches token and layout drift | `await expect(page).toHaveScreenshot({ fullPage: true, maxDiffPixelRatio: 0.01 })` | Unintended visual change |
| Perf budget | **Lighthouse CI** (`@lhci/cli`) with mobile throttling | Enforces the budgets in §2 and §3 | `npx lhci autorun` · `lighthouserc.json`: `assertions: { "resource-summary:script:size": ["error",{"maxNumericValue":122880}], "largest-contentful-paint": ["error",{"maxNumericValue":4000}] }` | JS creep (P-01), LCP |
| Bundle | `@next/bundle-analyzer` | See what is in each chunk | `ANALYZE=true next build` | h3-js / recharts in client bundles |
| Component catalog | **Storybook 8** (only once `components/ui` exists) | Build and review the 12 UI components in isolation, in hi, mr and en, light and dark | `npx storybook@latest init` | Inconsistent variants |
| Design | **Figma** (free tier) with variables mirroring `tokens.css`; **Tokens Studio** if you want design↔code sync | One source of truth for tokens | Export variables → `tokens.css` | Drift between design and code |
| Motion / 3D | **Rive**, **dotLottie**, **GSAP**, **Spline** (prototype), **Blender** + **gltf-transform** (`npx @gltf-transform/cli optimize in.glb out.glb --compress meshopt --texture-compress ktx2`) | §2 | – | Oversized assets |
| Maps | **Leaflet** + **OpenStreetMap-based tiles** (or MapLibre if you need vector); an India-specific geocoder (Mappls/MapmyIndia or Ola Maps) for village names; **India Post PIN directory** (data.gov.in) for offline PIN → lat/lng | Indian village search is the hard part; global geocoders are weak here | Load the PIN CSV into Postgres | F-02 |
| Geo DB | **PostGIS** on Neon or Supabase | Radius search, distance, no Redis needed | `CREATE EXTENSION postgis; CREATE INDEX ON machines USING gist(location);` | F-03 |
| ORM | **Drizzle** | SQL-first, typed, small | `npm i drizzle-orm postgres && npm i -D drizzle-kit` | – |
| i18n | **next-intl** + JSON messages; **Tolgee** or a shared Google Sheet for translators | App Router support, ICU plurals | `npm i next-intl`; `app/[locale]/…`; `middleware.ts` with `createMiddleware(routing)`, where `routing = defineRouting({ locales: ["mr","hi","en"], defaultLocale: "en", localeDetection: true })` [UPDATED by D-03] | A-07, T-04 |
| Monitoring | **Sentry** (`@sentry/nextjs`) | Errors from real phones, with release tags | `npx @sentry/wizard@latest -i nextjs` | Crashes, failed bookings |
| Analytics + replay | **PostHog** (with masking on) | The funnel: search → results → book → confirmed; session replay to *watch* farmers struggle | `npm i posthog-js` | Where users drop off |
| Real-user speed | **Vercel Speed Insights** | Real LCP and INP from Indian 3G/4G | `npm i @vercel/speed-insights` | Field performance |
| Uptime | **Better Stack** or **UptimeRobot** | Alerts if search or booking is down at harvest | Monitor `/api/health` every 1 min | Outages |
| CI/CD | GitHub Actions (have it) + **Vercel preview deployments** per PR | Review real URLs on a phone before merge | Vercel GitHub integration | – |
| Security | **Dependabot** (npm, gomod, actions), **gitleaks** in CI, **CodeQL**, **govulncheck** | Dependency and secret scanning (also replaces the `*token*` gitignore hack) | `.github/dependabot.yml`; `uses: gitleaks/gitleaks-action@v2`; `go install golang.org/x/vuln/cmd/govulncheck@latest && govulncheck ./...` | Leaked keys, CVEs |
| Offline / PWA (optional, D-01) | **Serwist** (`@serwist/next`) | Cached shell, last results, queued bookings on 2G | `npm i @serwist/next serwist`; `app/sw.ts` with `NetworkFirst` for `/api/*`, `CacheFirst` for images; `BackgroundSyncPlugin("bookings")` | A-10 |
| Messaging (optional; in-app + log mock by default, D-11) | **WhatsApp Business Cloud API**, plus a DLT-registered SMS provider (e.g. MSG91) | Confirmations where farmers already are | Template approval takes days; start early | F-10 |
| Payments [UPDATED by D-08] | **None: a mock payment service** (`server/payments/mock.ts`) behind a `PaymentProvider` interface | It's a project; no real money | `createPayment()` resolves after ~1.5 s with `paid_demo`; `DEMO_PAYMENT_FAIL=true` forces a failure for testing | F-15 |
| Auth [ADDED by D-05] | **Auth.js (NextAuth v5)** + `@auth/drizzle-adapter`, argon2 for passwords | Google, email/password and a custom OTP flow on one session model | `npm i next-auth@beta @auth/drizzle-adapter @node-rs/argon2`; Google provider (dev: "Mock Google" credentials provider), Credentials provider for email, custom OTP route | S-02 |
| Dev mocks [ADDED] | `server/mocks/` for Google sign-in, SMS OTP (logs code), notifications (in-app + log), payments | Runs with zero keys | Switched by env: `AUTH_GOOGLE_ID` present → real Google; else mock | Part 0 §0.1 rule 5 |

**Not recommended for now:** Kafka, Kubernetes, Redlock in the product path, and a CRDT for telemetry. These are good for the showcase but premature for a pilot.

---

## 8. Build plan: milestones M0–M8 [UPDATED: replaces the earlier three-phase rollout]

Each milestone lists what to build, the review findings it closes, and the checks that must pass before moving on. UI details are in `UI-SPEC.md`; section numbers like "UI §4.1" refer to it.

### M0: Repository hygiene and safety
**Build:**
- [ ] Move `services/matching-engine`, `services/booking-orchestrator`, `services/telemetry-gateway`, `contracts/`, `analytics/`, `deploy/` and `tests/load/` to `showcase/` (D-17), and fix every path in CI and `test-all.sh`.
- [ ] Apply S-01 (service token plus input validation), S-05 (range checks, generic errors, `[]` not `null`) and S-06 (server timeouts) to the Go services.
- [ ] Create `apps/web` (move `services/client-portal` there) with the folder structure from Phase 3 §4.
- [ ] D-02: fix `.gitignore` (remove `*token*` and `*secret*`, add explicit secret patterns and `!.env.example`).
- [ ] D-03: create `GLOSSARY.md`. X-14: delete the unread `NEXT_PUBLIC_*` vars from the README.
- [ ] D-05/X-15: move `.scratch/skills-stack-e2e`, `.claude/skills` and the skills checks out of `test-all.sh` and CI.
- [ ] D-06: Prettier with the Tailwind plugin, lefthook (eslint, prettier, typecheck on staged files), knip, ESLint `jsx-a11y` strict and `typescript-eslint` strict.
- [ ] D-01: rewrite the README for developers, add `.env.example` and `compose.yaml` (Postgres 16 + PostGIS on 5432).

**Done when:** CI passes on the moved layout, `docker compose up` starts the database, and `npm run dev` serves the old portal from `apps/web`.

### M1: Foundations (design system, i18n, layout)
**Build:**
- [ ] `app/tokens.css` and `tailwind.config.ts` exactly as in Phase 3 §1 / UI §2 (closes V-02, V-03, V-04, V-06, V-08, V-09, V-10, V-11).
- [ ] Fonts: Mukta 400/700 and Baloo 2 700 with the `latin` and `devanagari` subsets (V-07).
- [ ] `components/ui/`: Button, Input, Select, ChipGroup, Tile, Card, Sheet, Toast, Badge, PriceRow, StickyCTA, Stepper, LanguageSwitch, EmptyState, Skeleton (UI §5; closes V-15, V-23, A-01).
- [ ] next-intl with `app/[locale]/…`, locales `mr`, `hi`, `en`, the cookie, middleware, and message files seeded from UI §11 (A-07, T-04).
- [ ] App shell: site header (desktop top nav, mobile header plus bottom tab bar), footer, skip link (A-02), active nav state (A-05), `not-found.tsx` (F-28), security headers (S-08).
- [ ] Format helpers: `formatRupees` (whole rupees), `formatDateRange` (Intl), `toAsciiNumber` (F-23, X-01).

**Done when:** a component gallery page (`/dev/ui`, dev builds only) shows every component in every state in all 3 languages, light and dark. axe is clean. Unit tests cover the formatters.

### M2: Data, auth and core API
**Build:**
- [ ] Drizzle schema and migrations (UI §12): `users`, `accounts`, `sessions`, `otp_codes`, `machines` (with `geography(Point,4326)` and a GiST index), `machine_photos`, `machine_blocks`, `bookings` (with `during tstzrange` and the `EXCLUDE` constraint from F-09), `payments`, `reviews`, `notifications`, `problem_reports`, `pin_codes`.
- [ ] Seed: 3 districts, ~40 machines across categories, 6 owners, 4 renters, reviews and bookings, all `is_sample = true`.
- [ ] Auth.js (NextAuth v5): Google provider (mocked in dev by a "Mock Google" button that signs in a seeded user); Credentials for email + password (argon2); phone OTP (6 digits, 5-minute expiry, 5 attempts, code printed to the server log in dev); `httpOnly` session cookie; roles `renter`, `owner`, `admin` (D-05, S-02).
- [ ] Route protection: every `/(app)` route needs a session and redirects to `/login?next=…`.
- [ ] API and server actions with zod validation and one error shape (C-04, C-06):
  - search: geo radius, date availability, sort, cursor paging (F-02, F-03, F-04, F-05, F-07, F-40, F-41);
  - machine detail;
  - create booking (idempotency key, slot/date-range model; F-06, F-21, F-26);
  - cancel booking;
  - mock payment (D-08);
  - owner accept/decline;
  - owner block days;
  - listing CRUD with photos (local disk in dev);
  - problem reports.
- [ ] Rate limiting on auth and booking endpoints (S-08).

**Done when:** API integration tests pass, including the 20-parallel-bookings test (exactly 1 succeeds) and the ownership checks (S-03).

### M3: Welcome page and login (UI §4.1–§4.3)
**Build:**
- [ ] The welcome page with the live field scene, the tractor ploughing in rounds, tweakable constants, the three pill buttons, floating counters and the language switch (D-10).
- [ ] The story sections below it, with CSS scroll-driven reveals (no 3D yet).
- [ ] Log in / Sign up page with all three methods and the sign-up name and role.
- [ ] OTP entry page.
- [ ] Forgot password (email link mocked to the server log).

**Done when:** UI §4.1–§4.3 checklists pass, reduced motion shows a still scene with final counter values, and the welcome page meets its Lighthouse targets.

### M4: Renter flow (UI §4.4–§4.10)
**Build:**
- [ ] Search (job tiles, PIN/village with autocomplete, voice button where supported, location, date chips and calendar, field-size stepper).
- [ ] Results (list/map toggle, sort, radius, "with driver" filter, free/busy split, paging, URL-synced filters F-37).
- [ ] Machine detail (photos, specs, condition F-35, price, 14-day availability, owner, reviews, sticky Book bar).
- [ ] Booking sheet as its own route (F-39), 3 steps with mock payment (D-08).
- [ ] Booking confirmation and booking detail.
- [ ] My bookings (tabs, statuses, call/WhatsApp, cancel F-10, report a problem F-36).
- [ ] In-app notifications (D-11).

**Done when:** UI checklists pass and the renter e2e journey passes in all 3 languages.

### M5: Owner flow (UI §4.11–§4.13)
**Build:**
- [ ] Listing wizard, 4 steps: machine, photos, where and when, price (F-11, F-13, F-14, F-35, F-38). RC upload "pending review" (D-12).
- [ ] Owner dashboard: earnings, requests with a 2-hour reply timer and accept/decline, calendar day-blocking, my machines with edit and pause (F-12).
- [ ] Demo admin page `/admin` (admin role only): mark the RC checked, view problem reports.

**Done when:** the owner e2e journey passes, and accepting a request changes the renter's booking status and creates a notification.

### M6: Story motion and 3D (UI §4.1.4–§4.1.5)
**Build:**
- [ ] The `data-motion` detector.
- [ ] GSAP ScrollTrigger pins (rich mode only).
- [ ] The React Three Fiber tractor in the "buy vs rent" section (D-09): GLB ≤ 400 KB, lazy after idle, image fallback.

**Done when:** the 3D chunk never loads in lite or none mode (checked in a network test), and the budgets in Phase 3 §2 hold.

### M7: Remaining pages (UI §4.14–§4.20)
**Build:**
- [ ] Settings: language, roles, phone/email, logout, delete account.
- [ ] Help, with a call/WhatsApp support placeholder.
- [ ] How we price.
- [ ] Terms and Privacy (placeholder text marked `[LEGAL REVIEW NEEDED]`).
- [ ] `/about/engineering`, with the dossiers moved there minus resume and interview content (D-16).
- [ ] 404 (already in M1, restyled).

### M8: Quality pass
**Build:**
- [ ] Close every remaining accessibility finding (A-01 to A-12) and content finding (T-01 to T-07; apply the copy table in §6).
- [ ] Performance: P-01 to P-07 (no h3-js or recharts in client bundles; server-rendered results; caching).
- [ ] Lighthouse CI with the budgets from Part 0 §0.4.
- [ ] axe in every Playwright spec, plus visual snapshots at 390 / 768 / 1280.
- [ ] Optional: Sentry, PostHog, PWA (A-10).

- [ ] Usability check with 5 farmers on their own phones (Marathi/Hindi) and 3 owners; fix every blocker found.

**Done when:** every item in Part 0 §0.4 is ticked.

---

# Phase 4: Top 15 (highest impact first)

1. **F-01:** Separate the farmer product from the engineering portfolio (nav, home, title, dossiers).
2. **A-07:** Hindi and Marathi with a Devanagari-capable font and a first-visit language picker.
3. **F-08 + F-09:** Real Postgres persistence with an `EXCLUDE` overlap constraint, replacing the in-memory `Map`.
4. **F-02:** PIN code and village search for all of India, instead of six Jaipur localities.
5. **F-06:** Respect the end date; bookings cover real days and slots.
6. **F-07:** Show only machines free on the chosen dates; busy ones last, labelled.
7. **S-02 (+ S-01, S-04) [UPDATED]:** Login with Google, mobile OTP or email (D-05), and auth on every write endpoint.
8. **F-11 + F-12:** An owner listing that saves price, location, photos and availability, plus an owner requests screen.
9. **F-10 + F-19 [UPDATED]:** My bookings, a human booking code, in-app confirmation (SMS/WhatsApp optional, D-11), and call or WhatsApp the owner.
10. **F-03 + F-04:** Adjustable radius (5/10/25 km) and Nearest / Cheapest / Best-rated sorting.
11. **Phase 3 §1 + V-01/V-02/V-03/V-07:** Mitti design system: sunlight-safe borders, 18 px body, working tokens, real components.
12. **V-13 + V-17:** Machine cards with real photos, whole-rupee prices and availability chips.
13. **F-13 + F-14:** Machine categories and attachments; per-acre and per-day pricing.
14. **F-16 + T-01:** Plain, honest language: no "escrow" or "authorise"; "uploaded", not "verified".
15. **D-10 + Phase 3 §2 [UPDATED]:** The welcome page with the live ploughing field, floating counters and story sections, built `lite`-first within the performance budget.


---

# Appendix A: Coverage checklist against the brief

Every item the brief asked for, and where it is answered in this file.

| Brief item | Where |
|---|---|
| Phase 0.1 Repo structure, stack, frameworks, libraries, folders, entry points | Phase 0 › Stack and layout |
| Phase 0.2 Every UI file read | Phase 0 › Components; all findings cite UI files |
| Phase 0.3 Core logic, API, data models, config; location search, map, booking, availability, payments, auth | F-02–F-09, F-15, S-01–S-04, booking lifecycle table |
| Phase 0.4 Install, run, lint, type-check, test, build | Phase 0 › What I ran |
| Phase 0.5 Browser at 1440/768/375, click everything, Slow 3G + 4× CPU | Phase 0 › Browser testing; Performance table; V-18, V-22 |
| Phase 0.6 Inventory: screens, components, flows (renter and owner), colours, type, spacing, radius, shadows, breakpoints | Phase 0 › Inventory |
| 1A Bugs, dead buttons, links, validation, error handling | F-06, F-11, F-20–F-24, F-30, F-34, F-38, T-07 |
| 1A Every state of every screen (loading, empty, error, success, partial, long text, 0, 1,000, slow, offline) | Screen states matrix |
| 1A Location: permission denied, manual fallback, distance correctness, radius, sorting, map on slow networks | F-02, F-03, F-04, F-05, F-25, F-27, F-41, distance check, V-14 |
| 1A Booking: double-booking, availability, date edge cases, cancel/reschedule, what both sides see, notifications | F-06–F-10, F-21, F-26, F-39, date/time check, booking lifecycle table |
| 1A Owner: listing, editing, photos, requests, pricing units, earnings | F-11, F-12, F-14, F-35 |
| 1A Payments: failure, refunds, deposits, UPI | F-15 |
| 1A Trust and safety: verification, ratings, condition, contact, disputes | F-16, F-17, F-18, F-19, F-35, F-36 |
| 1A Edge cases: double-clicks, refresh, back button, invalid input, special characters, long names, regional input | Phase 0 (double-click: one POST), F-37, F-38, F-39, F-23, F-17, security checks (special characters) |
| 1A Security: keys, frontend secrets, auth, others' bookings, input, XSS, injection, CORS, storage, location/phone exposure | S-01–S-08, Security checks that passed |
| 1A Performance: bundle, re-renders, images, N+1, caching, blocking requests, geo indexes | P-01–P-07, F-09 (geo index), Phase 3 §4 |
| 1A Dead code, unused files and deps, duplication, console.logs, commented code, TODOs | X-01–X-15, Security checks that passed |
| 1B Folder structure, naming, long files, inconsistent patterns, types, hard-coded values, over/under-engineering | C-01–C-09 |
| 1C Colour (every hex, contrast with ratios, outdoor, states, full palette) | Inventory, V-02–V-06, A-03, Phase 3 §1 |
| 1C Typography (every family/size/weight/line height/tracking, scale, Devanagari fonts) | Inventory, V-07, V-08, Phase 3 §1 |
| 1C Spacing (every value, scale, what changes to what) | Inventory, V-09, Phase 3 §1 |
| 1C Boxes, cards, borders, radius, shadows | Inventory, V-10, V-11, V-12 |
| 1C Layout and alignment, visual hierarchy | V-09, V-18, V-21, V-22 |
| 1C Equipment cards and listing pages | V-13, F-35 |
| 1C Map UI | V-14 |
| 1C Components and all their states | V-15, V-23 |
| 1C Icons and imagery | V-16, V-17 |
| 1C Responsiveness at 375 / 768 / 1024 / 1440 | V-18, V-22, Phase 0 (no horizontal scroll at any width except F-38) |
| 1C Dark mode | V-19 |
| 1C Motion | V-20, A-11, Phase 3 §2 |
| 1D AI-slop hunt with quotes and rewrites | 1D table AI-01–AI-15 |
| 1E Every visible string, jargon, capitalisation, errors, translation readiness | T-01–T-07, Phase 3 §6 |
| 1F Four personas, walkthroughs, ratings per flow, top 5 complaints, one love | 1F and the flow ratings matrix |
| 1G Contrast, alt text, labels, keyboard, focus, ARIA, semantics | A-02–A-06, A-12 (there are no images, so no alt text yet: add it with V-17) |
| 1G Touch targets under 48 px | A-01 |
| 1G Languages, switcher, Devanagari | A-07, V-07 |
| 1G Low literacy, voice | A-08 |
| 1G Low-end device and network, offline | Performance table, A-10 |
| 1G Reduced motion | A-11, Phase 3 §1 (CSS) and §2 |
| 1H README, setup, env example, scripts, lint/format, git hygiene, secrets, giant files, AI leftovers | D-01–D-08, X-15, Security checks that passed |
| Phase 2 Scorecard with targets | Phase 2 |
| Phase 3.1 Design system as code | Phase 3 §1 |
| Phase 3.2 Storytelling landing page, libraries, fallbacks, budget | Phase 3 §2 |
| Phase 3.3 Screen redesigns with ASCII wireframes | Phase 3 §3 |
| Phase 3.4 Architecture refactor | Phase 3 §4 |
| Phase 3.5 Functionality upgrades by impact and effort | Phase 3 §5 |
| Phase 3.6 Full copy rewrite table | Phase 3 §6, T-03, T-06 |
| Phase 3.7 Tools with setup | Phase 3 §7 |
| Phase 3.8 Phased rollout referencing IDs | Phase 3 §8 |
| Phase 4 Top 15 | Phase 4 |
| Post-review UI decisions (website only, welcome page, login, languages, payments, 3D) | Part 0 and `UI-SPEC.md` |

# Appendix B: Limits of this review

- I couldn't test on a real budget Android phone, real Hindi or Marathi keyboards, or real GPS (only "location denied"). The Slow 3G and 4× CPU numbers come from Chrome's emulation.
- Time to interactive wasn't measured as a single number; the table gives first paint, `load`, and when results became visible.
- 25 of your 27 Playwright tests couldn't start in my sandbox (browser version mismatch, not your code); your own last run passed.
- 8 Postgres integration tests were skipped (no Postgres in my sandbox). Every Redis-backed test passed.
- The personas are role-played from the current build, not real interviews.
- The Hindi and Marathi copy in Phase 3 §2 is a draft for native-speaker review.
- The tractor cost and working-days figures in the landing story come from your pricing model, not from a survey.

