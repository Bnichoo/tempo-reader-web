import { describe, it, expect } from 'vitest';
import { sanitizeHTML } from './sanitize';

describe('sanitizeHTML', () => {
  it('removes disallowed tags and keeps content', () => {
    const s = '<p>ok<script>alert(1)</script>done</p>';
    const clean = sanitizeHTML(s);
    expect(clean.toLowerCase()).not.toContain('<script');
    expect(clean).toContain('ok');
    expect(clean).toContain('done');
  });

  it('hardens links and removes unsafe href', () => {
    const s = '<a href="javascript:alert(1)">x</a> <a href="https://a">y</a>';
    const clean = sanitizeHTML(s);
    // unsafe becomes <a>x</a>
    expect(clean).toMatch(/<a[^>]*>x<\/a>/i);
    // safe link keeps href and gains target+rel
    expect(clean).toMatch(/<a[^>]*href="https:\/\/a"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/i);
  });
});

