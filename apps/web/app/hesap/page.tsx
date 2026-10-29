import { AddMemberForm } from '@/components/add-member-form';
import { PasswordForm, ProfileForm, SessionsCard } from '@/components/account-forms';
import { AdminShortcuts } from '@/components/admin-shortcuts';
import { Card, LoadError, PageTitle, StatusBadge } from '@/components/common';
import { accountSections, roleLabel } from '@/lib/account';
import { formatDate } from '@/lib/api';
import { requireMe, serverGet } from '@/lib/server-api';
import type { AccountSession, Member, PendingCounts } from '@/lib/types';

export const metadata = { title: 'Hesabım · ARC Global' };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

export default async function AccountPage() {
  const me = await requireMe();
  const sections = accountSections(me);
  const [sessions, members, counts] = await Promise.all([
    serverGet<{ items: AccountSession[] }>('/me/sessions'),
    sections.includes('company') ? serverGet<Member[]>('/company/members') : null,
    sections.includes('admin') ? serverGet<PendingCounts>('/admin/pending-counts') : null,
  ]);

  return (
    <div className="space-y-6">
      <PageTitle sub={me.user.email}>{me.user.fullName}</PageTitle>

      <Card className="space-y-4">
        <h2 className="font-semibold text-primary">Profil</h2>
        <dl className="divide-y text-sm">
          <Row label="E-posta">{me.user.email}</Row>
          <Row label="Rol">{roleLabel(me)}</Row>
          {me.company ? (
            <Row label="Şirket">
              <span className="inline-flex flex-wrap items-center justify-end gap-2">
                {me.company.legalName} <StatusBadge status={me.company.status} />
              </span>
            </Row>
          ) : null}
          {me.user.createdAt ? (
            <Row label="Kayıt tarihi">{formatDate(me.user.createdAt)}</Row>
          ) : null}
        </dl>
        <ProfileForm fullName={me.user.fullName} phone={me.user.phone ?? ''} />
      </Card>

      <Card className="space-y-4">
        <h2 className="font-semibold text-primary">Güvenlik</h2>
        <PasswordForm />
      </Card>

      <Card className="space-y-4">
        <h2 className="font-semibold text-primary">Oturumlar</h2>
        {sessions.ok ? (
          <SessionsCard sessions={sessions.data.items} />
        ) : (
          <LoadError error={sessions.error} />
        )}
      </Card>

      {me.company ? (
        <Card className="space-y-2">
          <h2 className="font-semibold text-primary">Şirket</h2>
          <p className="flex items-center gap-2">
            {me.company.legalName} <StatusBadge status={me.company.status} />
          </p>
          {me.company.status === 'pending' ? (
            <p className="text-sm text-muted-foreground">
              Şirketiniz yönetici onayını bekliyor. Onaylanana kadar satın alma, ilan verme ve
              mezata katılma açılmaz.
            </p>
          ) : null}
          {me.company.status === 'rejected' || me.company.status === 'suspended' ? (
            <p className="text-sm text-destructive">
              Şirketiniz şu anda işlem yapamaz. Destek ile iletişime geçin.
            </p>
          ) : null}
          <p className="text-sm text-muted-foreground">
            Rolünüz: {me.company.memberRole === 'owner' ? 'Sahip' : 'Üye'}
          </p>
        </Card>
      ) : null}

      {members ? (
        <Card className="space-y-4">
          <h2 className="font-semibold text-primary">Üyeler</h2>
          {!members.ok ? (
            <LoadError error={members.error} />
          ) : (
            <ul className="divide-y text-sm">
              {members.data.map((m) => (
                <li key={m.email} className="flex justify-between py-2">
                  <span>
                    {m.fullName} <span className="text-muted-foreground">· {m.email}</span>
                  </span>
                  <span className="text-muted-foreground">
                    {m.role === 'owner' ? 'Sahip' : 'Üye'}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {me.company?.memberRole === 'owner' ? <AddMemberForm /> : null}
        </Card>
      ) : null}

      {sections.includes('admin') ? (
        <Card className="space-y-4">
          <h2 className="font-semibold text-primary">Yönetim</h2>
          <AdminShortcuts counts={counts?.ok ? counts.data : null} />
        </Card>
      ) : null}
    </div>
  );
}
