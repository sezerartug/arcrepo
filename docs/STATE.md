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
MVP + yönetim/itiraz/bildirim/mali rapor/çok sektörlü kategori/slider/koyu mod/hesap sayfası TAMAM (yerel demo; ROADMAP X-01…X-19). Bekleyenler (sırasız, ürün sahibi seçer): demo temizliği tamamlandı (2026-10-29, DB sıfırlandı); para koduna bağımsız inceleme (P4-19); sır taraması dev parolası ayarı (onay gerekir); mesajlaşma (P2-10); e-posta/telefon doğrulama (sağlayıcı kararı); destek talebi; tarayıcıda görsel doğrulama (slider, koyu mod, yeni sayfalar) kullanıcıda. Modeller: Fable/Opus 5 yok; Sonnet (kod), Haiku (basit). Not: istemci IP'si `req.ip` (proxy güveni kapalı; Next rewrite arkasında tüm web trafiği tek IP görünür). Env: `AUTO_CONFIRM_DAYS`, `REGISTER_RATE_MAX` (20/sa), `RESET_RATE_MAX` (10/sa), `WEB_BASE_URL`, `MAIL_DIR`. Çalıştır: `pnpm demo` (web :3000, api :3001). Hesaplar: admin@arc.local/Admin!2345; satici1@, satici2@, alici@arc.local / Demo!2345.

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

## Mali rapor (X-12)
- Salt okunur: `GET /admin/finance/summary?range=|from=&to=` (+ `orders.csv`, `payouts.csv`; CSV `;` ayraçlı, BOM'lu, audit `admin.finance.export`). Aralık metrikleri (komisyon, forfeit, ciro, iade, itiraz) tarihle süzülür; bakiyeler (escrow, hakediş, teminat, bank_clearing) her zaman anlık. `consistency.ok` = ledger toplamı 0 ve escrow = açık siparişlerin toplamı. Kod: `modules/admin/admin-finance.service.ts`; web: `components/admin-finance-report.tsx`.

## Kategori ağacı + ikinci el (X-13)
- Migration 0008: 7 üst kategori (İnşaat Malzemeleri [Çelik>demir/profil/sac/boru, Çimento, Agrega, Tuğla/Blok, Yalıtım], Makine ve Ekipman, İş Makineleri, Hurda ve Geri Dönüşüm, El Aletleri ve Hırdavat, Fabrika ve Depo Ekipmanları, Proje ve İş İhaleleri); slug anahtarlı upsert, mevcut kimlikler korunur. Birim 'iş' (hizmet). `listings.condition` (yeni|ikinci_el|hurda). `GET /listings?categoryId=` (alt soylar dahil) ve `?condition=`. Web: `CategoryPicker` (ana>alt), `/ilanlar?condition=ikinci_el` kısayolu. Test yardımcısı `seedCategory` varsayılan slug'ı `test-demir` (migration slug'larıyla çakışmasın).


## Hero slider + tema (X-14, X-15)
- Hero: `components/hero-slider.tsx` (istemci; kategori ağacını prop alır, birincil bağlantı kategori ADIYLA çözülür) + `components/illustrations/hero-scenes.tsx`. Tema: `lib/theme.ts` (anahtar `arc-theme`, <head> betiği) + `components/theme-toggle.tsx`; renkler `globals.css` içinde `[data-theme='dark']`. Üst menü/alt bilgi/hero `bg-chrome text-chrome-foreground` (her iki temada koyu lacivert); `text-brand-text` = turuncu vurgu metni. Yeni arayüzde sabit renk (bg-white, #hex) kullanma, token kullan.

## Ana sayfa + satıcı özeti (X-16, X-17)
- Ana sayfa: `HomeSearch`, `TrustCenter` (5 kart), `HomeTabs` (`?sekme=` → `lib/home.ts` HOME_TABS → /listings saleType/condition), `LiveDot`; kartlarda Doğrulanmış şirket (status published) ve %5 teminatlı rozetleri. `/satici` üstünde `SellerSummaryCards` (`computeSellerSummary`: canlı mezat = /auctions?status=live ∩ satıcı ilanları; bekleyen sipariş = awaiting_payment + paid_escrow). API değişmedi. Tarayıcıda görsel doğrulama yapılmadı.


## Hesap sayfası (X-18)
- Migration 0009 `users.phone`. `AuthContext` artık `sessionId/phone/createdAt` taşır. `AuthService`: `changePassword` (limiter `passwordChange` kullanıcı başına 5/15 dk, bellek içi), `updateProfile`, `listSessions`, `revokeSession`, `revokeOtherSessions`. Admin: `GET /admin/pending-counts` (`AdminDirectoryService.pendingCounts`). Web: `components/account-forms.tsx`, `admin-shortcuts.tsx`, `lib/account.ts` (doğrulama + bölüm mantığı).
