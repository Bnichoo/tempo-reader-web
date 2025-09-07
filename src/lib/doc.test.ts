import { describe, it, expect } from 'vitest';
import { docDisplayName, hashDocId } from './doc';

describe('doc utilities', () => {
  it('docDisplayName truncates with ellipsis', () => {
    const text = 'A'.repeat(80);
    const name = docDisplayName(text);
    expect(name.endsWith('…')).toBe(true);
    expect(name.length).toBe(58); // 57 + ellipsis
  });

  it('hashDocId is deterministic and includes length', () => {
    const t1 = 'hello world';
    const t2 = 'hello world!';
    const id1a = hashDocId(t1);
    const id1b = hashDocId(t1);
    const id2 = hashDocId(t2);
    expect(id1a).toBe(id1b);
    expect(id1a).not.toBe(id2);
    expect(id1a.endsWith(`-${t1.length}`)).toBe(true);
    expect(id2.endsWith(`-${t2.length}`)).toBe(true);
  });
});

