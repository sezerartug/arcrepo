# MVP-PLAN.md — Yerelde çalışan demo sürümü (2026-10-28)

Hedef: 500 kullanıcılık yerel ölçek, tek süreç, Docker/Redis yok. Firmaya gösterilecek uçtan uca akış:
**şirket kaydı → admin onayı → satıcı ilan verir → admin onaylar → alıcı arar → sabit fiyatla satın alır VEYA mezata teminat yatırıp teklif verir → sipariş → sahte havale → escrow → teslim → hakediş.**
Bağlayıcı kurallar: `AUCTION-RULES.md`, değişmezler CLAUDE.md. Bu dosya yalnızca MVP kararlarını ve API sözleşmesini tutar.

## MVP varsayılanları (OPEN-AU — ürün sahibi onayı bekliyor; gerçek para yok, sahte havale)
| Karar | MVP değeri |
|---|---|
| OPEN-AU-01 artış | Mezat başına sabit `min_increment_minor` (birim fiyat üzerinden) |
| 02 uzatma | Son 60 sn içinde kabul edilen teklif bitişi `t+60 sn` yapar; en fazla 10 uzatma ve ilk `ends_at + 15 dk` tavanı |
| 03 rezerv | Gizli; yalnızca satıcı/admin görür. Sağlanmazsa `ENDED_NO_SALE` |
| 04 hemen al | Yok (v2) |
| 05 geri çekme | Yok |
| 06 teminat | Başlangıç fiyatı × miktar toplamının %5'i (yuvarla yukarı), mezat başına bir kez, sahte havale + admin onayı. Kaybeden: iade; kazanan: ödemeye sayılır; ödemeyen kazanan: satıcıya değil platforma kalır (ihlal) |
| 07 başarısız ödeme | `PAYMENT_FAILED`; ikinci teklif sahibine teklif yok (v2), satıcı yeniden listeler |
| 08 ödeme penceresi | 48 saat (env ile ayarlanır) |
| 09 yönetici iptali | Yalnızca admin, neden zorunlu, teminatlar iade, audit |
| 10 art arda teklif | Zaten en yüksek teklif sahibi tekrar veremez (`ALREADY_HIGH_BIDDER`) |
| 11 komisyon | Satıcıdan %2 (env: `COMMISSION_BPS=200`), KDV hariç tutar üzerinden |
| 12 cayma | Uygulanmaz (B2B); hukuk lansman öncesi |

Fiyat/miktar: `unit_price_minor` = satış birimi başına kuruş (çelik: TL/ton). Miktar `quantity_base` = en küçük birimde tamsayı (kg). Kategori `base_per_unit` (ton=1000, adet=1, m3=1000 (litre değil: dm³), palet=1, torba=1). Toplam = `round_half_up(unit_price_minor × quantity_base / base_per_unit)` — **tek fonksiyon** `lineTotalMinor` (modül `pricing`), KDV hariç. KDV bilgi amaçlı gösterilir, ledger'a girmez.

## Teknik kararlar
- API: NestJS + Kysely + PostgreSQL (embedded, `pnpm db:start`). Web: Next.js; `/api/*` → API'ye rewrite (aynı origin, çerez sorunsuz).
- Oturum: rastgele token, DB'de sha256 özeti, `HttpOnly; SameSite=Lax` çerez `arc_session`, 7 gün. Parola: `node:crypto` `argon2id`. Her istekte sunucu tarafı kimlik + nesne yetkisi.
- Zaman: yalnızca `clock_timestamp()`. Para: `bigint` kuruş; API JSON'da **string** olarak taşınır (`"amount_minor":"1250000"`).
- Canlı güncelleme: istemci `GET /auctions/:id` (snapshot + `server_now`) yoklar (1 sn, mezat sayfasında). Kapanış: API süreci içinde 1 sn'lik süpürücü + tembel kapanış.
- Redis/BullMQ/WebSocket/outbox yok (ROADMAP "Yalın kapsam"). Mail: konsola yazan `MailPort`.
- E-posta/telefon doğrulama, MFA, KYC yok: şirket doğrulaması = vergi no format kontrolü (10 hane) + admin onayı.
- Rol modeli: `users.is_platform_admin`; şirket üyeliği `company_members.role` ∈ `owner | member`. Doğrulanmış şirket hem alır hem satar.

## Veri modeli (tablolar)
`users, sessions, companies(status pending|verified|rejected|suspended), company_members, categories(parent_id,name,slug,unit,base_per_unit), listings(company_id,category_id,title,description,attrs jsonb,sale_type fixed|auction,unit_price_minor,quantity_base,min_order_base,location,delivery_terms,status pending_review|published|rejected|sold|removed), listing_images(path), auctions(listing_id unique, status, start_price_minor, min_increment_minor, reserve_minor, starts_at, ends_at, original_ends_at, hard_end_cap, last_seq, current_price_minor, high_bid_id, bid_count, extension_count, version, deposit_minor, closed_at), bids(auction_id,seq,bidder_company_id,bidder_user_id,amount_minor,accepted_at) unique(auction_id,seq), bid_attempts(rejections), auction_results(auction_id unique,...), deposits(auction_id,company_id,amount_minor,reference,status pending|held|refunded|applied|forfeited), orders(source_listing_id,source_auction_id unique partial,buyer_company_id,seller_company_id,unit_price_minor,quantity_base,total_minor,commission_minor,status,payment_reference,payment_due_at), ledger_accounts, ledger_journals, ledger_entries (toplam=0), idempotency_keys, audit_log (var)`.

