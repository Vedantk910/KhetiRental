/**
 * The inline <head> script that sets `data-motion` on <html> before first paint (UI-SPEC §4.1.5, REVIEW Phase 3 §2).
 * none = reduced motion; rich = capable device on a fast link; lite = everything else. Re-runs when the setting or
 * the connection changes. It is a string so the tests can run the very code that ships.
 */
export const MOTION_SCRIPT = `try{var d=document.documentElement,q=matchMedia("(prefers-reduced-motion: reduce)"),c=navigator.connection;function s(){var m=q.matches,x=navigator.deviceMemory,h=navigator.hardwareConcurrency,r=!m&&!(c&&(c.saveData||/2g|3g/.test(c.effectiveType)))&&(x==null?4:x)>=4&&(h==null?4:h)>=6;d.dataset.motion=m?"none":r?"rich":"lite"}s();q.addEventListener("change",s);c&&c.addEventListener&&c.addEventListener("change",s)}catch(e){document.documentElement.dataset.motion="lite"}`;

export type Motion = "rich" | "lite" | "none";
