// Tests for auth utilities — password hashing and JWT helpers
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Set env before any imports that read process.env
process.env.JWT_SECRET = 'test_secret_at_least_32_chars_long__pad';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_32_chars_long_pad';
process.env.NODE_ENV = 'test';

describe('Password hashing', () => {
  it('hashes a password and verifies correctly', async () => {
    const password = 'SecurePass123!';
    const hash = await bcrypt.hash(password, 10);
    expect(await bcrypt.compare(password, hash)).toBe(true);
    expect(await bcrypt.compare('wrongpass', hash)).toBe(false);
  });

  it('produces a different hash each time (salt)', async () => {
    const hash1 = await bcrypt.hash('password', 10);
    const hash2 = await bcrypt.hash('password', 10);
    expect(hash1).not.toBe(hash2);
  });
});

describe('JWT', () => {
  const secret = 'test_secret_at_least_32_chars_long__pad';
  const payload = { id: 'user-123', email: 'test@example.com', role: 'USER' };

  it('signs and verifies a token', () => {
    const token = jwt.sign(payload, secret, { expiresIn: '15m' });
    const decoded = jwt.verify(token, secret) as typeof payload & { iat: number; exp: number };
    expect(decoded.id).toBe(payload.id);
    expect(decoded.email).toBe(payload.email);
  });

  it('rejects an expired token', () => {
    const token = jwt.sign(payload, secret, { expiresIn: '-1s' });
    expect(() => jwt.verify(token, secret)).toThrow();
  });

  it('rejects a token signed with a different secret', () => {
    const token = jwt.sign(payload, 'different-secret-that-is-also-long-enough');
    expect(() => jwt.verify(token, secret)).toThrow();
  });
});
