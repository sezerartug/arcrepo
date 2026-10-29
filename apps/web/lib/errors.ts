import { ApiError, formatTry } from './api';

const MESSAGES: Record<string, string> = {
  NETWORK: 'Sunucuya ulaşılamadı. Lütfen tekrar deneyin.',
  UNAUTHENTICATED: 'Bu işlem için giriş yapmalısınız.',
  FORBIDDEN: 'Bu işlem için yetkiniz yok.',
  NOT_FOUND: 'Kayıt bulunamadı.',
  VALIDATION_ERROR: 'Girdiğiniz bilgileri kontrol edin.',
  INVALID_CREDENTIALS: 'E-posta veya parola hatalı.',
  EMAIL_TAKEN: 'Bu e-posta ile kayıtlı bir kullanıcı var.',
  COMPANY_NOT_VERIFIED: 'Şirketiniz henüz onaylanmadı.',
  AUCTION_NOT_LIVE: 'Mezat şu anda canlı değil.',
  AUCTION_ENDED: 'Mezat sona erdi.',
  BID_TOO_LOW: 'Teklifiniz minimum tutarın altında.',
  SELF_BID: 'Kendi mezatınıza teklif veremezsiniz.',
  BIDDER_NOT_ELIGIBLE: 'Teklif vermek için önce teminat yatırıp onaylatmalısınız.',
  ALREADY_HIGH_BIDDER: 'En yüksek teklif zaten sizde.',
  RATE_LIMITED: 'Çok fazla deneme yapıldı. Lütfen daha sonra tekrar deneyin.',
  INVALID_RESET_TOKEN: 'Sıfırlama bağlantısı geçersiz veya süresi dolmuş. Yeni bağlantı isteyin.',
  AUCTION_LISTING_LOCKED: 'Yayındaki mezat ilanı düzenlenemez.',
  NOT_ADMIN: 'Bu işlem yalnızca platform yöneticileri içindir.',
  NO_COMPANY: 'Bu işlem için bir şirkete bağlı olmalısınız.',
  NOT_COMPANY_OWNER: 'Bu işlemi yalnızca şirket sahibi yapabilir.',
  NOT_LISTING_OWNER: 'Bu ilan şirketinize ait değil.',
  TAX_NO_TAKEN: 'Bu vergi numarasıyla kayıtlı bir şirket var.',
  INVALID_TRANSITION: 'Kaydın mevcut durumunda bu işlem yapılamaz.',
  AUCTION_ACTIVE: 'İlanın devam eden bir mezatı var. Önce mezadı iptal edin.',
  PAYMENT_NOT_CONFIRMABLE: 'Bu ödeme şu anda onaylanamaz.',
  PAYMENT_AMOUNT_MISMATCH: 'Tutar, ödenmesi gereken tutarla uyuşmuyor.',
  NOTHING_TO_TRANSFER: 'Aktarılacak hakediş bulunmuyor.',
  NOT_FIXED_PRICE: 'Bu ilan sabit fiyatlı değil.',
  SELF_PURCHASE: 'Kendi ilanınızı satın alamazsınız.',
  INSUFFICIENT_STOCK: 'Yeterli stok yok.',
  QUANTITY_BELOW_MINIMUM: 'Miktar minimum sipariş miktarının altında.',
  WRONG_ROLE: 'Bu işlemi bu siparişte yapmaya yetkili değilsiniz.',
  TOO_MANY_IMAGES: 'En fazla 8 görsel yükleyebilirsiniz.',
  PAYLOAD_TOO_LARGE: 'Dosya çok büyük (en fazla 2 MB).',
  UNSUPPORTED_MEDIA_TYPE: 'Desteklenmeyen dosya türü.',
  IDEMPOTENCY_KEY_REQUIRED: 'İstek anahtarı eksik. Sayfayı yenileyip tekrar deneyin.',
  IDEMPOTENCY_KEY_INVALID: 'İstek anahtarı geçersiz. Sayfayı yenileyip tekrar deneyin.',
  BAD_REQUEST: 'İstek geçersiz.',
  INTERNAL: 'Sunucuda bir hata oluştu. Lütfen daha sonra tekrar deneyin.',
  IDEMPOTENCY_MISMATCH: 'İstek anahtarı çakıştı. Sayfayı yenileyip tekrar deneyin.',
};

/** Turkish, user-facing message for an error. */
export function errorMessage(e: unknown): string {
  if (!(e instanceof ApiError)) return 'Beklenmeyen bir hata oluştu.';
  if (e.code === 'BID_TOO_LOW' && typeof e.details.minNextBidMinor === 'string') {
    return `Teklifiniz çok düşük. En az ${formatTry(e.details.minNextBidMinor)} vermelisiniz.`;
  }
  if (e.code === 'RATE_LIMITED' && typeof e.details.retryAfterSeconds === 'number') {
    const minutes = String(Math.ceil(e.details.retryAfterSeconds / 60));
    return `Çok fazla deneme yapıldı. ${minutes} dakika sonra tekrar deneyin.`;
  }
  return MESSAGES[e.code] ?? 'İşlem tamamlanamadı.';
}
