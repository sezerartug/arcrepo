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
  IDEMPOTENCY_MISMATCH: 'İstek anahtarı çakıştı. Sayfayı yenileyip tekrar deneyin.',
};

/** Turkish, user-facing message for an error. */
export function errorMessage(e: unknown): string {
  if (!(e instanceof ApiError)) return 'Beklenmeyen bir hata oluştu.';
  if (e.code === 'BID_TOO_LOW' && typeof e.details.minNextBidMinor === 'string') {
    return `Teklifiniz çok düşük. En az ${formatTry(e.details.minNextBidMinor)} vermelisiniz.`;
  }
  return MESSAGES[e.code] ?? (e.message || 'İşlem tamamlanamadı.');
}
