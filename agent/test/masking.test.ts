import { describe, expect, it } from 'vitest';
import { scrub, scrubString } from '../src/masking';

describe('scrubString', () => {
  it('redacts emails', () => {
    expect(scrubString('email me at jane@example.com please')).toContain('[email-redacted]');
  });

  it('redacts JWTs', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature_value_here';
    expect(scrubString(jwt)).toBe('[jwt-redacted]');
  });
});

describe('scrub', () => {
  it('strips password fields by name', () => {
    const out = scrub({ user: 'a', password: 'hunter2' });
    expect(out.password).toBe('[redacted]');
    expect(out.user).toBe('a');
  });

  it('walks arrays and nested objects', () => {
    const out = scrub({ history: [{ note: 'ping me at z@y.com', token: 'sk-test_AAAAAAAAAAAAAAAA' }] });
    expect(out.history[0].note).toContain('[email-redacted]');
    expect(out.history[0].token).toContain('[token-redacted]');
  });
});
