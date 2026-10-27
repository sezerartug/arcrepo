# AUCTION-RULES.md — Açık artırma motoru kuralları (v0.1)

Bu doküman teklif, kapanış, ödeme penceresi ve sipariş bağlantısı için **bağlayıcı** kuraldır. Kodu değiştirmeden önce okunur; kural değişikliği önce burada yapılır (ADR + onay), sonra kodda.
Açık ürün kararları `OPEN-AU-xx` ile işaretlidir; Faz 0'da (P0-14) kapanır.

## 1. Durumlar ve geçişler
`DRAFT → SCHEDULED → LIVE → PAYMENT_PENDING → SETTLED`
Yan sonlar: `ENDED_NO_SALE` (teklif yok/rezerv sağlanmadı), `PAYMENT_FAILED`, `CANCELLED`.

| Geçiş | Tetikleyen | Koşul |
|---|---|---|
| DRAFT → SCHEDULED | Satıcı yayınlar | Moderasyon onayı, geçerli kurallar |
| SCHEDULED → LIVE | Worker/ilk erişim | `starts_at <= clock_timestamp()` |
| SCHEDULED → CANCELLED | Satıcı/yönetici | Teklif yok |
| LIVE → PAYMENT_PENDING | Closer | `ends_at <= clock_timestamp()` ve kazanan var ve rezerv sağlandı |
| LIVE → ENDED_NO_SALE | Closer | Teklif yok veya rezerv sağlanmadı |
| LIVE → CANCELLED | Yalnızca yönetici | Neden zorunlu, audit, bildirim (OPEN-AU-09) |
| PAYMENT_PENDING → SETTLED | Ödeme onayı (webhook) | Escrow tahsil edildi, sipariş ödendi |
| PAYMENT_PENDING → PAYMENT_FAILED | Süre dolumu/ret | Ödeme penceresi bitti |
| PAYMENT_FAILED → … | Politika | OPEN-AU-07: ikinci teklif sahibine teklif / yeniden listeleme |

Tablo dışı geçiş kodda imkânsız olmalı (tek geçiş fonksiyonu; test edilir).

## 2. Değişmezler (testle korunur)
- **I1** Bir artırmanın kabul edilmiş teklifleri için `seq` 1'den başlayan, boşluksuz, artan tamsayıdır; `(auction_id, seq)` unique.
- **I2** Kabul edilmiş teklif tutarları `seq` ile kesin artandır; her biri öncekinden en az `min_increment` fazladır (ilk teklif ≥ başlangıç fiyatı).
- **I3** Hiçbir teklif, kabul anında `ends_at` değerine eşit veya sonrasında kabul edilmez (kabul anı = kilit sonrası `clock_timestamp()`).
- **I4** Bir artırma için en fazla bir `auction_results` satırı vardır (`auction_id` unique).
- **I5** Kazanan, en yüksek `seq`'e sahip kabul edilmiş tekliftir; sonuçtaki fiyat bu teklifin tutarıdır.
- **I6** Bir artırma kazanımı için en fazla bir sipariş vardır (kısmi unique index).
- **I7** Ledger: her journal'ın entry toplamı 0; escrow bakiyesi sipariş durumuyla tutarlı.
- **I8** Sipariş toplamı = nihai fiyat + ücretler; ledger ile eşit.
- **I9** Durum yalnızca §1 tablosundaki geçişlerle değişir.
- **I10** Aynı `Idempotency-Key` + aynı gövde → aynı yanıt, yeni yan etki yok; aynı anahtar + farklı gövde → 422.

