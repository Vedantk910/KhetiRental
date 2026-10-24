// In-app notifications (D-11) plus the log mock.
import { getSql } from "./db";
import { logNotification } from "./mocks/notify";
import type { SessionUser } from "./session";

export type NotificationType =
  | "booking_requested"
  | "booking_accepted"
  | "booking_declined"
  | "booking_expired"
  | "booking_cancelled"
  | "payment_recorded"
  | "problem_reported";

export async function notify(userId: string, type: NotificationType, bookingId: string | null = null) {
  await getSql()`INSERT INTO notifications (user_id, type, booking_id) VALUES (${userId}, ${type}, ${bookingId})`;
  logNotification(userId, type, bookingId ?? "");
}

export async function listNotifications(u: SessionUser) {
  const sql = getSql();
  const items = await sql<
    { id: string; type: string; bookingId: string | null; readAt: Date | null; createdAt: Date }[]
  >`
    SELECT id, type, booking_id AS "bookingId", read_at AS "readAt", created_at AS "createdAt"
    FROM notifications WHERE user_id = ${u.id} ORDER BY created_at DESC, id LIMIT 100`;
  const [{ unread }] = await sql<{ unread: number }[]>`
    SELECT count(*)::int AS unread FROM notifications WHERE user_id = ${u.id} AND read_at IS NULL`;
  return { items, unread };
}

export async function markRead(u: SessionUser, input: { ids?: string[]; all?: true }) {
  const sql = getSql();
  const rows = input.all
    ? await sql`UPDATE notifications SET read_at = now() WHERE user_id = ${u.id} AND read_at IS NULL RETURNING id`
    : await sql`UPDATE notifications SET read_at = now()
                WHERE user_id = ${u.id} AND id = ANY(${input.ids ?? []}::uuid[]) AND read_at IS NULL RETURNING id`;
  return { marked: rows.length };
}
