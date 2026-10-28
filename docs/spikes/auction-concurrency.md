# Spike: mezat eşzamanlılık ölçümü (S3)

Ortam: Windows, gömülü PostgreSQL 18 (`durable:false`), tek API süreci, Kysely havuzu (pg varsayılanı: 10 bağlantı), READ COMMITTED.
Test: `apps/api/src/modules/auctions/auctions.int.test.ts` ("200 parallel bids"). 20 teklif veren şirket, 200 istek aynı anda, tutarlar benzersiz ve artan; her istek `FOR UPDATE` ile sıraya girer.

## Ölçüm (3 çalıştırma)
| Çalıştırma | Kabul | Duvar saati | p50 | p95 | p99 | max |
|---|---|---|---|---|---|---|
| 1 | 170 | 1670 ms | 967 ms | 1596 ms | 1646 ms | 1652 ms |
| 2 | 163 | 1524 ms | 843 ms | 1452 ms | 1502 ms | 1507 ms |
| 3 | 166 | 1569 ms | 881 ms | 1495 ms | 1545 ms | 1551 ms |

Yorum: gecikme, 200 isteğin aynı anda gelip 10 bağlantılık havuz + tek satır kilidinde sıraya girmesinin kuyruk süresidir (~8 ms/teklif sıralı işlem, ≈125 teklif/sn tek mezat). Gerçekçi yükte (saniyede birkaç teklif) tek teklifin işlem süresi bu değerdir, kuyruk oluşmaz. Üretim hedefi (p99) bu ölçümle doğrulanmadı: yük testi (k6) ayrı iştir.

## Doğruluk (her çalıştırmada)
- Çift kazanan = 0: `auction_results` satır sayısı 1 (I4); kazanan = en yüksek `seq` (I5).
- `seq` 1..n boşluksuz (I1); tutarlar kesin artan, her fark >= `min_increment` (I2); `last_seq = bid_count = bids` satır sayısı.
- Reddedilenler yalnızca `BID_TOO_LOW` / `ALREADY_HIGH_BIDDER`; 5xx yok; `bid_attempts` = 200 − kabul.
- Kapanış-teklif yarışı (süpürücü 100 ms, 10 eşzamanlı teklif veren, bitişe 1,5 sn sonrasına kadar): hiçbir `accepted_at >= ends_at` yok (I3), tek sonuç, ledger toplamı 0.

## Sınırlar
Tek süreç, tek PG; çoklu süreç/`SKIP LOCKED` süpürücü yarışı yalnızca `closeAuction` paralel çağrısıyla test edildi (8 paralel çağrı). Süreç çökmesi, bağlantı kopması ve saat sapması (AUCTION-RULES §10 dayanıklılık) bu dilimde test edilmedi.
