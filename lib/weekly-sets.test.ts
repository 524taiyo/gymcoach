import { describe, expect, it } from 'vitest';
import { plannedWeeklySets, weeklySetsRows } from './weekly-sets';

describe('plannedWeeklySets', () => {
  it('sums target sets per primary muscle across the weekly split, skipping cardio', () => {
    expect(
      plannedWeeklySets([
        {
          exercises: [
            { muscleGroup: 'CHEST', category: 'COMPOUND', targetSets: 4 },
            { muscleGroup: 'TRICEPS', category: 'ISOLATION', targetSets: 3 },
          ],
        },
        {
          exercises: [
            { muscleGroup: 'CHEST', category: 'COMPOUND', targetSets: 3 },
            { muscleGroup: 'OTHER', category: 'CARDIO', targetSets: 1 },
          ],
        },
      ]),
    ).toEqual({ CHEST: 7, TRICEPS: 3 });
  });
});

describe('weeklySetsRows', () => {
  it('classifies plan and last week against the default band', () => {
    const rows = weeklySetsRows({
      planned: { CHEST: 16, BICEPS: 5 },
      thisWeek: { CHEST: 8 },
      lastWeek: { CHEST: 22, BICEPS: 5 },
    });
    expect(rows.map((r) => r.group)).toEqual(['CHEST', 'BICEPS']);
    expect(rows[0]).toMatchObject({
      planned: 16,
      thisWeek: 8,
      lastWeek: 22,
      mev: 10,
      mrv: 20,
      custom: false,
      plannedZone: 'WITHIN',
      lastWeekZone: 'ABOVE_MRV',
    });
    expect(rows[1]).toMatchObject({ plannedZone: 'BELOW_MEV', thisWeek: 0 });
  });

  it('uses a personal band when one is set', () => {
    const [row] = weeklySetsRows({
      planned: { BICEPS: 6 },
      thisWeek: {},
      lastWeek: {},
      targets: { BICEPS: { mev: 4, mrv: 12 } },
    });
    expect(row).toMatchObject({ mev: 4, mrv: 12, custom: true, plannedZone: 'WITHIN' });
  });

  it('lists muscles trained off-plan and drops the OTHER bucket', () => {
    const rows = weeklySetsRows({ planned: {}, thisWeek: { CALVES: 3, OTHER: 2 }, lastWeek: {} });
    expect(rows.map((r) => r.group)).toEqual(['CALVES']);
  });
});
