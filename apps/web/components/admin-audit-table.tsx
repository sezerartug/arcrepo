import { formatDate } from '@/lib/api';
import type { AdminAuditRow } from '@/lib/admin-types';
import { actorTypeLabel, auditActionLabel, entityTypeLabel } from '@/lib/labels';

const fmt = (s?: string) => (s ? formatDate(s) : '—');
export function AdminAuditTable({ rows }: { rows: AdminAuditRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">Denetim kayıtları</caption>
        <thead className="text-left text-muted-foreground">
          <tr>
            <th scope="col" className="py-1">
              Zaman
            </th>
            <th scope="col">Eylem</th>
            <th scope="col">Yapan</th>
            <th scope="col">Varlık</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id} className="border-t">
              <td className="py-1 text-muted-foreground">{fmt(a.occurredAt)}</td>
              <td>
                {auditActionLabel(a.action)}
                {a.reason ? (
                  <span className="text-xs text-muted-foreground"> · {a.reason}</span>
                ) : null}
              </td>
              <td>{actorTypeLabel(a.actorType)}</td>
              <td className="text-xs">
                {entityTypeLabel(a.entityType)}
                <span className="font-mono"> {a.entityId?.slice(0, 8)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
