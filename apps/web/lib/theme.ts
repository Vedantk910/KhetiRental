export const THEME_KEY = "kr:theme";
export type ThemeChoice = "system" | "light" | "dark";

/** Inline in <head>: applies the saved choice before first paint. No saved choice means the phone's setting. */
export const THEME_SCRIPT = `try{var v=localStorage.getItem("${THEME_KEY}");if(v==="light"||v==="dark")document.documentElement.dataset.theme=v}catch(e){}`;
