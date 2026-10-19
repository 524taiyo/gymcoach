import { describe, it, expect } from 'vitest';
import { dayToStartDate, normalizeDeloadWeeks, programInputSchema } from './program';
import { generatedProgramSchema } from './program-generation';

describe('programInputSchema', () => {
  it('accepts a valid program and trims fields', () => {
    const parsed = programInputSchema.parse({
      name: '  Upper/Lower  ',
      phase: '  Hypertrophy  ',
      description: '  4-week block  ',
    });
    expect(parsed.name).toBe('Upper/Lower');
    expect(parsed.phase).toBe('Hypertrophy');
    expect(parsed.description).toBe('4-week block');
  });

  it('treats description as optional', () => {
    expect(programInputSchema.safeParse({ name: 'PPL', phase: 'Base' }).success).toBe(true);
  });

  it('requires name and phase', () => {
    expect(programInputSchema.safeParse({ name: '', phase: 'Base' }).success).toBe(false);
    expect(programInputSchema.safeParse({ name: 'PPL', phase: '' }).success).toBe(false);
  });

  it('rejects an over-long name', () => {
    expect(programInputSchema.safeParse({ name: 'x'.repeat(121), phase: 'Base' }).success).toBe(
      false,
    );
  });
});

describe('program block schedule', () => {
  const base = { name: 'Recomp', phase: 'Recomp' };

  it('keeps accepting a program without any schedule field', () => {
    const r = programInputSchema.safeParse(base);
    expect(r.success).toBe(true);
  });

  it('accepts a 12-week block with deloads in weeks 4 and 8 and a 75 min budget', () => {
    const r = programInputSchema.safeParse({
      ...base,
      startDate: '2026-10-19',
      durationWeeks: 12,
      deloadWeeks: [8, 4],
      sessionBudgetMin: 75,
    });
    expect(r.success).toBe(true);
  });

  it('rejects deload weeks outside the block', () => {
    const r = programInputSchema.safeParse({ ...base, durationWeeks: 12, deloadWeeks: [13] });
    expect(r.success).toBe(false);
  });

  it('rejects deload weeks without a block length', () => {
    const r = programInputSchema.safeParse({ ...base, deloadWeeks: [4] });
    expect(r.success).toBe(false);
  });

  it('accepts clearing the schedule with null and an empty list', () => {
    const r = programInputSchema.safeParse({
      ...base,
      durationWeeks: null,
      deloadWeeks: [],
      sessionBudgetMin: null,
    });
    expect(r.success).toBe(true);
  });

  it('rejects out-of-range values and malformed input', () => {
    expect(programInputSchema.safeParse({ ...base, durationWeeks: 0 }).success).toBe(false);
    expect(programInputSchema.safeParse({ ...base, durationWeeks: 53 }).success).toBe(false);
    expect(programInputSchema.safeParse({ ...base, sessionBudgetMin: 10 }).success).toBe(false);
    expect(
      programInputSchema.safeParse({ ...base, durationWeeks: 12, deloadWeeks: [Number.NaN] })
        .success,
    ).toBe(false);
    expect(programInputSchema.safeParse({ ...base, startDate: '19/10/2026' }).success).toBe(false);
  });

  it('applies the same rules to generated programs', () => {
    const program = {
      name: 'P',
      phase: 'Recomp',
      workouts: [
        {
          name: 'A',
          exercises: [
            {
              name: 'Bench Press',
              muscleGroup: 'CHEST',
              category: 'COMPOUND',
              targetSets: 3,
              targetRepsMin: 5,
              targetRepsMax: 8,
              targetRIR: 2,
              restSec: 120,
            },
          ],
        },
      ],
    };
    expect(generatedProgramSchema.safeParse(program).success).toBe(true);
    expect(
      generatedProgramSchema.safeParse({ ...program, durationWeeks: 12, deloadWeeks: [4, 8] })
        .success,
    ).toBe(true);
    expect(generatedProgramSchema.safeParse({ ...program, deloadWeeks: [4] }).success).toBe(false);
  });

  it('normalizes deload weeks sorted and de-duplicated', () => {
    expect(normalizeDeloadWeeks([8, 4, 8])).toEqual([4, 8]);
    expect(normalizeDeloadWeeks(undefined)).toBeUndefined();
  });

  it('stores a start day at noon UTC', () => {
    expect(dayToStartDate('2026-10-19').toISOString()).toBe('2026-10-19T12:00:00.000Z');
  });
});