## API sözleşmesi (REST, JSON, çerez oturumu; hata: `{ "error": { "code": "...", "message": "..." } }`)
Yazan uçlar `Idempotency-Key` başlığı kabul eder; (★) olanlarda zorunludur.
Kısaltma: [A]=giriş gerekli, [V]=doğrulanmış şirket, [AD]=platform admin.

**Kimlik**
- `POST /auth/register` `{email,password,fullName,company:{legalName,taxNo,taxOffice,address}}` → 201 `{user,company}`, oturum açar. Şirket `pending`.
- `POST /auth/login` `{email,password}` · `POST /auth/logout` · `GET /me` [A] → `{user,company:{id,legalName,status,memberRole}|null}`
- `POST /company/members` [A,owner] `{email,fullName}` → `{email,tempPassword}` (bir kez gösterilir) · `GET /company/members` [A]
**Katalog**
- `GET /categories` → ağaç `[{id,name,slug,unit,basePerUnit,children:[]}]`
- `GET /listings?q=&categoryId=&saleType=&minPrice=&maxPrice=&location=&sort=newest|price_asc|price_desc|ending&page=` → `{items,total,page}`; yalnızca `published`. Türkçe FTS (`turkish`+`unaccent`).
- `GET /listings/:id` → ilan + satıcı şirket adı + (mezat ise `auction` özeti). Yayında olmayan ilanı yalnızca sahibi/admin görür.
- `POST /listings` [V] (★) `{categoryId,title,description,attrs,saleType,unitPriceMinor,quantityBase,minOrderBase?,location,deliveryTerms,auction?:{startPriceMinor,minIncrementMinor,reserveMinor?,startsAt,endsAt}}` → `pending_review`
- `PATCH /listings/:id` [V,sahip] · `POST /listings/:id/remove` [V,sahip] · `GET /seller/listings` [V]
- `POST /listings/:id/images` [V,sahip] multipart `file` (jpeg/png/webp ≤2 MB, içerik türü doğrulanır, yerel `.data/uploads`) · `GET /uploads/:file`
- `POST /listings/:id/favorite` / `DELETE` [A] · `GET /favorites` [A]
**Mezat**
- `GET /auctions/:id` → `{id,listingId,status,currentPriceMinor,minNextBidMinor,bidCount,endsAt,serverNow,depositMinor,startsAt,bids:[{seq,amountMinor,bidder:"Teklif veren #n",at}] (son 20), winner?, myState:{eligible,depositStatus,isHighBidder}}`
- `GET /auctions?status=live|scheduled|closed` → liste
- `POST /auctions/:id/deposit` [V] (★) → `{reference,amountMinor,iban:"TR00 DEMO ...",status:"pending"}` (sahte havale talimatı)
- `POST /auctions/:id/bids` [V] (★) `{amountMinor}` → 201 `{seq,...snapshot}` | 409/422 `{error:{code: AUCTION_NOT_LIVE|AUCTION_ENDED|BID_TOO_LOW(minNextBidMinor)|SELF_BID|BIDDER_NOT_ELIGIBLE|ALREADY_HIGH_BIDDER|IDEMPOTENCY_MISMATCH}}`
**Sipariş / ödeme**
- `POST /listings/:id/buy` [V] (★) `{quantityBase}` (sabit fiyat) → `201 order`
- `GET /orders` [V] (alıcı veya satıcı şirketin) · `GET /orders/:id` [V, taraf]
- Durumlar: `awaiting_payment → paid_escrow → shipped → delivered → completed`; `cancelled`, `payment_failed`
- `POST /orders/:id/ship` [V,satıcı] · `POST /orders/:id/confirm-delivery` [V,alıcı] → hakediş serbest (ledger)
- Mezat kazananı için sipariş kapanışta kendiliğinden oluşur (`awaiting_payment`, teminat düşülmüş tutar).
**Admin** [AD]
- `GET /admin/companies?status=pending` · `POST /admin/companies/:id/verify|reject|suspend` (`reason`)
- `GET /admin/listings?status=pending_review` · `POST /admin/listings/:id/approve|reject` (`reason`)
- `GET /admin/payments?status=pending` (bekleyen teminat/sipariş havaleleri) · `POST /admin/payments/confirm` `{reference}` (sahte banka mutabakatı) · `POST /admin/auctions/:id/cancel` `{reason}`
- `GET /admin/audit?entityType=&entityId=` · `GET /admin/stats`
**Sağlık** `GET /health` → `{ok:true}`

## Dilimler (ROADMAP'teki görev kimlikleriyle)
| Dilim | İçerik | Görevler |
|---|---|---|
| S0 | Repo/ortam onarımı, DB temeli doğrula, PRD ölçeği | P1-06, P1-09 |
| S1 | Kimlik + şirket + admin onayı + audit + idempotency | P1-07, P1-08, P1-10, P2-12 |
| S2 | Kategori + ilan + görsel + arama + moderasyon + favori | P2-01…04, P2-06, P2-08, P2-09(favori), P2-11, P2-14 |
| S3 | Ledger + mezat (teklif, kapanış, teminat) + eşzamanlılık testleri | P1-14, P1-16, P4-01…08, P4-11…14 |
| S4 | Sipariş + sahte havale + escrow + teslim + hakediş | P3-01, P3-03…06, P4-09, P4-10, P3-08(sahte), P3-09 |
| S5 | Web: ziyaretçi/alıcı/satıcı/admin ekranları, tohum veri, demo betiği | P1-17, P2-13, P5-03, P5-06, P6-08 |
