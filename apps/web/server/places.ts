// PIN code and village autocomplete (UI-SPEC §4.4), and "Near you" (nearest PIN centroid to a GPS fix).
import { getSql, one } from "./db";

export interface Place {
  pin: string;
  village: string;
  district: string;
  state: string;
  lat: number;
  lng: number;
  label: string;
}

type Row = Omit<Place, "label">;
const withLabel = (r: Row): Place => ({ ...r, label: `${r.pin} · ${r.village}, ${r.state}` });
const COLS = `pin, village, district, state, ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng`;
/** Escapes LIKE wildcards so "%" and "_" mean themselves. */
const like = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/** 3+ digits match a PIN prefix; 2+ other characters match a village or post-office name prefix. */
export async function suggestPlaces(q: string): Promise<Place[]> {
  const sql = getSql();
  const text = q.trim();
  const isPin = /^\d+$/.test(text);
  if (isPin ? text.length < 3 : text.length < 2) return [];
  const rows = isPin
    ? await sql.unsafe<Row[]>(
        `SELECT DISTINCT ON (pin) ${COLS} FROM pin_codes WHERE pin LIKE $1 ESCAPE '\\' ORDER BY pin, office LIMIT 8`,
        [`${like(text)}%`],
      )
    : await sql.unsafe<Row[]>(
        `SELECT * FROM (SELECT DISTINCT ON (pin) ${COLS} FROM pin_codes
           WHERE lower(village) LIKE lower($1) ESCAPE '\\' OR lower(office) LIKE lower($1) ESCAPE '\\'
           ORDER BY pin, office) s ORDER BY village, pin LIMIT 8`,
        [`${like(text)}%`],
      );
  return rows.map(withLabel);
}

export async function nearestPlace(lat: number, lng: number): Promise<Place | null> {
  const r = one(
    await getSql()<Row[]>`
    SELECT pin, village, district, state, ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng
    FROM pin_codes ORDER BY location <-> ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography LIMIT 1`,
  );
  return r ? withLabel(r) : null;
}
