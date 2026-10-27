# ARCHITECTURE.md (v0.1, taslak — 24 Ekim 2026)

ADR'ler (§11) Kabul edilene kadar buradaki seçimler "varsayılan"dır. Sürüm numaraları kurulum anında `npm view <paket> dist-tags` ile doğrulanır.

## 1. İlkeler
1. Modüler monolit; mikroservis ancak ölçüm gerektirirse (ilk aday: gerçek zamanlı yayın, arama).
2. **Doğruluk kaynağı PostgreSQL.** Redis hız ve dağıtım içindir; kaybolabilir.
3. Kritik kurallar sunucuda, saf fonksiyonlarda; yan etkiler ince bir katmanda.
4. Olay günlüğü + outbox: durum değişikliği ve yayın aynı transaction'da kaydedilir.
5. Her dış etkili yazma idempotent; her kritik eylem audit'li.
6. Zaman ve para için tek kural (aşağıda), istisnasız.

## 2. Yığın
| Alan | Seçim | Not |
|---|---|---|
| Çalışma zamanı | **Node.js 26** (Active LTS: 28 Ekim 2026) | Kritik bağımlılıklar CI'da 26 ile geçmezse Node 24 (20 Ekim 2026'da Maintenance'a geçti, EOL 30 Nisan 2028). ADR-012 |
| Dil | TypeScript (strict, ≥5.9) | Ortak tipler yalnızca API sözleşmesi için |
| Web | Next.js (App Router) + React | SEO/SSR; admin ve satıcı paneli aynı uygulamada ayrı rota grupları |
| UI | Tailwind CSS + shadcn/ui | |
| API | NestJS, REST + OpenAPI; WebSocket gateway | |
| Veritabanı | PostgreSQL 17/18 (sağlayıcının desteklediği en güncel kararlı major) | `timestamptz`, `bigint`, kısıtlar |
| ORM | **Prisma 7 (kararlı) sabitlenir**; kritik yol (teklif/kapanış/ledger) raw SQL | Prisma 8, Ekim 2026 itibarıyla RC; `npm install prisma` RC'yi getirebilir → sürümü açıkça sabitle. GA sonrası ayrı ADR |
| Önbellek/kuyruk | Redis + BullMQ | BullMQ için `maxmemory-policy=noeviction` |
| Arama | PostgreSQL FTS (`turkish`, `unaccent`, `pg_trgm`) arkasında `SearchPort` | Geçiş ölçütleri ADR-009 |
| Dosya | S3-uyumlu nesne depolama + CDN | |
| Gözlem | OpenTelemetry + Sentry | |
| Test | Vitest, Testcontainers, fast-check, Playwright, k6 | |
| CI/CD | GitHub Actions veya şirket CI | |
| Paketleme | pnpm workspaces; Docker | Dağıtım hedefi ADR-010 |

## 3. Modüller
`identity` · `catalog` (kategori/ilan) · `media` · `search` · `auctions` · `orders` · `payments` (PSP) · `ledger` · `sellers` · `messaging` · `notifications` · `moderation` · `admin` · `platform` (audit, idempotency, outbox, rate-limit, config).

Kurallar: modüller yalnızca birbirinin **public arayüzü** veya **olayları** üzerinden konuşur; derin import lint hatasıdır. `ledger` yalnızca `payments`/`orders` çağırır, tersi yoktur. `auctions` ödemeyi doğrudan değil `orders` arayüzüyle tetikler.

```
apps/web  apps/api
packages/{contracts,config,ui}
apps/api/src/modules/<modül>/{domain,application,infrastructure,http}
docs/  scripts/  .claude/
```