## 3. Zaman kuralı
- Tek otorite: veritabanı saati. Karar anındaki zaman, **satır kilidi alındıktan sonra** `clock_timestamp()` ile okunur. (`now()` transaction başlangıcını döndürür; kilit beklemiş bir transaction'da eskimiş olur.)
- `ends_at` (güncel bitiş) ve `original_ends_at` saklanır. İstemciye her olayda `server_now` ve `ends_at` gönderilir; istemci geri sayımı `server_now` farkıyla (offset) çizer ve **yalnızca gösterimdir**.
- BullMQ gecikmeli işi hızlandırıcıdır; doğruluk, DB'deki `ends_at` + süpürücüdür (§5).
- DB sunucusu saat senkronizasyonu (NTP/yönetilen servis) izlenir; sapma alarmı.

## 4. Teklif verme (PlaceBid) — tek transaction
İzolasyon: READ COMMITTED (varsayılan). Satır kilidi beklendikten sonra `FOR UPDATE` güncel satırı görür. REPEATABLE READ/SERIALIZABLE seçilirse serialization failure için yeniden deneme gerekir.

```sql
BEGIN;
-- 1) Idempotency: aynı anahtar eşzamanlı gelirse ikincisi birincinin commit'ini bekler
INSERT INTO idempotency_keys(user_id, key, request_hash, created_at)
VALUES ($user, $key, $hash, clock_timestamp())
ON CONFLICT (user_id, key) DO NOTHING;
--    0 satır eklendiyse: saklı yanıtı döndür (hash farklıysa 422) ve ÇIK.

-- 2) Kilit
SELECT * FROM auctions WHERE id = $auction FOR UPDATE;

-- 3) Zaman (kilitten SONRA)
SELECT clock_timestamp() AS t;

-- 4) Doğrulama (saf fonksiyon): durum=LIVE, t < ends_at, bidder ≠ seller,
--    bidder uygun (doğrulanmış, yasaklı değil, güvence var), amount ≥ current + increment
--    (ilk teklifte ≥ start_price), üst sınır, art arda aynı kişi politikası (OPEN-AU-10)

-- 5a) Kabul: seq = last_seq + 1
INSERT INTO bids(auction_id, seq, bidder_id, amount_minor, accepted_at, idempotency_key) ...;
UPDATE auctions SET current_price_minor=$amount, high_bid_id=$bid, last_seq=last_seq+1,
       bid_count=bid_count+1, version=version+1,
       ends_at = CASE WHEN ends_at - $t <= extension_window
                      THEN LEAST($t + extension, hard_end_cap) ELSE ends_at END,
       extension_count = extension_count + (ends_at - $t <= extension_window)::int
WHERE id=$auction;
INSERT INTO auction_events(auction_id, seq, type, payload, at) ...;
INSERT INTO outbox_events(...);             -- yayın + closer yeniden zamanlama

-- 5b) İş kuralı reddi: bids'e yazma; bid_attempts + idempotency yanıtı yaz ve YİNE COMMIT
--     (reddedilen isteğin tekrarı aynı yanıtı alsın; altyapı hatasında ROLLBACK)
COMMIT;
```
Kurallar: kabul/ret kararı kilidi alma sırasına göre verilir; aynı tutarla gelen ikinci teklif, birincinin ardından "çok düşük" reddi alır (eşit tutar kazanamaz). Kabul yanıtı **commit sonrası** döner. Prisma'da bu blok `$transaction` içinde raw SQL ile yazılır.

Ret kodları: `AUCTION_NOT_LIVE`, `AUCTION_ENDED`, `BID_TOO_LOW` (yanıtta `min_next_bid`), `SELF_BID`, `BIDDER_NOT_ELIGIBLE`, `RATE_LIMITED`, `IDEMPOTENCY_MISMATCH`, `ALREADY_HIGH_BIDDER` (OPEN-AU-10).

## 5. Kapanış (Closer)
Üç katman, hepsi aynı idempotent fonksiyonu çağırır:
1. **Gecikmeli iş** (BullMQ) — `ends_at`'te; uzatmada yeniden zamanlanır.
2. **Süpürücü** — her 1–2 sn: `SELECT id FROM auctions WHERE status='LIVE' AND ends_at <= clock_timestamp() ORDER BY ends_at LIMIT 100 FOR UPDATE SKIP LOCKED`; her artırma ayrı transaction'da kapanır.
3. **Tembel kapanış** — süresi dolmuş bir artırmaya gelen her teklif reddedilir (`AUCTION_ENDED`) ve kapanış tetiklenir.

```sql
BEGIN;
SELECT * FROM auctions WHERE id=$a FOR UPDATE;
-- Koşul: status='LIVE' AND ends_at <= clock_timestamp(). Değilse NOOP (uzatılmış olabilir).
-- Kazanan: son kabul edilen teklif (en yüksek seq)
INSERT INTO auction_results(auction_id, outcome, winner_id, winning_bid_id, final_price_minor, at)
VALUES (...);                                -- auction_id UNIQUE → ikinci çalışma hata/NOOP
UPDATE auctions SET status = 'PAYMENT_PENDING' | 'ENDED_NO_SALE', closed_at = clock_timestamp();
INSERT INTO orders(source_auction_id, ...);  -- kısmi unique index: tek sipariş
INSERT INTO outbox_events(...);              -- sonuç yayını, bildirimler, ödeme penceresi
COMMIT;
```
Hedef: `closed_at − ends_at` p99 < 2 sn. Closer iki kez veya iki worker'da çalışırsa sonuç aynıdır (I4, I6).

## 6. Uzatma (anti-sniping) — OPEN-AU-02
Öneri: son 60 sn içindeki kabul edilen teklif, bitişi `t + 60 sn` yapar; en fazla N uzatma veya `hard_end_cap`. Parametreler artırma başına saklanır; değişirse yeni artırmalar etkilenir, canlılar etkilenmez.

## 7. Gerçek zamanlı protokol
Olay zarfı: `{ auctionId, seq, type, price_minor, bidder_alias, ends_at, server_now }`; türler: `bid.accepted`, `auction.extended`, `auction.closed`, `auction.cancelled`.
- Teklif veren kimliği anonim (`Teklif veren #3`); satıcı ve yönetici gerçek kimliği panelde görür.
- İstemci `lastSeq` tutar; `seq` boşluğu veya yeniden bağlanmada `GET /auctions/:id/snapshot` çağırır.
- Yeniden bağlanma: üstel geri çekilme + jitter. Kalp atışı ile ölü bağlantı tespiti.
- Arayüz iyimser güncelleme yapmaz: teklif gönderilince "gönderildi", sunucu kabul edince "kabul edildi/geçildi" gösterilir.

## 8. Ödeme penceresi ve güvence — OPEN-AU-06/07/08
- Teklif için yetkinlik: doğrulanmış telefon/e-posta, KYC/limit, güvence (ön provizyon veya depozito).
- Kazanan `payment_window` (öneri: 24–48 sa) içinde öder. Ödemeyen: ihlal kaydı + politika (ikinci teklif sahibine teklif **veya** yeniden listeleme). İkinci teklif yalnızca rezervi sağlıyorsa.
- Sipariş tek yoldan, `orders` arayüzüyle oluşur; tutar ledger ile uzlaşır (I7, I8).

## 9. Kötüye kullanım
Teklif başına hız sınırı (kullanıcı, IP, artırma), kendi ilanına/ilişkili hesaba teklif engeli, yeni hesap limitleri, şişirme (shill) sinyalleri (aynı cihaz/IP kümesi, tekrar eden satıcı-alıcı çiftleri, hep aynı satıcıya teklif, geri çekilen yüksek teklif örüntüsü), otomatik betik tespiti. Karar mekanizması: önce **işaretle ve incele**, otomatik cezayı ancak güvenilirlik ölçülünce aç.

## 10. Test matrisi (Faz 4 kapısı)
| Katman | Ne | Araç |
|---|---|---|
| Birim | Saf kural fonksiyonları, geçiş tablosu | Vitest |
| Property | Rastgele teklif akışlarında I1–I5, I9 | fast-check |
| Eşzamanlılık | N=200+ paralel teklif; aynı tutar yarışı; kapanış-teklif yarışı; aynı anahtar çift istek | Testcontainers (gerçek PG) |
| Dayanıklılık | Süreç ortada ölür; closer iki kez; DB bağlantı kopması; worker kaybı; saat sapması | Fault injection |
| Entegrasyon | Kazanan → sipariş → escrow → ledger (I6–I8) | Testcontainers |
| Yük | Son 10 sn yoğunluğu, WebSocket fan-out | k6 |
| Üretim | Değişmez denetçisi (I1–I10) periyodik | Zamanlanmış iş + alarm |

## 11. Açık ürün kararları (P0-14)
OPEN-AU-01 artış tablosu (sabit/kademeli) · 02 uzatma penceresi/süre/üst sınır · 03 rezerv fiyatın görünürlüğü · 04 "hemen al" ilk tekliften sonra kalkar mı · 05 teklif geri çekme (öneri: yok) · 06 teklif güvencesi türü/tutarı · 07 başarısız ödeme politikası · 08 ödeme penceresi süresi · 09 yönetici iptali koşulları ve tazmin · 10 aynı kişinin art arda teklifi · 11 komisyon ve ücret hesabı · 12 mesafeli satış/cayma hakkı artırma satışlarına uygulanır mı (hukuk).
