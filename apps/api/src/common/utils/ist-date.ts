const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/**
 * Parses a plain "YYYY-MM-DD" string as an IST calendar date, not UTC midnight.
 * The API can run anywhere (Render is UTC), but this is always an Indian clinic —
 * without this, "today" drifts by hours around midnight IST depending on where
 * the server happens to be deployed. See Info guide 2.7 "date and timezone handling".
 */
export function parseIstDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00+05:30`);
}

/** IST midnight-to-midnight bounds for the given instant (defaults to now), regardless of server timezone. */
export function istDayBounds(reference: Date = new Date()): { start: Date; end: Date } {
  const istNow = new Date(reference.getTime() + IST_OFFSET_MS);
  const isoDate = istNow.toISOString().slice(0, 10);
  const start = parseIstDate(isoDate);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
  return { start, end };
}
