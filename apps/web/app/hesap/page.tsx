import { AddMemberForm } from '@/components/add-member-form';
import { Card, LoadError, PageTitle, StatusBadge } from '@/components/common';
import { requireMe, serverGet } from '@/lib/server-api';
import type { Member } from '@/lib/types';

export const metadata = { title: 'Hesabım · ARC Global' };

export default async function AccountPage() {
  const me = await requireMe();
  const members = me.company ? await serverGet<Member[]>('/company/members') : null;

  return (
    <div className="space-y-6">
      <PageTitle sub={me.user.email}>{me.user.fullName}</PageTitle>
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
    </div>
  );
}
