import { describe, it, expect } from 'vitest';
import {
  accountPortalModel,
  validateNewPassword,
  validateEmailShape,
  deactivateConfirmReady,
  MIN_PASSWORD_LENGTH,
  type AccountPortalState,
} from '../src/ui/account_portal';

const base: AccountPortalState = {
  loggedIn: true,
  username: 'Aelwyn',
  email: '',
  createdAt: '2026-01-15T10:00:00.000Z',
  wocBalance: 1250,
  characterCount: 3,
};

describe('accountPortalModel', () => {
  it('exposes all sections in order when logged in', () => {
    const m = accountPortalModel(base);
    expect(m.loggedIn).toBe(true);
    expect(m.sections).toEqual(['settings', 'wallet', 'characters', 'logout']);
    expect(m.header.username).toBe('Aelwyn');
  });

  it('shows no sections when logged out', () => {
    const m = accountPortalModel({ ...base, loggedIn: false });
    expect(m.sections).toEqual([]);
  });

  it('shows the balance only when one is known', () => {
    expect(accountPortalModel(base).header.showBalance).toBe(true);
    expect(accountPortalModel({ ...base, wocBalance: null }).header.showBalance).toBe(false);
  });

  it('normalizes createdAt and tolerates junk', () => {
    expect(accountPortalModel(base).header.memberSinceIso).toBe('2026-01-15T10:00:00.000Z');
    expect(accountPortalModel({ ...base, createdAt: 'not-a-date' }).header.memberSinceIso).toBe('');
    expect(accountPortalModel({ ...base, createdAt: '' }).header.memberSinceIso).toBe('');
  });
});

describe('validateNewPassword', () => {
  it('rejects an empty current password', () => {
    expect(validateNewPassword('', 'longenough')).toBe('empty-current');
  });
  it('rejects a too-short new password', () => {
    expect(validateNewPassword('oldpass', 'a'.repeat(MIN_PASSWORD_LENGTH - 1))).toBe('too-short');
  });
  it('rejects an unchanged password', () => {
    expect(validateNewPassword('samesame', 'samesame')).toBe('unchanged');
  });
  it('accepts a valid change', () => {
    expect(validateNewPassword('oldpass', 'brandnew')).toBeNull();
  });
});

describe('validateEmailShape', () => {
  it('accepts empty (clears the address)', () => {
    expect(validateEmailShape('')).toBe(true);
    expect(validateEmailShape('   ')).toBe(true);
  });
  it('accepts a plausible address', () => {
    expect(validateEmailShape('player@example.com')).toBe(true);
  });
  it('rejects malformed addresses', () => {
    expect(validateEmailShape('nope')).toBe(false);
    expect(validateEmailShape('a@b')).toBe(false);
    expect(validateEmailShape('a b@c.com')).toBe(false);
  });
  it('rejects an over-long address', () => {
    expect(validateEmailShape(`${'a'.repeat(250)}@example.com`)).toBe(false);
  });
});

describe('deactivateConfirmReady', () => {
  it('requires exact username and a non-empty password', () => {
    expect(deactivateConfirmReady('Aelwyn', 'Aelwyn', 'pw')).toBe(true);
    expect(deactivateConfirmReady('Aelwyn', 'aelwyn', 'pw')).toBe(false);
    expect(deactivateConfirmReady('Aelwyn', 'Aelwyn', '')).toBe(false);
    expect(deactivateConfirmReady('Aelwyn', '', 'pw')).toBe(false);
  });
});
