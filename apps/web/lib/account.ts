import type { Me } from './types';

// Mirrors the API rules (the server stays authoritative): password 8-128, phone 7-20 of digits, + and spaces.
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;
const PHONE_RE = /^[0-9+ ]{7,20}$/;

export function validateProfile(input: { fullName: string; phone: string }): string | null {
  const name = input.fullName.trim();
  if (name.length < 2 || name.length > 120) return 'Ad soyad 2–120 karakter olmalı.';
  const phone = input.phone.trim();
  if (phone !== '' && !PHONE_RE.test(phone)) {
    return 'Telefon yalnızca rakam, + ve boşluk içerebilir (7–20 karakter).';
  }
  return null;
}

export function validatePasswordChange(input: {
  current: string;
  next: string;
  confirm: string;
}): string | null {
  if (input.current === '') return 'Mevcut parolanızı girin.';
  if (input.next.length < PASSWORD_MIN)
    return `Yeni parola en az ${String(PASSWORD_MIN)} karakter olmalı.`;
  if (input.next.length > PASSWORD_MAX)
    return `Yeni parola en çok ${String(PASSWORD_MAX)} karakter olabilir.`;
  if (input.next !== input.confirm) return 'Yeni parola ile tekrarı aynı değil.';
  if (input.next === input.current) return 'Yeni parola mevcut parolanızdan farklı olmalı.';
  return null;
}

export function roleLabel(me: Me): string {
  if (me.user.isAdmin) return 'Platform yöneticisi';
  if (me.company?.memberRole === 'owner') return 'Şirket sahibi';
  return 'Üye';
}

export type AccountSection = 'profile' | 'security' | 'sessions' | 'company' | 'admin';

/** Which cards /hesap shows: company only with a company, admin only for platform admins. */
export function accountSections(me: Me): AccountSection[] {
  const out: AccountSection[] = ['profile', 'security', 'sessions'];
  if (me.company) out.push('company');
  if (me.user.isAdmin) out.push('admin');
  return out;
}

export const ADMIN_SHORTCUTS = [
  ['companies', 'Onay bekleyen şirket', '/admin/sirketler'],
  ['listings', 'İncelemedeki ilan', '/admin?tab=ilanlar&status=pending_review'],
  ['disputes', 'Açık itiraz', '/admin?tab=itirazlar'],
  ['payments', 'Bekleyen havale', '/admin?tab=havaleler'],
] as const;
