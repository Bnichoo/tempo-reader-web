import { describe, it, expect } from 'vitest';
import { tokenizeImpl } from './tokenizeImpl';

describe('tokenizeImpl', () => {
  it('splits whitespace but keeps words together', () => {
    const s = 'Hello world';
    const t = tokenizeImpl(s);
    expect(t).toEqual(['Hello', ' ', 'world']);
  });

  it('treats joiners as part of words', () => {
    const s = "world's email-addr co_op long—dash"; // em dash
    const t = tokenizeImpl(s);
    expect(t).toEqual(["world's", ' ', 'email-addr', ' ', 'co_op', ' ', 'long—dash']);
  });

  it('handles unicode letters and numbers (current behavior)', () => {
    const s = 'naïve café №10';
    const t = tokenizeImpl(s);
    // Note: '№10' splits as ['№','10'] with current regex
    expect(t).toEqual(['naïve', ' ', 'café', ' ', '№', '10']);
  });
});
