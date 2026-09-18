import { describe, expect, it } from 'vitest';
import { extractAdjustments, stripStreamingAdjustments } from './coach-adjustments';

describe('extractAdjustments', () => {
  it('returns the original markdown when no tag is present', () => {
    const md = '## Recap\n\nGood volume this week.';
    const r = extractAdjustments(md);
    expect(r.cleaned).toBe(md);
    expect(r.adjustments).toEqual([]);
    expect(r.parseErrors).toEqual([]);
  });

  it('strips the adjustments block and parses a valid array', () => {
    const md = `## Recap

Great progression on the squat.

<adjustments>
[
  {
    "exerciseName": "Squat",
    "summary": "Move up to 82.5 kg",
    "suggestedLoad": 82.5,
    "currentLoad": 80
  },
  {
    "exerciseName": "Barbell curl",
    "summary": "Lower the rep range to 8-12",
    "suggestedRepsMin": 8,
    "suggestedRepsMax": 12,
    "rationale": "You have been stuck at 12 reps for 3 weeks."
  }
]
</adjustments>`;
    const r = extractAdjustments(md);
    expect(r.cleaned).not.toContain('<adjustments>');
    expect(r.cleaned).toContain('## Recap');
    expect(r.adjustments).toHaveLength(2);
    expect(r.adjustments[0]).toMatchObject({
      exerciseName: 'Squat',
      summary: 'Move up to 82.5 kg',
      suggestedLoad: 82.5,
    });
    expect(r.adjustments[1]?.suggestedRepsMin).toBe(8);
    expect(r.parseErrors).toEqual([]);
  });

  it('returns parseErrors when JSON is malformed (markdown still cleaned)', () => {
    const md = `Some text
<adjustments>
[ { "exerciseName": "Squat" }
</adjustments>`;
    const r = extractAdjustments(md);
    expect(r.cleaned).toBe('Some text');
    expect(r.adjustments).toEqual([]);
    expect(r.parseErrors[0]).toMatch(/Invalid JSON/);
  });

  it('returns parseErrors when schema validation fails', () => {
    const md = `Text
<adjustments>
[
  { "exerciseName": "", "summary": "empty" }
]
</adjustments>`;
    const r = extractAdjustments(md);
    expect(r.adjustments).toEqual([]);
    expect(r.parseErrors[0]).toMatch(/Invalid schema/);
  });

  it('handles an empty adjustments tag', () => {
    const md = `Text\n<adjustments></adjustments>`;
    const r = extractAdjustments(md);
    expect(r.adjustments).toEqual([]);
    expect(r.parseErrors[0]).toMatch(/Empty/);
  });

  it('clamps RIR and reps to the documented bounds', () => {
    const md = `<adjustments>
[
  { "exerciseName": "Squat", "summary": "x", "suggestedRIR": 9 }
]
</adjustments>`;
    const r = extractAdjustments(md);
    expect(r.adjustments).toEqual([]);
    expect(r.parseErrors).toHaveLength(1);
  });
});

describe('stripStreamingAdjustments', () => {
  const body = 'Bench is moving, add 2.5 kg.';

  it('hides the block while it is still being typed out', () => {
    // The tag arrives one token at a time; none of these fragments should
    // reach the screen.
    for (const fragment of ['<', '<a', '<adj', '<adjustments', '<adjustments>']) {
      expect(stripStreamingAdjustments(`${body}\n\n${fragment}`)).toBe(body);
    }
  });

  it('hides a block whose JSON is still streaming', () => {
    expect(
      stripStreamingAdjustments(`${body}\n\n<adjustments>\n[\n  { "exerciseNam`),
    ).toBe(body);
  });

  it('hides a complete block', () => {
    expect(
      stripStreamingAdjustments(
        `${body}\n\n<adjustments>[{"exerciseName":"Bench","summary":"+2.5 kg"}]</adjustments>`,
      ),
    ).toBe(body);
  });

  it('leaves a lone angle bracket in the prose alone', () => {
    expect(stripStreamingAdjustments('Keep RIR < 3')).toBe('Keep RIR < 3');
    expect(stripStreamingAdjustments('Use <b>bold</b>')).toBe('Use <b>bold</b>');
  });

  it('agrees with extractAdjustments once the block is complete', () => {
    const full = `${body}\n\n<adjustments>[{"exerciseName":"Bench","summary":"+2.5 kg"}]</adjustments>`;
    expect(stripStreamingAdjustments(full)).toBe(extractAdjustments(full).cleaned);
  });
});
