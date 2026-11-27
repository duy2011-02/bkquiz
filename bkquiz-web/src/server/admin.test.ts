import { describe, expect, it, vi } from 'vitest';
import { isAdminEmail, parseAdminEmails } from './admin';

vi.mock('@/server/prisma', () => ({ prisma: {} }));
vi.mock('@/auth', () => ({ auth: vi.fn() }));

describe('ADMIN_EMAILS', () => {
  it('splits on commas, semicolons and whitespace; lower-cases; ignores junk', () => {
    expect([...parseAdminEmails({ ADMIN_EMAILS: ' A@x.com, b@Y.vn;c@z.edu  nope ,, ' })]).toEqual(['a@x.com', 'b@y.vn', 'c@z.edu']);
    expect(parseAdminEmails({}).size).toBe(0);
    expect(parseAdminEmails({ ADMIN_EMAILS: '' }).size).toBe(0);
  });

  it('matches case-insensitively, never for empty / missing email', () => {
    const env = { ADMIN_EMAILS: 'Admin@Hust.edu.vn' };

    expect(isAdminEmail('admin@hust.edu.vn', env)).toBe(true);
    expect(isAdminEmail(' ADMIN@HUST.EDU.VN ', env)).toBe(true);
    expect(isAdminEmail('other@hust.edu.vn', env)).toBe(false);
    expect(isAdminEmail(null, env)).toBe(false);
    expect(isAdminEmail('', { ADMIN_EMAILS: '' })).toBe(false);
  });
});
