import { RegisterForm } from '@/components/auth-forms';
import { PageTitle } from '@/components/common';

export const metadata = { title: 'Kayıt · ARC Global' };

export default function RegisterPage() {
  return (
    <>
      <PageTitle sub="Alıcı ve satıcı yalnızca şirketlerdir">Şirket kaydı</PageTitle>
      <RegisterForm />
    </>
  );
}
