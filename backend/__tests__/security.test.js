const { hashPassword, verifyPassword, signToken, verifyToken } = require('../src/utils/security');

process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long';

describe('security utilities', () => {
  test('hashes passwords and verifies only the matching password', async () => {
    const hash = await hashPassword('CorrectHorseBattery9!');
    expect(hash).not.toContain('CorrectHorseBattery9!');
    expect(await verifyPassword('CorrectHorseBattery9!', hash)).toBe(true);
    expect(await verifyPassword('incorrect-password', hash)).toBe(false);
  });

  test('signs and verifies a token with subject and role claims', () => {
    const token = signToken({ _id: '507f1f77bcf86cd799439011', role: 'teamMember' });
    const payload = verifyToken(token);
    expect(payload.sub).toBe('507f1f77bcf86cd799439011');
    expect(payload.role).toBe('teamMember');
    expect(payload.exp).toBeGreaterThan(payload.iat);
  });

  test('rejects tampered tokens', () => {
    const token = signToken({ _id: '507f1f77bcf86cd799439011', role: 'teamMember' });
    const parts = token.split('.');
    const signature = parts[2];
    parts[2] = `${signature[0] === 'a' ? 'b' : 'a'}${signature.slice(1)}`;
    expect(() => verifyToken(parts.join('.'))).toThrow();
  });
});
