import { describe, expect, it } from 'vitest';
import { stripStreamingBlocks } from './coach-blocks';
import { extractAdjustments } from './coach-adjustments';
import { extractProgramProposal } from './coach-program';

const body = 'Bench is moving, add 2.5 kg.';

describe('stripStreamingBlocks', () => {
  it('hides an adjustments tag while it is still being typed out', () => {
    for (const fragment of ['<', '<a', '<adj', '<adjustments', '<adjustments>']) {
      expect(stripStreamingBlocks(`${body}\n\n${fragment}`)).toBe(body);
    }
  });

  it('hides a program tag while it is still being typed out', () => {
    for (const fragment of ['<', '<p', '<prog', '<program', '<program>']) {
      expect(stripStreamingBlocks(`${body}\n\n${fragment}`)).toBe(body);
    }
  });

  it('hides a block whose JSON is still streaming', () => {
    expect(stripStreamingBlocks(`${body}\n\n<adjustments>\n[\n  { "exerciseNam`)).toBe(body);
    expect(stripStreamingBlocks(`${body}\n\n<program>\n{\n  "name": "Upp`)).toBe(body);
  });

  it('hides a complete block of either kind', () => {
    expect(
      stripStreamingBlocks(
        `${body}\n\n<adjustments>[{"exerciseName":"Bench","summary":"+2.5 kg"}]</adjustments>`,
      ),
    ).toBe(body);
    expect(stripStreamingBlocks(`${body}\n\n<program>{"name":"Upper/Lower"}</program>`)).toBe(body);
  });

  it('leaves a lone angle bracket in the prose alone', () => {
    expect(stripStreamingBlocks('Keep RIR < 3')).toBe('Keep RIR < 3');
    expect(stripStreamingBlocks('Use <b>bold</b>')).toBe('Use <b>bold</b>');
  });

  it('agrees with the extractors once the block is complete', () => {
    const withAdjustments = `${body}\n\n<adjustments>[{"exerciseName":"Bench","summary":"+2.5 kg"}]</adjustments>`;
    expect(stripStreamingBlocks(withAdjustments)).toBe(
      extractAdjustments(withAdjustments).cleaned,
    );

    const withProgram = `${body}\n\n<program>{"name":"P","phase":"Base","workouts":[]}</program>`;
    expect(stripStreamingBlocks(withProgram)).toBe(extractProgramProposal(withProgram).cleaned);
  });
});
