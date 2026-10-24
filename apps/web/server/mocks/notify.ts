// Notifications mock (D-11): the in-app row is the real channel; this is the "log" half.
import { mocksMayLog } from "./flags";

export function logNotification(userId: string, type: string, detail = "") {
  if (mocksMayLog()) console.info(`[notify-mock] user ${userId}: ${type} ${detail}`.trim());
  else console.info(`[notify-mock] user ${userId}: ${type}`);
}
