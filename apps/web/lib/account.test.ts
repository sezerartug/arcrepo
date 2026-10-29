import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AdminShortcuts } from '@/components/admin-shortcuts';
import { accountSections, roleLabel, validatePasswordChange, validateProfile } from './account';
import type { Me } from './types';

const base = { id: 'u1', email: 'a@b.co', fullName: 'Ad Soyad' };
const owner: Me = {
  user: base,
  company: { id: 'c1', legalName: 'X A.Ş.', status: 'verified', memberRole: 'owner' },
};
const admin: Me = { user: { ...base, isAdmin: true }, company: null };

describe('validateProfile', () => {
  it('accepts a name with optional loose phone', () => {
    expect(validateProfile({ fullName: 'Ali Veli', phone: '' })).toBeNull();
    expect(validateProfile({ fullName: 'Ali Veli', phone: '+90 532 111 22 33' })).toBeNull();
  });
  it('rejects short names and malformed phones', () => {
    expect(validateProfile({ fullName: 'A', phone: '' })).not.toBeNull();
    expect(validateProfile({ fullName: 'Ali Veli', phone: '123' })).not.toBeNull();
    expect(validateProfile({ fullName: 'Ali Veli', phone: '0532-111-2233' })).not.toBeNull();
    expect(validateProfile({ fullName: 'Ali Veli', phone: '1'.repeat(21) })).not.toBeNull();
  });
});

describe('validatePasswordChange', () => {
  const ok = { current: 'Eski!1234', next: 'Yeni!Parola9', confirm: 'Yeni!Parola9' };
  it('accepts a valid change', () => {
    expect(validatePasswordChange(ok)).toBeNull();
  });
  it('rejects empty current, short, mismatched and unchanged passwords', () => {
    expect(validatePasswordChange({ ...ok, current: '' })).not.toBeNull();
    expect(validatePasswordChange({ ...ok, next: 'kisa', confirm: 'kisa' })).not.toBeNull();
    expect(validatePasswordChange({ ...ok, confirm: 'Baska!Parola9' })).not.toBeNull();
    expect(
      validatePasswordChange({
        current: 'Ayni!Parola9',
        next: 'Ayni!Parola9',
        confirm: 'Ayni!Parola9',
      }),
    ).not.toBeNull();
  });
});

describe('account sections and roles', () => {
  it('shows the admin section only to platform admins', () => {
    expect(accountSections(owner)).not.toContain('admin');
    expect(accountSections(admin)).toContain('admin');
    expect(accountSections(admin)).not.toContain('company');
    expect(accountSections(owner)).toContain('company');
  });
  it('labels roles in Turkish', () => {
    expect(roleLabel(admin)).toBe('Platform yöneticisi');
    expect(roleLabel(owner)).toBe('Şirket sahibi');
    expect(
      roleLabel({
        ...owner,
        company: { id: 'c1', legalName: 'X A.Ş.', status: 'verified', memberRole: 'member' },
      }),
    ).toBe('Üye');
  });
});

describe('AdminShortcuts', () => {
  it('renders counts and links to /admin', () => {
    const html = renderToStaticMarkup(
      AdminShortcuts({ counts: { companies: 3, listings: 0, disputes: 1, payments: 2 } }),
    );
    expect(html).toContain('Onay bekleyen şirket');
    expect(html).toContain('href="/admin?tab=havaleler"');
    expect(html).toContain('>3<');
  });
  it('degrades to dashes when counts are unavailable', () => {
    expect(renderToStaticMarkup(AdminShortcuts({ counts: null }))).toContain('—');
  });
});
