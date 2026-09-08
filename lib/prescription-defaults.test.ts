import { describe, expect, it } from 'vitest';
import { recommendedPrescription } from './prescription-defaults';
import { bodyPartOf } from './body-parts';

describe('recommendedPrescription', () => {
  it('gives heavy compounds fewer reps and a 2 RIR buffer', () => {
    expect(recommendedPrescription({ category: 'COMPOUND', muscleGroup: 'CHEST' })).toEqual({
      targetSets: 4,
      targetRepsMin: 6,
      targetRepsMax: 10,
      targetRIR: 2,
    });
  });

  it('gives isolation work more reps', () => {
    expect(recommendedPrescription({ category: 'ISOLATION', muscleGroup: 'BICEPS' })).toEqual({
      targetSets: 3,
      targetRepsMin: 10,
      targetRepsMax: 15,
      targetRIR: 1,
    });
  });

  it('pushes calves, abs and side delts into the high-rep range even when compound', () => {
    expect(
      recommendedPrescription({ category: 'COMPOUND', muscleGroup: 'CALVES' }).targetRepsMin,
    ).toBe(12);
    expect(
      recommendedPrescription({ category: 'ISOLATION', muscleGroup: 'SHOULDERS_LATERAL' }),
    ).toEqual({ targetSets: 3, targetRepsMin: 12, targetRepsMax: 15, targetRIR: 1 });
  });

  it('keeps cardio at a single duration-based set', () => {
    expect(recommendedPrescription({ category: 'CARDIO', muscleGroup: 'OTHER' })).toEqual({
      targetSets: 1,
      targetRepsMin: 1,
      targetRepsMax: 1,
      targetRIR: 0,
    });
  });
});

describe('bodyPartOf', () => {
  it('folds fine-grained muscle groups into the five regions plus core and other', () => {
    expect(bodyPartOf('BACK_WIDTH')).toBe('back');
    expect(bodyPartOf('LOWER_BACK')).toBe('back');
    expect(bodyPartOf('SHOULDERS_REAR')).toBe('shoulders');
    expect(bodyPartOf('FOREARMS')).toBe('arms');
    expect(bodyPartOf('GLUTES')).toBe('legs');
    expect(bodyPartOf('ABS')).toBe('core');
    expect(bodyPartOf('OTHER')).toBe('other');
  });
});
