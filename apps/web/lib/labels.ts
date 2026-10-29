// Turkish labels for codes that reach admin screens. Unknown codes fall back to the raw value.

const AUDIT_ACTIONS: Record<string, string> = {
  'admin.company.view': 'Şirket detayı görüntülendi',
  'admin.company.verify': 'Şirket onaylandı',
  'admin.company.reject': 'Şirket reddedildi',
  'admin.company.suspend': 'Şirket askıya alındı',
  'company.registered': 'Şirket kaydoldu',
  'company.verified': 'Şirket onaylandı',
  'company.rejected': 'Şirket reddedildi',
  'company.suspended': 'Şirket askıya alındı',
  'company.member_added': 'Üye eklendi',
  'user.password_reset_requested': 'Parola sıfırlama istendi',
  'user.password_reset': 'Parola sıfırlandı',
  'listing.created': 'İlan oluşturuldu',
  'listing.updated': 'İlan güncellendi',
  'listing.approved': 'İlan yayınlandı',
  'listing.rejected': 'İlan reddedildi',
  'listing.removed': 'İlan kaldırıldı',
  'auction.created': 'Mezat oluşturuldu',
  'auction.bid_accepted': 'Teklif kabul edildi',
  'auction.closed': 'Mezat kapandı',
  'auction.cancelled': 'Mezat iptal edildi',
  'deposit.requested': 'Teminat talep edildi',
  'deposit.confirmed': 'Teminat onaylandı',
  'deposit.held': 'Teminat emanette',
  'deposit.refunded': 'Teminat iade edildi',
  'deposit.applied': 'Teminat siparişe sayıldı',
  'deposit.forfeited': 'Teminat gelir kaydedildi',
  'deposit.cancelled': 'Teminat iptal edildi',
  'order.created': 'Sipariş oluşturuldu',
  'order.payment_confirmed': 'Ödeme onaylandı',
  'order.shipped': 'Sipariş kargolandı',
  'order.delivered': 'Teslim edildi',
  'order.completed': 'Sipariş tamamlandı',
  'order.cancelled': 'Sipariş iptal edildi',
  'order.payment_failed': 'Ödeme başarısız',
  'payout.transferred': 'Hakediş aktarıldı',
};

export function auditActionLabel(action: string): string {
  return AUDIT_ACTIONS[action] ?? action;
}

const ENTITIES: Record<string, string> = {
  company: 'Şirket',
  user: 'Kullanıcı',
  listing: 'İlan',
  auction: 'Mezat',
  order: 'Sipariş',
  deposit: 'Teminat',
  payout: 'Hakediş',
};
export const entityTypeLabel = (t: string): string => ENTITIES[t] ?? t;

const ACTORS: Record<string, string> = { admin: 'Yönetici', user: 'Kullanıcı', system: 'Sistem' };
export const actorTypeLabel = (t: string): string => ACTORS[t] ?? t;

const ROLES: Record<string, string> = {
  owner: 'Sahip',
  member: 'Üye',
  buyer: 'Alıcı',
  seller: 'Satıcı',
};
export const roleLabel = (r: string): string => ROLES[r] ?? r;

export const saleTypeLabel = (t: string): string =>
  t === 'auction' ? 'Mezat' : t === 'fixed' ? 'Sabit fiyat' : t;

const PAYMENT_KINDS: Record<string, string> = { deposit: 'Teminat', order: 'Sipariş' };
export const paymentKindLabel = (k: string): string => PAYMENT_KINDS[k] ?? k;
