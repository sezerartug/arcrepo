# CLAUDE.md

Şirket içi ürün: B2B inşaat malzemesi pazaryeri (öncelik çelik) — ilan + gerçek zamanlı açık artırma (mezat) + escrow'lu güvenli alışveriş (havale + teminat) + satıcı yönetimi. Alıcı ve satıcı yalnızca şirket.
Mimari: modüler monolit (TypeScript). Ayrıntılar gerektiğinde okunur, otomatik yüklenmez (token tasarrufu):
`docs/PRD.md` · `docs/ARCHITECTURE.md` · `docs/AUCTION-RULES.md` · `docs/SECURITY.md` · `docs/DEFINITION-OF-DONE.md`

## Oturum başlangıcı
1. `docs/ROADMAP.md` "MVP yolu" tablosundaki sırayla ilk işaretlenmemiş görevi bul; yalnızca o görevin satırını ve faz bölümünü oku.
2. `docs/LOG.md` dosyasının son girişini oku.
3. Kodlamadan önce 5–10 satırlık plan yaz. Ürün sahibi kararı (2026-10-28): rutin/teknik kararlarda onay bekleme, eksik dosyaları oluştur, devam et; yalnızca kritik kararlarda sor (iş kuralı: para/mezat/ödeme, geri alınamaz veya dışa etkili işlem, güvenlik kontrolünü gevşetme). Hedef: yalın, uçtan uca çalışan ürün.

## Çalışma ilkeleri
1. **Önce düşün.** Varsayımları açıkça yaz. Birden fazla yorum varsa seçenekleri sun, sessizce seçme.
2. **Sadelik.** İsteneni çözen en küçük kod. Tek kullanımlık soyutlama, spekülatif esneklik, istenmemiş özellik yok. Önce mevcut kodu ve standart kütüphaneyi kullan.
3. **Cerrahi değişiklik.** Yalnızca görevin gerektirdiği satırlara dokun. Komşu kodu "iyileştirme", yeniden biçimlendirme. Kendi değişikliğinin yetim bıraktığı kodu temizle; önceden var olan ölü kodu yalnızca istenirse sil.
4. **Hedef odaklı.** Görevi doğrulanabilir ölçüte çevir. Önce başarısız test, sonra kod (red → green → refactor). Testi çalıştırmadan "çalışıyor" deme.

Sadelik ilkesi şunları ASLA kısmaz: girdi doğrulama, yetkilendirme, hata yönetimi, transaction/kilit, idempotency, audit log, test.
Ponytail kuruluysa: çekirdek modüllerde (auction, ledger, payments) `/ponytail lite`; CRUD ve arayüzde `full`.

## Değişmez kurallar
- **Para:** `bigint` minor unit (kuruş) + ISO para birimi. float yok. Para hareketi yalnızca ledger servisi üzerinden, çift taraflı.
- **Zaman:** tek otorite veritabanı saati (`clock_timestamp()`), UTC `timestamptz`. İstemci saati hiçbir karar için kullanılmaz.
- Teklif / kapanış / ödeme / sipariş kodunu `docs/AUCTION-RULES.md` okumadan değiştirme. Değişmezler (I1–I10) testle korunur.
- Dış etkili her yazma idempotent (`Idempotency-Key`). Webhook'lar imza doğrulamalı ve tekilleştirilmiş.
- Her uç noktada kimlik doğrulama + nesne düzeyinde yetki kontrolü, sunucu tarafında. UI'da gizlemek güvenlik sayılmaz.
- Kritik eylemler (teklif, ödeme, iade, yönetici müdahalesi, rol/KYC değişikliği) audit log'a yazılır.
- Gizli bilgi, kart verisi, kişisel veri loga/koda/teste girmez. `.env*` dosyalarını okuma.
- Modüller yalnızca birbirinin public arayüzünü/olaylarını kullanır; derin import yok.
- Migration olmadan şema değişikliği yok. Migration'lar ileri uyumlu olmalı.
- Redis hiçbir zaman teklif/sipariş/ödeme için tek doğruluk kaynağı değildir; kaynak PostgreSQL'dir.

## Komutlar
Kökten çalıştır (Node ≥24, pnpm `packageManager` alanından). Tek paket için: `pnpm --filter @arc/api <komut>`.
- Kur: `pnpm install` · Geliştir: `pnpm dev` (web :3000, api :3001) · Build: `pnpm build`
- Typecheck: `pnpm typecheck` · Unit test: `pnpm test:unit`
- Lint: `pnpm lint` (modül sınır kuralı dahil) · Format: `pnpm format` / `pnpm format:check` · Sır taraması: `pnpm secrets:scan`
- Henüz yok: test:int + test:e2e (P1-19), migrate (P1-06).

## Bitirme protokolü (her görevde)
1. typecheck + lint + ilgili testler yeşil; çıktıyı özetle.
2. Yeni davranış için test eklendi. Bir değişmez etkilendiyse property/eşzamanlılık testi eklendi.
3. `docs/ROADMAP.md` içinde ilgili `- [ ]` → `- [x]` (yalnızca doğrulandıysa).
4. `docs/LOG.md`'ye giriş ekle: ne yapıldı, karar, test sonucu, `/usage` özeti, risk, sonraki adım.
5. Değişen dosyaları, atlananları ve kalan riskleri raporla. Test edilmemiş şeyi çalışıyor diye sunma.

## Token disiplini
- Görevler arasında `/clear`. Uzun oturumda `/compact` + neyin korunacağını yaz.
- Uzun çıktılı işleri (test koşturma, geniş arama, log okuma) `test-runner` subagent'ına devret.
- Plan/mimari: güçlü model. Uygulama: Sonnet. Basit subagent: Haiku.
- Dosyanın tamamını değil ilgili aralığı oku. `node_modules`, `dist`, lockfile ve üretilmiş dosyaları okuma.
- Bu dosyayı kısa tut (<150 satır). Uzun talimat → skill veya `docs/`.

## Dil
Kod, identifier, commit mesajı: İngilizce. Belgeler, açıklamalar, raporlar: Türkçe.
