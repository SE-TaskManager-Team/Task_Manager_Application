
const { isValidDeadline } = require('../src/routes/projectRoutes');

describe('Project deadline validation', () => {
  test('accepts a valid date', () => {
    expect(isValidDeadline('2026-12-25')).toBe(true);
  });

  test('rejects an impossible calendar date', () => {
    expect(isValidDeadline('2026-02-30')).toBe(false);
  });

  test('rejects an invalid date format', () => {
    expect(isValidDeadline('25-12-2026')).toBe(false);
  });

  test('rejects a timestamp instead of a date-only string', () => {
    expect(isValidDeadline('2026-12-25T10:00:00Z')).toBe(false);
  });

  test('rejects empty or non-string values', () => {
    expect(isValidDeadline('')).toBe(false);
    expect(isValidDeadline(null)).toBe(false);
    expect(isValidDeadline(20261225)).toBe(false);
  });
});
