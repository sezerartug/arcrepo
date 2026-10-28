import Link from 'next/link';
import { PageTitle } from '@/components/common';
import { ForgotPasswordForm } from '@/components/password-forms';

export const metadata = { title: 'Parolamı unuttum · ARC Global' };

export default function ForgotPasswordPage() {
  return (
    <>
      <PageTitle sub="Hesabınızın e-posta adresini girin">Parolamı unuttum</PageTitle>
      <ForgotPasswordForm />
      <p className="mt-4 text-sm">
        <Link className="underline" href="/giris">
          Girişe dön
        </Link>
      </p>
    </>
  );
}
