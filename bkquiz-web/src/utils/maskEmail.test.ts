import { describe, expect, it } from 'vitest';
import { maskEmail } from './maskEmail';

describe('maskEmail', () => {
  it('keeps the first 2 characters and the domain', () => {
    expect(maskEmail('nguyenvana@hust.edu.vn')).toBe('ng***@hust.edu.vn');
  });

  it('never reveals the whole local part of short addresses', () => {
    expect(maskEmail('ab@x.vn')).toBe('a***@x.vn');
    expect(maskEmail('a@x.vn')).toBe('a***@x.vn');
  });

  it('returns null for empty or invalid values', () => {
    expect(maskEmail(null)).toBeNull();
    expect(maskEmail('')).toBeNull();
    expect(maskEmail('no-at-sign')).toBeNull();
    expect(maskEmail('@x.vn')).toBeNull();
    expect(maskEmail('a@')).toBeNull();
  });
});
