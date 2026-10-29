import { AdminActionDialog } from './admin-action-dialog';

/** Per-user admin actions: suspend / unsuspend (reason required) and "send password reset link". */
export function UserAdminActions({
  userId,
  suspended,
  suspendReason,
}: {
  userId: string;
  suspended: boolean;
  suspendReason: string | null;
}) {
  const base = `/admin/users/${userId}`;
  return (
    <div className="flex flex-col items-start gap-1">
      {suspended ? (
        <>
          <span className="text-xs font-medium text-destructive">
            Askıda{suspendReason ? `: ${suspendReason}` : ''}
          </span>
          <AdminActionDialog
            path={`${base}/unsuspend`}
            label="Askıyı kaldır"
            title="Kullanıcının askısını kaldır"
            description="Kullanıcı yeniden giriş yapabilecek."
            reason="required"
            variant="outline"
            doneMessage="Askı kaldırıldı."
          />
        </>
      ) : (
        <AdminActionDialog
          path={`${base}/suspend`}
          label="Askıya al"
          title="Kullanıcıyı askıya al"
          description="Yalnızca bu kullanıcı etkilenir: tüm oturumları kapatılır ve giriş yapamaz. Şirketin diğer üyeleri etkilenmez."
          reason="required"
          variant="destructive"
          doneMessage="Kullanıcı askıya alındı."
        />
      )}
      <AdminActionDialog
        path={`${base}/send-reset`}
        label="Parola sıfırlama bağlantısı gönder"
        title="Parola sıfırlama bağlantısı gönder"
        description="Bağlantı kullanıcının e-posta adresine gönderilir; size gösterilmez."
        variant="outline"
        doneMessage="Bağlantı e-posta ile gönderildi."
      />
    </div>
  );
}
