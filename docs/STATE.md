# STATE.md — Tek bakışta proje durumu (her oturumda ÖNCE bunu oku; projeyi baştan okuma)

Güncelleme kuralı: bir dilim/görev bitince yalnızca bu dosyadaki tablo + "Sıradaki" satırı güncellenir. Ayrıntı: `docs/MVP-PLAN.md` (kararlar + API sözleşmesi), `docs/ROADMAP.md` (checkbox), `docs/LOG.md` (günlük).

## Dilim durumu (MVP-PLAN §Dilimler)
| Dilim | Durum | Not |
|---|---|---|
| S0 Ortam + DB temeli | ✅ | Kysely + embedded PG, audit, FOR UPDATE testi |
| S1 Kimlik/şirket/admin | ✅ | giriş kilidi (5 hata/15 dk, e-posta+IP, bellek içi) + kayıt/sıfırlama IP sınırı; parola sıfırlama (`password_resets`, migration 0005, `MailPort` → konsol + `.data/mail/`); e-posta doğrulama YOK |
| S2 Katalog/ilan/arama | ✅ | ilan düzenleme ekranı `/satici/[id]/duzenle` (yayındaki mezat ilanı düzenlenemez: `AUCTION_LISTING_LOCKED`); satıcı/admin rezervi görür |
| S3 Ledger + mezat | ✅ | 200 paralel teklif testi geçti; dayanıklılık/k6 yok |
| S4 Sipariş + sahte havale | ✅ | oto teslim onayı: shipped + `AUTO_CONFIRM_DAYS` (7) → `OrdersService.sweepAutoConfirm` (actor system) |
| S5 Web ekranları + tohum veri | ✅ | tarayıcıda elle tıklama doğrulanmadı |

## Sıradaki
MVP tamam (yerel demo). Sıradaki: tarayıcıda elle gezinti + hata düzeltme; sonra ROADMAP 'MVP sonrası' sırası (mesajlaşma, e-posta/telefon doğrulama, görsel yükleme denemesi). Not: istemci IP'si `req.ip` (proxy güveni kapalı; Next rewrite arkasında tüm web trafiği tek IP görünür). Env: `AUTO_CONFIRM_DAYS`, `REGISTER_RATE_MAX` (20/sa), `RESET_RATE_MAX` (10/sa), `WEB_BASE_URL`, `MAIL_DIR`. Çalıştır: `pnpm demo` (web :3000, api :3001). Hesaplar: admin@arc.local/Admin!2345; satici1@, satici2@, alici@arc.local / Demo!2345.

## Dosya haritası (nerede ne var)
- `apps/api/src/db/` — `client.ts` (Kysely), `clock.ts` (`dbNow`), `migrate.ts` (liste), `migrations/NNNN_*.ts`, `schema.ts` (tablo tipleri)
- `apps/api/src/modules/<modül>/{index.ts (public), application, infrastructure, http}` — modüller arası yalnızca `index.ts`
- `apps/api/scripts/` — `dev-db.ts` (yerel PostgreSQL), `local-postgres.ts`
- `apps/api/src/test/` — test DB yardımcıları (`createTestDb`)
- `apps/web/app/` — Next.js sayfaları · `apps/web/components/ui/` — shadcn
- Çalıştır: `pnpm db:start` (api paketinde: `pnpm --filter @arc/api db:start`) → `pnpm dev`

## Tuzaklar (tekrar keşfetme)
- Windows'ta her PowerShell çağrısı PATH'i sıfırlar: `git`/`pnpm` için önce PATH'i yükle (`$env:USERPROFILE\bin` pnpm shim'i). `CI=true` olmadan pnpm TTY ister.
- Dosya aktarımında (flash/OneDrive) dosyalar NUL'a dönebilir; `git status` ile kontrol et, `git checkout HEAD -- <dosya>`.
- `.env*` okunmaz/yazılmaz (settings engeli); yeni env değişkeni → `.env.example`'ı kullanıcı elle günceller veya `cp`.
- Tüm komutlar kökten; DB integration testleri `pnpm --filter @arc/api test:int` (ilk çalışma yavaş).

## Yönetici adına ilan + görsel yönetimi
- `POST /admin/listings` {companyId, ...} (AD, Idempotency-Key): doğrulanmış şirket adına ilan, doğrudan `published` (mezat: `createAuctionFromListing`), audit `admin.listing.create`. `POST /listings/:id/images` sahip veya admin; `DELETE /listings/:id/images/:imageId` (dosya diskten silinir, audit `listing.image.removed`). Web: `/admin/ilan-ekle` (+ `?companyId=`), `ListingImageGallery` düzenleme ekranında. Admin ilan alanlarını `PATCH /admin/listings/:id` ile düzenler (zorunlu `reason`, durum korunur, audit `admin.listing.update`; yayındaki mezat ilanı `AUCTION_LISTING_LOCKED`); web: `/satici/[id]/duzenle` admin kipi.

## Yönetici mezat izleme (X-06)
- `GET /admin/auctions?status=&q=&page=` (durum büyük harf: LIVE…) ve `GET /admin/auctions/:id` (gerçek şirket+kullanıcı adları; `admin.auction.view` audit; `?poll=1` yoklamada audit yazmaz). Web: `/admin?tab=mezatlar`, `/admin/mezatlar/[id]` (`AdminAuctionMonitor`, 3 sn yoklama). `GET /auctions` artık `imageUrl` döner (mezat kartı görseli).

## İtiraz / iade (X-08, X-09)
- Alıcı yalnızca `shipped` iken `POST /orders/:id/dispute {reason ≥10}` (★) açar → `disputed` (OrderSweeper ve confirm-delivery çalışmaz: geçiş tablosunda disputed→delivered yok). Yönetici: `GET /admin/disputes?status=&page=`, `POST /admin/disputes/:id/resolve {outcome:'refund'|'reject', refundMinor?, note}` (★). `GET /admin/orders?status=&q=&page=`.
- Muhasebe (tek journal `order.dispute_resolution`): escrow −total; bank_clearing +R; seller_payable +(K−komisyon(K)); platform_revenue +komisyon(K); K=total−R. R=total → `refunded` (satıcı/komisyon 0; mezat siparişinde teminat `refunded`, mezat yine SETTLED); aksi `completed`. `orders.refund_minor` ve `commission_minor` güncellenir; satıcı net = total − refund − commission.
- Web: `/siparisler/[id]` "İtiraz aç" diyaloğu + itiraz kartı; `/admin?tab=itirazlar` ve `?tab=siparisler`. Destek talebi (ticket) akışı yok (P3-07 KISMİ).
## Kullanıcı askıya alma + bildirimler (X-10, X-11)
- `users.suspended_at/suspend_reason` (migration 0007). `UserAdminService` (identity): `POST /admin/users/:id/suspend|unsuspend {reason}`, `/send-reset`. Askıdaki kullanıcı: oturumlar silinir, `byToken` null döner (401), login 403 `USER_SUSPENDED`. Web: `UserAdminActions` (admin Kullanıcılar sekmesi + şirket detayı).
- Bildirim: `notifications` (user_id başına satır + company_id, `read_at`). Yazım yalnız `notifyCompany(trx, ...)` (modules/notifications/index.ts) ile, olayın transaction'ında: teklif geçildi (`placeBidTx`), mezat sonucu (`AuctionCloser.notifyClosed`), sipariş durumu (`transitionOrder` → `notifyOrderParties`). API `/notifications*`; web `NotificationBell` (site-header, 20 sn yoklama) + `/bildirimler`. E-posta bildirimi yok.
