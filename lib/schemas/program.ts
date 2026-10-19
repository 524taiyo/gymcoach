import { z } from 'zod';

// Block schedule bounds (lib/program-weeks.ts). A year-long block is the cap;
// sessions between 15 min and 4 h cover any realistic time budget.
export const MAX_PROGRAM_WEEKS = 52;
export const MIN_SESSION_BUDGET_MIN = 15;
export const MAX_SESSION_BUDGET_MIN = 240;

// Optional block schedule shared by manual programs and generated/template
// programs. Every field is optional so existing clients keep working.
export const programScheduleFields = {
  durationWeeks: z.number().int().min(1).max(MAX_PROGRAM_WEEKS).nullish(),
  deloadWeeks: z
    .array(z.number().int().min(1).max(MAX_PROGRAM_WEEKS))
    .max(MAX_PROGRAM_WEEKS)
    .optional(),
  sessionBudgetMin: z
    .number()
    .int()
    .min(MIN_SESSION_BUDGET_MIN)
    .max(MAX_SESSION_BUDGET_MIN)
    .nullish(),
};

// Deload weeks must fall inside the planned block and are stored sorted and
// de-duplicated.
export function refineProgramSchedule(
  value: { durationWeeks?: number | null; deloadWeeks?: number[] },
  ctx: z.RefinementCtx,
): void {
  const weeks = value.deloadWeeks ?? [];
  if (weeks.length > 0 && value.durationWeeks == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Deload weeks need a program length.',
      path: ['deloadWeeks'],
    });
    return;
  }
  if (value.durationWeeks != null && weeks.some((w) => w > value.durationWeeks!)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Deload weeks must be within the program length.',
      path: ['deloadWeeks'],
    });
  }
}

export function normalizeDeloadWeeks(weeks: readonly number[] | undefined): number[] | undefined {
  return weeks === undefined ? undefined : [...new Set(weeks)].sort((a, b) => a - b);
}

export const programInputSchema = z
  .object({
    name: z.string().trim().min(1, 'Name required').max(120, 'Too long'),
    phase: z.string().trim().min(1, 'Phase required').max(60),
    description: z.string().trim().max(2000).optional().nullable(),
    // Calendar day (YYYY-MM-DD) the block starts; week 1 is its ISO week.
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date')
      .optional(),
    ...programScheduleFields,
  })
  .superRefine(refineProgramSchedule);

export type ProgramInput = z.infer<typeof programInputSchema>;

// A YYYY-MM-DD day stored at 12:00 UTC so the ISO week it falls in is the
// same in every time zone from UTC-11 to UTC+11.
export function dayToStartDate(day: string): Date {
  return new Date(`${day}T12:00:00.000Z`);
}
