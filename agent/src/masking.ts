// On-device masking. Runs before any network call. Defense in depth.

export interface MaskingRule {
  label: string;
  pattern: RegExp;
  replacement: string;
}

export const DEFAULT_RULES: MaskingRule[] = [
  { label: 'email', pattern: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, replacement: '[email-redacted]' },
  { label: 'phone', pattern: /\+?\d[\d\s().-]{7,}\d/g, replacement: '[phone-redacted]' },
  { label: 'ssn', pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '[ssn-redacted]' },
  { label: 'credit_card', pattern: /\b(?:\d[ -]*?){13,19}\b/g, replacement: '[card-redacted]' },
  { label: 'token', pattern: /\b(?:sk|pk|ghp|github_pat|xox[abp])[_-][A-Za-z0-9_-]{16,}\b/g, replacement: '[token-redacted]' },
  { label: 'jwt', pattern: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, replacement: '[jwt-redacted]' },
];

export function scrubString(value: string, rules: MaskingRule[] = DEFAULT_RULES): string {
  return rules.reduce((acc, rule) => acc.replace(rule.pattern, rule.replacement), value);
}

export function scrub<T>(value: T, rules: MaskingRule[] = DEFAULT_RULES): T {
  if (value == null) return value;
  if (typeof value === 'string') return scrubString(value, rules) as unknown as T;
  if (Array.isArray(value)) return value.map((v) => scrub(v, rules)) as unknown as T;
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      // Always drop password fields by name, regardless of content.
      if (/password|secret|api[_-]?key/i.test(k)) {
        out[k] = '[redacted]';
      } else {
        out[k] = scrub(v, rules);
      }
    }
    return out as T;
  }
  return value;
}
