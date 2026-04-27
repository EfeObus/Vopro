import { describe, expect, it } from 'vitest';
import { formatDuration, formatPercent } from '@/lib/format';

describe('formatDuration', () => {
  it('formats seconds', () => {
    expect(formatDuration(45)).toBe('45s');
  });
  it('formats minutes', () => {
    expect(formatDuration(125)).toBe('2m 5s');
  });
  it('formats hours', () => {
    expect(formatDuration(3700)).toBe('1h 1m');
  });
});

describe('formatPercent', () => {
  it('rounds to nearest integer percent', () => {
    expect(formatPercent(0.876)).toBe('88%');
  });
});
