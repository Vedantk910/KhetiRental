# KhetiRental website: UI specification (final)

> **Status: FINAL, 24 October 2026.** Agreed with the owner after the review.
> **Companions:** `REVIEW.md` (Part 0 has the decisions D-01 to D-17 and the build milestones M0–M8) and `design/*.dc.html` (the clickable mockups the owner approved).
> **Audience:** Claude Code. This file says exactly what each page shows, what each button does, every state, every string and every animation. If something you need is not specified here, follow the closest existing pattern in this file and flag the gap in your commit message. Don't invent new visual styles.

---

## 0. How to use this file and the mockups

- `design/*.dc.html` are **mockups in a design-tool format** (`<x-dc>`, `{{holes}}`, `<sc-for>`, `<sc-if>`, a `DCLogic` class). They show the **approved look, spacing, colours and copy** at phone width (390 px).
- **Don't copy that format or its runtime into the website.** Rebuild each screen as Next.js App Router pages and React components with Tailwind and the tokens in §2. The inline styles in the mockups map one-to-one onto the tokens (for example `#223585` = `action`, `2px solid #7C7062` = `border-control`, `border-radius: 10px` = `rounded-control`).
- **Mockup → route map:**

| Mockup file | Page | Route (with locale prefix `/{mr\|hi\|en}`) |
|---|---|---|
| `Main.dc.html` | Welcome page + story | `/` |
| `Login.dc.html` | Log in / Sign up | `/login` (sign-up is the same page: `/login?mode=signup`) |
| `Search.dc.html` | Search | `/rent` |
| `Results.dc.html` | Results | `/rent/results?…` |
| `Detail.dc.html` | Machine detail | `/rent/m/[machineId]` |
| `Booking.dc.html` | Booking (3 steps) | `/rent/m/[machineId]/book?step=1\|2\|3&…` |
| `Booked.dc.html` | My bookings | `/bookings` |
| `ListMachine.dc.html` | Owner listing, step 4 (price) | `/owner/machines/new?step=4` |
| `Owner.dc.html` | Owner dashboard | `/owner` |

- Pages with **no mockup** are fully specified in this file (§4.3, §4.8, §4.10, §4.11 steps 1–3, §4.14–§4.20). Build them from the same components and tokens.
- **Sample data in the mockups** (Ramesh K., Swaraj 744 FE, ₹710, KR-4821, Latur, 2–4 Nov) is illustrative. The real pages read from the database. Seeded sample data must show a "Sample" badge (§5.9).

---

## 1. Product summary and UI principles

KhetiRental is a **website** where farmers rent farm machines (tractors, rotavators, harvesters, sprayers, seed drills, trolleys) from owners nearby, and owners earn from machines that would otherwise sit idle. The users are mostly rural Indian farmers on budget Android phones, often in bright sunlight, on slow networks, more comfortable in Marathi or Hindi than English.

**Principles, in priority order:**
1. **Readable outdoors:** body text 18 px; nothing smaller than 14 px (the 11 px source line on the welcome counters is the only exception); body text contrast ≥ 7:1; control borders ≥ 3:1.
2. **Big targets:** every tappable thing ≥ 48 × 48 px; primary actions 56 px tall on phones.
3. **One primary action per screen,** in a sticky bottom bar on phones and inline on desktop.
4. **Pictures and numbers before words:** job tiles with icons, machine photos, whole-rupee prices.
5. **Three languages everywhere:** मराठी · हिंदी · English, switchable on every page.
6. **Motion only on the welcome and story area.** App pages stay calm and fast; only small transitions (sheets 200 ms, chips 120 ms, toasts 150 ms).
7. **Honest copy:** no "escrow" or "authorise" jargon, no fake "verified", and demo payments are labelled as demo.

---

## 2. Design tokens

These are the same tokens as REVIEW.md Phase 3 §1, repeated here so this file stands alone.

### 2.1 Colour roles

| Role | Light | Dark | Use |
|---|---|---|---|
| `bg` | `#FAF8F4` | `#13100D` | Page background |
| `surface` | `#FFFFFF` | `#211C18` | Cards, sheets, header |
| `surface-muted` | `#F3EEE6` | `#2B2520` | Tab track, busy cards, chips (neutral) |
| `text` | `#13100D` | `#F3EEE6` | Body text |
| `text-muted` | `#483F37` | `#CFC4B4` | Secondary text |
| `text-subtle` | `#5E544A` | `#A39684` | Captions, step labels |
| `border-control` | `#7C7062` | `#7C7062` | Input, select and secondary-button borders (2 px) |
| `border-subtle` | `#E5DDD1` | `#332C26` | Card borders (1 px), dividers |
| `chip-border` | `#CFC4B4` | `#5E544A` | Unselected chip and tile borders (2 px) |
| `action` | `#223585` | `#FBC02D` | Primary buttons, links, active tab underline |
| `action-hover` / `-pressed` | `#1B2A66` / `#141F4A` | `#FFD45C` / `#C98A00` | |
| `on-action` | `#FFFFFF` | `#13100D` | Text on primary buttons |
| `selected` | `#FFD45C` + 2 px `#223585` border | same | Selected chip, tile or radio row (`#FFF4CC` fill for large rows) |
| `success` / `success-bg` | `#1E7B3C` / `#E7F4EA` | `#6CCB8A` / `#1F3326` | "Free 2–4 Nov", "Confirmed", "Driver included" |
| `warning` / `warning-bg` | `#B4500A` / `#FDEEE2` | `#F59E5B` / `#3A2A1C` | "Waiting for owner", reply timers |
| `danger` / `danger-bg` | `#B42318` / `#FDECEA` | `#F97066` / `#3A1F1C` | Errors, Cancel button text and border |
| `info` / `info-bg` | `#2C44A8` / `#EAEFFB` | `#8DA2E3` / `#1E2440` | "RC checked", demo-payment banner |
| `owner-hero` | `#223585` (text `#FFFFFF`, tiles `#1B2A66`, labels `#DCE3F7`) | same | Owner dashboard header, story owner section |
| `overlay` | `rgba(19,16,13,0.6)` | same | Behind sheets and modals |
| Live scene | see §4.1.2 | – | Welcome page only |

### 2.2 Type (fonts: **Mukta** 400/700 for the UI; **Baloo 2** 700 for display; subsets `latin` + `devanagari`)

| Token | Phone | ≥ 768 px | Weight | Where |
|---|---|---|---|---|
| `display` | 46/50 (welcome hero) | 72/76 | Baloo 2 700 | Welcome heading |
| `display-2` | 28/34 | 40/48 | Baloo 2 700 | Story section titles, Login "Welcome to KhetiRental" (32/38) |
| `counter` | 40/44 | 56/60 | Baloo 2 700, tabular | Welcome counters |
| `h1` | 24–30/32–38 | 32/40 | 700 | Page titles ("What work?", machine name) |
| `h2` | 20–22/28–30 | 24/32 | 700 | Section titles |
| `price` | 28/34 | 28/34 | 700, tabular | Prices on cards and detail |
| `body` | 18/28–30 | 18/30 | 400 | Text and inputs |
| `small` | 16/24 | 16/24 | 400 | Meta lines |
| `label` | 16/24 | 16/24 | 700 | Labels, chips, buttons |
| `caption` | 14/20 | 14/20 | 400/700 | Hints, badges, step labels |
| `micro` | 11/14 | 12/16 | 400 | **Only** the welcome counter source line |

Devanagari text uses the same tokens; line heights already allow for matras.

### 2.3 Spacing, radius, shadow, sizes
- **Spacing scale:** 4, 8, 12, 16, 24, 32, 48, 64, 96 px. Page side padding 16 px on phones, 24 px from 640 px, content max width 1152 px. Reading text max width 38 rem.
- **Radius:** `control` 10 px (buttons, inputs, tiles); `card` 16 px (cards, sheets, panels); `pill` 999 px (chips, badges, language switch, welcome buttons).
- **Shadow:** `sheet` `0 -8px 24px rgba(19,16,13,.14)`; `raised` `0 -2px 8px rgba(19,16,13,.08)` (sticky bottom bars only). Nothing else gets a shadow.
- **Heights:** primary button 56 (phone) / 52 (desktop); secondary button 48–52; input 52; chip 44–48 (filter chips 36 only on the results header, inside a 48 px tap area); tab 44 inside a 52 track; bottom tab bar 64; header 56–60.
- **Icons:** lucide-react, 2 px stroke, 20 px inline, 24 px in buttons and navigation. Machine and job pictograms: custom SVG set (§5.12).

### 2.4 Code
The full `tokens.css` and `tailwind.config.ts` follow, identical to REVIEW.md Phase 3 §1.

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

---

## 3. Site map, navigation and access

### 3.1 Routes

| Route | Page | Access | Spec |
|---|---|---|---|
| `/` | Welcome page + story | Public (logged-in users see "Go to my bookings / Find machines" in place of Log in / Sign up) | §4.1 |
| `/login` (`?mode=login\|signup`, `?next=`) | Log in / Sign up | Public; logged-in users are redirected to `/rent` | §4.2 |
| `/login/otp` | Enter OTP | Public (needs a pending OTP) | §4.3 |
| `/login/forgot` | Forgot password | Public | §4.3 |
| `/rent` | Search | Logged in | §4.4 |
| `/rent/results` | Results (list ⇄ map) | Logged in | §4.5 |
| `/rent/m/[id]` | Machine detail | Logged in | §4.6 |
| `/rent/m/[id]/book` | Booking (steps 1–3) | Logged in | §4.7 |
| `/rent/m/[id]/book/pay` | Mock payment screen | Logged in | §4.7.4 |
| `/bookings` | My bookings | Logged in | §4.9 |
| `/bookings/[code]` | Booking detail | Logged in (renter or owner of that booking) | §4.8 |
| `/bookings/[code]/problem` | Report a problem | Logged in (renter or owner of that booking) | §4.10 |
| `/owner` | Owner dashboard | Owner role | §4.12 |
| `/owner/machines/new` (`?step=1–4`) | List a machine | Owner role (renters see "Turn on owner mode" first) | §4.11 |
| `/owner/machines/[id]/edit` | Edit a machine | Owner of that machine | §4.11 (same wizard, pre-filled) |
| `/owner/requests/[code]` | Request detail | Owner of that machine | §4.13 |
| `/notifications` | Notifications | Logged in | §4.14 |
| `/settings` | Settings | Logged in | §4.15 |
| `/help` | Help | Public | §4.16 |
| `/how-we-price` | How we price | Public | §4.17 |
| `/terms`, `/privacy` | Legal | Public | §4.18 |
| `/about/engineering` (+ sub-pages) | How we built it (showcase) | Public | §4.19 |
| `/admin` | Demo admin | Admin role | §4.20 |
| any other | 404 | Public | §4.21 |

All routes sit under the locale prefix `/{mr|hi|en}`. The language switch keeps the path and query string.

### 3.2 Navigation

- **Phone (< 768 px), logged-in pages:** a top header (56 px) with the logo (links to `/rent` when logged in) on the left and, on the right, the bell icon (→ `/notifications`, red dot if unread) and the language pill. A **bottom tab bar** (64 px) shows on `/rent*`, `/bookings*`, `/owner*`, `/notifications` and `/settings`:
  - renter: **Rent** · **My bookings** · **Help** (· **Owner** when the owner role is on);
  - owner-only accounts: **Dashboard** · **My machines** · **Help**.
  
  The active tab gets `action` text plus a 3 px top border. The tab bar is hidden while a booking sheet or wizard is open, where the sticky CTA bar takes its place.
- **Desktop (≥ 1024 px):** a top header (64 px) with the logo · Rent · My bookings · (Owner dashboard) · Help on the left, and bell · language switch · avatar menu (Settings, Log out) on the right. No bottom bar.
- **Tablet (768–1023 px):** the phone pattern, with a 2-column content grid where noted.
- **Footer** (public pages and the bottom of `/rent`): About · How we price · How we built it · Help · Terms · Privacy · the language switch.
- **Language switch:** a segmented pill with three buttons **मराठी · हिंदी · English**. Selected = `action` fill with `on-action` text; others = surface with `text`. Each button is ≥ 38 px tall inside a 44 px pill. It needs `role="group"`, `aria-label` "Language" (translated) and `aria-pressed` on each button. Switching changes the locale, keeps the page, keeps form input (persist form state in the URL or in memory) and sets the `NEXT_LOCALE` cookie.

### 3.3 Login gating
Any logged-in-only route hit while logged out redirects to `/login?next=<path>`. After login: go to `next`. With no `next`: owners whose only role is owner go to `/owner`, everyone else to `/rent`. A new sign-up who picked "List my machines" goes to `/owner/machines/new`.

---

## 4. Pages

Each page section gives: purpose → layout (phone, then desktop) → every element from top to bottom, with what is clickable and where it goes → states → data → acceptance checks. String keys refer to §11.

### 4.1 Welcome page (`/`), mockup `Main.dc.html`

**Purpose:** the first screen. It says what KhetiRental is in two words, shows a living farm, gives 3 small actions, proves the need with 3 numbers, then tells the story as you scroll.

#### 4.1.1 Hero layout (first screen, `height: 100svh`, min 640 px, max 1000 px)

Layers from back to front:
1. Sky, sun, clouds, hills
2. The field (soil, furrow lines)
3. The crop row
4. The ploughed strips
5. The tractor
6. The counters
7. The heading, tagline and buttons
8. The header

Phone positions are given for a 390 × 844 viewport. Scale them as percentages of the hero height; the mockup's pixel values are listed so you can match it exactly.

| Element | Phone position (390 × 844) | Desktop (≥ 1024) |
|---|---|---|
| **Header** (transparent) | Top, 12/16 padding. Left: a logo pill (`rgba(255,255,255,.85)`, pill radius, 6/12 padding) with the 24 px wheel logo and "KhetiRental" 20 px bold. Right: the language switch (§3.2) on a white pill | Same, 24 px side padding, max width 1152 centred |
| **Heading group** (one flex column, centred, so nothing overlaps) | Starts at top 96 px. **H1** `welcome.h1` in Baloo 2, 46/50, `text`. Under it the **tagline** `welcome.tag`, 18/26 bold. Then, 14 px below, the **button row** | H1 72/76; group starts at ~14 % of height |
| **Button row** (`<nav aria-label="Get started">`, wraps, 10 px gap, centred) | 3 pills, 48 px tall: **Log in** (`pill-primary`) → `/login`; **Sign up** (`pill-accent`) → `/login?mode=signup`; **How it works ↓** (`pill-light`) → smooth-scrolls to `#how` (instant when reduced motion) | Same, side by side |
| **Counters** (`<section aria-label>`) | Top 656 px (≈ 78 % of height), full width, 3 equal columns, centred text. Each column: the value (`counter` token, `text` colour) and the label (14/18 bold). Below: the source line `welcome.stats.source` (`micro`, `#332C26`) | Values 56/60; group max width 720, centred, above the bottom 8 % |
| **Logged-in variant** | Log in / Sign up become **Find machines** (`pill-primary` → `/rent`) and **My bookings** (`pill-accent` → `/bookings`) | Same |

**Hero copy:** there is deliberately no paragraph; the heading and tagline are all the text. Don't add a white card over the scene. The whole scene stays visible.

#### 4.1.2 The live field scene (SVG plus CSS; no canvas, no JS animation loop)

The geometry comes from the mockup (390 × 844 coordinates). On wider screens, ground layers stretch horizontally (`preserveAspectRatio="none"` for sky, hills and soil), while the tractor, crops and sun keep their aspect ratio.

| Part | Spec |
|---|---|
| Sky | Solid colour by time of day: morning `#CFE3F2` · noon `#9CC7EA` · evening `#F2B78A` |
| Sun | Circle r 38 at cx 300 (≈ 77 % of width), cy 318 (morning, partly behind the hills) / 300 (noon) / 326 (evening). Colour `#FBC02D` / `#FFD45C` / `#E0703A`. Animation `kr-sun`: scale 1 → 1.06 → 1 over 6 s, ease-in-out, infinite |
| Clouds | Cloud A: ellipses (40,74,rx44,ry16) + (70,64,rx30,ry14), white 85 %, at the top **above the heading**. Cloud B: (60,284,rx40,ry14) + (86,276,rx24,ry11), white 70 %, **just above the hills**. Animation `kr-cloud`: translateX −120 px → width + 30 px, linear, infinite; A 38 s, B 55 s with a −20 s delay. **No cloud may pass behind the heading or buttons** (top 96–270 px band); this was an approved fix |
| Hills | Back hill path `M0 330 C70 290 140 300 210 320 S330 290 390 305 V420 H0 Z`, front hill `M0 360 C90 335 170 350 260 345 S360 330 390 340 V440 H0 Z`. Colours (back/front): morning `#7FA35A`/`#5E8A3E`, noon `#6E9A48`/`#4E7A2E`, evening `#6B7A45`/`#4A5A30` |
| Soil | A rect from y 400 to the bottom, `#C9A86A`. Furrow lines at y 440, 480, 525, 575, 630, 690, stroke `#B08A4C` 3 px |
| Crop row | 16 stalks evenly spaced along y 404–438, each 6 px wide, `#4E7A2E`, rounded top, heights 18 + ((i·7) mod 14) px. Animation `kr-sway`: skewX −4° → 5° → −4° over 3 s, ease-in-out, infinite, origin bottom centre, delay −(i mod 5)·0.4 s |
| Ploughed strips | Strip 1: y 500, height 28, full width, `#6B4A26`, 4 px radius, `transform-origin: left`. Strip 2: y 570, same, `transform-origin: right`. Both run on the tractor's cycle (`--lap`), see the keyframes below |
| Tractor | A 170 × 110 SVG (from the mockup): cab body `#223585`, canopy `#FFD45C` with a 4 px `#13100D` outline, exhaust `#13100D`, implement `#483F37`, rear wheel r 26 (hub `#FBC02D`), front wheel r 16. Sub-animations: both wheels spin (`kr-spin` 0.9 s linear; `transform-box: fill-box`), the body bobs (`kr-bob` 0.5 s, ±2 px), and two exhaust puffs rise and fade (`kr-puff` 1.2 s, second one delayed 0.6 s). Container at top 420 px |
| Tractor path ("rounds") | **Approved behaviour: no jump-back.** It drives right along row 1, turns down to row 2 while flipping to face left, drives left along row 2, then turns back up to row 1 while flipping to face right, and repeats. Every segment eases in and out |

**Keyframes** (from the mockup; on wide screens replace `225px` with `calc(100vw - 165px)` via a CSS variable `--travel`):
```css
@keyframes kr-round{
 0%  {transform:translate(-10px,0)    scaleX(1)}
 44% {transform:translate(var(--travel,225px),0)   scaleX(1)}
 50% {transform:translate(calc(var(--travel,225px) + 7px),70px) scaleX(-1)}
 94% {transform:translate(-3px,70px)  scaleX(-1)}
 100%{transform:translate(-10px,0)    scaleX(1)}}
@keyframes kr-plough1{0%{transform:scaleX(0);opacity:1}44%{transform:scaleX(1);opacity:1}93%{transform:scaleX(1);opacity:1}100%{transform:scaleX(1);opacity:0}}
@keyframes kr-plough2{0%,50%{transform:scaleX(0);opacity:1}94%{transform:scaleX(1);opacity:1}100%{transform:scaleX(1);opacity:0}}
@keyframes kr-spin{to{transform:rotate(360deg)}}
@keyframes kr-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}
@keyframes kr-cloud{from{transform:translateX(-120px)}to{transform:translateX(calc(100vw + 30px))}}
@keyframes kr-sway{0%,100%{transform:skewX(-4deg)}50%{transform:skewX(5deg)}}
@keyframes kr-sun{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
@keyframes kr-puff{0%{opacity:.7;transform:translate(0,0) scale(.6)}100%{opacity:0;transform:translate(-26px,-22px) scale(1.6)}}
.kr-drive{transform-origin:center;animation:kr-round var(--lap,24s) ease-in-out infinite}
.kr-plough1{transform-origin:left center;animation:kr-plough1 var(--lap,24s) ease-in-out infinite}
.kr-plough2{transform-origin:right center;animation:kr-plough2 var(--lap,24s) ease-in-out infinite}
@media (prefers-reduced-motion: reduce){.kr-drive,.kr-plough1,.kr-plough2,.kr-wheel,.kr-body,.kr-cloud,.kr-sway,.kr-sun,.kr-puff{animation:none!important}}
```
Reduced motion shows a still scene: the tractor parked at 30 % of row 1, both strips half drawn, and the counters at their final values.

**Tweakable constants** (`config/welcome.ts`, approved defaults):
- `LAP_SECONDS = 24` (range 10–60)
- `TIME_OF_DAY = "morning"` (`"morning" | "noon" | "evening"`); optionally pick it from the local hour (05–11 morning, 11–16 noon, 16–20 evening, otherwise morning)
- `SHOW_TRACTOR = true`

The scene is `aria-hidden="true"`. Pause every animation while the tab is hidden (`document.visibilitychange` → add a `paused` class) to save battery.

#### 4.1.3 Counters
| # | Value | Label key (en / hi / mr) | Source |
|---|---|---|---|
| 1 | **86%** | `welcome.stats.small` small farms / छोटे खेत / लहान शेते | Agriculture Census 2015–16: 86.21 % of holdings are small or marginal (< 2 ha) |
| 2 | **1.08** | `welcome.stats.avg` hectare avg. farm / हेक्टेयर औसत खेत / हेक्टर सरासरी शेत | Agriculture Census 2015–16: average operational holding 1.08 ha |
| 3 | **47%** | `welcome.stats.mech` mechanised / मशीनीकरण / यांत्रिकीकरण | India's farm mechanisation ≈ 47 % (reported 2025; US ≈ 95 %) |

- **Behaviour:** each value counts up from 0 to its target over **1800 ms with ease-out-cubic** (`1-(1-p)^3`), starting when ≥ 35 % of the counter row is visible (IntersectionObserver). It runs once per page load. Format: integers with a `%` suffix, and the middle value with 2 decimals.
- **Implementation:** one `requestAnimationFrame` loop updating a single progress value (no per-frame layout reads). The numbers use tabular figures so the width doesn't jitter.
- **Reduced motion or no IntersectionObserver:** show the final values straight away.
- **Accessibility:** the visible number is `aria-hidden` during the animation. An `sr-only` text holds the final sentence, e.g. "86% of farm holdings are small".
- **Source line** (`welcome.stats.source`): "Agriculture Census 2015–16 · 2025 estimates". It links to `/how-we-price#sources`. Keep it this short (approved).
- If India's Agriculture Census 2021–22 is published before launch, update the numbers and the source, and ask the owner first.

#### 4.1.4 Story sections (below the hero; `id="how"` on the first one)
Each section fades and slides up 28 px as it enters, using CSS `animation-timeline: view()` with range `entry 0% entry 60%`, wrapped in `@supports`. Sections alternate `bg` and `surface` backgrounds. Padding is 40 px vertical on phones and 96 px on desktop. Content max width 720 px on desktop. Titles use `display-2`.

