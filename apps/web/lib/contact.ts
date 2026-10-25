import { config } from "@/config/site";

/** `tel:` link for the helpline. */
export const helplineHref = (phone: string = config.helplinePhone) => `tel:${phone.replace(/[^+\d]/g, "")}`;

/** `wa.me` link for WhatsApp support. */
export const whatsappHref = (phone: string = config.whatsappPhone) =>
  `https://wa.me/${phone.replace(/\D/g, "")}`;
