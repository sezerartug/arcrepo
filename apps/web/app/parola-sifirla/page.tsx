import Link from 'next/link';
import { Empty, PageTitle } from '@/components/common';
import { ResetPasswordForm } from '@/components/password-forms';

export const metadata = { title: 'Parola sıfırla · ARC Global' };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <>
      <PageTitle>Yeni parola belirleyin</PageTitle>
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <Empty>
          Sıfırlama bağlantısı geçersiz.{' '}
          <Link className="underline" href="/parola-unuttum">
            Yeni bağlantı isteyin
          </Link>
          .
        </Empty>
      )}
    </>
  );
}
