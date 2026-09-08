import { z } from 'zod';

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Widest gap between the lifter's local calendar day and the server's UTC day
// (UTC-12 .. UTC+14 spans two days either side once the clock skew is counted).
const MAX_DAY_DRIFT_MS = 2 * 24 * 60 * 60 * 1000;

// The client sends its own local day so the tip rolls over at the lifter's
// midnight, not the server's. It must be a real date close to now, so a stale
// or forged value cannot fill the table with arbitrary keys.
export const dailyTipDaySchema = z
  .string()
  .regex(DAY_PATTERN, 'day must be YYYY-MM-DD')
  .refine((day) => {
    const parsed = Date.parse(`${day}T00:00:00Z`);
    if (Number.isNaN(parsed)) return false;
    // Round-trip guards against 2026-02-31 style values Date.parse accepts.
    if (new Date(parsed).toISOString().slice(0, 10) !== day) return false;
    return Math.abs(parsed - Date.now()) <= MAX_DAY_DRIFT_MS;
  }, 'day must be within two days of today');

export const dailyTipQuerySchema = z.object({
  day: dailyTipDaySchema,
});
