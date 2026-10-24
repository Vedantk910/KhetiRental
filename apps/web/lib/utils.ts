import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Teach tailwind-merge the Mitti scale names, or it reads `text-label` as a colour and drops it.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        { text: ["caption", "small", "label", "body", "h4", "h3", "h2", "h1", "price", "display"] },
      ],
      shadow: [{ shadow: ["sheet", "raised"] }],
      rounded: [{ rounded: ["control", "card", "pill"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