## 4. Veri kuralları
- **Para:** `bigint` minor unit + `currency` (ISO 4217). Yuvarlama kuralı tek yerde (ledger/pricing). Ledger çift taraflı: her journal'ın entry toplamı 0.
- **Zaman:** karar veren her zaman DB saatidir (`clock_timestamp()`); depolama UTC `timestamptz`. Uygulama sunucusu saati yalnızca log içindir.
- **Kimlik:** UUID (v7 tercih; PG 18'de yerel `uuidv7()`); dışa açık id'lerde sıralanabilirlik sızıntısını değerlendir.
- **Silme:** finansal ve artırma kayıtları fiziksel silinmez; kişisel veri anonimleştirilir.
- **Migration:** ileri uyumlu (expand → migrate → contract); geri alma planı PR açıklamasında.
- **Kısıtlar önce:** iş kuralının güvencesi uygulama kodu değil DB kısıtıdır (unique, partial unique, CHECK, FK).

## 5. Gerçek zamanlı
WebSocket gateway; yayın outbox → Redis pub/sub → bağlı istemciler. Redis mesajı kaybolabilir; bu yüzden her olayda `auctionId` + artan `seq` vardır, istemci boşluk görürse `GET /auctions/:id/snapshot` ile durumu yeniden çeker. Ölçekleme: Redis adapter ile çok örnekli gateway. Protokol ve olay zarfı: AUCTION-RULES §7. Kütüphane (`ws` / Socket.IO): ADR-007.

## 6. Kuyruk, outbox, önbellek
- **Outbox:** iş verisiyle aynı transaction'da `outbox_events`; relay işi `SKIP LOCKED` ile okur, en az bir kez teslim eder; tüketiciler idempotent.
- **BullMQ:** e-posta, bildirim, görsel türevi, mutabakat, süpürücü. İşler idempotent, yeniden denemeli, dead-letter'lı. **Gecikmeli iş doğruluk kaynağı değildir**; kaybolursa süpürücü yakalar.
- **Önbellek:** cache-aside (kategori ağacı, ilan detayı); olayla geçersiz kılma. Artırma durumu (güncel fiyat, bitiş) önbellekten karar için okunmaz.

## 7. Arama
v1: PostgreSQL FTS. Türkçe için `turkish` yapılandırması + `unaccent` + `pg_trgm` (yazım toleransı); büyük/küçük `İ/ı` davranışı test kümesine dahil. OpenSearch/Meilisearch'e geçiş ölçütü: p95 hedefi aşımı, ilgililik şikayetleri, facet ihtiyacı. Geçiş `SearchPort` arkasında kalır.

## 8. Görsel depolama
Doğrudan yükleme (presigned), sonra sunucuda içerik türü (magic bytes), boyut ve piksel sınırı doğrulaması; asenkron türev üretimi (webp/avif), EXIF/GPS temizleme; orijinaller özel, türevler CDN'den; yaşam döngüsü kuralları; SVG yüklemesi yok.

## 9. Gözlemlenebilirlik
Üç sinyal (iz, metrik, log) OpenTelemetry ile; yapısal log + kişisel veri maskeleme; korelasyon id her istekte.
Kritik metrikler: teklif kabul/ret oranı ve nedenleri, teklif gecikmesi, kilit bekleme süresi, kapanış gecikmesi (`closed_at − ends_at`), WebSocket bağlantı sayısı/yeniden bağlanma, kuyruk derinliği/yaş, ödeme başarı oranı, webhook gecikmesi, mutabakat sapması, değişmez denetçisi ihlal sayısı.
Başlangıç SLO'ları: PRD NFR-02/03.

## 10. Güvenlik özeti
Ayrıntı: SECURITY.md. HttpOnly + Secure + SameSite çerez oturumu (ADR-006), argon2id, MFA (satıcı/yönetici), nesne düzeyi yetki politikaları, CSRF/XSS/SSRF korumaları, rate limit katmanları, sır yönetimi, bağımlılık ve tedarik zinciri denetimi.

## 11. ADR listesi (hepsi "Önerildi")
| ADR | Konu | Varsayılan karar |
|---|---|---|
| 001 | Modüler monolit | Evet |
| 002 | Zaman otoritesi | DB saati, kilit sonrası `clock_timestamp()` |
| 003 | Eşzamanlılık | MVP: artırma satırı `FOR UPDATE`; ölçek yolu: artırma başına tek-yazıcı bölümleme |
| 004 | Para | `bigint` minor unit + çift taraflı ledger |
| 005 | ORM | Prisma 7 sabit + kritik yolda raw SQL |
| 006 | Kimlik/oturum | Sunucu taraflı oturum + HttpOnly çerez; mobil gelince kısa ömürlü token |
| 007 | Gerçek zamanlı | WebSocket + `seq` + snapshot; kütüphane PoC ile seçilir |
| 008 | Outbox + BullMQ | Evet |
| 009 | Arama | PG FTS + `SearchPort`; geçiş ölçütleri yazılı |
| 010 | Dağıtım hedefi | Şirket standardı (K8s/ECS/VM) |
| 011 | PSP ve escrow | Lisanslı PSP alt üye işyeri; hukuk onayı bekliyor |
| 012 | Node sürümü | 26 (CI uyumu doğrulanınca), aksi halde 24 |
| 013 | Test stratejisi | Birim + property + eşzamanlılık + dayanıklılık + k6 |
| 014 | Teklif güvencesi | Ön provizyon vs depozito; Finans/Hukuk ile |

## 12. Dış plan (ChatGPT çıktısı) ile karşılaştırma
Örtüşenler: TypeScript, Next.js, NestJS, PostgreSQL, Redis/BullMQ, modüler monolit, durum makinesi, idempotency, webhook doğrulama, PG FTS ile başlama.
Bu kitte farklı/eklenen kararlar:
| Konu | Dış plan | Bu kit |
|---|---|---|
| Node sürümü | "24 Active LTS (23 Ekim 2026)" | 24, 20 Ekim 2026'da Maintenance'a geçti; 26, 28 Ekim'de Active LTS |
| Prisma | Sürüm belirtilmemiş | 7 sabit; 8 hâlâ RC ve `latest` etiketi RC'ye işaret edebilir |
| Satır kilidi | "Prisma + satır kilitleme" | Prisma'da `FOR UPDATE` için raw SQL gerekir; kritik yol raw SQL |
| Zaman | "Sunucu saati" | DB saati; kilit beklendikten **sonra** `clock_timestamp()` (`now()` transaction başlangıcını verir) |
| Çift kazanan | Transaction + kilit | + DB kısıtları: `(auction_id, seq)` unique, tek `auction_results`, tek sipariş |
| Zamanlayıcı | BullMQ zamanlanmış iş | Yalnızca hız için; doğruluk DB + süpürücü |
| Yayın | Redis Pub/Sub | + `seq` + snapshot/resync (Pub/Sub kayıp verebilir) |
| Para/ödeme | Webhook + sipariş durumu | + çift taraflı ledger + mutabakat işi + kaos testleri |
| Süre | 20–24 hf (3–5 kişi) | ~36 hf; escrow/KYC/moderasyon/arama/gözlemlenebilirlik dahil, dış bağımlılık payı ile |
