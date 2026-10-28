import Link from 'next/link';
import { LoginForm } from '@/components/auth-forms';
import { PageTitle } from '@/components/common';

export const metadata = { title: 'Giriş · ARC Global' };

export default function LoginPage() {
  return (
    <>
      <PageTitle>Giriş yap</PageTitle>
      <LoginForm />
      <p className="mt-4 text-sm">
        <Link className="underline" href="/parola-unuttum">
          Parolamı unuttum
        </Link>
      </p>
      <p className="mt-2 text-sm">
        Hesabınız yok mu?{' '}
        <Link className="underline" href="/kayit">
          Şirketinizi kaydedin
        </Link>
        .
      </p>
    </>
  );
}
