export function formatScheduled(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

export function updateRtmpRow(
  rows: { url: string; key: string }[],
  setRows: (r: { url: string; key: string }[]) => void,
  index: number,
  patch: Partial<{ url: string; key: string }>,
) {
  setRows(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
}

/** Parse HH:MM:SS to seconds. Returns null if invalid. */
export function parseHms(hms: string): number | null {
  const m = /^(\d{1,2}):(\d{2}):(\d{2})$/.exec(hms.trim());
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const s = parseInt(m[3], 10);
  if (min > 59 || s > 59) return null;
  return h * 3600 + min * 60 + s;
}

/** Inverse of parseHms — formats seconds as HH:MM:SS. */
export function formatHms(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/** Validate HH:MM:SS format and range (30s - 43200s). Returns error message or null. */
export function validateHms(hms: string): string | null {
  const seconds = parseHms(hms);
  if (seconds == null) return 'Use HH:MM:SS format (e.g. 12:00:00)';
  if (seconds < 30) return 'Minimum DVR window is 30 seconds';
  if (seconds > 43200) return 'Maximum DVR window is 12 hours (43200 seconds)';
  return null;
}
