import { ADJUSTMENTS_TAG } from '@/lib/coach-adjustments';
import { PROGRAM_TAG } from '@/lib/coach-program';

// Hiding the coach's machine-readable blocks while a reply streams.
//
// The chat renders the assistant message token by token, so an <adjustments>
// or <program> block is typed out on screen character by character before it
// is complete - "<pro", "<program>", "<program>{\"name\"..." - and the user
// would watch raw JSON appear under the answer. Both blocks duplicate, in
// machine form, what the prose already says, so neither is ever displayed.
//
// The tag names come from the modules that own them, so adding a block type
// there cannot leave this stripper behind.
const BLOCK_TAGS = [ADJUSTMENTS_TAG, PROGRAM_TAG] as const;

const COMPLETE_BLOCK_RE = new RegExp(
  `<(${BLOCK_TAGS.join('|')})>[\\s\\S]*?</\\1>`,
  'gi',
);

// Strips every complete block, plus a trailing fragment that is still a prefix
// of one of the opening tags.
//
// Text that merely contains a "<" (e.g. "keep RIR < 3", "<b>bold</b>") is left
// alone: the tail has to be a prefix of a known tag, not just an angle
// bracket.
export function stripStreamingBlocks(text: string): string {
  const withoutComplete = text.replace(COMPLETE_BLOCK_RE, '');
  const lastOpen = withoutComplete.lastIndexOf('<');
  if (lastOpen !== -1) {
    const tail = withoutComplete.slice(lastOpen).toLowerCase();
    const partial = BLOCK_TAGS.some((tag) => {
      const open = `<${tag}>`;
      return open.startsWith(tail) || tail.startsWith(open);
    });
    if (partial) return withoutComplete.slice(0, lastOpen).trimEnd();
  }
  return withoutComplete.trimEnd();
}
