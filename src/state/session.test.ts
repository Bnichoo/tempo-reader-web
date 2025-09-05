import { describe, it, expect } from 'vitest';
import { initSessionState, sessionReducer } from './session';

describe('sessionReducer', () => {
  it('initializes with expected defaults', () => {
    const s = initSessionState();
    expect(s.playing).toBe(false);
    expect(s.wIndex).toBe(0);
    expect(s.searchStr).toBe('');
    expect(s.clipsExpanded).toBe(false);
  });

  it('clamps word index', () => {
    const s0 = initSessionState();
    const s1 = sessionReducer(s0, { type: 'setWordIndex', index: 10, maxWords: 5 });
    expect(s1.wIndex).toBe(4);
    const s2 = sessionReducer(s1, { type: 'setWordIndex', index: -3, maxWords: 5 });
    expect(s2.wIndex).toBe(0);
  });

  it('advances with clamp', () => {
    const s0 = { ...initSessionState(), wIndex: 2 };
    const s1 = sessionReducer(s0, { type: 'advanceWords', by: 10, maxWords: 8 });
    expect(s1.wIndex).toBe(7);
  });

  it('play controls', () => {
    const s0 = initSessionState();
    const s1 = sessionReducer(s0, { type: 'togglePlaying' });
    expect(s1.playing).toBe(true);
    const s2 = sessionReducer(s1, { type: 'pause' });
    expect(s2.playing).toBe(false);
    const s3 = sessionReducer(s2, { type: 'setPlaying', value: true });
    expect(s3.playing).toBe(true);
  });

  it('sets UI bits', () => {
    const s0 = initSessionState();
    const s1 = sessionReducer(s0, { type: 'setSearch', value: 'hi' });
    expect(s1.searchStr).toBe('hi');
    const s2 = sessionReducer(s1, { type: 'toggleClipsExpanded' });
    expect(s2.clipsExpanded).toBe(true);
  });
});

