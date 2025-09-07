import { describe, it, expect } from 'vitest';
import { parseImport } from './storage';

describe('parseImport', () => {
  it('parses settings and clips when present', () => {
    const json = JSON.stringify({ settings: { wps: 2, count: 3 }, clips: [{ id: '1' }, { id: '2' }] });
    const out = parseImport(json);
    expect(out.settings).toBeDefined();
    expect(out?.settings?.wps).toBe(2);
    expect(Array.isArray(out.clips)).toBe(true);
    expect(out.clips?.length).toBe(2);
  });

  it('ignores unexpected fields and throws on non-object', () => {
    const json = JSON.stringify({ foo: 1, bar: true });
    const out = parseImport(json);
    expect(out.settings).toBeUndefined();
    expect(out.clips).toBeUndefined();
    expect(() => parseImport('"not an object"')).toThrowError();
  });
});

