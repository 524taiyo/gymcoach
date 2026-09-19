import { describe, expect, it } from 'vitest';
import { countProgramExercises, extractProgramProposal } from './coach-program';

const PROGRAM = {
  name: 'Upper / Lower 4x',
  phase: 'Hypertrophy',
  description: 'Four sessions a week.',
  workouts: [
    {
      name: 'Upper A',
      dayOfWeek: 1,
      exercises: [
        {
          name: 'Barbell bench press',
          muscleGroup: 'CHEST',
          category: 'COMPOUND',
          equipmentType: 'BARBELL',
          targetSets: 4,
          targetRepsMin: 6,
          targetRepsMax: 8,
          targetRIR: 2,
          restSec: 180,
        },
      ],
    },
    {
      name: 'Lower A',
      dayOfWeek: 2,
      exercises: [
        {
          name: 'Back Squat',
          muscleGroup: 'QUADS',
          category: 'COMPOUND',
          equipmentType: 'BARBELL',
          targetSets: 4,
          targetRepsMin: 6,
          targetRepsMax: 8,
          targetRIR: 2,
          restSec: 180,
        },
        {
          name: 'Leg extension',
          muscleGroup: 'QUADS',
          category: 'ISOLATION',
          equipmentType: 'MACHINE',
          targetSets: 3,
          targetRepsMin: 12,
          targetRepsMax: 15,
          targetRIR: 2,
          restSec: 60,
        },
      ],
    },
  ],
};

const prose = 'Here is a four-day split.';
const reply = (json: string) => `${prose}\n\n<program>\n${json}\n</program>`;

describe('extractProgramProposal', () => {
  it('returns no program and the untouched prose when there is no block', () => {
    const out = extractProgramProposal(prose);
    expect(out.program).toBeNull();
    expect(out.parseError).toBeNull();
    expect(out.cleaned).toBe(prose);
  });

  it('validates the block and strips it from what the user reads', () => {
    const out = extractProgramProposal(reply(JSON.stringify(PROGRAM)));
    expect(out.parseError).toBeNull();
    expect(out.cleaned).toBe(prose);
    expect(out.program?.name).toBe('Upper / Lower 4x');
    expect(out.program?.workouts).toHaveLength(2);
    expect(out.program?.workouts[1]?.exercises[0]?.name).toBe('Back Squat');
  });

  it('tolerates a code fence around the JSON', () => {
    const out = extractProgramProposal(reply('```json\n' + JSON.stringify(PROGRAM) + '\n```'));
    expect(out.parseError).toBeNull();
    expect(out.program?.workouts).toHaveLength(2);
  });

  it('rejects a program the schema refuses, keeping the prose readable', () => {
    // targetSets 0 is out of range: the user gets the answer, not a button
    // wired to invalid data.
    const broken = structuredClone(PROGRAM);
    broken.workouts[0]!.exercises[0]!.targetSets = 0;
    const out = extractProgramProposal(reply(JSON.stringify(broken)));
    expect(out.program).toBeNull();
    expect(out.parseError).toMatch(/targetSets/);
    expect(out.cleaned).toBe(prose);
  });

  it('rejects an invented muscle group rather than guessing one', () => {
    const broken = structuredClone(PROGRAM);
    broken.workouts[0]!.exercises[0]!.muscleGroup = 'PECTORALS';
    const out = extractProgramProposal(reply(JSON.stringify(broken)));
    expect(out.program).toBeNull();
    expect(out.parseError).toMatch(/muscleGroup/);
  });

  it('reports an empty block instead of throwing', () => {
    const out = extractProgramProposal(`${prose}\n\n<program></program>`);
    expect(out.program).toBeNull();
    expect(out.parseError).toBe('Empty <program> block.');
  });
});

describe('countProgramExercises', () => {
  it('sums the exercise rows across workouts', () => {
    const out = extractProgramProposal(reply(JSON.stringify(PROGRAM)));
    expect(countProgramExercises(out.program!)).toBe(3);
  });
});
