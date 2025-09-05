import { describe, it, expect } from 'vitest';
import { sentenceRangeAt } from './sentences';

describe('sentenceRangeAt', () => {
  it('selects the surrounding sentence based on token index', () => {
    const tokens = ['Hello', ' ', 'world', '.', ' ', 'Hi', '!'];
    const r1 = sentenceRangeAt(tokens, 0); // Hello
    expect(r1).toEqual({ start: 0, length: 4 }); // up to '.'
    const r2 = sentenceRangeAt(tokens, 2); // world
    expect(r2).toEqual({ start: 0, length: 4 });
    const r3 = sentenceRangeAt(tokens, 5); // Hi
    expect(r3).toEqual({ start: 5, length: 2 }); // 'Hi' + '!'
  });
});