| # | Background | Title key | Content | Clickable |
|---|---|---|---|---|
| S1 | bg | `story.s1` "A tractor costs ₹6–7 lakh. Most of the year, it waits in the shed." | Eyebrow `story.problem` (14 px bold, `#8F5F00`, letter-spacing 1 px). A strip of 182 small squares (26 columns, 10 px tall, 3 px gap, 2 px radius); every 12th is mustard `#FBC02D`, the rest `#E5DDD1`. As it scrolls into view the mustard squares fill one by one (scroll-driven); with reduced motion they're just shown. Caption `story.s1.caption` | – |
| S2 | surface | `story.s2` "You don't need to own it. You need it on time." | The **3D tractor slot** (160 px tall on phones, 360 px on desktop, `surface-muted`, `rounded-card`), see §4.1.5. Two bars: "Buy" ₹6,40,000 (full width, `#483F37`) and "Rent 4 hours" ₹2,839 (12 px wide, `success`); as it scrolls in, the buy bar shrinks from full width to a short stub | – |
| S3 | bg | `story.s3` "It's already near you." | A stylised village SVG (358 × 220 on phones; scale up on desktop): a canal, roads, a hex ring of 7 cells around a mustard centre cell with a blue farm dot, and 3 black price pills ₹710 / ₹650 / ₹1,400. As it scrolls in, the hex ring outlines draw one by one, then the pills pop in (scale 0.6 → 1, staggered 120 ms) | – |
| S4 | surface | `story.s4` "The full price, before you say yes." | Receipt panel (`bg`, `rounded-card`, 18 px): Rent 4 h × ₹710 = ₹2,840; Diesel "Included" (success, bold); Deposit (comes back) ₹1,950; total row "You pay ₹2,840". Rows appear one after another as it scrolls in | – |
| S5 | bg | `story.s5` "The owner is paid after the job, not before." | 3 equal cards (2 px `action` border): numbered circles 1/2/3 (44 px, action fill), titles Handover / Work / Return, captions "Photo + OTP" / "Hours counted" / "Owner paid". They stamp in one by one (scale 1.15 → 1 with fade) | – |
| S6 | `owner-hero` (`#223585`, white text) | `story.s6` "Your idle tractor can earn." | Paragraph `story.s6.body` (`#DCE3F7`). Button **List your tractor** (`lg`, `#FBC02D` fill, `text`) → `/login?mode=signup&role=owner` (or `/owner/machines/new` when logged in as an owner) | 1 button |
| S7 | bg | `story.s7` "Prefer to talk?" | Button **Call [helpline]** (`outline-dark`, `lg`) → `tel:` from `config.helplinePhone` (shows `[YOUR HELPLINE]` until set). Footer links: About · How we price · How we built it · Privacy · Terms | Call + footer links |

#### 4.1.5 3D tractor (D-09)
- **When:** only when `data-motion="rich"`. The detector script is inline in `<head>`:
  ```js
  const c=navigator.connection,m=matchMedia("(prefers-reduced-motion: reduce)").matches;
  const rich=!m&&!(c&&(c.saveData||/2g|3g/.test(c.effectiveType)))&&(navigator.deviceMemory??4)>=4&&(navigator.hardwareConcurrency??4)>=6;
  document.documentElement.dataset.motion=m?"none":rich?"rich":"lite";
  ```
- **How:** `next/dynamic(() => import("./TractorScene"), { ssr: false })`, mounted after `requestIdleCallback` once S2 is within one viewport. React Three Fiber + drei `useGLTF`. GLB ≤ 400 KB (meshopt + KTX2, ≤ 25k triangles), low-poly, in the brand colours (indigo body, mustard canopy). The tractor rotates with scroll progress through S2 (0 → 300°), and the rotavator lowers between 40 % and 60 %.
- **Fallback (lite/none):** a still image (AVIF ≤ 80 KB, same framing) inside the same slot. The slot keeps its size, so nothing shifts (CLS 0).

