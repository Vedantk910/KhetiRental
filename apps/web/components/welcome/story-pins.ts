import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/** Marker the network test looks for in the lazy chunk. */
export const CHUNK = "kr-story-pins";

const SCROLL = { s1: 0.9, s2: 1.6, s5: 1.0 } as const; // pinned scroll length, in viewport heights
const REBUILD_MS = 250;

function build(root: HTMLElement) {
  const vh = window.innerHeight;
  const grey = `rgb(${getComputedStyle(root).getPropertyValue("--n-200").trim().replace(/\s+/g, ",")})`;
  const marked: HTMLElement[] = [];
  const ctx = gsap.context(() => {
    root.querySelectorAll<HTMLElement>("[data-pin]").forEach((sec) => {
      const id = sec.dataset.pin as keyof typeof SCROLL;
      // Pin only when the section fits the screen, or its lower half would be unreachable.
      const pin = sec.offsetHeight <= vh;
      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: sec,
          start: pin ? "top top" : "top 85%",
          end: pin ? `+=${vh * SCROLL[id]}` : "top 30%",
          pin,
          scrub: 0.4,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
      });
      if (pin) {
        sec.setAttribute("data-pinned", "");
        marked.push(sec);
      }
      const q = (s: string) => sec.querySelectorAll<HTMLElement>(s);
      if (id === "s1") tl.from(q(".kr-fill"), { backgroundColor: grey, stagger: 0.1, duration: 0.1 });
      if (id === "s2") {
        tl.fromTo(q(".kr-shrink"), { scaleX: 1 }, { scaleX: 0.12, duration: 0.4 }, 0)
          .fromTo(q(".kr-grow"), { scaleX: 0 }, { scaleX: 1, duration: 0.3 }, 0.1)
          .fromTo(q("[data-tractor-slot]"), { "--kr-p": 0 }, { "--kr-p": 1, duration: 1 }, 0);
      }
      if (id === "s5") tl.from(q(".kr-stamp"), { opacity: 0, scale: 1.15, stagger: 0.3, duration: 0.3 });
    });
  }, root);
  return {
    revert() {
      ctx.revert();
      marked.forEach((s) => {
        s.removeAttribute("data-pinned");
      });
    },
  };
}

/**
 * Pin spacers add whole screens of height above the reader. Run `change`, then scroll by however far the section at the
 * top of the screen moved, so building or removing pins never throws someone off the part they are reading.
 */
function keepPlace(change: () => void) {
  const sections = [...document.querySelectorAll<HTMLElement>("main section")];
  const anchor = sections.find((s) => s.getBoundingClientRect().bottom > 1);
  const before = anchor?.getBoundingClientRect().top ?? 0;
  change();
  ScrollTrigger.refresh();
  const moved = (anchor?.getBoundingClientRect().top ?? 0) - before;
  if (Math.abs(moved) > 1) window.scrollTo({ top: window.scrollY + moved, behavior: "instant" });
}

/** Pins S1, S2 and S5 with scroll-scrubbed timelines. Returns a function that puts everything back. */
export function startPins(): () => void {
  gsap.registerPlugin(ScrollTrigger);
  const root = document.getElementById("story");
  if (!root) return () => undefined;
  const html = document.documentElement;
  html.setAttribute("data-pins", CHUNK); // switches the CSS reveals off for the pinned sections
  let current!: ReturnType<typeof build>;
  keepPlace(() => {
    current = build(root);
  });
  let timer: ReturnType<typeof setTimeout>;
  let size = `${window.innerWidth}x${window.innerHeight}`;
  const onResize = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const now = `${window.innerWidth}x${window.innerHeight}`;
      if (now === size) return;
      size = now;
      keepPlace(() => {
        current.revert();
        current = build(root);
      });
    }, REBUILD_MS);
  };
  window.addEventListener("resize", onResize);
  void document.fonts.ready.then(() => {
    ScrollTrigger.refresh();
  });
  return () => {
    clearTimeout(timer);
    window.removeEventListener("resize", onResize);
    keepPlace(() => {
      current.revert();
      html.removeAttribute("data-pins");
    });
  };
}
