import { describe, it, expect } from 'vitest';
import {
  programTemplates,
  getTemplateBySlug,
} from './templates';
import { generatedProgramSchema } from '@/lib/schemas/program-generation';
import { estimateWorkoutMinutes } from '@/lib/today-workout';
import { getExerciseDisplayName } from '@/i18n/exercise-names';

describe('program templates', () => {
  it('ships at least the four required established programs', () => {
    // Issue #37 asks for 5/3/1, GZCLP, a PPL split and an Upper/Lower split.
    expect(programTemplates.length).toBeGreaterThanOrEqual(4);
    const slugs = programTemplates.map((t) => t.slug);
    expect(slugs).toContain('531-bbb-4day');
    expect(slugs).toContain('gzclp-3day');
    expect(slugs).toContain('ppl-6day');
    expect(slugs).toContain('upper-lower-4day');
  });

  it('ships the expanded catalog added in issue #59', () => {
    // Issue #59 adds Starting Strength, StrongLifts 5x5, Madcow, PHUL, PHAT and
    // a beginner Full Body 3x template on top of the original five.
    const slugs = programTemplates.map((t) => t.slug);
    expect(slugs).toContain('starting-strength-3day');
    expect(slugs).toContain('stronglifts-5x5-3day');
    expect(slugs).toContain('madcow-5x5-3day');
    expect(slugs).toContain('phul-4day');
    expect(slugs).toContain('phat-5day');
    expect(slugs).toContain('full-body-3day');
    expect(programTemplates.length).toBeGreaterThanOrEqual(11);
  });

  it('every new #59 template materializes into a valid program with runnable workouts', () => {
    const newSlugs = [
      'starting-strength-3day',
      'stronglifts-5x5-3day',
      'madcow-5x5-3day',
      'phul-4day',
      'phat-5day',
      'full-body-3day',
    ];
    for (const slug of newSlugs) {
      const template = getTemplateBySlug(slug);
      expect(template, `${slug} should exist`).toBeDefined();
      const result = generatedProgramSchema.safeParse(template!.program);
      expect(result.success, `${slug} should validate`).toBe(true);
      // A runnable program: at least one workout, each with at least one set.
      expect(template!.program.workouts.length).toBeGreaterThan(0);
      for (const w of template!.program.workouts) {
        expect(w.exercises.length).toBeGreaterThan(0);
        for (const ex of w.exercises) {
          expect(ex.targetSets).toBeGreaterThan(0);
        }
      }
    }
  });

  it('has unique slugs', () => {
    const slugs = programTemplates.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('every template program validates against the build schema', () => {
    for (const t of programTemplates) {
      const result = generatedProgramSchema.safeParse(t.program);
      expect(result.success, `${t.slug} should be valid`).toBe(true);
    }
  });

  it('every template has display metadata', () => {
    for (const t of programTemplates) {
      expect(t.name.length).toBeGreaterThan(0);
      expect(t.summary.length).toBeGreaterThan(0);
      expect(t.attribution.length).toBeGreaterThan(0);
    }
  });

  it('every workout has at least one exercise with a valid rep range', () => {
    for (const t of programTemplates) {
      for (const w of t.program.workouts) {
        expect(w.exercises.length).toBeGreaterThan(0);
        for (const ex of w.exercises) {
          expect(ex.targetRepsMax).toBeGreaterThanOrEqual(ex.targetRepsMin);
        }
      }
    }
  });

  it('looks up a template by slug and returns undefined for an unknown slug', () => {
    expect(getTemplateBySlug('ppl-6day')?.name).toBe('Push / Pull / Legs (6-day)');
    expect(getTemplateBySlug('does-not-exist')).toBeUndefined();
  });
});

describe('12-week body recomp template', () => {
  const template = getTemplateBySlug('recomp-5day-12week');

  it('ships first in the catalog so the picker shows it without expanding', () => {
    expect(template).toBeDefined();
    expect(programTemplates[0]?.slug).toBe('recomp-5day-12week');
  });

  it('pins one workout to each of Monday through Saturday and leaves Sunday off', () => {
    const days = template!.program.workouts.map((w) => w.dayOfWeek);
    expect(days).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('makes Thursday a conditioning-only day', () => {
    const thursday = template!.program.workouts.find((w) => w.dayOfWeek === 4)!;
    expect(thursday.exercises.every((e) => e.category === 'CARDIO')).toBe(true);
  });

  it('keeps every lifting day inside the 75 minute session budget', () => {
    for (const w of template!.program.workouts) {
      expect(estimateWorkoutMinutes(w.exercises), w.name).toBeLessThanOrEqual(75);
    }
  });

  it('prescribes a target RIR of 1-2 on every lifting exercise', () => {
    for (const w of template!.program.workouts) {
      for (const e of w.exercises.filter((x) => x.category !== 'CARDIO')) {
        expect(e.targetRIR, e.name).toBeGreaterThanOrEqual(1);
        expect(e.targetRIR, e.name).toBeLessThanOrEqual(2);
      }
    }
  });

  it('keeps heavy low-rep anchors for bench, squat and deadlift', () => {
    const all = template!.program.workouts.flatMap((w) => w.exercises);
    for (const name of ['Bench Press', 'Back Squat', 'Deadlift']) {
      const ex = all.find((e) => e.name === name);
      expect(ex, name).toBeDefined();
      expect(ex!.targetRepsMax, name).toBeLessThanOrEqual(6);
    }
  });

  it('uses exercise names that have a Japanese display name', () => {
    for (const w of template!.program.workouts) {
      for (const e of w.exercises) {
        expect(getExerciseDisplayName(e.name, 'ja'), e.name).not.toBe(e.name);
      }
    }
  });
});