#### 4.1.6 Welcome page states and checks
- [ ] The heading, tagline and buttons never overlap at 320–1440 px in any language (they're one flex column).
- [ ] No element of the scene passes behind the heading or button band.
- [ ] The tractor loop has no visible jump at the cycle boundary (the strips fade out over the final 6 %).
- [ ] Counters start at 0 and finish on exactly 86%, 1.08 and 47%.
- [ ] Reduced motion: completely static, final values shown.
- [ ] Language switch: the heading, tagline, buttons, counter labels and story titles change. The source line stays in English unless translated (key exists).
- [ ] Lighthouse mobile ≥ 75. LCP is the H1 text, not an image.

### 4.2 Log in / Sign up (`/login`), mockup `Login.dc.html`

**Layout (phone):** `bg` background. Header 60 px: back arrow (44 × 44, → `/` or history back) on the left, language switch on the right. Content column with 16 px padding and 16 px gaps. **Desktop:** a centred card, max width 440 px, `surface`, `rounded-card`, 32 px padding. The left half of the screen shows a still frame of the welcome field (decorative, `aria-hidden`).

**Elements, top to bottom:**
1. **H1** `login.welcome` "Welcome to KhetiRental" (Baloo 2, 32/38).
2. **Tabs** (`role="tablist"`, a 2-column grid on a `surface-muted` track with 4 px padding and 12 px radius): **Log in** | **Sign up**, each 44 px tall. Selected tab = surface fill; the other is transparent. Selecting one updates `?mode=`.
3. **Continue with Google** (`secondary`, 54 px, Google "G" mark on the left; use Google's official button assets when the real provider is on). It starts Google OAuth through Auth.js. In dev without keys it signs in the seeded user "Demo Google User" (mock).
4. Divider: line · `login.or` "OR" · line (14 px bold, `text-subtle`).
5. **Method chips** (ChipGroup, single): **Mobile number** | **Email**. Default Mobile.
6. *(Sign up only)* **Full name** input (required, 2–80 characters).
7. *(Mobile)* a **"+91"** prefix box plus a **mobile input** (`inputmode="numeric"`, `autocomplete="tel-national"`, placeholder "98765 43210"; accepts 10 digits, strips spaces, accepts Devanagari digits). Hint: `login.otpHint` "We'll send a 6-digit OTP by SMS."
8. *(Email)* **Email address** (`type="email"`, `autocomplete="email"`) and **Password** (`type="password"`, show/hide eye button 48 × 48; sign-up requires ≥ 8 characters with a strength hint). In login mode, a **Forgot password?** link → `/login/forgot`.
9. *(Sign up only)* **"I want to"**: two 56 px choice buttons, **Rent machines** | **List my machines** (selected style). Default Rent. Stored as the user's roles.
10. **Primary CTA** (`lg`): the label depends on the state. Mobile → **Send OTP** (→ `/login/otp`); Email + Log in → **Log in**; Email + Sign up → **Create account**.
11. Terms line `login.terms` (14 px, centred), with **Terms** and **Privacy Policy** as links.

**Validation and errors** (inline, under the field):
- Invalid mobile: "Enter a 10-digit mobile number."
- Wrong email or password: "Email or password is wrong." (never say which one).
- Email already registered (sign-up): "This email already has an account. Log in instead." with a link.
- Too many attempts: "Too many tries. Wait 10 minutes and try again."
- Network: a toast, "No internet connection. Try again when you have signal."

**After success:** see §3.3.

**Checks:**
- [ ] Each of the 3 methods works in dev with no keys (mocks).
- [ ] The tabs and chips are keyboard-operable.
- [ ] The language switch keeps the typed values.
- [ ] Password managers fill the fields.

### 4.3 OTP entry (`/login/otp`) and Forgot password (`/login/forgot`) (no mockup; same style as §4.2)
**OTP page, top to bottom:**
1. Back arrow and language switch.
2. H1 "Enter the code".
3. Line: "We sent a 6-digit code to +91 98765 43210." with a **Change number** link.
4. **6 single-digit boxes** (each 48 × 56, 2 px `border-control`, 24 px bold, `inputmode="numeric"`, `autocomplete="one-time-code"`; paste fills all six; auto-advance).
5. Primary **Verify** (`lg`), disabled until 6 digits are entered, with the reason "Enter all 6 digits".
6. **Resend code**, a ghost button disabled for 30 s with a countdown ("Resend in 0:24").
7. Errors: "That code is wrong. 3 tries left." / "This code has expired. Send a new one."

In dev, the code is printed to the server log and shown in a dev-only toast.

**Forgot password page:**
1. H1 "Reset your password".
2. Email input.
3. Primary **Send reset link**.
4. Success state: "If an account exists for this email, we've sent a link. Check your inbox." (In dev the link is logged.)
5. The reset page `/login/reset?token=` has a new password field plus confirm, and **Save password**, then goes to `/login` with the toast "Password changed. Log in."

### 4.4 Search (`/rent`), mockup `Search.dc.html`

**Purpose:** collect the job, place, dates and (optionally) field size in under 30 seconds, mostly by tapping.

**Phone layout:** header (§3.2), content with 20/16 padding and 22 px gaps between groups, a sticky CTA, and the bottom tab bar hidden while the page has a sticky CTA (show it again above 768 px). **Desktop:** a 2-column card (max width 960): left column job tiles; right column place, dates and field size; the CTA under the right column, inline.

**Elements:**
1. **H1** `search.what` "What work?".
2. **Job tiles** (Tile, 3 × 2 grid, 8 px gap, each 92 px tall): **Plough**, **Rotavate**, **Sow**, **Spray**, **Harvest**, **Transport**, each with its pictogram. Single select, required, default the last-used value (otherwise none, and the CTA shows "Choose the work first"). Each job maps to machine categories and attachments (§12.3).
3. **"Where is your farm?"** label plus a row:
   - **Place input** (flex 1; placeholder "PIN code or village", e.g. "413512 · Latur"). Autocomplete from `pin_codes` and villages: after 2+ characters (or 3+ digits), a listbox below with up to 8 options "413512 · Latur, Maharashtra". Keyboard and screen-reader support (`role="combobox"`).
   - **Mic button** (52 × 52, 2 px `border-control`, `aria-label` "Speak your village name"). It uses Web Speech `SpeechRecognition` with `lang` = `mr-IN` / `hi-IN` / `en-IN` and puts the result in the input. **Hide the button where the API isn't supported.**
4. **Use my phone's location** (`secondary`, 48 px, full width) → browser geolocation (8 s timeout). Success fills the place as "Near you (Chakur)" using the nearest PIN centroid. On denial or failure, a hint under the button: "Couldn't get your location. Type your PIN code or village instead."
5. **"When?"** label plus a **ChipGroup**: **Tomorrow** | **This week** | **Pick dates**.
   - Tomorrow = the next day, a single day.
   - This week = the next 7 days (shows "free any day this week").
   - Pick dates opens a **date-range sheet**: a month calendar with 48 px day cells, past days disabled, the start and end highlighted in `selected`, the range in `#FFF4CC`, and **Done**.
   
   Under the chips: a summary line (16 px muted), e.g. "Mon 2 Nov – Wed 4 Nov · 3 days" (Intl, locale-aware).
6. **Field size (optional)** row: the label plus a **Stepper** in 0.5-acre steps (min 0.5, max 100; the value reads "2.5 acres"). Tap the number to type it. Beyond 100: hint "For more than 100 acres, call us."
7. **Sticky CTA:** **Find machines** (`lg`) → `/rent/results?job=rotavate&place=413512&lat=…&lng=…&from=2026-11-02&to=2026-11-04&slot=full&acres=2.5&r=10&sort=nearest`. Disabled with a visible reason if the job or place is missing ("Choose the work and your place").

**Remember** the last search in the user profile and in a cookie, and pre-fill it on the next visit.

**Checks:**
- [ ] It works with no geolocation.
- [ ] Devanagari digits work in the place and acres inputs.
- [ ] Every value is in the URL on submit (F-37).
- [ ] Back from the results restores the form.

### 4.5 Results (`/rent/results`), mockup `Results.dc.html`

**Phone layout:** a sticky top area, then the list. **Desktop (≥ 1024):** the filter bar spans the top; the list sits on the left (2 columns of cards from 1280 px); in map mode, the map fills the right 50 % and stays sticky.

**4.5.1 Sticky top area** (surface, 1 px bottom border, 10/16/12 padding):
- **Back** (44 × 44 ←) → `/rent` with the query restored.
- A **summary button** (flex 1, 2 px `chip-border`, `rounded-control`, 16/22): "**Rotavate** · 2–4 Nov · Latur · **Change**" → `/rent` pre-filled.
- **Sort ChipGroup:** **Nearest** (default) | **Cheapest** | **Top rated**, each 44 px; it updates `?sort=` and re-queries. Plus a **Map** toggle chip on the right (`aria-pressed`) that switches list ⇄ map (`?view=map`).
- **Filter chips** (36 px tall inside a 48 px tap area):
  - **10 km ▾** opens a radius menu: 5 / 10 / 25 km.
  - **With driver** is an on/off toggle.
  - On desktop only, also: **Category ▾** and **Price ▾**.

**4.5.2 List**
- Count line (16 px): "**5 free** on your dates · showing nearest first" (ICU plural; the sort name follows the active sort).
- **Free machine cards** (§4.5.3) in sort order.
- Divider "BUSY ON YOUR DATES" (14 px bold, lines on both sides), then **busy cards** (`busy` variant): machine name (18 bold), "₹680 / hour · 2.1 km", and on the right "Free from 6 Nov" (14 bold). A busy card is tappable → its detail page with dates pre-set to the next free range.
- **Show more** (`secondary`, full width) loads 20 more via the cursor; the count line reads "Showing 20 of 83".
- Footer line: "Not finding one? **Search up to 25 km** or **call us**". The first link sets `r=25`; the second is `tel:` to the helpline.

**4.5.3 Machine card**
- **Photo area:** 120 px tall, `#E5DDD1` placeholder, the first owner photo with `object-fit: cover`, lazy-loaded, AVIF/WebP. Top-left chip **"● Free 2–4 Nov"** (`free` badge). A **Sample** badge top-right when seeded.
- **Body** (12/14/14 padding, 4 px gaps), in this order:
  1. **Price** `₹710` (28/34 bold) plus the unit, "/ hour · with driver" (16 muted). The unit comes from the owner's price unit (hour / acre / day).
  2. **Name** "Swaraj 744 FE + rotavator · 48 HP" (18). Attachments are joined with " + ".
  3. **Where:** "3.5 km away · Muhana" (16 muted). Distance is straight-line, rounded to 0.5 km.
  4. **Trust:** "★ 4.6 (23) · Ramesh K. · serviced Aug 2026" (16 muted). With fewer than 3 reviews, show "New on KhetiRental" instead of the rating.
  5. **Book for 2–4 Nov** (`lg` primary) → `/rent/m/[id]/book?from…&to…&slot…`.
- The whole card except the button links to the detail page `/rent/m/[id]?from…&to…`.

**4.5.4 Map mode**
- Leaflet with OSM tiles, lazy-loaded only when Map is on.
- Markers are price pills (black `#13100D` background, white 14 px bold text, e.g. "₹710"); the selected one turns `action` with white text. Your farm shows as a blue dot with a 10 % pulse ring (static when reduced motion). Cluster above 30 markers.
- Tapping a marker opens a bottom sheet with the same machine card.
- "**Search this area**" pill appears after panning.

**4.5.5 States**
- **Loading:** 3 skeleton cards; the count line reads "Finding machines near you…".
- **Empty:** EmptyState "No machines free within 10 km on these dates." with actions **Search up to 25 km**, **Try other dates** and **Call us**.
- **Error:** an inline alert "We couldn't load machines. Check your connection." plus **Try again**; it also auto-retries on the `online` event.
- **Offline with cached results:** show them with the banner "Saved at 10:42 – may have changed."

### 4.6 Machine detail (`/rent/m/[id]`), mockup `Detail.dc.html`

**Phone layout:** a full-bleed photo carousel (260 px), then content (18/16 padding, 18 px gaps), then a sticky CTA. **Desktop:** a 2-column grid; left: photos (4:3, thumbnails below), specs, availability, owner, reviews; right: a **sticky booking card** (surface, `rounded-card`, 24 px padding) with the price, unit, badges, "Comes with", date and slot pickers inline, the estimate and **Book**.

**Elements:**
1. **Carousel:** 3+ owner photos, swipeable, with dots and a counter pill "1 / 3" (bottom centre, `rgba(19,16,13,.7)`, white 14 px). Back button: a round white 44 px "←" at top-left → results (history back if the referrer was results). Tapping a photo opens a full-screen viewer.
2. **H1** machine name (30/38), e.g. "Swaraj 744 FE".
3. **Spec line** (18 muted): "48 HP · 2019 · 2,340 engine hours" (HP, year, hour meter; F-35).
4. **Badges** (wrap, 8 px gap): "✔ RC checked" (`info`, only when the admin has verified it), "★ 4.6 (23 reviews)" (`neutral`), "Serviced Aug 2026" (`neutral`, if set), plus **Sample** if seeded.
5. **Price panel** (Card): "**₹710** / hour" (28 bold plus 16 muted); if the owner also set a second unit, it shows right-aligned ("or ₹1,400 / acre"). Badges: "Driver included" and "Diesel included" (success, shown according to the owner's settings). "Comes with: **Rotavator, Trolley**".
6. **"Free days · next 14"** (h2 20 px) plus a 7-column grid of 14 day cells (44 px tall, 10 px radius; date number 14 bold, weekday 11).
   - Colours: free = `success-bg`; booked or blocked = `#E5DDD1` with `text-subtle`; your chosen dates = `#FFD45C`.
   - Legend (14 muted): "Green = free · grey = booked · yellow = your dates".
   - Tapping a free day changes the chosen dates (the first tap sets the start, the second the end) and updates the URL.
7. **Owner row:** a 52 px avatar (photo or initials), **name** (18 bold, first name plus last initial), and the line "Muhana · 3.5 km · on KhetiRental 3 years · replies in about 20 min" (16 muted). The phone number is **not** shown before a confirmed booking.
8. **Reviews:** h2 "What farmers say", up to 2 quotes (16/24, "— Sunil P., Oct 2026"), and a **See all 23 reviews** link that opens a sheet with the full list (paged). Zero reviews: "No reviews yet."
9. **Sticky CTA** (phone): on the left "**₹2,840**" (20 bold) with "est. for 4 hours" (14 muted; shows "est. for 2.5 acres" or "for 3 days" depending on the unit); on the right **Book 2–4 Nov** (`lg`) → booking step 1. If the chosen dates are busy, the button reads **Pick other dates** and scrolls to the availability grid.

**States:**
- **Loading:** skeleton photo and lines.
- **Machine paused or deleted:** EmptyState "This machine isn't available any more." with **Back to results**.

### 4.7 Booking (`/rent/m/[id]/book?step=1|2|3`), mockup `Booking.dc.html`

**Container:** phone = a bottom sheet over the dimmed detail page (§5.6); desktop = a centred 480 px dialog. It is its own route, so refresh and Back restore the exact step (F-39).

**Header (all steps):**
- The grab handle (phone only).
- On the left, the step label "STEP 2 OF 3" (14 bold, `text-subtle`) above the step title (h2 24 px).
- On the right, a ✕ close button (48 round) → detail page (disabled while a payment is processing).
- A progress bar of 3 segments (6 px tall, 3 px radius, 6 px gap): done and current segments `action`, later ones `#E5DDD1`.

**Footer:** a primary **Next** (`lg`, steps 1–2) or the step-3 CTA, and a **Back** ghost link (steps 2–3).

#### 4.7.1 Step 1, "When do you need it?" (`booking.s1.title`)
- **Date summary box:** 2 px `action` border, `#FFF4CC` fill, 10 px radius, 14 px padding. "**Mon 2 Nov – Wed 4 Nov** · 3 days". Tapping it opens the date-range sheet (the same calendar, with this machine's busy days disabled).
- **Slot ChipGroup:** **Morning** | **Afternoon** | **Full day** (48 px each; default Full day). Morning = 7 am–1 pm, Afternoon = 1–7 pm, Full day = 7 am–7 pm.
- **Estimate** (shown when the unit is per hour): a Stepper for hours (default from acres × the job's hours per acre, or 4); hint "You pay only for hours used." For per acre: a stepper for acres. For per day: no stepper (days = the range length).
- Info line (16 muted): "Driver arrives at 7 am each day. You pay only for hours used." (the time follows the slot).

#### 4.7.2 Step 2, "Check the price" (`booking.s2.title`)
- **Price panel** (bg fill, 16 radius, 16 padding, 10 px gaps, 18 px):
  - "Rent: 4 h × ₹710" … "₹2,840";
  - "Diesel" … "**Included**" (success), or "₹X" if the owner charges it separately;
  - "Deposit *(comes back after the job)*" … "₹1,950" (deposit = min(tier floor, 25 % of rent) for jobs under 8 h, F-15);
  - total row: "Pay after work" or "You pay now" … "₹2,840" (22 bold). The label depends on the payment method chosen in step 3, and defaults to "You pay".
- **Read this aloud** (`secondary`, 48 px, speaker icon): uses `speechSynthesis` with a voice for the current locale. It reads the breakdown in one sentence. Hide it if unsupported.

#### 4.7.3 Step 3, "How do you want to pay?" (`booking.s3.title`) (D-08)
- **Radio list** (`role="radiogroup"`, 8 px gap). Each row is ≥ 60 px tall with 8/14 padding, 10 px radius, a 2 px border (`chip-border`, or `action` when selected) and a fill (surface, or `#FFF4CC` when selected). A 22 px radio circle on the left (2 px `action` border, filled `action` when selected), then the label (17 bold) and hint (14 muted):
  1. **UPI**: "GPay, PhonePe, Paytm or any UPI app" (default)
  2. **Debit / credit card**: "Visa, Mastercard, RuPay"
  3. **Net banking**: "All major banks"
  4. **Pay after work**: "Cash or UPI to the owner when the job is done"
- **Info banner** (`info-bg`, 10 radius, 12 padding, 15/22): "Demo payment: no real money moves. Free cancellation until Sun 1 Nov, 6 pm." The cancellation deadline is 24 h before the start.
- **CTA:** "**Pay ₹2,840 and book**" for the online methods, or "**Confirm booking**" for Pay after work. Disabled while submitting, with a spinner.
- On tap:
  - The booking is created with an `Idempotency-Key` (generated once per booking route and kept in `sessionStorage`).
  - **Pay after work** → booking `REQUESTED`, payment `pay_later` → confirmation (§4.8).
  - **Online methods** → `/rent/m/[id]/book/pay` (§4.7.4).
  - On a 409 (the machine was just booked): an inline error "Just booked by someone else. Pick other dates or another machine." with **Pick other dates** (→ step 1).

#### 4.7.4 Mock payment screen (`/book/pay`)
- A full page: a header with ✕ (cancel the payment → back to step 3), and an amount card "₹2,840 to KhetiRental (demo)".
- Method-specific mock UI:
  - **UPI:** a UPI ID input (e.g. `name@bank`) with **Pay**.
  - **Card:** card number, expiry and CVV inputs. Test card hint "4111 1111 1111 1111".
  - **Net banking:** a bank dropdown.
- A large label "DEMO – no real money moves" (warning badge).
- After submit: a spinner for 1.5 s, "Processing…", then a success tick with "Payment successful (demo)" → after 1 s, auto-redirect to the confirmation.
- Failure (only when the dev flag `DEMO_PAYMENT_FAIL=true`): "Payment failed. No money was taken." with **Try again** and **Pay after work instead**.
- **Never collect real card data:** don't send card fields to the server at all; only `{method, amountPaise}` is posted. Card inputs use `autocomplete="off"`.

### 4.8 Booking confirmation and detail (`/bookings/[code]`)
- **Confirmation state** (arriving from booking): a success banner (`success-bg`, 16 radius) with a ✓ circle and "**Request sent to Ramesh**" / "He usually replies in 20 minutes. We'll let you know here." (D-11: in-app, plus a log mock).
- **Detail content:**
  - Status chip.
  - **Booking code** "KR-4821" (24 bold, tap to copy).
  - Dates and slot ("Mon 2 – Wed 4 Nov · from 7 am").
  - The machine (thumbnail, name, attachments).
  - The owner (name, village; the **phone number only once Confirmed**).
  - The place (village; once Confirmed, a **map pin and Directions** link `https://www.google.com/maps/dir/?api=1&destination=lat,lng`).
  - The price breakdown (as in step 2) and the payment status ("Paid (demo) · UPI" or "Pay after work").
- **Actions by status:**

  | Status | Renter actions | Owner actions |
  |---|---|---|
  | `REQUESTED` (waiting for owner) | Cancel · Report a problem | Accept · Decline |
  | `CONFIRMED` | Call · WhatsApp · Add to calendar (.ics) · Cancel (free until the deadline, then "Cancelling now may cost the deposit") · Report a problem | Call · WhatsApp · Mark as handed over · Cancel (with reason) |
  | `IN_PROGRESS` | Call · Report a problem | Mark as returned |
  | `COMPLETED` | Rate the owner (1–5 stars + text) · Book again | Rate the renter |
  | `CANCELLED` / `DECLINED` / `EXPIRED` | Find another machine | – |

- **Cancel** opens a confirmation sheet: "Cancel this booking?", with the refund line, an optional reason chip group, **Yes, cancel** (danger) and **Keep booking**.
- **Timeline** at the bottom: Requested 10:42 → Accepted 10:58 → …

### 4.9 My bookings (`/bookings`), mockup `Booked.dc.html`
- Header H1 "My bookings" (22 bold).
- An optional confirmation banner (as in §4.8) when arriving with `?new=KR-4821`.
- **Tabs (ChipGroup):** **Upcoming (n)** | **Past**.
- **Booking cards** (Card, 14 padding, 6 px gaps):
  - Row 1: the status chip on the left (waiting = `warning`, confirmed = `success`, in progress = `info`, completed = `neutral`, cancelled = `busy`), "Code **KR-4821**" on the right.
  - Line 2: dates and slot (18 bold).
  - Line 3: the machine and owner (16 muted).
  - An action grid of 3 equal 48 px buttons: **Call** (`tel:`; disabled until Confirmed, showing "Number shown after the owner accepts"), **WhatsApp** (`https://wa.me/91XXXXXXXXXX?text=` with a prefilled text in the user's language; same rule), **Cancel** (`danger-outline`).
  - **Report a problem** link → §4.10.
  - Tapping the card body → `/bookings/[code]`.
- **Empty:** EmptyState "No bookings yet." with a **Find a machine** button.
- **Bottom tab bar** (phone): Rent · **My bookings** (active) · Help.

### 4.10 Report a problem (`/bookings/[code]/problem`) (no mockup)
1. H1 "What went wrong?".
2. **Picture choice tiles** (Tile, 2 columns):
   - renter: Machine didn't come · Broke down · Damage · Charged more · Other;
   - owner: Renter didn't come · Damage · Late return · Didn't pay · Other.
3. **Photos** (up to 3; camera or gallery).
4. A text area (optional, with a 🎤 voice button).
5. **Send report** (`lg`) → toast "Report sent. We'll call you within a day." The booking detail then shows "Problem reported" in its timeline.
6. Admin sees it in `/admin`.

### 4.11 List a machine (`/owner/machines/new?step=1–4`), mockup `ListMachine.dc.html` (step 4)

**Shared frame:**
- Header: back arrow (44 × 44 → the previous step, or `/owner` on step 1), with the step label "STEP 4 OF 4" (14 bold, `text-subtle`) over the step title (20 bold).
- Progress: 4 segments (6 px, 3 px radius), in `action` up to the current step.
- Sticky CTA: **Next** (steps 1–3) or **Publish my tractor** on step 4. The word "tractor" changes with the category (machine name in the user's language).
- A draft autosaves (localStorage try/catch plus server draft), so leaving and returning resumes the same step.

**Step 1, "Your machine":**
- Category Tiles (2 columns, 8 options): Tractor, Rotavator, Combine harvester, Sprayer, Seed drill, Trolley, Thresher, Baler.
- **Company** (Select with search: Mahindra, Swaraj, Sonalika, John Deere, New Holland, Kubota, Eicher, Massey Ferguson, Escorts, Other).
- **Model** (text, ≤ 40 characters).
- **HP** (number 10–150; tractors only).
- **Year of manufacture** (number, current year − 40 to the current year).
- **Hour-meter reading** (number, optional).
- **Last serviced** (month picker, optional).
- **Comes with** (multi ChipGroup of attachments: Rotavator, Plough, Cultivator, Seed drill, Trolley, Sprayer, Harvester attachment).

**Step 2, "Photos":**
- 3 required photo slots, each a 1:1 tile with a dashed 2 px `chip-border` border, a camera icon and a label: **Front**, **Side**, **Hour meter**. Up to 3 more optional.
- Each slot offers "📷 Take photo" (`accept="image/*" capture="environment"`) or "Choose from gallery".
- Images are compressed client-side to ≤ 1600 px and ≤ 300 KB (WebP). Each shows a thumbnail with ✕ remove.
- Tip line: "Tip: daylight, whole machine in the frame."
- **RC photo** (optional at this step, required before the "RC checked" badge): one slot, labelled "RC (registration certificate)". After upload it shows "Uploaded – pending review" (D-12).

**Step 3, "Where and when":**
- **Machine location:** the PIN/village input (same component as Search), plus a "📍 Use my current location" button, plus a small Leaflet map with a draggable pin (lazy-loaded). The exact pin is shown to renters **only after confirmation**; search shows the village and a rounded distance.
- **Free days:** a calendar with every day free by default. Tap to block or unblock a day; a "Block every Sunday" quick toggle.
- **"I will drive it (operator included)"** toggle (checkbox styled 24 px, label 18 px, row ≥ 48 px).
- **"Diesel included in price"** toggle.

**Step 4, "Set your price"** (mockup):
- **Summary card** (Card): a 64 px photo thumbnail, then "Swaraj 744 FE · 48 HP" (18 bold) and "Muhana · with rotavator, trolley" (16 muted).
- **"How do you charge?"** ChipGroup: **Per hour** | **Per acre** | **Per day** (48 px; mockup default Per acre).
- **"Your price per acre"**: a 56 px input with a "₹" prefix (22 bold), number only, whole rupees.
- **Hint box** (`#FFF4CC`, 10 radius): "Similar machines near you charge **₹1,200–₹1,600 an acre**." The range is the 25th–75th percentile of active machines of the same category within 25 km and the same unit. Fallback: the pricing-engine suggestion (`packages/domain/pricing-engine`). With no data, hide the box.
- **Earnings card:** "Farmer pays ₹1,400" / "Our fee (13.5 %) − ₹189" / total row "You keep **₹1,211**" (success colour). The fee comes from config `TAKE_RATE = 0.135`.
- The operator toggle is repeated here (as in the mockup) so it can be changed at the last step.
- **Publish my tractor** → the listing goes live (`active = true`) → toast "Your Swaraj 744 FE is live. Farmers within 10 km can now book it." → `/owner`.

### 4.12 Owner dashboard (`/owner`), mockup `Owner.dc.html`
- **Hero header** (`owner-hero` background, 16 px padding, 12 px gaps):
  - Row: "Namaste, Ramesh" (22 bold; the greeting comes from i18n, e.g. "नमस्ते" / "नमस्कार") and the language switch on the right.
  - **3 earnings tiles** (3-column grid, `#1B2A66`, 10 radius, 10 padding): "This month ₹18,400", "Paid to you ₹12,000", "Coming ₹6,400" (the last value in `#FFD45C`). Labels are 14 px `#DCE3F7`, values 22 bold. In this demo, "Paid" is a ledger; no payouts are made.
- **New requests (n)** (h2 22): request cards (`request` variant: 2 px `#FBC02D` border).
  - Row 1: "Sunil P. · 2.5 acres · 4 km" (18 bold) on the left, "Reply in 1 h 40 m" on the right (14 bold `warning`, a live countdown; at 0 the request auto-declines with status `EXPIRED`).
  - Line: dates and job ("Mon 2 – Wed 4 Nov · rotavating").
  - The amount (22 bold).
  - Two 52 px buttons: **Accept** (success fill `#1E7B3C`, white) and **Decline** (secondary).
  - Accept → booking `CONFIRMED`; the renter is notified; the card leaves the list with the toast "Accepted. Sunil can now call you." Decline opens a reason sheet (Busy · Too far · Machine not ready · Other) → `DECLINED`.
  - Empty: "No new requests. We'll let you know when one comes."
- **Calendar** (h2 "November" with ‹ › month arrows; hint "Tap a day to block it"): a 7-column grid of 40 px day buttons; booked = `action` fill with white text, free = `success-bg`, blocked = `#CFC4B4`. Tapping a free day blocks it; tapping a blocked day unblocks it; tapping a booked day opens that booking. Legend: Booked · Free · Blocked. With several machines, a machine selector above.
- **My machines (n)** (h2) with **+ Add** → step 1. Rows (Card): name (18 bold), "₹1,400 / acre · live" (16 muted; or "paused"), and an **Edit** button (secondary 44) → wizard pre-filled. Overflow menu: Pause / Resume / Delete (with confirmation).
- Bottom tab bar (phone): Dashboard · My machines · Help (+ Rent when the renter role is on).

### 4.13 Request detail (owner) (`/owner/requests/[code]`)
The same as the booking detail (§4.8) from the owner's side: the renter's first name plus last initial, village, distance, field size, job, dates and slot, the amount and what the owner keeps. **Accept** and **Decline** sit in a sticky bar. The renter's phone number is shown only after Accept.

### 4.14 Notifications (`/notifications`)
A list of notification rows (icon, title, time, unread dot). Tapping one opens the related page. Types:
- booking requested (owner)
- accepted / declined / expired (renter)
- reminder the day before (both)
- cancelled (both)
- payment recorded (renter)
- problem report update

A **Mark all as read** ghost button at the top. Empty state: "Nothing new."

### 4.15 Settings (`/settings`)
Sections:
- **Language** (the three-way switch).
- **Profile:** name, phone (verify with OTP if changed), email.
- **Roles:** "I rent machines" and "I list machines" toggles; turning on owner mode leads to the listing wizard.
- **Appearance:** System / Light / Dark.
- **Notifications:** in-app is always on; "SMS (coming soon)" disabled.
- **Log out.**
- **Delete my account:** danger, with a confirmation sheet that requires typing DELETE.

### 4.16 Help (`/help`)
- A helpline card: **Call** and **WhatsApp** buttons using the configured numbers (placeholders until set).
- An FAQ accordion (`<details>`): How do I book? · When do I pay? · How do I cancel? · What if the machine breaks down? · How do I list my machine? · Is my money safe? (answer: "This is a demo; no real money moves.").
- A **Report a problem** link → My bookings.

### 4.17 How we price (`/how-we-price`)
- The plain-language formula: "Your price = owner's rate + diesel (if not included). Deposit comes back after the job."
- A worked example with a PriceRow breakdown.
- The 13.5 % fee, explained as "taken from the owner's share, never added to your bill".
- **Sources** anchor `#sources` with the census and mechanisation sources from §4.1.3.
- A link to "How we built it" for the detailed model.

### 4.18 Terms and Privacy (`/terms`, `/privacy`)
Readable text pages (max width 38 rem, h2 sections). The placeholder text is clearly marked `[LEGAL REVIEW NEEDED]`. Privacy must say:
- phone, email and location are used only for bookings;
- the exact location is shared only after a confirmed booking;
- no Aadhaar is collected;
- payments are simulated.

### 4.19 How we built it (`/about/engineering`) (D-16)
The current showcase content moves here, **unchanged in function but restyled with the tokens**:
- an index page;
- `/about/engineering/h3-spatial` (sandbox);
- `/about/engineering/escrow` (simulator, using the plain labels from REVIEW T-06);
- `/about/engineering/pricing` (calculator; T-07 fixed);
- `/about/engineering/architecture`;
- `/about/engineering/systems` and `/about/engineering/product` (the dossiers **without** "Resume bullets" and "Interview defence").

Reached only from the footer link. It is not in the main navigation.

### 4.20 Demo admin (`/admin`, admin role)
Tables:
- **RC reviews:** machine, owner, RC photo, Approve / Reject. Approve sets "RC checked".
- **Problem reports:** booking, type, photos, status Open / Resolved, with a note.
- **Users:** search, role toggles.

Plain styling with the same tokens. It must not be linked from any public page.

### 4.21 Not found (404)
The welcome scene's still frame (small, decorative), H1 "We couldn't find that page.", and buttons **Find a machine** (primary) and **Go home** (secondary). `<title>`: "Page not found – KhetiRental".

---

## 5. Components (build in `components/ui/` before the pages)

### 5.1 Button
Variants:
- `primary`: `action` background, `on-action` text, no border.
- `secondary`: surface background, 2 px `border-control`, `text`.
- `outline-dark`: transparent, 2 px `text`-colour border (the welcome page "Call" button).
- `danger-outline`: surface background, 2 px `danger` border, `danger` text.
- `ghost`: no border, `action` text (Back, links).
- `pill-primary`, `pill-accent` (`#FFD45C` with `text`), `pill-light` (`rgba(255,255,255,.9)` with `text`): the welcome page buttons, 48 px tall, 16–20 px side padding.

Sizes: `lg` 56 px / 18 px bold (phone primary actions); `md` 48–52 px / 16 px bold.

States: hover (primary → `action-hover`; secondary → `surface-muted` fill), pressed (`action-pressed`, `translateY(1px)`), focus-visible (3 px `focus` outline, 2 px offset, plus a 6 px `sarson-300` halo at 60 %), disabled (`surface-muted` fill, `text-subtle` text, with a visible reason next to it), loading (spinner, keeps its width, `aria-busy="true"`). Links styled as buttons use `<a>`; actions use `<button>`.

### 5.2 Input, Select, Textarea
52 px tall, 18 px text, 14 px side padding, 2 px `border-control`, `rounded-control`, surface background. The label is above, 16/24 bold. A hint sits below in caption `text-subtle`. Invalid state: 2 px `danger` border, error text in caption `danger` with an icon, `aria-invalid` and `aria-describedby`. Prefix boxes (like "+91") are the same height. Every number field parses Devanagari digits and decimal commas (`toAsciiNumber`).

### 5.3 ChipGroup (single or multi select)
Chips 44–48 px tall, pill radius, 2 px `chip-border`, 15–16 px bold. Selected chip: `selected` fill plus a 2 px `action` border. Semantics: `role="radiogroup"` or `group`, each chip `role="radio"` / `aria-pressed`.

### 5.4 Tile (picture choice)
Square-ish (3 per row on phones; 92 px tall in the mockup), `rounded-control`, 2 px `chip-border`, a 32 px pictogram above a 16 px bold label. Selected = `selected` fill plus a 2 px `action` border. Used for job type (search) and machine category (listing step 1).

### 5.5 Card
`surface` background, 1 px `border-subtle`, `rounded-card`, 14–16 px padding. Variants: `machine` (§4.5.3), `booking` (§4.9), `request` (2 px `#FBC02D` border, §4.12), `busy` (`surface-muted` fill, no border).

### 5.6 Sheet / Modal
Phone: a bottom sheet with 16 px top radius, a 44 × 5 px grab handle in `chip-border`, the `sheet` shadow, the `overlay` behind it, and a 200 ms slide-up (`cubic-bezier(.2,.8,.2,1)`). Desktop: a centred dialog, max width 480 px. It traps focus, returns focus on close, and closes with Escape and the ✕ button (48 × 48, round, 2 px `chip-border`) **unless a submit is in flight** (F-34).

### 5.7 StickyCTA bar
Phone only: fixed to the bottom, surface background, the `raised` shadow, padding 12/16/20. Holds either one primary `lg` button, or a price summary on the left (20 px bold plus a 14 px caption) with a primary button on the right taking the remaining width.

### 5.8 Stepper
− / value / + with 48 × 48 buttons and a 2 px `border-control`. The value is 18 px bold, min-width 76 px. Bounds come from props. Long-press repeats. The buttons have `aria-label`s.

### 5.9 Badge / Chip (non-interactive)
Pill, 3–4 px × 10 px padding, 14 px bold. Variants: `free` (success-bg / success), `busy` (surface-muted / text-subtle), `waiting` (warning-bg / warning), `confirmed` (success), `info` (info-bg / info, e.g. "✔ RC checked"), `neutral` (surface-muted / text, e.g. "★ 4.6 (23 reviews)"), and **`sample`** (warning-bg / warning, text "Sample"), which shows on any seeded record.

### 5.10 Toast
Bottom, above the tab bar or sticky bar, max width 480 px, `rounded-card`, 16 px text, icon on the left. Success/info auto-dismiss after 5 s; errors stay until dismissed. `role="status"`, or `role="alert"` for errors.

### 5.11 EmptyState / Skeleton
EmptyState: a small pictogram, an 18 px bold title, a 16 px muted line, and 1–2 actions. Skeleton: `surface-muted` blocks with the same layout as the content, shimmer only when motion is allowed.

### 5.12 Pictograms (custom SVG, 2 px stroke, `text` colour, one optional mustard accent)
- **Jobs:** plough, rotavate, sow, spray, harvest, transport.
- **Machines:** tractor, rotavator, combine harvester, sprayer, seed drill, trolley, thresher, baler.

The mockup uses simple placeholder paths (`Search.dc.html` job tiles); replace them with the real set but keep the same 32 px size and placement.

### 5.13 LanguageSwitch
See §3.2.

### 5.14 PriceRow
Label left, value right, 18 px. A total row has a 2 px `text` top border, 10 px top padding, and 22 px bold text.

---

## 6. Responsive rules

| Width | Rules |
|---|---|
| 320–389 | Same as the 390 mockups. Welcome H1 may wrap to 2 lines (allowed). Tiles stay 3 per row (min 96 px); the language switch shows **म · हि · EN** short labels below 360 px |
| 390–767 | **The mockups as drawn.** Bottom tab bar, sticky CTAs, bottom sheets |
| 768–1023 | Content max width 720 centred. Results cards in 2 columns. Search form in 2 columns (tiles on the left). Sheets become centred dialogs |
| ≥ 1024 | Top navigation, no bottom bar. Results list + map side by side in map mode. Detail page in 2 columns with a sticky booking card. Owner dashboard: hero across the top, then 2 columns (requests on the left; calendar and machines on the right) |
| ≥ 1280 | Results cards 2–3 columns; container max 1152 |

The welcome hero always fills the viewport height (`100svh`, clamped to 640–1000 px). The scene scales as described in §4.1.2.

## 7. Motion summary

| Where | What | Duration / easing | Reduced motion |
|---|---|---|---|
| Welcome scene | tractor rounds, strips, wheels, bob, puffs, clouds, crops, sun | §4.1.2 | Off, still frame |
| Welcome counters | count up 0 → value | 1800 ms ease-out-cubic | Final values |
| Story sections | fade and slide up, strip fill, bar shrink, hex draw, pill pop, receipt rows, stamps | scroll-driven | Shown static |
| 3D tractor | rotate with scroll | scroll-linked | Not loaded |
| Sheets / dialogs | slide up / fade | 200 ms `cubic-bezier(.2,.8,.2,1)` | Instant |
| Chips / tiles selection | background fill | 120 ms | Instant |
| Toasts | fade and rise 8 px | 150 ms | Instant |
| Skeleton shimmer | gradient sweep | 1.2 s linear | Static blocks |

Nothing else animates. No parallax on app pages.

## 8. Accessibility requirements (in addition to REVIEW 1G)
- Semantic landmarks (`header`, `nav`, `main`, `footer`), one `h1` per page, and a skip link.
- Every control is a real `<button>`, `<a>` or `<input>` with a visible label. Icon-only buttons get an `aria-label` in the current language.
- Focus ring: a 3 px `focus` outline with a 2 px offset plus a 6 px halo, visible on every control. Logical tab order. Sheets trap focus.
- `lang` on `<html>` follows the locale. Mixed-script strings are fine (fonts cover both).
- Live regions: search result count, booking submit result and the OTP error. One live region per page.
- Colour is never the only signal (availability chips carry text, status chips carry text).
- Inputs ≥ 16 px (18 px used) so iOS doesn't zoom. Targets ≥ 48 px.
- Charts and animations are `aria-hidden` with text equivalents.

## 9. Performance requirements (in addition to REVIEW P-01–P-07)
- Server-render results and detail pages. Client islands only for filters, sheets and maps.
- No `h3-js` or `recharts` in product bundles (the showcase pages may load them).
- Leaflet, the 3D scene, GSAP and the image viewer load lazily.
- Images: `next/image`, AVIF/WebP, explicit sizes, lazy except the first card photo.
- Fonts: preload Mukta 400 Latin only. Load the Devanagari subset when the locale is hi or mr. Baloo 2 with `preload: false`.
- Budgets: Part 0 §0.4.

## 10. Global states and system messages

| Situation | Behaviour | Copy key |
|---|---|---|
| Page loading | Skeleton of the page layout; never a full-page spinner | – |
| Network error on load | Inline alert plus **Try again**; auto-retry when back online | `errors.network` |
| Offline while submitting | Keep the form; toast; the submit button reads "Try again" | `errors.offlineSubmit` |
| Server error | Inline alert with the helpline | `errors.server` |
| Session expired | Redirect to `/login?next=` with the toast "Please log in again." | `errors.session` |
| Not allowed (wrong role or owner) | 403 page in the 404 style: "You can't open this page." plus **Go home** | `errors.forbidden` |
| Sample data | **Sample** badge on cards and detail; a site-wide thin ribbon "Sample data – machines and owners are not real yet." until the first real listing exists (config flag) | `common.sampleRibbon` |
| Demo payment | Banner on payment screens | `pay.demoBanner` |

## 11. Message catalogue (en / hi / mr)

All Hindi and Marathi below are **drafts**. Have them reviewed by native speakers from farming families before launch; keep the keys stable. Strings with `{placeholders}` use ICU syntax. **Every** string in the product must have a key; this table covers the approved screens. Add others in the same files.

### 11.1 Common and navigation
| Key | en | hi | mr |
|---|---|---|---|
| `common.brand` | KhetiRental | खेती रेंटल | खेती रेंटल |
| `common.lang.mr` / `.hi` / `.en` | मराठी / हिंदी / English | मराठी / हिंदी / English | मराठी / हिंदी / English |
| `common.language` | Language | भाषा | भाषा |
| `common.back` | Back | वापस | मागे |
| `common.close` | Close | बंद करें | बंद करा |
| `common.next` | Next | आगे | पुढे |
| `common.tryAgain` | Try again | फिर कोशिश करें | पुन्हा प्रयत्न करा |
| `common.sample` | Sample | नमूना | नमुना |
| `common.sampleRibbon` | Sample data – machines and owners are not real yet. | नमूना डेटा – मशीनें और मालिक अभी असली नहीं हैं। | नमुना माहिती – यंत्रे आणि मालक अजून खरे नाहीत. |
| `nav.rent` | Rent | किराया | भाडे |
| `nav.bookings` | My bookings | मेरी बुकिंग | माझी बुकिंग |
| `nav.owner` | Owner | मालिक | मालक |
| `nav.dashboard` | Dashboard | डैशबोर्ड | डॅशबोर्ड |
| `nav.machines` | My machines | मेरी मशीनें | माझी यंत्रे |
| `nav.help` | Help | मदद | मदत |
| `nav.settings` | Settings | सेटिंग्स | सेटिंग्ज |
| `nav.logout` | Log out | लॉग आउट | लॉग आउट |
| `nav.notifications` | Notifications | सूचनाएँ | सूचना |
| `footer.about` | About | हमारे बारे में | आमच्याबद्दल |
| `footer.pricing` | How we price | हम कीमत कैसे तय करते हैं | आम्ही किंमत कशी ठरवतो |
| `footer.built` | How we built it | हमने इसे कैसे बनाया | आम्ही हे कसे बनवले |
| `footer.terms` / `.privacy` | Terms / Privacy | नियम / गोपनीयता | अटी / गोपनीयता |
| `units.hour` / `.acre` / `.day` | / hour · / acre · / day | / घंटा · / एकड़ · / दिन | / तास · / एकर · / दिवस |
| `units.withDriver` | with driver | ड्राइवर के साथ | ड्रायव्हरसह |

### 11.2 Welcome and story
| Key | en | hi | mr |
|---|---|---|---|
| `welcome.h1` | Farm, made easy. | खेती, आसान। | शेती, सोपी. |
| `welcome.tag` | Rent machines from your village | अपने गाँव से मशीन किराए पर लें | गावातूनच यंत्रे भाड्याने घ्या |
| `welcome.login` | Log in | लॉग इन | लॉग इन |
| `welcome.signup` | Sign up | साइन अप | साइन अप |
| `welcome.how` | How it works ↓ | कैसे काम करता है ↓ | कसे चालते ↓ |
| `welcome.find` (logged in) | Find machines | मशीन खोजें | यंत्रे शोधा |
| `welcome.stats.small` | small farms | छोटे खेत | लहान शेते |
| `welcome.stats.avg` | hectare avg. farm | हेक्टेयर औसत खेत | हेक्टर सरासरी शेत |
| `welcome.stats.mech` | mechanised | मशीनीकरण | यांत्रिकीकरण |
| `welcome.stats.source` | Agriculture Census 2015–16 · 2025 estimates | कृषि गणना 2015–16 · 2025 अनुमान | कृषी गणना 2015–16 · 2025 अंदाज |
| `welcome.stats.sr1` | 86% of farm holdings in India are small or marginal. | भारत की 86% खेती की जोतें छोटी या सीमांत हैं। | भारतातील 86% शेतजमिनी लहान किंवा अत्यल्प आहेत. |
| `welcome.stats.sr2` | The average Indian farm is 1.08 hectares. | भारत में औसत खेत 1.08 हेक्टेयर का है। | भारतातील सरासरी शेत 1.08 हेक्टरचे आहे. |
| `welcome.stats.sr3` | About 47% of farm work in India is mechanised. | भारत में लगभग 47% खेती का काम मशीनों से होता है। | भारतात सुमारे 47% शेतीचे काम यंत्रांनी होते. |
| `story.problem` | THE PROBLEM | समस्या | अडचण |
| `story.s1` | A tractor costs ₹6–7 lakh. Most of the year, it waits in the shed. | ट्रैक्टर ₹6–7 लाख का आता है। साल के ज़्यादातर दिन वह खड़ा रहता है। | ट्रॅक्टर ₹6–7 लाखांचा असतो. वर्षातील बहुतेक दिवस तो उभाच असतो. |
| `story.s1.caption` | Each square is a day; mustard days are working days. | हर खाना एक दिन है; पीले दिन काम के दिन हैं। | प्रत्येक चौकोन एक दिवस आहे; पिवळे दिवस कामाचे दिवस आहेत. |
| `story.s2` | You don't need to own it. You need it on time. | मशीन ख़रीदने की ज़रूरत नहीं। ज़रूरत है समय पर मिलने की। | ट्रॅक्टर विकत घेण्याची गरज नाही. वेळेवर मिळणं महत्त्वाचं. |
| `story.s2.buy` / `.rent` | Buy / Rent 4 hours | ख़रीदें / 4 घंटे किराया | विकत घ्या / 4 तास भाडे |
| `story.s3` | It's already near you. | वह आपके पास ही है। | तो तुमच्या जवळच आहे. |
| `story.s4` | The full price, before you say yes. | हाँ कहने से पहले पूरी कीमत। | होकार देण्याआधी पूर्ण किंमत. |
| `story.s5` | The owner is paid after the job, not before. | मालिक को पैसे काम के बाद मिलते हैं, पहले नहीं। | मालकाला पैसे कामानंतर मिळतात, आधी नाही. |
| `story.s5.handover` / `.work` / `.return` | Handover / Work / Return | सौंपना / काम / वापसी | हस्तांतरण / काम / परत |
| `story.s6` | Your idle tractor can earn. | आपका खड़ा ट्रैक्टर कमाई कर सकता है। | तुमचा उभा ट्रॅक्टर कमाई करू शकतो. |
| `story.s6.body` | List it once. Choose your price and your days. You decide who to accept. | एक बार सूची में डालें। अपनी कीमत और दिन चुनें। किसे देना है, आप तय करें। | एकदा नोंदवा. तुमची किंमत आणि दिवस निवडा. कोणाला द्यायचे ते तुम्ही ठरवा. |
| `story.s6.cta` | List your tractor | अपना ट्रैक्टर किराए पर दें | तुमचा ट्रॅक्टर भाड्याने द्या |
| `story.s7` | Prefer to talk? | बात करना पसंद है? | बोलायला आवडेल? |
| `story.s7.call` | Call {phone} | {phone} पर कॉल करें | {phone} वर कॉल करा |

### 11.3 Login, OTP, password
| Key | en | hi | mr |
|---|---|---|---|
| `login.welcome` | Welcome to KhetiRental | खेती रेंटल में स्वागत है | खेती रेंटलमध्ये स्वागत आहे |
| `login.tab.login` / `.signup` | Log in / Sign up | लॉग इन / साइन अप | लॉग इन / साइन अप |
| `login.google` | Continue with Google | Google से जारी रखें | Google ने पुढे चला |
| `login.or` | OR | या | किंवा |
| `login.mobile` | Mobile number | मोबाइल नंबर | मोबाइल नंबर |
| `login.email` | Email | ईमेल | ईमेल |
| `login.emailAddr` | Email address | ईमेल पता | ईमेल पत्ता |
| `login.password` | Password | पासवर्ड | पासवर्ड |
| `login.name` | Full name | पूरा नाम | पूर्ण नाव |
| `login.otpHint` | We'll send a 6-digit OTP by SMS. | हम SMS से 6 अंकों का OTP भेजेंगे। | आम्ही SMS ने 6 अंकी OTP पाठवू. |
| `login.sendOtp` | Send OTP | OTP भेजें | OTP पाठवा |
| `login.doLogin` | Log in | लॉग इन करें | लॉग इन करा |
| `login.create` | Create account | खाता बनाएँ | खाते तयार करा |
| `login.iwant` | I want to | मुझे चाहिए | मला हवे आहे |
| `login.rent` | Rent machines | मशीन किराए पर लेना | यंत्रे भाड्याने घेणे |
| `login.own` | List my machines | अपनी मशीन किराए पर देना | माझी यंत्रे भाड्याने देणे |
| `login.forgot` | Forgot password? | पासवर्ड भूल गए? | पासवर्ड विसरलात? |
| `login.terms` | By continuing you agree to the {terms} and {privacy}. | आगे बढ़कर आप {terms} और {privacy} से सहमत होते हैं। | पुढे जाऊन तुम्ही {terms} आणि {privacy} ला संमती देता. |
| `login.err.mobile` | Enter a 10-digit mobile number. | 10 अंकों का मोबाइल नंबर डालें। | 10 अंकी मोबाइल नंबर टाका. |
| `login.err.creds` | Email or password is wrong. | ईमेल या पासवर्ड गलत है। | ईमेल किंवा पासवर्ड चुकीचा आहे. |
| `login.err.exists` | This email already has an account. Log in instead. | इस ईमेल से पहले से खाता है। लॉग इन करें। | या ईमेलचे खाते आधीच आहे. लॉग इन करा. |
| `login.err.rate` | Too many tries. Wait 10 minutes and try again. | बहुत ज़्यादा कोशिशें। 10 मिनट बाद फिर कोशिश करें। | खूप प्रयत्न झाले. 10 मिनिटांनी पुन्हा प्रयत्न करा. |
| `otp.title` | Enter the code | कोड डालें | कोड टाका |
| `otp.sent` | We sent a 6-digit code to {phone}. | हमने {phone} पर 6 अंकों का कोड भेजा है। | आम्ही {phone} वर 6 अंकी कोड पाठवला आहे. |
| `otp.change` | Change number | नंबर बदलें | नंबर बदला |
| `otp.verify` | Verify | पुष्टि करें | पडताळा |
| `otp.resendIn` | Resend in {time} | {time} में दोबारा भेजें | {time} मध्ये पुन्हा पाठवा |
| `otp.resend` | Resend code | कोड दोबारा भेजें | कोड पुन्हा पाठवा |
| `otp.wrong` | That code is wrong. {n, plural, one {# try} other {# tries}} left. | कोड गलत है। {n} कोशिश बाकी। | कोड चुकीचा आहे. {n} प्रयत्न बाकी. |
| `otp.expired` | This code has expired. Send a new one. | कोड की समय-सीमा खत्म। नया कोड भेजें। | कोडची मुदत संपली. नवीन कोड पाठवा. |
| `pw.title` | Reset your password | पासवर्ड बदलें | पासवर्ड बदला |
| `pw.send` | Send reset link | रीसेट लिंक भेजें | रीसेट लिंक पाठवा |
| `pw.sent` | If an account exists for this email, we've sent a link. Check your inbox. | अगर इस ईमेल का खाता है, तो हमने लिंक भेजा है। इनबॉक्स देखें। | या ईमेलचे खाते असल्यास आम्ही लिंक पाठवली आहे. इनबॉक्स तपासा. |

### 11.4 Search and results
| Key | en | hi | mr |
|---|---|---|---|
| `search.what` | What work? | कौन सा काम? | कोणते काम? |
| `jobs.plough` / `.rotavate` / `.sow` / `.spray` / `.harvest` / `.transport` | Plough / Rotavate / Sow / Spray / Harvest / Transport | जुताई / रोटावेटर / बुवाई / छिड़काव / कटाई / ढुलाई | नांगरणी / रोटाव्हेटर / पेरणी / फवारणी / कापणी / वाहतूक |
| `search.where` | Where is your farm? | आपका खेत कहाँ है? | तुमचे शेत कुठे आहे? |
| `search.placePh` | PIN code or village | पिन कोड या गाँव | पिन कोड किंवा गाव |
| `search.speak` | Speak your village name | गाँव का नाम बोलें | गावाचे नाव बोला |
| `search.locate` | Use my phone's location | मेरे फ़ोन की लोकेशन लें | माझ्या फोनचे लोकेशन वापरा |
| `search.locateFail` | Couldn't get your location. Type your PIN code or village instead. | लोकेशन नहीं मिली। पिन कोड या गाँव लिखें। | लोकेशन मिळाले नाही. पिन कोड किंवा गाव लिहा. |
| `search.when` | When? | कब? | कधी? |
| `search.tomorrow` / `.week` / `.pick` | Tomorrow / This week / Pick dates | कल / इस हफ़्ते / तारीख चुनें | उद्या / या आठवड्यात / तारीख निवडा |
| `search.days` | {n, plural, one {# day} other {# days}} | {n} दिन | {n} दिवस |
| `search.size` | Field size | खेत का आकार | शेताचा आकार |
| `search.optional` | (optional) | (वैकल्पिक) | (ऐच्छिक) |
| `search.acres` | {n} acres | {n} एकड़ | {n} एकर |
| `search.cta` | Find machines | मशीन खोजें | यंत्रे शोधा |
| `search.need` | Choose the work and your place | काम और जगह चुनें | काम आणि ठिकाण निवडा |
| `results.change` | Change | बदलें | बदला |
| `results.sort.nearest` / `.cheapest` / `.top` | Nearest / Cheapest / Top rated | सबसे पास / सबसे सस्ता / सबसे अच्छी रेटिंग | सर्वात जवळ / सर्वात स्वस्त / सर्वोत्तम रेटिंग |
| `results.map` / `.list` | Map / List | नक्शा / सूची | नकाशा / यादी |
| `results.radius` | {km} km | {km} किमी | {km} किमी |
| `results.withDriver` | With driver | ड्राइवर के साथ | ड्रायव्हरसह |
| `results.count` | {n, plural, one {# free} other {# free}} on your dates · showing {sort} first | आपकी तारीखों पर {n} खाली · पहले {sort} | तुमच्या तारखांना {n} मोकळे · आधी {sort} |
| `results.freeChip` | Free {dates} | {dates} खाली | {dates} मोकळे |
| `results.busy` | BUSY ON YOUR DATES | आपकी तारीखों पर व्यस्त | तुमच्या तारखांना व्यस्त |
| `results.freeFrom` | Free from {date} | {date} से खाली | {date} पासून मोकळे |
| `results.away` | {km} km away · {village} | {km} किमी दूर · {village} | {km} किमी दूर · {village} |
| `results.new` | New on KhetiRental | खेती रेंटल पर नया | खेती रेंटलवर नवीन |
| `results.book` | Book for {dates} | {dates} के लिए बुक करें | {dates} साठी बुक करा |
| `results.more` | Show more | और दिखाएँ | अजून दाखवा |
| `results.showing` | Showing {shown} of {total} | {total} में से {shown} | {total} पैकी {shown} |
| `results.empty` | No machines free within {km} km on these dates. | इन तारीखों पर {km} किमी में कोई मशीन खाली नहीं। | या तारखांना {km} किमीमध्ये एकही यंत्र मोकळे नाही. |
| `results.wider` | Search up to 25 km | 25 किमी तक खोजें | 25 किमीपर्यंत शोधा |
| `results.otherDates` | Try other dates | दूसरी तारीखें देखें | दुसऱ्या तारखा पहा |
| `results.callUs` | Call us | हमें कॉल करें | आम्हाला कॉल करा |
| `results.notFinding` | Not finding one? | नहीं मिली? | सापडले नाही? |
| `results.loading` | Finding machines near you… | पास की मशीनें खोज रहे हैं… | जवळची यंत्रे शोधत आहोत… |
| `results.searchArea` | Search this area | इस इलाके में खोजें | या भागात शोधा |

### 11.5 Detail, booking, payment
| Key | en | hi | mr |
|---|---|---|---|
| `detail.hours` | {n} engine hours | {n} इंजन घंटे | {n} इंजिन तास |
| `detail.rc` | ✔ RC checked | ✔ RC जाँचा गया | ✔ RC तपासले |
| `detail.reviews` | ★ {r} ({n, plural, one {# review} other {# reviews}}) | ★ {r} ({n} समीक्षाएँ) | ★ {r} ({n} पुनरावलोकने) |
| `detail.serviced` | Serviced {month} | {month} में सर्विस | {month} मध्ये सर्व्हिसिंग |
| `detail.driver` | Driver included | ड्राइवर शामिल | ड्रायव्हर समाविष्ट |
| `detail.diesel` | Diesel included | डीज़ल शामिल | डिझेल समाविष्ट |
| `detail.comesWith` | Comes with: | साथ में: | सोबत: |
| `detail.freeDays` | Free days · next 14 | खाली दिन · अगले 14 | मोकळे दिवस · पुढचे 14 |
| `detail.legend` | Green = free · grey = booked · yellow = your dates | हरा = खाली · स्लेटी = बुक · पीला = आपकी तारीखें | हिरवा = मोकळा · राखाडी = बुक · पिवळा = तुमच्या तारखा |
| `detail.owner` | {village} · {km} km · on KhetiRental {years} years · replies in about {min} min | {village} · {km} किमी · खेती रेंटल पर {years} साल · लगभग {min} मिनट में जवाब | {village} · {km} किमी · खेती रेंटलवर {years} वर्षे · सुमारे {min} मिनिटांत उत्तर |
| `detail.say` | What farmers say | किसान क्या कहते हैं | शेतकरी काय म्हणतात |
| `detail.allReviews` | See all {n} reviews | सभी {n} समीक्षाएँ देखें | सर्व {n} पुनरावलोकने पहा |
| `detail.est` | est. for {what} | {what} का अनुमान | {what} साठी अंदाज |
| `detail.book` | Book {dates} | {dates} बुक करें | {dates} बुक करा |
| `detail.pickOther` | Pick other dates | दूसरी तारीखें चुनें | दुसऱ्या तारखा निवडा |
| `booking.step` | STEP {n} OF 3 | चरण {n} / 3 | पायरी {n} / 3 |
| `booking.s1.title` | When do you need it? | कब चाहिए? | कधी हवे आहे? |
| `booking.slot.morning` / `.afternoon` / `.full` | Morning / Afternoon / Full day | सुबह / दोपहर / पूरा दिन | सकाळ / दुपार / पूर्ण दिवस |
| `booking.s1.info` | Driver arrives at {time} each day. You pay only for hours used. | ड्राइवर हर दिन {time} बजे आएगा। जितने घंटे काम, उतना ही भुगतान। | ड्रायव्हर दररोज {time} वाजता येईल. वापरलेल्या तासांचेच पैसे. |
| `booking.s2.title` | Check the price | कीमत देखें | किंमत पहा |
| `booking.rent` | Rent: {qty} × {rate} | किराया: {qty} × {rate} | भाडे: {qty} × {rate} |
| `booking.diesel` | Diesel | डीज़ल | डिझेल |
| `booking.included` | Included | शामिल | समाविष्ट |
| `booking.deposit` | Deposit | जमा राशि | अनामत रक्कम |
| `booking.depositNote` | (comes back after the job) | (काम के बाद वापस) | (कामानंतर परत) |
| `booking.payAfter` | Pay after work | काम के बाद भुगतान | कामानंतर पैसे द्या |
| `booking.youPay` | You pay | आप देंगे | तुम्ही द्याल |
| `booking.readAloud` | Read this aloud | इसे पढ़कर सुनाएँ | हे वाचून दाखवा |
| `booking.s3.title` | How do you want to pay? | भुगतान कैसे करेंगे? | पैसे कसे द्याल? |
| `pay.upi` / hint | UPI / GPay, PhonePe, Paytm or any UPI app | UPI / GPay, PhonePe, Paytm या कोई भी UPI ऐप | UPI / GPay, PhonePe, Paytm किंवा कोणतेही UPI ॲप |
| `pay.card` / hint | Debit / credit card / Visa, Mastercard, RuPay | डेबिट / क्रेडिट कार्ड / Visa, Mastercard, RuPay | डेबिट / क्रेडिट कार्ड / Visa, Mastercard, RuPay |
| `pay.net` / hint | Net banking / All major banks | नेट बैंकिंग / सभी बड़े बैंक | नेट बँकिंग / सर्व प्रमुख बँका |
| `pay.cash` / hint | Pay after work / Cash or UPI to the owner when the job is done | काम के बाद भुगतान / काम पूरा होने पर मालिक को नकद या UPI | कामानंतर पैसे / काम झाल्यावर मालकाला रोख किंवा UPI |
| `pay.demoBanner` | Demo payment: no real money moves. Free cancellation until {deadline}. | डेमो भुगतान: असली पैसे नहीं कटते। {deadline} तक मुफ़्त रद्द करें। | डेमो पेमेंट: खरे पैसे जात नाहीत. {deadline} पर्यंत मोफत रद्द करा. |
| `pay.ctaOnline` | Pay {amount} and book | {amount} देकर बुक करें | {amount} भरून बुक करा |
| `pay.ctaCash` | Confirm booking | बुकिंग पक्की करें | बुकिंग निश्चित करा |
| `pay.processing` | Processing… | प्रोसेस हो रहा है… | प्रक्रिया सुरू आहे… |
| `pay.success` | Payment successful (demo) | भुगतान सफल (डेमो) | पेमेंट यशस्वी (डेमो) |
| `pay.failed` | Payment failed. No money was taken. | भुगतान नहीं हुआ। कोई पैसा नहीं कटा। | पेमेंट झाले नाही. पैसे कापले गेले नाहीत. |
| `pay.demoLabel` | DEMO – no real money moves | डेमो – असली पैसे नहीं | डेमो – खरे पैसे नाहीत |
| `booking.taken` | Just booked by someone else. Pick other dates or another machine. | अभी किसी और ने बुक कर लिया। दूसरी तारीख या मशीन चुनें। | आत्ताच दुसऱ्याने बुक केले. दुसऱ्या तारखा किंवा यंत्र निवडा. |

### 11.6 Bookings, problems, notifications
| Key | en | hi | mr |
|---|---|---|---|
| `bookings.title` | My bookings | मेरी बुकिंग | माझी बुकिंग |
| `bookings.sent` | Request sent to {owner} | {owner} को अनुरोध भेजा गया | {owner} यांना विनंती पाठवली |
| `bookings.sentBody` | {owner} usually replies in {min} minutes. We'll let you know here. | {owner} आमतौर पर {min} मिनट में जवाब देते हैं। हम आपको यहाँ बताएँगे। | {owner} साधारण {min} मिनिटांत उत्तर देतात. आम्ही तुम्हाला इथे कळवू. |
| `bookings.upcoming` / `.past` | Upcoming ({n}) / Past | आने वाली ({n}) / पिछली | येणाऱ्या ({n}) / मागील |
| `bookings.code` | Code {code} | कोड {code} | कोड {code} |
| `status.requested` | Waiting for owner | मालिक के जवाब का इंतज़ार | मालकाच्या उत्तराची वाट |
| `status.confirmed` | Confirmed | पक्की | निश्चित |
| `status.inProgress` | Working | काम चालू | काम सुरू |
| `status.completed` | Done | पूरा | पूर्ण |
| `status.cancelled` / `.declined` / `.expired` | Cancelled / Declined / Expired | रद्द / अस्वीकार / समय समाप्त | रद्द / नाकारले / मुदत संपली |
| `bookings.call` / `.whatsapp` / `.cancel` | Call / WhatsApp / Cancel | कॉल / WhatsApp / रद्द करें | कॉल / WhatsApp / रद्द करा |
| `bookings.numberLater` | Number shown after the owner accepts | मालिक के स्वीकार करने के बाद नंबर दिखेगा | मालकाने स्वीकारल्यावर नंबर दिसेल |
| `bookings.report` | Report a problem | समस्या बताएँ | अडचण कळवा |
| `bookings.empty` | No bookings yet. | अभी कोई बुकिंग नहीं। | अजून बुकिंग नाही. |
| `bookings.findOne` | Find a machine | मशीन खोजें | यंत्र शोधा |
| `cancel.title` | Cancel this booking? | यह बुकिंग रद्द करें? | ही बुकिंग रद्द करायची? |
| `cancel.yes` / `.keep` | Yes, cancel / Keep booking | हाँ, रद्द करें / बुकिंग रखें | हो, रद्द करा / बुकिंग ठेवा |
| `problem.title` | What went wrong? | क्या गड़बड़ हुई? | काय चुकले? |
| `problem.noShow` / `.breakdown` / `.damage` / `.overcharge` / `.other` | Machine didn't come / Broke down / Damage / Charged more / Other | मशीन नहीं आई / खराब हो गई / नुकसान / ज़्यादा पैसे लिए / अन्य | यंत्र आले नाही / बिघडले / नुकसान / जास्त पैसे घेतले / इतर |
| `problem.send` | Send report | रिपोर्ट भेजें | तक्रार पाठवा |
| `problem.sent` | Report sent. We'll call you within a day. | रिपोर्ट भेज दी। हम एक दिन में कॉल करेंगे। | तक्रार पाठवली. आम्ही एका दिवसात कॉल करू. |
| `notif.empty` | Nothing new. | कुछ नया नहीं। | नवीन काही नाही. |
| `notif.markAll` | Mark all as read | सब पढ़ा हुआ करें | सर्व वाचले म्हणून खूण करा |

### 11.7 Owner
| Key | en | hi | mr |
|---|---|---|---|
| `owner.hello` | Namaste, {name} | नमस्ते, {name} | नमस्कार, {name} |
| `owner.month` / `.paid` / `.coming` | This month / Paid to you / Coming | इस महीने / आपको मिला / आने वाला | या महिन्यात / तुम्हाला मिळाले / येणार |
| `owner.requests` | New requests ({n}) | नए अनुरोध ({n}) | नवीन विनंत्या ({n}) |
| `owner.replyIn` | Reply in {time} | {time} में जवाब दें | {time} मध्ये उत्तर द्या |
| `owner.accept` / `.decline` | Accept / Decline | स्वीकार करें / मना करें | स्वीकारा / नाकारा |
| `owner.accepted` | Accepted. {name} can now call you. | स्वीकार किया। अब {name} आपको कॉल कर सकते हैं। | स्वीकारले. आता {name} तुम्हाला कॉल करू शकतात. |
| `owner.noRequests` | No new requests. We'll let you know when one comes. | कोई नया अनुरोध नहीं। आने पर हम बताएँगे। | नवीन विनंती नाही. आल्यावर आम्ही कळवू. |
| `owner.blockHint` | Tap a day to block it | दिन बंद करने के लिए उस पर टैप करें | दिवस बंद करण्यासाठी त्यावर टॅप करा |
| `owner.legend` | Booked · Free · Blocked | बुक · खाली · बंद | बुक · मोकळे · बंद |
| `owner.machines` | My machines ({n}) | मेरी मशीनें ({n}) | माझी यंत्रे ({n}) |
| `owner.add` | + Add | + जोड़ें | + जोडा |
| `owner.edit` | Edit | बदलें | बदला |
| `owner.live` / `.paused` | live / paused | चालू / रुका हुआ | चालू / थांबवले |
| `list.step` | STEP {n} OF 4 | चरण {n} / 4 | पायरी {n} / 4 |
| `list.s1` / `.s2` / `.s3` / `.s4` | Your machine / Photos / Where and when / Set your price | आपकी मशीन / फ़ोटो / कहाँ और कब / अपनी कीमत तय करें | तुमचे यंत्र / फोटो / कुठे आणि कधी / तुमची किंमत ठरवा |
| `list.howCharge` | How do you charge? | आप कैसे चार्ज करते हैं? | तुम्ही कसे पैसे घेता? |
| `list.perHour` / `.perAcre` / `.perDay` | Per hour / Per acre / Per day | प्रति घंटा / प्रति एकड़ / प्रति दिन | प्रति तास / प्रति एकर / प्रति दिवस |
| `list.yourPrice` | Your price {per} | आपकी कीमत {per} | तुमची किंमत {per} |
| `list.similar` | Similar machines near you charge {range}. | आपके पास ऐसी मशीनें {range} लेती हैं। | तुमच्या जवळची अशी यंत्रे {range} घेतात. |
| `list.farmerPays` / `.fee` / `.keep` | Farmer pays / Our fee ({pct}) / You keep | किसान देगा / हमारी फ़ीस ({pct}) / आपको मिलेगा | शेतकरी देईल / आमची फी ({pct}) / तुम्हाला मिळेल |
| `list.drive` | I will drive it (operator included) | मैं खुद चलाऊँगा (ऑपरेटर शामिल) | मी स्वतः चालवीन (ऑपरेटर समाविष्ट) |
| `list.publish` | Publish my {machine} | मेरा {machine} प्रकाशित करें | माझा {machine} प्रकाशित करा |
| `list.live` | Your {name} is live. Farmers within 10 km can now book it. | आपका {name} अब दिख रहा है। 10 किमी के किसान इसे बुक कर सकते हैं। | तुमचा {name} आता दिसत आहे. 10 किमीमधील शेतकरी तो बुक करू शकतात. |
| `list.rcPending` | Uploaded – pending review | अपलोड हुआ – जाँच बाकी | अपलोड झाले – तपासणी बाकी |
| `list.photoTip` | Tip: daylight, whole machine in the frame. | सुझाव: दिन की रोशनी, पूरी मशीन फ़ोटो में। | टीप: दिवसाचा उजेड, संपूर्ण यंत्र फोटोत. |
| `list.takePhoto` / `.gallery` | Take photo / Choose from gallery | फ़ोटो लें / गैलरी से चुनें | फोटो काढा / गॅलरीतून निवडा |

### 11.8 Errors
| Key | en | hi | mr |
|---|---|---|---|
| `errors.network` | We couldn't load this. Check your connection. | लोड नहीं हुआ। इंटरनेट जाँचें। | लोड झाले नाही. इंटरनेट तपासा. |
| `errors.offlineSubmit` | No internet connection. Nothing was sent. Try again when you have signal. | इंटरनेट नहीं है। कुछ नहीं भेजा गया। नेटवर्क आने पर फिर कोशिश करें। | इंटरनेट नाही. काहीही पाठवले नाही. नेटवर्क आल्यावर पुन्हा प्रयत्न करा. |
| `errors.server` | Something went wrong on our side. Try again, or call {phone}. | हमारी तरफ़ से गड़बड़ हुई। फिर कोशिश करें या {phone} पर कॉल करें। | आमच्याकडून चूक झाली. पुन्हा प्रयत्न करा किंवा {phone} वर कॉल करा. |
| `errors.session` | Please log in again. | कृपया फिर से लॉग इन करें। | कृपया पुन्हा लॉग इन करा. |
| `errors.forbidden` | You can't open this page. | आप यह पेज नहीं खोल सकते। | तुम्ही हे पान उघडू शकत नाही. |
| `errors.notFound` | We couldn't find that page. | वह पेज नहीं मिला। | ते पान सापडले नाही. |

## 12. Data the UI needs

### 12.1 Tables (Drizzle; see REVIEW F-09 and Phase 3 §4)
- `users`(id, name, phone?, phone_verified_at?, email?, password_hash?, image?, locale, roles text[], created_at)
- `accounts`/`sessions` (Auth.js adapter)
- `otp_codes`(phone, code_hash, expires_at, attempts)
- `machines`(id, owner_id, category, make, model, hp?, year, hour_meter?, last_serviced?, attachments text[], location geography(Point,4326), village, pin, price_unit enum('hour','acre','day'), price_paise, alt_price_unit?, alt_price_paise?, operator_included bool, diesel_included bool, rc_status enum('none','pending','checked','rejected'), active bool, is_sample bool, created_at)
- `machine_photos`(id, machine_id, url, kind enum('front','side','meter','extra','rc'), sort)
- `machine_blocks`(machine_id, day date)
- `bookings`(id, code char(7) unique 'KR-1234', machine_id, renter_id, during tstzrange, slot enum('morning','afternoon','full'), est_qty numeric, unit, rate_paise, rent_paise, deposit_paise, diesel_paise, status enum('REQUESTED','CONFIRMED','IN_PROGRESS','COMPLETED','CANCELLED','DECLINED','EXPIRED'), reply_by timestamptz, idempotency_key unique, created_at), with `EXCLUDE USING gist (machine_id WITH =, during WITH &&) WHERE status IN ('REQUESTED','CONFIRMED','IN_PROGRESS')`
- `payments`(id, booking_id, method enum('upi','card','net','cash'), status enum('paid_demo','pay_later','failed_demo'), amount_paise, created_at)
- `reviews`(id, booking_id, author_id, target_user_id, stars 1–5, text?, created_at)
- `notifications`(id, user_id, type, booking_id?, read_at?, created_at)
- `problem_reports`(id, booking_id, reporter_id, type, text?, photos text[], status enum('open','resolved'), note?)
- `pin_codes`(pin, office, village, district, state, location geography(Point,4326))

### 12.2 Card and detail payloads (server → UI)
- **Machine card:** `{ id, name, attachments[], hp, priceRupees, unit, operatorIncluded, distanceKm (rounded to 0.5), village, rating, reviewCount, ownerShortName, servicedMonth?, photoUrl?, available, nextFreeDate?, isSample }`
- **Detail:** card fields plus `{ year, hourMeter, rcStatus, altPrice?, dieselIncluded, photos[], days14: [{date, state:'free'|'busy'|'blocked'}], owner: { shortName, village, yearsOnPlatform, replyMinutes, avatarUrl? }, reviewsPreview[] }`
- **Quote** (computed server-side; never trust client maths): `{ qty, unit, rateRupees, rentRupees, dieselRupees|null, depositRupees, totalRupees, cancelDeadline }`

### 12.3 Job → machine mapping
| Job | Categories | Attachments that qualify a tractor |
|---|---|---|
| Plough | tractor | Plough, Cultivator |
| Rotavate | rotavator, tractor | Rotavator |
| Sow | seed_drill, tractor | Seed drill |
| Spray | sprayer, tractor | Sprayer |
| Harvest | combine_harvester, thresher, tractor | Harvester attachment |
| Transport | trolley, tractor | Trolley |

## 13. Page acceptance checklist (tick each in the PR description)

For **every** page: matches its §4 spec and mockup at 390 px · works at 360 / 768 / 1024 / 1440 · all 3 languages · keyboard and screen reader · reduced motion · loading, empty and error states · no hard-coded strings · axe clean · within the JS budget.

| Page | Extra checks |
|---|---|
| Welcome | Loop has no jump; no cloud behind the heading band; counters end exactly on 86% / 1.08 / 47%; logged-in variant; LCP is text |
| Login | 3 methods (mocked); sign-up name and role; redirect rules (§3.3) |
| OTP | Paste fills; resend timer; attempts limit |
| Search | Every value in the URL; mic hidden when unsupported; geolocation fallback |
| Results | Free/busy split; sort; radius; driver filter; paging; map lazy; restored on Back |
| Detail | Day grid accurate against bookings and blocks; phone hidden before confirmation |
| Booking | Refresh-safe steps; idempotent create; 409 handling; deposit rule; read aloud |
| Payment | Never posts card fields; demo label; failure path with the flag |
| My bookings | Status chips; call/WhatsApp gated; cancel flow |
| Problem | Photos optional; appears in admin |
| Owner listing | Draft autosave; photo compression; price hint; keep amount maths |
| Owner dashboard | Accept/decline updates the renter; countdown expiry; calendar block |
| Settings | Role switch; delete account confirmation |
| 404 / 403 | Correct titles; working buttons |

## 14. Assumptions and placeholders to replace before launch
- Helpline number `[YOUR HELPLINE]` and WhatsApp support number: set in `config/contact.ts`.
- Terms and Privacy text: `[LEGAL REVIEW NEEDED]`.
- Machine photos, owner photos and the pictogram set are placeholders until real ones are commissioned or uploaded.
- The Hindi and Marathi strings in §11 are drafts that need native review.
- The counter figures come from the Agriculture Census 2015–16 and 2025 mechanisation reporting; update them if newer official data is published.
- The 3D tractor model must be made or licensed (CC0 or a commissioned model); don't use a branded tractor model.

## Appendix A. Mockup sources (verbatim)

These are the approved mockups exported from the design canvas. They are also saved in the project's `design/` folder. **Format note:** each file is a design-canvas document (`<x-dc>` root, `{{holes}}` for data, `sc-for` / `sc-if` for loops and conditions, a `DCLogic` script for state). Use them as the visual and behavioural reference only: copy the layout, sizes, colours, copy and keyframes, but **rebuild them as React components**. Do not port the canvas runtime.

### A.Main — `design/Main.dc.html`

````html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>KhetiRental welcome</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@700&amp;family=Mukta:wght@400;700&amp;display=swap">
<style>
body{margin:0}
a{color:#223585}a:hover{color:#1B2A66}
@keyframes kr-round{0%{transform:translate(-10px,0) scaleX(1)}44%{transform:translate(225px,0) scaleX(1)}50%{transform:translate(232px,70px) scaleX(-1)}94%{transform:translate(-3px,70px) scaleX(-1)}100%{transform:translate(-10px,0) scaleX(1)}}
@keyframes kr-plough1{0%{transform:scaleX(0);opacity:1}44%{transform:scaleX(1);opacity:1}93%{transform:scaleX(1);opacity:1}100%{transform:scaleX(1);opacity:0}}
@keyframes kr-plough2{0%,50%{transform:scaleX(0);opacity:1}94%{transform:scaleX(1);opacity:1}100%{transform:scaleX(1);opacity:0}}
@keyframes kr-spin{to{transform:rotate(360deg)}}
@keyframes kr-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}
@keyframes kr-cloud{from{transform:translateX(-120px)}to{transform:translateX(420px)}}
@keyframes kr-sway{0%,100%{transform:skewX(-4deg)}50%{transform:skewX(5deg)}}
@keyframes kr-sun{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
@keyframes kr-puff{0%{opacity:.7;transform:translate(0,0) scale(.6)}100%{opacity:0;transform:translate(-26px,-22px) scale(1.6)}}
@keyframes kr-up{from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:none}}
.kr-drive{transform-origin:center;animation:kr-round ease-in-out infinite}
.kr-plough1{transform-origin:left center;animation:kr-plough1 ease-in-out infinite}
.kr-plough2{transform-origin:right center;animation:kr-plough2 ease-in-out infinite}
.kr-wheel{transform-box:fill-box;transform-origin:center;animation:kr-spin .9s linear infinite}
.kr-body{animation:kr-bob .5s ease-in-out infinite}
.kr-cloud{animation:kr-cloud linear infinite}
.kr-sway{transform-origin:bottom center;animation:kr-sway 3s ease-in-out infinite}
.kr-sun{transform-box:fill-box;transform-origin:center;animation:kr-sun 6s ease-in-out infinite}
.kr-puff{transform-box:fill-box;transform-origin:center;animation:kr-puff 1.2s ease-out infinite}
@supports (animation-timeline: view()){.kr-reveal{animation:kr-up linear both;animation-timeline:view();animation-range:entry 0% entry 60%}}
@media (prefers-reduced-motion: reduce){.kr-drive,.kr-plough1,.kr-plough2,.kr-wheel,.kr-body,.kr-cloud,.kr-sway,.kr-sun,.kr-puff,.kr-reveal{animation:none !important}}
</style>
</helmet>
<div lang="{{lang}}" style="width: 390px; height: 3120px; box-sizing: border-box; background: #FAF8F4; color: #13100D; font-family: Mukta, 'Noto Sans Devanagari', sans-serif; display: flex; flex-direction: column">

<section style="position: relative; height: 844px; overflow: hidden; background: {{sky}}">
<svg width="390" height="844" viewBox="0 0 390 844" aria-hidden="true" style="position: absolute; inset: 0">
<circle class="kr-sun" cx="300" cy="{{sunY}}" r="38" fill="{{sun}}"></circle>
<g class="kr-cloud" style="animation-duration: 38s"><ellipse cx="40" cy="74" rx="44" ry="16" fill="#FFFFFF" opacity="0.85"></ellipse><ellipse cx="70" cy="64" rx="30" ry="14" fill="#FFFFFF" opacity="0.85"></ellipse></g>
<g class="kr-cloud" style="animation-duration: 55s; animation-delay: -20s"><ellipse cx="60" cy="284" rx="40" ry="14" fill="#FFFFFF" opacity="0.7"></ellipse><ellipse cx="86" cy="276" rx="24" ry="11" fill="#FFFFFF" opacity="0.7"></ellipse></g>
<path d="M0 330 C70 290 140 300 210 320 S330 290 390 305 V420 H0 Z" fill="{{hill1}}"></path>
<path d="M0 360 C90 335 170 350 260 345 S360 330 390 340 V440 H0 Z" fill="{{hill2}}"></path>
<rect x="0" y="400" width="390" height="444" fill="#C9A86A"></rect>
<path d="M0 440 H390 M0 480 H390 M0 525 H390 M0 575 H390 M0 630 H390 M0 690 H390" stroke="#B08A4C" stroke-width="3"></path>
</svg>

<div style="position: absolute; left: 0; right: 0; top: 404px; height: 34px; display: flex; justify-content: space-around; align-items: flex-end">
<sc-for list="{{crops}}" as="c" hint-placeholder-count="16"><span class="kr-sway" style="display: block; width: 6px; height: {{c.h}}px; border-radius: 3px 3px 0 0; background: #4E7A2E; animation-delay: {{c.d}}s"></span></sc-for>
</div>

<div class="kr-plough1" style="position: absolute; left: 0; top: 500px; width: 390px; height: 28px; border-radius: 4px; background: #6B4A26; animation-duration: {{dur}}s"></div>
<div class="kr-plough2" style="position: absolute; left: 0; top: 570px; width: 390px; height: 28px; border-radius: 4px; background: #6B4A26; animation-duration: {{dur}}s"></div>

<sc-if value="{{showTractor}}" hint-placeholder-val="{{ true }}">
<div class="kr-drive" style="position: absolute; left: 0; top: 420px; width: 170px; height: 110px; animation-duration: {{dur}}s">
<svg width="170" height="110" viewBox="0 0 170 110" aria-hidden="true">
<circle class="kr-puff" cx="96" cy="14" r="7" fill="#CFC4B4"></circle>
<circle class="kr-puff" cx="96" cy="14" r="6" fill="#CFC4B4" style="animation-delay: .6s"></circle>
<g class="kr-body">
<rect x="20" y="66" width="34" height="10" rx="2" fill="#483F37"></rect>
<rect x="54" y="48" width="86" height="30" rx="6" fill="#223585"></rect>
<path d="M88 48 V20 H124 L132 48" fill="#FFD45C" stroke="#13100D" stroke-width="4" stroke-linejoin="round"></path>
<rect x="92" y="18" width="5" height="18" fill="#13100D"></rect>
</g>
<g class="kr-wheel"><circle cx="76" cy="80" r="26" fill="#13100D"></circle><circle cx="76" cy="80" r="10" fill="#FBC02D"></circle><path d="M76 56 V104 M52 80 H100" stroke="#483F37" stroke-width="4"></path></g>
<g class="kr-wheel"><circle cx="138" cy="90" r="16" fill="#13100D"></circle><circle cx="138" cy="90" r="6" fill="#FBC02D"></circle><path d="M138 74 V106 M122 90 H154" stroke="#483F37" stroke-width="3"></path></g>
</svg>
</div>
</sc-if>

<div ref="{{statsRef}}" style="position: absolute; left: 0; right: 0; top: 656px; display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 0 12px">
<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); width: 100%; text-align: center">
<sc-for list="{{stats}}" as="s" hint-placeholder-count="3">
<div style="display: flex; flex-direction: column; align-items: center">
<span style="font-family: 'Baloo 2', Mukta, sans-serif; font-size: 40px; line-height: 44px; color: #13100D; font-variant-numeric: tabular-nums">{{s.value}}</span>
<span style="font-size: 14px; line-height: 18px; font-weight: 700; color: #13100D">{{s.label}}</span>
</div>
</sc-for>
</div>
<span style="font-size: 11px; line-height: 14px; color: #332C26">Agriculture Census 2015–16 · 2025 estimates</span>
</div>

<header style="position: absolute; top: 0; left: 0; right: 0; display: flex; align-items: center; justify-content: space-between; padding: 12px 16px">
<div style="display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 20px; color: #13100D; background: rgba(255,255,255,0.85); padding: 6px 12px; border-radius: 999px">
<svg width="24" height="24" viewBox="0 0 28 28" aria-hidden="true"><circle cx="9" cy="18" r="7" fill="none" stroke="#223585" stroke-width="2.5"></circle><circle cx="22" cy="21" r="4" fill="none" stroke="#223585" stroke-width="2.5"></circle><path d="M9 11 L14 5 H20 V17" fill="none" stroke="#223585" stroke-width="2.5" stroke-linejoin="round"></path></svg>
KhetiRental
</div>
<div role="group" aria-label="Language" style="display: flex; background: #FFFFFF; border-radius: 999px; padding: 3px; gap: 2px">
<sc-for list="{{langs}}" as="l" hint-placeholder-count="3">
<button onClick="{{l.pick}}" aria-pressed="{{l.on}}" style="height: 38px; padding: 0 10px; border-radius: 999px; border: none; background: {{l.bg}}; color: {{l.fg}}; font: 700 14px Mukta, sans-serif">{{l.label}}</button>
</sc-for>
</div>
</header>

<div style="position: absolute; left: 0; right: 0; top: 96px; display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; padding: 0 16px">
<h1 style="margin: 0; font-family: 'Baloo 2', Mukta, sans-serif; font-size: 46px; line-height: 50px; color: #13100D; letter-spacing: -0.5px">{{t.h1}}</h1>
<p style="margin: 0; font-size: 18px; line-height: 26px; color: #13100D; font-weight: 700">{{t.tag}}</p>
<nav aria-label="Get started" style="margin-top: 14px; display: flex; justify-content: center; gap: 10px; flex-wrap: wrap">
<a href="Login.dc.html" style="display: flex; align-items: center; height: 48px; padding: 0 20px; border-radius: 999px; background: #223585; color: #FFFFFF; font-weight: 700; font-size: 16px; text-decoration: none">{{t.login}}</a>
<a href="Login.dc.html" style="display: flex; align-items: center; height: 48px; padding: 0 20px; border-radius: 999px; background: #FFD45C; color: #13100D; font-weight: 700; font-size: 16px; text-decoration: none">{{t.signup}}</a>
<a href="#how" style="display: flex; align-items: center; height: 48px; padding: 0 18px; border-radius: 999px; background: rgba(255,255,255,0.9); color: #13100D; font-weight: 700; font-size: 16px; text-decoration: none">{{t.how}} ↓</a>
</nav>
</div>
</section>

<section id="how" class="kr-reveal" style="padding: 40px 16px; display: flex; flex-direction: column; gap: 16px">
<p style="margin: 0; font-size: 14px; font-weight: 700; color: #8F5F00; letter-spacing: 1px">{{t.problem}}</p>
<h2 style="margin: 0; font-family: 'Baloo 2', Mukta, sans-serif; font-size: 28px; line-height: 34px">{{t.s1}}</h2>
<div style="display: grid; grid-template-columns: repeat(26, minmax(0, 1fr)); gap: 3px" aria-hidden="true">
<sc-for list="{{days}}" as="d" hint-placeholder-count="182"><span style="display: block; height: 10px; border-radius: 2px; background: {{d.c}}"></span></sc-for>
</div>
<p style="margin: 0; font-size: 14px; line-height: 22px; color: #5E544A">Each square is a day; mustard days are working days. [Replace with surveyed figures.]</p>
</section>

<section class="kr-reveal" style="padding: 40px 16px; display: flex; flex-direction: column; gap: 16px; background: #FFFFFF">
<h2 style="margin: 0; font-family: 'Baloo 2', Mukta, sans-serif; font-size: 28px; line-height: 34px">{{t.s2}}</h2>
<div style="height: 160px; border-radius: 16px; background: #F3EEE6; display: flex; align-items: center; justify-content: center; color: #483F37; font-size: 14px">[3D tractor turns as you scroll · still image on slow phones]</div>
<div><div style="display: flex; justify-content: space-between; font-size: 16px"><span>Buy</span><strong>₹6,40,000</strong></div><div style="height: 18px; border-radius: 9px; background: #483F37; margin-top: 6px"></div></div>
<div><div style="display: flex; justify-content: space-between; font-size: 16px"><span>Rent 4 hours</span><strong style="color: #1E7B3C">₹2,839</strong></div><div style="height: 18px; width: 12px; border-radius: 9px; background: #1E7B3C; margin-top: 6px"></div></div>
</section>

<section class="kr-reveal" style="padding: 40px 16px; display: flex; flex-direction: column; gap: 16px">
<h2 style="margin: 0; font-family: 'Baloo 2', Mukta, sans-serif; font-size: 28px; line-height: 34px">{{t.s3}}</h2>
<svg viewBox="0 0 358 220" width="358" height="220" role="img" aria-label="Map of a village with nearby machines and their prices">
<rect width="358" height="220" rx="16" fill="#F3EEE6"></rect>
<path d="M0 160 C80 140 140 180 220 150 S330 110 358 120" stroke="#8DA2E3" stroke-width="10" fill="none" opacity="0.6"></path>
<path d="M40 0 L120 220 M0 76 H358" stroke="#CFC4B4" stroke-width="5"></path>
<polygon points="179,90 199,102 199,126 179,138 159,126 159,102" fill="#FFD45C" stroke="#223585" stroke-width="2"></polygon>
<polygon points="179,42 199,54 199,78 179,90 159,78 159,54" fill="none" stroke="#7C7062" stroke-width="1.5"></polygon>
<polygon points="219,66 239,78 239,102 219,114 199,102 199,78" fill="none" stroke="#7C7062" stroke-width="1.5"></polygon>
<circle cx="179" cy="114" r="7" fill="#223585"></circle>
<rect x="232" y="34" width="58" height="26" rx="13" fill="#13100D"></rect><text x="261" y="52" text-anchor="middle" font-family="Mukta" font-weight="700" font-size="14" fill="#FFFFFF">₹710</text>
<rect x="70" y="114" width="58" height="26" rx="13" fill="#13100D"></rect><text x="99" y="132" text-anchor="middle" font-family="Mukta" font-weight="700" font-size="14" fill="#FFFFFF">₹650</text>
<rect x="250" y="150" width="62" height="26" rx="13" fill="#13100D"></rect><text x="281" y="168" text-anchor="middle" font-family="Mukta" font-weight="700" font-size="14" fill="#FFFFFF">₹1,400</text>
</svg>
</section>

<section class="kr-reveal" style="padding: 40px 16px; display: flex; flex-direction: column; gap: 16px; background: #FFFFFF">
<h2 style="margin: 0; font-family: 'Baloo 2', Mukta, sans-serif; font-size: 28px; line-height: 34px">{{t.s4}}</h2>
<div style="background: #FAF8F4; border-radius: 16px; padding: 18px; display: flex; flex-direction: column; gap: 10px; font-size: 18px">
<div style="display: flex; justify-content: space-between"><span>Rent: 4 h × ₹710</span><span>₹2,840</span></div>
<div style="display: flex; justify-content: space-between"><span>Diesel</span><span style="color: #1E7B3C; font-weight: 700">Included</span></div>
<div style="display: flex; justify-content: space-between"><span>Deposit (comes back)</span><span>₹1,950</span></div>
<div style="display: flex; justify-content: space-between; border-top: 2px solid #13100D; padding-top: 10px; font-weight: 700; font-size: 22px"><span>You pay</span><span>₹2,840</span></div>
</div>
</section>

<section class="kr-reveal" style="padding: 40px 16px; display: flex; flex-direction: column; gap: 16px">
<h2 style="margin: 0; font-family: 'Baloo 2', Mukta, sans-serif; font-size: 28px; line-height: 34px">{{t.s5}}</h2>
<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px">
<sc-for list="{{stamps}}" as="s" hint-placeholder-count="3">
<div style="display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 14px 6px; border: 2px solid #223585; border-radius: 16px; background: #FFFFFF; text-align: center">
<div style="width: 44px; height: 44px; border-radius: 22px; background: #223585; color: #FFFFFF; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 20px">{{s.n}}</div>
<strong style="font-size: 16px">{{s.t}}</strong>
<span style="font-size: 14px; line-height: 20px; color: #483F37">{{s.d}}</span>
</div>
</sc-for>
</div>
</section>

<section class="kr-reveal" style="padding: 40px 16px; display: flex; flex-direction: column; gap: 16px; background: #223585; color: #FFFFFF">
<h2 style="margin: 0; font-family: 'Baloo 2', Mukta, sans-serif; font-size: 28px; line-height: 34px">{{t.s6}}</h2>
<p style="margin: 0; font-size: 18px; line-height: 28px; color: #DCE3F7">List it once. Choose your price and your days. You decide who to accept.</p>
<a href="Login.dc.html" style="display: flex; align-items: center; justify-content: center; height: 56px; border-radius: 10px; background: #FBC02D; color: #13100D; font-weight: 700; font-size: 18px; text-decoration: none">{{t.list}}</a>
</section>

<section class="kr-reveal" style="padding: 40px 16px; display: flex; flex-direction: column; gap: 14px">
<h2 style="margin: 0; font-size: 24px; line-height: 32px">{{t.s7}}</h2>
<a href="tel:+911800000000" style="display: flex; align-items: center; justify-content: center; height: 56px; border-radius: 10px; border: 2px solid #13100D; color: #13100D; font-weight: 700; font-size: 18px; text-decoration: none">Call [YOUR HELPLINE]</a>
<p style="margin: 8px 0 0; font-size: 14px; color: #5E544A">About · How we price · Privacy · Terms</p>
</section>
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"speed":{"editor":"range","default":24,"min":10,"max":60,"step":1,"unit":"s","section":"Live field"},"timeOfDay":{"editor":"enum","options":["morning","noon","evening"],"default":"morning","section":"Live field"},"showTractor":{"editor":"boolean","default":true,"section":"Live field"},"$preview":{"width":390,"height":3120}}'>
class Component extends DCLogic {
  constructor(p) {
    super(p);
    this.state = { lang: 'en', k: 0 };
    this.statsRef = (el) => {
      if (!el || this._io || this._started) return;
      if (typeof IntersectionObserver === 'undefined') { this.countUp(); return; }
      this._io = new IntersectionObserver((es) => {
        if (es.some((e) => e.isIntersecting)) { this._io.disconnect(); this.countUp(); }
      }, { threshold: 0.35 });
      this._io.observe(el);
    };
  }
  countUp() {
    if (this._started) return;
    this._started = true;
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { this.setState({ k: 1 }); return; }
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / 1800);
      this.setState({ k: 1 - Math.pow(1 - p, 3) });
      if (p < 1) this._raf = requestAnimationFrame(tick);
    };
    this._raf = requestAnimationFrame(tick);
  }
  componentWillUnmount() {
    if (this._raf) cancelAnimationFrame(this._raf);
    if (this._io) this._io.disconnect();
  }
  renderVals() {
    const T = {
      en: { h1: 'Farm, made easy.', tag: 'Rent machines from your village', h1long: 'Need a tractor? Rent one from your village.', about: 'KhetiRental connects farmers with tractors, rotavators and harvesters owned by people nearby.', sub: 'See the full price first. The owner is paid only after the work is done.', login: 'Log in', signup: 'Sign up', how: 'How it works', problem: 'THE PROBLEM', s1: 'A tractor costs ₹6–7 lakh. Most of the year, it waits in the shed.', s2: "You don't need to own it. You need it on time.", s3: "It's already near you.", s4: 'The full price, before you say yes.', s5: 'The owner is paid after the job, not before.', s6: 'Your idle tractor can earn.', s7: 'Prefer to talk?', list: 'List your tractor' },
      hi: { h1: 'खेती, आसान।', tag: 'अपने गाँव से मशीन किराए पर लें', about: 'खेती रेंटल किसानों को पास के मालिकों के ट्रैक्टर, रोटावेटर और हार्वेस्टर से जोड़ता है।', sub: 'पहले पूरी कीमत देखें। काम पूरा होने के बाद ही मालिक को पैसे मिलते हैं।', login: 'लॉग इन', signup: 'साइन अप', how: 'कैसे काम करता है', problem: 'समस्या', s1: 'ट्रैक्टर ₹6–7 लाख का आता है। साल के ज़्यादातर दिन वह खड़ा रहता है।', s2: 'मशीन ख़रीदने की ज़रूरत नहीं। ज़रूरत है समय पर मिलने की।', s3: 'वह आपके पास ही है।', s4: 'हाँ कहने से पहले पूरी कीमत।', s5: 'मालिक को पैसे काम के बाद मिलते हैं, पहले नहीं।', s6: 'आपका खड़ा ट्रैक्टर कमाई कर सकता है।', s7: 'बात करना पसंद है?', list: 'अपना ट्रैक्टर किराए पर दें' },
      mr: { h1: 'शेती, सोपी.', tag: 'गावातूनच यंत्रे भाड्याने घ्या', about: 'खेती रेंटल शेतकऱ्यांना जवळच्या मालकांच्या ट्रॅक्टर, रोटाव्हेटर आणि हार्वेस्टरशी जोडते.', sub: 'आधी पूर्ण किंमत पहा. काम झाल्यावरच मालकाला पैसे मिळतात.', login: 'लॉग इन', signup: 'साइन अप', how: 'कसे चालते', problem: 'अडचण', s1: 'ट्रॅक्टर ₹6–7 लाखांचा असतो. वर्षातील बहुतेक दिवस तो उभाच असतो.', s2: 'ट्रॅक्टर विकत घेण्याची गरज नाही. वेळेवर मिळणं महत्त्वाचं.', s3: 'तो तुमच्या जवळच आहे.', s4: 'होकार देण्याआधी पूर्ण किंमत.', s5: 'मालकाला पैसे कामानंतर मिळतात, आधी नाही.', s6: 'तुमचा उभा ट्रॅक्टर कमाई करू शकतो.', s7: 'बोलायला आवडेल?', list: 'तुमचा ट्रॅक्टर भाड्याने द्या' }
    };
    const SKY = {
      morning: { sky: '#CFE3F2', sun: '#FBC02D', sunY: 318, hill1: '#7FA35A', hill2: '#5E8A3E' },
      noon: { sky: '#9CC7EA', sun: '#FFD45C', sunY: 300, hill1: '#6E9A48', hill2: '#4E7A2E' },
      evening: { sky: '#F2B78A', sun: '#E0703A', sunY: 326, hill1: '#6B7A45', hill2: '#4A5A30' }
    };
    const lang = this.state.lang;
    const langs = [['mr', 'मराठी'], ['hi', 'हिंदी'], ['en', 'English']].map(([id, label]) => ({
      label, on: lang === id ? 'true' : 'false',
      bg: lang === id ? '#223585' : '#FFFFFF', fg: lang === id ? '#FFFFFF' : '#13100D',
      pick: () => this.setState({ lang: id })
    }));
    const crops = Array.from({ length: 16 }, (_, i) => ({ h: 18 + ((i * 7) % 14), d: -(i % 5) * 0.4 }));
    const days = Array.from({ length: 182 }, (_, i) => ({ c: (i % 12 === 3) ? '#FBC02D' : '#E5DDD1' }));
    const S = {
      en: { stTitle: '', a: 'small farms', b: 'hectare avg. farm', c: 'mechanised' },
      hi: { stTitle: '', a: 'छोटे खेत', b: 'हेक्टेयर औसत खेत', c: 'मशीनीकरण' },
      mr: { stTitle: '', a: 'लहान शेते', b: 'हेक्टर सरासरी शेत', c: 'यांत्रिकीकरण' }
    }[lang];
    const k = this.state.k;
    const stats = [
      { value: Math.round(86 * k) + '%', label: S.a },
      { value: (1.08 * k).toFixed(2), label: S.b },
      { value: Math.round(47 * k) + '%', label: S.c }
    ];
    return {
      lang, langs, t: { ...T[lang], stTitle: S.stTitle }, crops, days, stats, statsRef: this.statsRef,
      dur: this.props.speed ?? 24,
      showTractor: this.props.showTractor ?? true,
      ...SKY[this.props.timeOfDay ?? 'morning'],
      stamps: [{ n: '1', t: 'Handover', d: 'Photo + OTP' }, { n: '2', t: 'Work', d: 'Hours counted' }, { n: '3', t: 'Return', d: 'Owner paid' }]
    };
  }
}
</script>
</body>
</html>
````

### A.Login — `design/Login.dc.html`

````html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Log in or sign up</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@700&amp;family=Mukta:wght@400;700&amp;display=swap">
<style>
body{margin:0}
a{color:#223585}a:hover{color:#1B2A66}
</style>
</helmet>
<div lang="{{lang}}" style="width: 390px; height: 844px; box-sizing: border-box; background: #FAF8F4; color: #13100D; font-family: Mukta, 'Noto Sans Devanagari', sans-serif; display: flex; flex-direction: column">
<header style="display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; height: 60px; box-sizing: border-box">
<a href="Main.dc.html" aria-label="Back" style="width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; color: #13100D; text-decoration: none; font-size: 22px">←</a>
<div role="group" aria-label="Language" style="display: flex; background: #FFFFFF; border: 1px solid #E5DDD1; border-radius: 999px; padding: 3px; gap: 2px">
<sc-for list="{{langs}}" as="l" hint-placeholder-count="3">
<button onClick="{{l.pick}}" aria-pressed="{{l.on}}" style="height: 38px; padding: 0 10px; border-radius: 999px; border: none; background: {{l.bg}}; color: {{l.fg}}; font: 700 14px Mukta, sans-serif">{{l.label}}</button>
</sc-for>
</div>
</header>

<main style="padding: 4px 16px 20px; display: flex; flex-direction: column; gap: 16px">
<h1 style="margin: 0; font-family: 'Baloo 2', Mukta, sans-serif; font-size: 32px; line-height: 38px">{{t.welcome}}</h1>

<div role="tablist" style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); background: #F3EEE6; border-radius: 12px; padding: 4px">
<button role="tab" aria-selected="{{loginSel}}" onClick="{{toLogin}}" style="height: 44px; border-radius: 9px; border: none; background: {{loginBg}}; font: 700 16px Mukta, sans-serif; color: #13100D">{{t.login}}</button>
<button role="tab" aria-selected="{{signupSel}}" onClick="{{toSignup}}" style="height: 44px; border-radius: 9px; border: none; background: {{signupBg}}; font: 700 16px Mukta, sans-serif; color: #13100D">{{t.signup}}</button>
</div>

<a href="Search.dc.html" style="display: flex; align-items: center; justify-content: center; gap: 10px; height: 54px; border-radius: 10px; border: 2px solid #7C7062; background: #FFFFFF; color: #13100D; font-weight: 700; font-size: 17px; text-decoration: none">
<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="none" stroke="#223585" stroke-width="2.5"></circle><path d="M12 11 H19 M18 11 A6 6 0 1 1 15.5 7" fill="none" stroke="#223585" stroke-width="2.5"></path></svg>
{{t.google}}
</a>

<div style="display: flex; align-items: center; gap: 10px; color: #5E544A; font-size: 14px; font-weight: 700"><span style="flex: 1; height: 1px; background: #CFC4B4"></span>{{t.or}}<span style="flex: 1; height: 1px; background: #CFC4B4"></span></div>

<div style="display: flex; gap: 8px">
<button onClick="{{usePhone}}" style="flex: 1; height: 44px; border-radius: 999px; border: {{phoneBorder}}; background: {{phoneBg}}; font: 700 15px Mukta, sans-serif; color: #13100D">{{t.mobile}}</button>
<button onClick="{{useEmail}}" style="flex: 1; height: 44px; border-radius: 999px; border: {{emailBorder}}; background: {{emailBg}}; font: 700 15px Mukta, sans-serif; color: #13100D">{{t.email}}</button>
</div>

<sc-if value="{{signup}}" hint-placeholder-val="{{ false }}">
<div style="display: flex; flex-direction: column; gap: 6px">
<label for="nm" style="font-weight: 700; font-size: 16px">{{t.name}}</label>
<input id="nm" style="height: 52px; padding: 0 14px; border: 2px solid #7C7062; border-radius: 10px; font: 400 18px Mukta, sans-serif; box-sizing: border-box; background: #FFFFFF">
</div>
</sc-if>

<sc-if value="{{phone}}" hint-placeholder-val="{{ true }}">
<div style="display: flex; flex-direction: column; gap: 6px">
<label for="mob" style="font-weight: 700; font-size: 16px">{{t.mobile}}</label>
<div style="display: flex; gap: 8px">
<span style="height: 52px; padding: 0 12px; border: 2px solid #7C7062; border-radius: 10px; display: flex; align-items: center; font-size: 18px; background: #FFFFFF; box-sizing: border-box">+91</span>
<input id="mob" inputmode="numeric" placeholder="98765 43210" style="flex: 1; min-width: 0; height: 52px; padding: 0 14px; border: 2px solid #7C7062; border-radius: 10px; font: 400 18px Mukta, sans-serif; box-sizing: border-box; background: #FFFFFF">
</div>
<span style="font-size: 14px; color: #5E544A">{{t.otpHint}}</span>
</div>
</sc-if>

<sc-if value="{{email}}" hint-placeholder-val="{{ false }}">
<div style="display: flex; flex-direction: column; gap: 10px">
<div style="display: flex; flex-direction: column; gap: 6px">
<label for="em" style="font-weight: 700; font-size: 16px">{{t.emailAddr}}</label>
<input id="em" type="email" placeholder="you@example.com" style="height: 52px; padding: 0 14px; border: 2px solid #7C7062; border-radius: 10px; font: 400 18px Mukta, sans-serif; box-sizing: border-box; background: #FFFFFF">
</div>
<div style="display: flex; flex-direction: column; gap: 6px">
<label for="pw" style="font-weight: 700; font-size: 16px">{{t.password}}</label>
<input id="pw" type="password" style="height: 52px; padding: 0 14px; border: 2px solid #7C7062; border-radius: 10px; font: 400 18px Mukta, sans-serif; box-sizing: border-box; background: #FFFFFF">
</div>
</div>
</sc-if>

<sc-if value="{{signup}}" hint-placeholder-val="{{ false }}">
<div style="display: flex; flex-direction: column; gap: 8px">
<span style="font-weight: 700; font-size: 16px">{{t.iwant}}</span>
<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px">
<button onClick="{{asRenter}}" style="height: 56px; border-radius: 10px; border: {{renterBorder}}; background: {{renterBg}}; font: 700 15px Mukta, sans-serif; color: #13100D">{{t.rent}}</button>
<button onClick="{{asOwner}}" style="height: 56px; border-radius: 10px; border: {{ownerBorder}}; background: {{ownerBg}}; font: 700 15px Mukta, sans-serif; color: #13100D">{{t.own}}</button>
</div>
</div>
</sc-if>

<a href="{{next}}" style="display: flex; align-items: center; justify-content: center; height: 56px; border-radius: 10px; background: #223585; color: #FFFFFF; font-weight: 700; font-size: 18px; text-decoration: none">{{cta}}</a>
<p style="margin: 0; font-size: 14px; line-height: 20px; color: #5E544A; text-align: center">{{t.terms}}</p>
</main>
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":390,"height":844}}'>
class Component extends DCLogic {
  constructor(p) { super(p); this.state = { lang: 'en', mode: 'login', method: 'phone', role: 'renter' }; }
  renderVals() {
    const T = {
      en: { welcome: 'Welcome to KhetiRental', login: 'Log in', signup: 'Sign up', google: 'Continue with Google', or: 'OR', mobile: 'Mobile number', email: 'Email', emailAddr: 'Email address', password: 'Password', name: 'Full name', otpHint: "We'll send a 6-digit OTP by SMS.", sendOtp: 'Send OTP', doLogin: 'Log in', create: 'Create account', iwant: 'I want to', rent: 'Rent machines', own: 'List my machines', terms: 'By continuing you agree to the Terms and Privacy Policy.' },
      hi: { welcome: 'खेती रेंटल में स्वागत है', login: 'लॉग इन', signup: 'साइन अप', google: 'Google से जारी रखें', or: 'या', mobile: 'मोबाइल नंबर', email: 'ईमेल', emailAddr: 'ईमेल पता', password: 'पासवर्ड', name: 'पूरा नाम', otpHint: 'हम SMS से 6 अंकों का OTP भेजेंगे।', sendOtp: 'OTP भेजें', doLogin: 'लॉग इन करें', create: 'खाता बनाएँ', iwant: 'मुझे चाहिए', rent: 'मशीन किराए पर लेना', own: 'अपनी मशीन किराए पर देना', terms: 'आगे बढ़कर आप नियम और गोपनीयता नीति से सहमत होते हैं।' },
      mr: { welcome: 'खेती रेंटलमध्ये स्वागत आहे', login: 'लॉग इन', signup: 'साइन अप', google: 'Google ने पुढे चला', or: 'किंवा', mobile: 'मोबाइल नंबर', email: 'ईमेल', emailAddr: 'ईमेल पत्ता', password: 'पासवर्ड', name: 'पूर्ण नाव', otpHint: 'आम्ही SMS ने 6 अंकी OTP पाठवू.', sendOtp: 'OTP पाठवा', doLogin: 'लॉग इन करा', create: 'खाते तयार करा', iwant: 'मला हवे आहे', rent: 'यंत्रे भाड्याने घेणे', own: 'माझी यंत्रे भाड्याने देणे', terms: 'पुढे जाऊन तुम्ही अटी आणि गोपनीयता धोरणाला संमती देता.' }
    };
    const s = this.state, t = T[s.lang];
    const sel = (on) => on ? { b: '2px solid #223585', bg: '#FFD45C' } : { b: '2px solid #CFC4B4', bg: '#FFFFFF' };
    const ph = sel(s.method === 'phone'), em = sel(s.method === 'email');
    const rr = sel(s.role === 'renter'), ow = sel(s.role === 'owner');
    const signup = s.mode === 'signup';
    const langs = [['mr', 'मराठी'], ['hi', 'हिंदी'], ['en', 'English']].map(([id, label]) => ({
      label, on: s.lang === id ? 'true' : 'false',
      bg: s.lang === id ? '#223585' : '#FFFFFF', fg: s.lang === id ? '#FFFFFF' : '#13100D',
      pick: () => this.setState({ lang: id })
    }));
    return {
      lang: s.lang, langs, t, signup,
      phone: s.method === 'phone', email: s.method === 'email',
      loginSel: signup ? 'false' : 'true', signupSel: signup ? 'true' : 'false',
      loginBg: signup ? 'transparent' : '#FFFFFF', signupBg: signup ? '#FFFFFF' : 'transparent',
      phoneBorder: ph.b, phoneBg: ph.bg, emailBorder: em.b, emailBg: em.bg,
      renterBorder: rr.b, renterBg: rr.bg, ownerBorder: ow.b, ownerBg: ow.bg,
      cta: s.method === 'phone' ? t.sendOtp : (signup ? t.create : t.doLogin),
      next: signup && s.role === 'owner' ? 'ListMachine.dc.html' : 'Search.dc.html',
      toLogin: () => this.setState({ mode: 'login' }), toSignup: () => this.setState({ mode: 'signup' }),
      usePhone: () => this.setState({ method: 'phone' }), useEmail: () => this.setState({ method: 'email' }),
      asRenter: () => this.setState({ role: 'renter' }), asOwner: () => this.setState({ role: 'owner' })
    };
  }
}
</script>
</body>
</html>
````

### A.Search — `design/Search.dc.html`

````html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Search for a machine</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Mukta:wght@400;700&amp;display=swap">
<style>
body{margin:0}
a{color:#223585}a:hover{color:#1B2A66}
</style>
</helmet>
<div style="width: 390px; height: 844px; box-sizing: border-box; background: #FAF8F4; color: #13100D; font-family: Mukta, 'Noto Sans Devanagari', sans-serif; display: flex; flex-direction: column">
<header style="display: flex; align-items: center; justify-content: space-between; padding: 0 16px; height: 56px; background: #FFFFFF; border-bottom: 1px solid #E5DDD1">
<a href="Main.dc.html" style="font-weight: 700; font-size: 20px; color: #13100D; text-decoration: none">KhetiRental</a>
<button style="height: 40px; padding: 0 14px; border-radius: 999px; border: 2px solid #7C7062; background: #FFFFFF; font: 700 16px Mukta, sans-serif">हिंदी ▾</button>
</header>

<main style="flex: 1; padding: 20px 16px; display: flex; flex-direction: column; gap: 22px; overflow: hidden">
<div style="display: flex; flex-direction: column; gap: 10px">
<h1 style="margin: 0; font-size: 24px; line-height: 32px">What work?</h1>
<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px">
<sc-for list="{{jobs}}" as="j" hint-placeholder-count="6">
<button onClick="{{j.pick}}" style="height: 92px; border-radius: 10px; border: {{j.border}}; background: {{j.bg}}; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; font: 700 16px Mukta, sans-serif; color: #13100D">
<svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true"><circle cx="11" cy="21" r="7" fill="none" stroke="#13100D" stroke-width="2"></circle><circle cx="25" cy="24" r="4" fill="none" stroke="#13100D" stroke-width="2"></circle><path d="{{j.icon}}" fill="none" stroke="#13100D" stroke-width="2" stroke-linejoin="round"></path></svg>
{{j.label}}
</button>
</sc-for>
</div>
</div>

<div style="display: flex; flex-direction: column; gap: 8px">
<label for="where" style="font-weight: 700; font-size: 16px">Where is your farm?</label>
<div style="display: flex; gap: 8px">
<input id="where" value="413512 · Latur" style="flex: 1; min-width: 0; height: 52px; padding: 0 14px; border: 2px solid #7C7062; border-radius: 10px; font: 400 18px Mukta, sans-serif; box-sizing: border-box; background: #FFFFFF">
<button aria-label="Speak your village name" style="width: 52px; height: 52px; border-radius: 10px; border: 2px solid #7C7062; background: #FFFFFF; display: flex; align-items: center; justify-content: center">
<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" fill="none" stroke="#13100D" stroke-width="2"></rect><path d="M5 11a7 7 0 0 0 14 0M12 18v3" fill="none" stroke="#13100D" stroke-width="2"></path></svg>
</button>
</div>
<button style="height: 48px; border-radius: 10px; border: 2px solid #7C7062; background: #FFFFFF; font: 700 16px Mukta, sans-serif; color: #13100D">Use my phone's location</button>
</div>

<div style="display: flex; flex-direction: column; gap: 8px">
<p style="margin: 0; font-weight: 700; font-size: 16px">When?</p>
<div style="display: flex; gap: 8px">
<sc-for list="{{whens}}" as="w" hint-placeholder-count="3">
<button onClick="{{w.pick}}" style="flex: 1; height: 48px; border-radius: 999px; border: {{w.border}}; background: {{w.bg}}; font: 700 16px Mukta, sans-serif; color: #13100D">{{w.label}}</button>
</sc-for>
</div>
<p style="margin: 0; font-size: 16px; color: #483F37">Mon 2 Nov – Wed 4 Nov · 3 days</p>
</div>

<div style="display: flex; align-items: center; justify-content: space-between">
<span style="font-weight: 700; font-size: 16px">Field size <span style="font-weight: 400; color: #5E544A">(optional)</span></span>
<div style="display: flex; align-items: center; gap: 10px">
<button onClick="{{less}}" aria-label="Fewer acres" style="width: 48px; height: 48px; border-radius: 10px; border: 2px solid #7C7062; background: #FFFFFF; font: 700 22px Mukta, sans-serif">−</button>
<span style="min-width: 76px; text-align: center; font-size: 18px; font-weight: 700">{{acres}} acres</span>
<button onClick="{{more}}" aria-label="More acres" style="width: 48px; height: 48px; border-radius: 10px; border: 2px solid #7C7062; background: #FFFFFF; font: 700 22px Mukta, sans-serif">+</button>
</div>
</div>
</main>

<footer style="padding: 12px 16px 20px; background: #FFFFFF; box-shadow: 0 -2px 8px rgba(19,16,13,0.08)">
<a href="Results.dc.html" style="display: flex; align-items: center; justify-content: center; height: 56px; border-radius: 10px; background: #223585; color: #FFFFFF; font-weight: 700; font-size: 18px; text-decoration: none">Find machines</a>
</footer>
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":390,"height":844}}'>
class Component extends DCLogic {
  constructor(p) { super(p); this.state = { job: 'Rotavate', when: 'Pick dates', acres: 2.5 }; }
  renderVals() {
    const on = (sel) => sel ? { border: '2px solid #223585', bg: '#FFD45C' } : { border: '2px solid #CFC4B4', bg: '#FFFFFF' };
    const J = [
      ['Plough', 'M11 14 L15 8 H21 V20'], ['Rotavate', 'M11 14 L15 8 H21 V20 M2 26 H8'], ['Sow', 'M11 14 L15 8 H21 V20 M4 6 v4'],
      ['Spray', 'M11 14 L15 8 H21 V20 M26 4 l3 3'], ['Harvest', 'M4 10 H22 V20 M4 10 V16'], ['Transport', 'M3 12 H20 V20 M20 14 H27']
    ];
    const jobs = J.map(([label, icon]) => ({ label, icon, ...on(this.state.job === label), pick: () => this.setState({ job: label }) }));
    const whens = ['Tomorrow', 'This week', 'Pick dates'].map((label) => ({ label, ...on(this.state.when === label), pick: () => this.setState({ when: label }) }));
    return {
      jobs, whens, acres: this.state.acres,
      less: () => this.setState({ acres: Math.max(0.5, this.state.acres - 0.5) }),
      more: () => this.setState({ acres: this.state.acres + 0.5 })
    };
  }
}
</script>
</body>
</html>
````

### A.Results — `design/Results.dc.html`

````html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Machines near you</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Mukta:wght@400;700&amp;display=swap">
<style>
body{margin:0}
a{color:#223585}a:hover{color:#1B2A66}
</style>
</helmet>
<div style="width: 390px; height: 1180px; box-sizing: border-box; background: #FAF8F4; color: #13100D; font-family: Mukta, 'Noto Sans Devanagari', sans-serif; display: flex; flex-direction: column">
<header style="padding: 10px 16px 12px; background: #FFFFFF; border-bottom: 1px solid #E5DDD1; display: flex; flex-direction: column; gap: 10px">
<div style="display: flex; align-items: center; gap: 10px">
<a href="Search.dc.html" aria-label="Back to search" style="width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; color: #13100D; text-decoration: none; font-size: 22px">←</a>
<a href="Search.dc.html" style="flex: 1; min-width: 0; padding: 8px 12px; border: 2px solid #CFC4B4; border-radius: 10px; color: #13100D; text-decoration: none; font-size: 16px; line-height: 22px"><strong>Rotavate</strong> · 2–4 Nov · Latur · <span style="color: #223585; font-weight: 700">Change</span></a>
</div>
<div style="display: flex; gap: 8px">
<sc-for list="{{sorts}}" as="s" hint-placeholder-count="3">
<button onClick="{{s.pick}}" style="height: 44px; padding: 0 14px; border-radius: 999px; border: {{s.border}}; background: {{s.bg}}; font: 700 15px Mukta, sans-serif; color: #13100D">{{s.label}}</button>
</sc-for>
<button style="margin-left: auto; height: 44px; padding: 0 14px; border-radius: 999px; border: 2px solid #CFC4B4; background: #FFFFFF; font: 700 15px Mukta, sans-serif">Map</button>
</div>
<div style="display: flex; gap: 8px">
<button style="height: 36px; padding: 0 12px; border-radius: 999px; border: 2px solid #CFC4B4; background: #FFFFFF; font: 700 14px Mukta, sans-serif">10 km ▾</button>
<button style="height: 36px; padding: 0 12px; border-radius: 999px; border: 2px solid #CFC4B4; background: #FFFFFF; font: 700 14px Mukta, sans-serif">With driver</button>
</div>
</header>

<main style="padding: 14px 16px; display: flex; flex-direction: column; gap: 14px">
<p style="margin: 0; font-size: 16px; color: #483F37"><strong style="color: #13100D">5 free</strong> on your dates · showing nearest first</p>
<sc-for list="{{free}}" as="m" hint-placeholder-count="2">
<article style="background: #FFFFFF; border: 1px solid #E5DDD1; border-radius: 16px; overflow: hidden">
<div style="height: 120px; background: #E5DDD1; position: relative; display: flex; align-items: center; justify-content: center">
<svg width="120" height="70" viewBox="0 0 120 70" aria-hidden="true"><rect x="30" y="18" width="56" height="22" rx="4" fill="#7C7062"></rect><path d="M54 18 V4 H76 L80 18" fill="none" stroke="#483F37" stroke-width="3"></path><circle cx="44" cy="46" r="18" fill="#483F37"></circle><circle cx="90" cy="52" r="10" fill="#483F37"></circle></svg>
<span style="position: absolute; left: 10px; top: 10px; padding: 3px 10px; border-radius: 999px; background: #E7F4EA; color: #1E7B3C; font-weight: 700; font-size: 14px">● Free 2–4 Nov</span>
<span style="position: absolute; right: 10px; bottom: 8px; font-size: 12px; color: #483F37">[owner photo]</span>
</div>
<div style="padding: 12px 14px 14px; display: flex; flex-direction: column; gap: 4px">
<div style="display: flex; align-items: baseline; gap: 6px"><strong style="font-size: 28px; line-height: 34px">{{m.price}}</strong><span style="font-size: 16px; color: #483F37">{{m.unit}}</span></div>
<span style="font-size: 18px">{{m.name}}</span>
<span style="font-size: 16px; color: #483F37">{{m.where}}</span>
<span style="font-size: 16px; color: #483F37">{{m.trust}}</span>
<a href="Detail.dc.html" style="margin-top: 8px; display: flex; align-items: center; justify-content: center; height: 56px; border-radius: 10px; background: #223585; color: #FFFFFF; font-weight: 700; font-size: 18px; text-decoration: none">Book for 2–4 Nov</a>
</div>
</article>
</sc-for>
<div style="display: flex; align-items: center; gap: 10px; color: #5E544A; font-size: 14px; font-weight: 700"><span style="flex: 1; height: 1px; background: #CFC4B4"></span>BUSY ON YOUR DATES<span style="flex: 1; height: 1px; background: #CFC4B4"></span></div>
<div style="background: #F3EEE6; border-radius: 16px; padding: 14px; display: flex; justify-content: space-between; align-items: center; color: #483F37">
<div style="display: flex; flex-direction: column"><strong style="color: #13100D; font-size: 18px">Mahindra 575 DI</strong><span style="font-size: 16px">₹680 / hour · 2.1 km</span></div>
<span style="font-size: 14px; font-weight: 700">Free from 6 Nov</span>
</div>
<p style="margin: 6px 0 0; font-size: 16px; color: #483F37; text-align: center">Not finding one? <a href="Search.dc.html" style="font-weight: 700">Search up to 25 km</a> or <a href="tel:+911800000000" style="font-weight: 700">call us</a></p>
</main>
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":390,"height":1180}}'>
class Component extends DCLogic {
  constructor(p) { super(p); this.state = { sort: 'Nearest' }; }
  renderVals() {
    const sorts = ['Nearest', 'Cheapest', 'Top rated'].map((label) => ({
      label,
      border: this.state.sort === label ? '2px solid #223585' : '2px solid #CFC4B4',
      bg: this.state.sort === label ? '#FFD45C' : '#FFFFFF',
      pick: () => this.setState({ sort: label })
    }));
    let free = [
      { name: 'Swaraj 744 FE + rotavator · 48 HP', price: '₹710', p: 710, r: 4.6, unit: '/ hour · with driver', where: '3.5 km away · Muhana', trust: '★ 4.6 (23) · Ramesh K. · serviced Aug 2026' },
      { name: 'Sonalika DI 745 + rotavator · 50 HP', price: '₹1,400', p: 1400, r: 4.8, unit: '/ acre · with driver', where: '5.2 km away · Chakur', trust: '★ 4.8 (41) · Sunita P. · serviced Sep 2026' }
    ];
    if (this.state.sort === 'Cheapest') free = free.slice().sort((a, b) => a.p - b.p);
    if (this.state.sort === 'Top rated') free = free.slice().sort((a, b) => b.r - a.r);
    return { sorts, free };
  }
}
</script>
</body>
</html>
````

### A.Detail — `design/Detail.dc.html`

````html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Machine detail</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Mukta:wght@400;700&amp;display=swap">
<style>
body{margin:0}
a{color:#223585}a:hover{color:#1B2A66}
</style>
</helmet>
<div style="width: 390px; height: 1180px; box-sizing: border-box; background: #FAF8F4; color: #13100D; font-family: Mukta, 'Noto Sans Devanagari', sans-serif; display: flex; flex-direction: column">
<div style="height: 260px; background: #E5DDD1; position: relative; display: flex; align-items: center; justify-content: center">
<a href="Results.dc.html" aria-label="Back to results" style="position: absolute; left: 12px; top: 12px; width: 44px; height: 44px; border-radius: 22px; background: #FFFFFF; display: flex; align-items: center; justify-content: center; color: #13100D; text-decoration: none; font-size: 22px">←</a>
<svg width="200" height="120" viewBox="0 0 120 70" aria-hidden="true"><rect x="30" y="18" width="56" height="22" rx="4" fill="#7C7062"></rect><path d="M54 18 V4 H76 L80 18" fill="none" stroke="#483F37" stroke-width="3"></path><circle cx="44" cy="46" r="18" fill="#483F37"></circle><circle cx="90" cy="52" r="10" fill="#483F37"></circle></svg>
<span style="position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%); padding: 2px 10px; border-radius: 999px; background: rgba(19,16,13,0.7); color: #FFFFFF; font-size: 14px">1 / 3 · [owner photos]</span>
</div>

<main style="padding: 18px 16px; display: flex; flex-direction: column; gap: 18px">
<div style="display: flex; flex-direction: column; gap: 6px">
<h1 style="margin: 0; font-size: 30px; line-height: 38px">Swaraj 744 FE</h1>
<span style="font-size: 18px; color: #483F37">48 HP · 2019 · 2,340 engine hours</span>
<div style="display: flex; gap: 8px; flex-wrap: wrap">
<span style="padding: 4px 10px; border-radius: 999px; background: #EAEFFB; color: #223585; font-weight: 700; font-size: 14px">✔ RC checked</span>
<span style="padding: 4px 10px; border-radius: 999px; background: #F3EEE6; font-weight: 700; font-size: 14px">★ 4.6 (23 reviews)</span>
<span style="padding: 4px 10px; border-radius: 999px; background: #F3EEE6; font-weight: 700; font-size: 14px">Serviced Aug 2026</span>
</div>
</div>

<div style="background: #FFFFFF; border: 1px solid #E5DDD1; border-radius: 16px; padding: 16px; display: flex; flex-direction: column; gap: 8px">
<div style="display: flex; align-items: baseline; gap: 6px"><strong style="font-size: 28px">₹710</strong><span style="font-size: 16px; color: #483F37">/ hour</span><span style="margin-left: auto; font-size: 16px; color: #483F37">or ₹1,400 / acre</span></div>
<div style="display: flex; gap: 8px; flex-wrap: wrap">
<span style="padding: 4px 10px; border-radius: 999px; background: #E7F4EA; color: #1E7B3C; font-weight: 700; font-size: 14px">Driver included</span>
<span style="padding: 4px 10px; border-radius: 999px; background: #E7F4EA; color: #1E7B3C; font-weight: 700; font-size: 14px">Diesel included</span>
</div>
<span style="font-size: 16px">Comes with: <strong>Rotavator, Trolley</strong></span>
</div>

<div style="display: flex; flex-direction: column; gap: 8px">
<h2 style="margin: 0; font-size: 20px">Free days · next 14</h2>
<div style="display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px">
<sc-for list="{{days}}" as="d" hint-placeholder-count="14">
<div style="height: 44px; border-radius: 10px; background: {{d.bg}}; color: {{d.fg}}; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 14px; line-height: 16px; font-weight: 700">{{d.n}}<span style="font-weight: 400; font-size: 11px">{{d.w}}</span></div>
</sc-for>
</div>
<span style="font-size: 14px; color: #483F37">Green = free · grey = booked · yellow = your dates</span>
</div>

<div style="display: flex; gap: 12px; align-items: center">
<div style="width: 52px; height: 52px; border-radius: 26px; background: #CFC4B4; display: flex; align-items: center; justify-content: center; font-weight: 700">RK</div>
<div style="display: flex; flex-direction: column"><strong style="font-size: 18px">Ramesh K.</strong><span style="font-size: 16px; color: #483F37">Muhana · 3.5 km · on KhetiRental 3 years · replies in about 20 min</span></div>
</div>

<div style="display: flex; flex-direction: column; gap: 6px">
<h2 style="margin: 0; font-size: 20px">What farmers say</h2>
<p style="margin: 0; font-size: 16px; line-height: 24px; color: #332C26">“Came on time, rotavator in good shape.” <span style="color: #5E544A">— Sunil P., Oct 2026</span></p>
<a href="Detail.dc.html" style="font-weight: 700; font-size: 16px">See all 23 reviews</a>
</div>
</main>

<footer style="margin-top: auto; padding: 12px 16px 20px; background: #FFFFFF; box-shadow: 0 -2px 8px rgba(19,16,13,0.08); display: flex; align-items: center; gap: 12px">
<div style="display: flex; flex-direction: column"><strong style="font-size: 20px">₹2,840</strong><span style="font-size: 14px; color: #483F37">est. for 4 hours</span></div>
<a href="Booking.dc.html" style="flex: 1; display: flex; align-items: center; justify-content: center; height: 56px; border-radius: 10px; background: #223585; color: #FFFFFF; font-weight: 700; font-size: 18px; text-decoration: none">Book 2–4 Nov</a>
</footer>
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":390,"height":1180}}'>
class Component extends DCLogic {
  renderVals() {
    const W = ['Sa', 'Su', 'Mo', 'Tu', 'We', 'Th', 'Fr'];
    const busy = [3, 7, 8];
    const mine = [2, 3, 4];
    const days = Array.from({ length: 14 }, (_, i) => {
      const n = 31 + i > 31 ? i : 31;
      const day = i === 0 ? 31 : i;
      const isMine = mine.includes(day) && i > 0;
      const isBusy = busy.includes(day) && i > 0 && !isMine;
      return {
        n: String(day), w: W[i % 7],
        bg: isMine ? '#FFD45C' : isBusy ? '#E5DDD1' : '#E7F4EA',
        fg: isBusy ? '#5E544A' : '#13100D'
      };
    });
    return { days };
  }
}
</script>
</body>
</html>
````

### A.Booking — `design/Booking.dc.html`

````html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Book a machine</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Mukta:wght@400;700&amp;display=swap">
<style>
body{margin:0}
a{color:#223585}a:hover{color:#1B2A66}
</style>
</helmet>
<div style="width: 390px; height: 844px; box-sizing: border-box; background: rgba(19,16,13,0.6); color: #13100D; font-family: Mukta, 'Noto Sans Devanagari', sans-serif; display: flex; flex-direction: column; justify-content: flex-end">
<section role="dialog" aria-labelledby="bk-title" style="background: #FFFFFF; border-radius: 16px 16px 0 0; padding: 10px 16px 20px; display: flex; flex-direction: column; gap: 16px; box-shadow: 0 -8px 24px rgba(19,16,13,0.14)">
<div style="width: 44px; height: 5px; border-radius: 3px; background: #CFC4B4; align-self: center"></div>
<div style="display: flex; align-items: center; justify-content: space-between">
<div style="display: flex; flex-direction: column"><span style="font-size: 14px; color: #5E544A; font-weight: 700">STEP {{step}} OF 3</span><h2 id="bk-title" style="margin: 0; font-size: 24px">{{title}}</h2></div>
<a href="Detail.dc.html" aria-label="Close" style="width: 48px; height: 48px; border-radius: 24px; border: 2px solid #CFC4B4; display: flex; align-items: center; justify-content: center; color: #13100D; text-decoration: none; font-size: 20px">✕</a>
</div>
<div style="display: flex; gap: 6px"><sc-for list="{{dots}}" as="d" hint-placeholder-count="3"><span style="flex: 1; height: 6px; border-radius: 3px; background: {{d.c}}"></span></sc-for></div>

<sc-if value="{{s1}}" hint-placeholder-val="{{ false }}">
<div style="display: flex; flex-direction: column; gap: 14px">
<div style="padding: 14px; border: 2px solid #223585; background: #FFF4CC; border-radius: 10px; font-size: 18px"><strong>Mon 2 Nov – Wed 4 Nov</strong> · 3 days</div>
<div style="display: flex; gap: 8px">
<button style="flex: 1; height: 48px; border-radius: 999px; border: 2px solid #CFC4B4; background: #FFFFFF; font: 700 16px Mukta, sans-serif">Morning</button>
<button style="flex: 1; height: 48px; border-radius: 999px; border: 2px solid #223585; background: #FFD45C; font: 700 16px Mukta, sans-serif">Full day</button>
</div>
<span style="font-size: 16px; color: #483F37">Driver arrives at 7 am each day. You pay only for hours used.</span>
</div>
</sc-if>

<sc-if value="{{s2}}" hint-placeholder-val="{{ true }}">
<div style="display: flex; flex-direction: column; gap: 10px; font-size: 18px">
<div style="background: #FAF8F4; border-radius: 16px; padding: 16px; display: flex; flex-direction: column; gap: 10px">
<div style="display: flex; justify-content: space-between"><span>Rent: 4 h × ₹710</span><span>₹2,840</span></div>
<div style="display: flex; justify-content: space-between"><span>Diesel</span><span style="color: #1E7B3C; font-weight: 700">Included</span></div>
<div style="display: flex; justify-content: space-between"><span>Deposit <span style="font-size: 14px; color: #5E544A">(comes back after the job)</span></span><span>₹1,950</span></div>
<div style="display: flex; justify-content: space-between; border-top: 2px solid #13100D; padding-top: 10px; font-weight: 700; font-size: 22px"><span>Pay after work</span><span>₹2,840</span></div>
</div>
<button style="height: 48px; border-radius: 10px; border: 2px solid #7C7062; background: #FFFFFF; font: 700 16px Mukta, sans-serif; display: flex; align-items: center; justify-content: center; gap: 8px">
<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z M16 8a5 5 0 0 1 0 8" fill="none" stroke="#13100D" stroke-width="2"></path></svg>
Read this aloud</button>
</div>
</sc-if>

<sc-if value="{{s3}}" hint-placeholder-val="{{ false }}">
<div style="display: flex; flex-direction: column; gap: 12px">
<div role="radiogroup" aria-label="Payment method" style="display: flex; flex-direction: column; gap: 8px">
<sc-for list="{{pays}}" as="p" hint-placeholder-count="4">
<button role="radio" aria-checked="{{p.on}}" onClick="{{p.pick}}" style="min-height: 60px; padding: 8px 14px; border-radius: 10px; border: {{p.border}}; background: {{p.bg}}; display: flex; align-items: center; gap: 12px; text-align: left; font-family: Mukta, sans-serif; color: #13100D">
<span style="width: 22px; height: 22px; flex: none; border-radius: 11px; border: 2px solid #223585; background: {{p.dot}}"></span>
<span style="display: flex; flex-direction: column"><strong style="font-size: 17px">{{p.label}}</strong><span style="font-size: 14px; color: #483F37">{{p.hint}}</span></span>
</button>
</sc-for>
</div>
<div style="padding: 12px; border-radius: 10px; background: #EAEFFB; font-size: 15px; line-height: 22px">Demo payment screen: no real money moves. Free cancellation until Sun 1 Nov, 6 pm.</div>
</div>
</sc-if>

<sc-if value="{{notLast}}" hint-placeholder-val="{{ true }}">
<button onClick="{{next}}" style="height: 56px; border-radius: 10px; border: none; background: #223585; color: #FFFFFF; font: 700 18px Mukta, sans-serif">Next</button>
</sc-if>
<sc-if value="{{s3}}" hint-placeholder-val="{{ false }}">
<a href="Booked.dc.html" style="display: flex; align-items: center; justify-content: center; height: 56px; border-radius: 10px; background: #223585; color: #FFFFFF; font-weight: 700; font-size: 18px; text-decoration: none">{{payCta}}</a>
</sc-if>
<sc-if value="{{canBack}}" hint-placeholder-val="{{ true }}">
<button onClick="{{back}}" style="height: 44px; border: none; background: none; font: 700 16px Mukta, sans-serif; color: #223585">Back</button>
</sc-if>
</section>
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":390,"height":844}}'>
class Component extends DCLogic {
  constructor(p) { super(p); this.state = { step: 2, pay: 'upi' }; }
  renderVals() {
    const s = this.state.step;
    return {
      step: s,
      title: ['When do you need it?', 'Check the price', 'How do you want to pay?'][s - 1],
      dots: [1, 2, 3].map((i) => ({ c: i <= s ? '#223585' : '#E5DDD1' })),
      s1: s === 1, s2: s === 2, s3: s === 3, notLast: s < 3, canBack: s > 1,
      pays: [['upi', 'UPI', 'GPay, PhonePe, Paytm or any UPI app'], ['card', 'Debit / credit card', 'Visa, Mastercard, RuPay'], ['net', 'Net banking', 'All major banks'], ['cash', 'Pay after work', 'Cash or UPI to the owner when the job is done']].map(([id, label, hint]) => ({
        label, hint, on: this.state.pay === id ? 'true' : 'false',
        border: this.state.pay === id ? '2px solid #223585' : '2px solid #CFC4B4',
        bg: this.state.pay === id ? '#FFF4CC' : '#FFFFFF',
        dot: this.state.pay === id ? '#223585' : '#FFFFFF',
        pick: () => this.setState({ pay: id })
      })),
      payCta: this.state.pay === 'cash' ? 'Confirm booking' : 'Pay ₹2,840 and book',
      next: () => this.setState({ step: Math.min(3, s + 1) }),
      back: () => this.setState({ step: Math.max(1, s - 1) })
    };
  }
}
</script>
</body>
</html>
````

### A.Booked — `design/Booked.dc.html`

````html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>My bookings</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Mukta:wght@400;700&amp;display=swap">
<style>
body{margin:0}
a{color:#223585}a:hover{color:#1B2A66}
</style>
</helmet>
<div style="width: 390px; height: 844px; box-sizing: border-box; background: #FAF8F4; color: #13100D; font-family: Mukta, 'Noto Sans Devanagari', sans-serif; display: flex; flex-direction: column">
<header style="padding: 0 16px; height: 56px; display: flex; align-items: center; background: #FFFFFF; border-bottom: 1px solid #E5DDD1"><h1 style="margin: 0; font-size: 22px">My bookings</h1></header>

<div style="margin: 14px 16px 0; padding: 14px; border-radius: 16px; background: #E7F4EA; display: flex; gap: 12px; align-items: flex-start">
<div style="width: 36px; height: 36px; flex: none; border-radius: 18px; background: #1E7B3C; color: #FFFFFF; display: flex; align-items: center; justify-content: center; font-weight: 700">✓</div>
<div style="display: flex; flex-direction: column; font-size: 16px; line-height: 24px"><strong style="font-size: 18px">Request sent to Ramesh</strong><span>He usually replies in 20 minutes. We'll SMS and WhatsApp you.</span></div>
</div>

<div style="display: flex; gap: 8px; padding: 14px 16px 0">
<button style="height: 44px; padding: 0 16px; border-radius: 999px; border: 2px solid #223585; background: #FFD45C; font: 700 16px Mukta, sans-serif">Upcoming (2)</button>
<button style="height: 44px; padding: 0 16px; border-radius: 999px; border: 2px solid #CFC4B4; background: #FFFFFF; font: 700 16px Mukta, sans-serif">Past</button>
</div>

<main style="padding: 14px 16px; display: flex; flex-direction: column; gap: 12px">
<sc-for list="{{list}}" as="b" hint-placeholder-count="2">
<article style="background: #FFFFFF; border: 1px solid #E5DDD1; border-radius: 16px; padding: 14px; display: flex; flex-direction: column; gap: 6px">
<div style="display: flex; justify-content: space-between; align-items: center">
<span style="padding: 3px 10px; border-radius: 999px; background: {{b.chipBg}}; color: {{b.chipFg}}; font-weight: 700; font-size: 14px">{{b.status}}</span>
<span style="font-size: 16px; color: #483F37">Code <strong style="color: #13100D">{{b.code}}</strong></span>
</div>
<strong style="font-size: 18px">{{b.when}}</strong>
<span style="font-size: 16px; color: #483F37">{{b.what}}</span>
<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-top: 6px">
<a href="tel:+910000000000" style="height: 48px; border-radius: 10px; border: 2px solid #7C7062; display: flex; align-items: center; justify-content: center; color: #13100D; font-weight: 700; text-decoration: none">Call</a>
<a href="Booked.dc.html" style="height: 48px; border-radius: 10px; border: 2px solid #7C7062; display: flex; align-items: center; justify-content: center; color: #13100D; font-weight: 700; text-decoration: none">WhatsApp</a>
<a href="Booked.dc.html" style="height: 48px; border-radius: 10px; border: 2px solid #B42318; display: flex; align-items: center; justify-content: center; color: #B42318; font-weight: 700; text-decoration: none">Cancel</a>
</div>
<a href="Booked.dc.html" style="font-size: 16px; font-weight: 700; margin-top: 4px">Report a problem</a>
</article>
</sc-for>
</main>

<nav aria-label="Main" style="margin-top: auto; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); background: #FFFFFF; border-top: 1px solid #E5DDD1; height: 64px">
<a href="Search.dc.html" style="display: flex; align-items: center; justify-content: center; color: #483F37; font-weight: 700; text-decoration: none">Rent</a>
<a href="Booked.dc.html" aria-current="page" style="display: flex; align-items: center; justify-content: center; color: #223585; font-weight: 700; text-decoration: none; border-top: 3px solid #223585">My bookings</a>
<a href="tel:+911800000000" style="display: flex; align-items: center; justify-content: center; color: #483F37; font-weight: 700; text-decoration: none">Help</a>
</nav>
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":390,"height":844}}'>
class Component extends DCLogic {
  renderVals() {
    return {
      list: [
        { status: 'Waiting for owner', chipBg: '#FDEEE2', chipFg: '#B4500A', code: 'KR-4821', when: 'Mon 2 – Wed 4 Nov · from 7 am', what: 'Swaraj 744 FE + rotavator · Ramesh K.' },
        { status: 'Confirmed', chipBg: '#E7F4EA', chipFg: '#1E7B3C', code: 'KR-4790', when: 'Sat 14 Nov · morning', what: 'Trolley · Sunita P.' }
      ]
    };
  }
}
</script>
</body>
</html>
````

### A.ListMachine — `design/ListMachine.dc.html`

````html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>List your machine: price</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Mukta:wght@400;700&amp;display=swap">
<style>
body{margin:0}
a{color:#223585}a:hover{color:#1B2A66}
</style>
</helmet>
<div style="width: 390px; height: 844px; box-sizing: border-box; background: #FAF8F4; color: #13100D; font-family: Mukta, 'Noto Sans Devanagari', sans-serif; display: flex; flex-direction: column">
<header style="padding: 10px 16px; background: #FFFFFF; border-bottom: 1px solid #E5DDD1; display: flex; flex-direction: column; gap: 8px">
<div style="display: flex; align-items: center; gap: 8px">
<a href="Main.dc.html" aria-label="Back" style="width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; color: #13100D; text-decoration: none; font-size: 22px">←</a>
<div style="display: flex; flex-direction: column"><span style="font-size: 14px; font-weight: 700; color: #5E544A">STEP 4 OF 4</span><strong style="font-size: 20px">Set your price</strong></div>
</div>
<div style="display: flex; gap: 6px"><span style="flex: 1; height: 6px; border-radius: 3px; background: #223585"></span><span style="flex: 1; height: 6px; border-radius: 3px; background: #223585"></span><span style="flex: 1; height: 6px; border-radius: 3px; background: #223585"></span><span style="flex: 1; height: 6px; border-radius: 3px; background: #223585"></span></div>
</header>

<main style="padding: 18px 16px; display: flex; flex-direction: column; gap: 18px">
<div style="display: flex; gap: 12px; align-items: center; padding: 12px; background: #FFFFFF; border: 1px solid #E5DDD1; border-radius: 16px">
<div style="width: 64px; height: 64px; border-radius: 10px; background: #E5DDD1; display: flex; align-items: center; justify-content: center; font-size: 12px; color: #483F37">[photo]</div>
<div style="display: flex; flex-direction: column"><strong style="font-size: 18px">Swaraj 744 FE · 48 HP</strong><span style="font-size: 16px; color: #483F37">Muhana · with rotavator, trolley</span></div>
</div>

<div style="display: flex; flex-direction: column; gap: 8px">
<p style="margin: 0; font-weight: 700; font-size: 16px">How do you charge?</p>
<div style="display: flex; gap: 8px">
<sc-for list="{{units}}" as="u" hint-placeholder-count="3">
<button onClick="{{u.pick}}" style="flex: 1; height: 48px; border-radius: 999px; border: {{u.border}}; background: {{u.bg}}; font: 700 16px Mukta, sans-serif; color: #13100D">{{u.label}}</button>
</sc-for>
</div>
</div>

<div style="display: flex; flex-direction: column; gap: 8px">
<label for="price" style="font-weight: 700; font-size: 16px">Your price {{per}}</label>
<div style="display: flex; align-items: center; border: 2px solid #7C7062; border-radius: 10px; background: #FFFFFF; height: 56px; padding: 0 14px">
<span style="font-size: 22px; font-weight: 700; color: #483F37">₹</span>
<input id="price" value="{{price}}" style="flex: 1; min-width: 0; border: none; outline: none; font: 700 22px Mukta, sans-serif; padding-left: 6px; background: transparent">
</div>
<div style="padding: 12px; border-radius: 10px; background: #FFF4CC; font-size: 16px; line-height: 24px">Similar machines near you charge <strong>{{range}}</strong>.</div>
</div>

<div style="background: #FFFFFF; border: 1px solid #E5DDD1; border-radius: 16px; padding: 16px; display: flex; flex-direction: column; gap: 8px; font-size: 18px">
<div style="display: flex; justify-content: space-between"><span>Farmer pays</span><span>₹{{price}}</span></div>
<div style="display: flex; justify-content: space-between; color: #483F37"><span>Our fee (13.5 %)</span><span>− ₹{{fee}}</span></div>
<div style="display: flex; justify-content: space-between; border-top: 2px solid #13100D; padding-top: 8px; font-weight: 700; font-size: 22px"><span>You keep</span><span style="color: #1E7B3C">₹{{keep}}</span></div>
</div>

<label style="display: flex; align-items: center; gap: 12px; min-height: 48px; font-size: 18px">
<input type="checkbox" checked style="width: 24px; height: 24px; accent-color: #223585">
I will drive it (operator included)
</label>
</main>

<footer style="margin-top: auto; padding: 12px 16px 20px; background: #FFFFFF; box-shadow: 0 -2px 8px rgba(19,16,13,0.08)">
<a href="Owner.dc.html" style="display: flex; align-items: center; justify-content: center; height: 56px; border-radius: 10px; background: #223585; color: #FFFFFF; font-weight: 700; font-size: 18px; text-decoration: none">Publish my tractor</a>
</footer>
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":390,"height":844}}'>
class Component extends DCLogic {
  constructor(p) { super(p); this.state = { unit: 'Per acre' }; }
  renderVals() {
    const P = { 'Per hour': [710, '/ hour', '₹600–₹850 an hour'], 'Per acre': [1400, '/ acre', '₹1,200–₹1,600 an acre'], 'Per day': [5200, '/ day', '₹4,500–₹6,000 a day'] };
    const [price, per, range] = P[this.state.unit];
    const fee = Math.round(price * 0.135);
    const fmt = (n) => n.toLocaleString('en-IN');
    const units = Object.keys(P).map((label) => ({
      label,
      border: this.state.unit === label ? '2px solid #223585' : '2px solid #CFC4B4',
      bg: this.state.unit === label ? '#FFD45C' : '#FFFFFF',
      pick: () => this.setState({ unit: label })
    }));
    return { units, price: fmt(price), per, range, fee: fmt(fee), keep: fmt(price - fee) };
  }
}
</script>
</body>
</html>
````

### A.Owner — `design/Owner.dc.html`

````html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Owner dashboard</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Mukta:wght@400;700&amp;display=swap">
<style>
body{margin:0}
a{color:#223585}a:hover{color:#1B2A66}
</style>
</helmet>
<div style="width: 390px; height: 1000px; box-sizing: border-box; background: #FAF8F4; color: #13100D; font-family: Mukta, 'Noto Sans Devanagari', sans-serif; display: flex; flex-direction: column">
<header style="padding: 16px; background: #223585; color: #FFFFFF; display: flex; flex-direction: column; gap: 12px">
<div style="display: flex; justify-content: space-between; align-items: center"><strong style="font-size: 22px">Namaste, Ramesh</strong><button style="height: 40px; padding: 0 14px; border-radius: 999px; border: 2px solid #8DA2E3; background: transparent; color: #FFFFFF; font: 700 16px Mukta, sans-serif">हिंदी ▾</button></div>
<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px">
<div style="display: flex; flex-direction: column; padding: 10px; border-radius: 10px; background: #1B2A66"><span style="font-size: 14px; color: #DCE3F7">This month</span><strong style="font-size: 22px">₹18,400</strong></div>
<div style="display: flex; flex-direction: column; padding: 10px; border-radius: 10px; background: #1B2A66"><span style="font-size: 14px; color: #DCE3F7">Paid to you</span><strong style="font-size: 22px">₹12,000</strong></div>
<div style="display: flex; flex-direction: column; padding: 10px; border-radius: 10px; background: #1B2A66"><span style="font-size: 14px; color: #DCE3F7">Coming</span><strong style="font-size: 22px; color: #FFD45C">₹6,400</strong></div>
</div>
</header>

<main style="padding: 16px; display: flex; flex-direction: column; gap: 18px">
<section style="display: flex; flex-direction: column; gap: 10px">
<h2 style="margin: 0; font-size: 22px">New requests ({{count}})</h2>
<sc-if value="{{none}}" hint-placeholder-val="{{ false }}"><p style="margin: 0; font-size: 18px; color: #483F37">No new requests. We'll SMS you when one comes.</p></sc-if>
<sc-for list="{{reqs}}" as="r" hint-placeholder-count="2">
<article style="background: #FFFFFF; border: 2px solid #FBC02D; border-radius: 16px; padding: 14px; display: flex; flex-direction: column; gap: 6px">
<div style="display: flex; justify-content: space-between"><strong style="font-size: 18px">{{r.who}}</strong><span style="font-size: 14px; font-weight: 700; color: #B4500A">Reply in {{r.left}}</span></div>
<span style="font-size: 16px; color: #483F37">{{r.what}}</span>
<strong style="font-size: 22px">{{r.amount}}</strong>
<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-top: 4px">
<button onClick="{{r.accept}}" style="height: 52px; border-radius: 10px; border: none; background: #1E7B3C; color: #FFFFFF; font: 700 18px Mukta, sans-serif">Accept</button>
<button onClick="{{r.decline}}" style="height: 52px; border-radius: 10px; border: 2px solid #7C7062; background: #FFFFFF; font: 700 18px Mukta, sans-serif; color: #13100D">Decline</button>
</div>
</article>
</sc-for>
</section>

<section style="display: flex; flex-direction: column; gap: 10px">
<div style="display: flex; justify-content: space-between; align-items: center"><h2 style="margin: 0; font-size: 22px">November</h2><span style="font-size: 14px; color: #483F37">Tap a day to block it</span></div>
<div style="display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px">
<sc-for list="{{cal}}" as="c" hint-placeholder-count="21">
<button style="height: 40px; border-radius: 8px; border: none; background: {{c.bg}}; color: {{c.fg}}; font: 700 14px Mukta, sans-serif">{{c.n}}</button>
</sc-for>
</div>
<div style="display: flex; gap: 14px; font-size: 14px; color: #483F37"><span>■ <span style="color: #223585">Booked</span></span><span>■ <span style="color: #1E7B3C">Free</span></span><span>■ Blocked</span></div>
</section>

<section style="display: flex; flex-direction: column; gap: 10px">
<div style="display: flex; justify-content: space-between; align-items: center"><h2 style="margin: 0; font-size: 22px">My machines (2)</h2><a href="ListMachine.dc.html" style="font-weight: 700; font-size: 16px">+ Add</a></div>
<div style="background: #FFFFFF; border: 1px solid #E5DDD1; border-radius: 16px; padding: 12px; display: flex; justify-content: space-between; align-items: center">
<div style="display: flex; flex-direction: column"><strong style="font-size: 18px">Swaraj 744 FE</strong><span style="font-size: 16px; color: #483F37">₹1,400 / acre · live</span></div>
<button style="height: 44px; padding: 0 14px; border-radius: 10px; border: 2px solid #7C7062; background: #FFFFFF; font: 700 16px Mukta, sans-serif">Edit</button>
</div>
</section>
</main>
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":390,"height":1000}}'>
class Component extends DCLogic {
  constructor(p) { super(p); this.state = { done: [] }; }
  renderVals() {
    const all = [
      { id: 'a', who: 'Sunil P. · 2.5 acres · 4 km', what: 'Mon 2 – Wed 4 Nov · rotavating', amount: '₹2,840', left: '1 h 40 m' },
      { id: 'b', who: 'Asha M. · 6 acres · 7 km', what: 'Sat 7 Nov · ploughing', amount: '₹8,400', left: '55 m' }
    ];
    const reqs = all.filter((r) => !this.state.done.includes(r.id)).map((r) => ({
      ...r,
      accept: () => this.setState({ done: [...this.state.done, r.id] }),
      decline: () => this.setState({ done: [...this.state.done, r.id] })
    }));
    const booked = [2, 3, 4, 14], blocked = [8, 15];
    const cal = Array.from({ length: 21 }, (_, i) => {
      const n = i + 1;
      const b = booked.includes(n), k = blocked.includes(n);
      return { n: String(n), bg: b ? '#223585' : k ? '#CFC4B4' : '#E7F4EA', fg: b ? '#FFFFFF' : '#13100D' };
    });
    return { reqs, count: reqs.length, none: reqs.length === 0, cal };
  }
}
</script>
</body>
</html>
````

### A.canvas — `design/canvas.json`

````json
{"v":3,"createdOnFiles":{"v":1,"at":"2026-10-24T07:35:00Z"},"title":"KhetiRental redesign","launch":{"view":"canvas"},"pages":[],
"boards":{
"Main.dc.html":{"x":0,"y":0,"w":390,"h":3120,"title":"0 · Welcome (live field) + story","is_interactive":true},
"Login.dc.html":{"x":470,"y":0,"w":390,"h":844,"title":"0b · Log in / Sign up","is_interactive":true},
"Search.dc.html":{"x":940,"y":0,"w":390,"h":844,"title":"1 · Search","is_interactive":true},
"Results.dc.html":{"x":1410,"y":0,"w":390,"h":1180,"title":"2 · Results","is_interactive":true},
"Detail.dc.html":{"x":1880,"y":0,"w":390,"h":1180,"title":"3 · Machine detail","is_interactive":true},
"Booking.dc.html":{"x":2350,"y":0,"w":390,"h":844,"title":"4 · Booking (3 steps + payment)","is_interactive":true},
"Booked.dc.html":{"x":2820,"y":0,"w":390,"h":844,"title":"5 · My bookings","is_interactive":true},
"ListMachine.dc.html":{"x":940,"y":1600,"w":390,"h":844,"title":"Owner · List machine (price step)","is_interactive":true},
"Owner.dc.html":{"x":1410,"y":1600,"w":390,"h":1000,"title":"Owner · Dashboard","is_interactive":true}
},
"order":["Main.dc.html","Login.dc.html","Search.dc.html","Results.dc.html","Detail.dc.html","Booking.dc.html","Booked.dc.html","ListMachine.dc.html","Owner.dc.html"],
"notes":{
"t0":{"x":0,"y":-300,"text":"Start: welcome → log in","kind":"title1","maxW":860},
"t1":{"x":940,"y":-300,"text":"Farmer app: search → results → detail → book → my bookings","kind":"title1","maxW":2270},
"t2":{"x":940,"y":1300,"text":"Owner app","kind":"title1","maxW":860},
"s0":{"x":-420,"y":0,"w":360,"text":"Live background: the tractor drives across the field, wheels turn, the ploughed strip grows behind it, clouds drift, crops sway. Open Tweaks on this artboard to change tractor speed, time of day (morning / noon / evening) and turn the tractor off. Phones with reduced motion get a still scene.","fill":"yellow","size":"s"},
"s1":{"x":-420,"y":900,"w":360,"text":"Story below the hero: each section fades up as it scrolls in, the year strip fills, the ₹6.4 lakh bar shrinks. Desktop and fast phones also get the rotating 3D tractor in the 'buy vs rent' scene.","fill":"orange","size":"s"},
"s2":{"x":-420,"y":1500,"w":360,"text":"The मराठी / हिंदी / English switch at the top works: it changes the headline, intro, buttons and section titles.","fill":"blue","size":"s"}
},
"designSystems":[]}
````
