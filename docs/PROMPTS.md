# PROMPTS.md — Claude Code için kopyala-yapıştır komutlar

Genel kural: **bir oturum = bir görev.** Bitince `/clear`. Plan modunda başla, onaydan sonra uygula. Skill komut adları kuruluma göre ad alanlı olabilir (`/` yazıp doğrula).
Model: plan/mimari/inceleme → Claude Opus 5.5; uygulama → Opus 5.5; test koşturma → `test-runner` (Haiku).

---
## P-00 Oturum başlatma (her oturumda)
```
CLAUDE.md "Oturum başlangıcı" adımlarını uygula: docs/ROADMAP.md'de ilk açık görevi bul (yalnızca o faz bölümünü oku), docs/LOG.md'nin son girişini oku.
Sonra 10 satırı geçmeyen bir plan sun: (1) hedef, (2) doğrulanabilir kabul ölçütleri, (3) dokunacağın dosya/modüller, (4) riskler ve varsayımlar, (5) test planı, (6) tahmini adım sayısı.
Belirsiz bir nokta varsa önce sor. Onay almadan kod yazma.
```

## P-01 Ortam doğrulama (P0-02, P0-09)
```
Ortamı kontrol et ve rapor ver; hiçbir şeyi değiştirme: Node, pnpm, Docker, Git, Claude Code sürümü; kurulu eklentiler/skill'ler/MCP sunucuları; /context çıktısındaki taban bağlam kullanımı (sistem, CLAUDE.md, MCP, skill'ler). Beklenenden fazla yer kaplayan kalemleri listele.
```

## P-02 Keşif / Grill (P0-10, P0-14)
```
/grill-with-docs ile başla. Girdi: docs/PRD.md (özellikle §2 açık sorular) ve docs/AUCTION-RULES.md §11 (OPEN-AU).
Bana teker teker, en kritik olandan başlayarak sorular sor; her cevaptan sonra ilgili dokümanı ve docs/GLOSSARY.md'yi güncelle. Seçenekleri, öneriyi ve gerekçeyi ver; karar benim.
Bitince kapanan ve açık kalan maddeleri listele.
```

## P-03 BMAD ile planlama (Faz 0; yalnızca planlama akışı)
```
bmad-build ile planlama yolunu çalıştır. Kaynak: docs/PRD.md, docs/ARCHITECTURE.md, docs/AUCTION-RULES.md.
Üretilen epic/story dosyalarını docs/stories/ altına yaz; her story başlığına docs/ROADMAP.md görev ID'sini (P2-04 gibi) yaz.
ROADMAP.md ile çelişki görürsen ROADMAP'i değiştirme; çelişkiyi raporla. Yeni backlog oluşturma; ROADMAP tek doğruluk kaynağıdır.
```

## P-04 İskelet kurulumu (Faz 1) — dört ayrı oturum
**P-04A (P1-01…P1-05)**
```
P1-01…P1-05'i sırayla, her biri ayrı commit olacak şekilde yap: pnpm workspace monorepo (apps/web, apps/api, packages/*), TypeScript strict, lint/format, modül sınır kuralı (derin import yasağı), docker compose (PostgreSQL, Redis, S3-uyumlu depo, e-posta yakalayıcı, OTel collector), env doğrulama, CI hattı.
Sürümleri kurulum anında `npm view <paket> dist-tags` ile doğrula; Prisma'yı 7'ye sabitle (8 RC olabilir). CLAUDE.md "Komutlar" bölümünü gerçek komutlarla doldur. Her adımın doğrulama çıktısını raporla.
```
**P-04B (P1-06…P1-10)**
```
Prisma 7 şema iskeleti + migration hattı; transaction içinde `SELECT … FOR UPDATE` raw SQL kalıbı ve bunu kanıtlayan eşzamanlılık testi (gerçek PostgreSQL, Testcontainers). Ardından kimlik (HttpOnly çerez oturumu, argon2id), roller + sahiplik politikası + BOLA test matrisi altyapısı, append-only audit log, Idempotency-Key (istek özeti doğrulama; iş kuralı reddini de saklayıp tekrarında aynı yanıtı verme).
Önce testleri yaz. Auth ve idempotency diff'lerini bitirince dur ve insan incelemesi iste.
```
**P-04C (P1-11…P1-15)**
```
Outbox + relay (SKIP LOCKED) + BullMQ worker iskeleti (retry, dead-letter), Redis tabanlı rate limit katmanları, OpenTelemetry + yapısal log + PII maskeleme + Sentry + health/ready, çift taraflı ledger iskeleti (journal toplamı 0 property testi), WebSocket gateway iskeleti (kimlik doğrulama, Redis fan-out, seq'li olay zarfı).
```
**P-04D (P1-16 spike)**
```
docs/AUCTION-RULES.md §3–§5'i oku. P1-16 için minimal bir PlaceBid + Closer prototipi yaz (üretim kodu değil, ama doğru kalıpla): tek transaction, FOR UPDATE, kilit sonrası clock_timestamp(), (auction_id, seq) unique, tek auction_results.
Testcontainers ile: 200 paralel teklif, aynı tutar yarışı, kapanış-teklif yarışı, aynı Idempotency-Key iki kez. Ölç: teklif başına gecikme dağılımı, kilit bekleme, çift kazanan sayısı (hedef 0).
Sonucu docs/spikes/auction-concurrency.md'ye yaz: yöntem, sayılar, bulgular, ADR-003 için öneri.
```

## P-05 Genel görev şablonu (TDD)
```
Görev: <ROADMAP ID + başlık>.
Kabul ölçütleri: <madde madde>.
Önce kabul ölçütlerini karşılayan başarısız testleri yaz ve başarısız olduklarını göster. Sonra testleri geçiren en küçük değişikliği yap (CLAUDE.md çalışma ilkeleri). Kapsam dışına çıkma.
Bitirme protokolünü uygula (testler, ROADMAP işareti, LOG girişi + /usage özeti). Test çıktısı uzunsa test-runner subagent'ını kullan.
```

## P-06 PlaceBid (P4-01…P4-05)
```
Önce docs/AUCTION-RULES.md'yi tamamen oku. P4-01'den başla: durum geçiş tablosu ve saf kural fonksiyonları (min artış, rezerv, uzatma, kazanan) + fast-check property testleri (I1, I2, I5, I9).
Sonra P4-02 şema/kısıtlar ve P4-03 PlaceBid transaction'ı (§4'teki sırayla). Her değişmez için en az bir test adlandır (I1…I10).
Kilit öncesi zaman okuma, now() kullanımı, kilitsiz okuma-sonra-yazma gibi kalıplar görürsen dur ve raporla.
```

## P-07 Kapanış ve sürekli doğruluk (P4-06, P4-17)
```
AUCTION-RULES §5: closer fonksiyonu (idempotent), BullMQ gecikmeli iş, süpürücü (SKIP LOCKED), tembel kapanış. Testler: closer iki kez/iki worker'da, süreç ortada ölür, gecikmeli iş kaybolur (süpürücü yakalamalı), uzatılmış artırmada erken closer NOOP.
Ardından değişmez denetçisi işi: I1–I10'u SQL ile periyodik kontrol eder, ihlalde metrik + alarm üretir.
```

## P-08 Ödeme, webhook, ledger (Faz 3 / P4-10)
```
docs/AUCTION-RULES.md §8 ve docs/SECURITY.md T6–T7'yi oku. Webhook alıcısı: ham gövdeyle imza doğrulama, event id tekilleştirme (unique), sırasız/gecikmeli olay toleransı (durum makinesi), PSP'den geri doğrulama. Ödeme başarısı → ledger girdileri (komisyon, escrow) tek transaction'da.
Kaos testleri: aynı webhook 5 kez, geç gelen eski olay, süreç çökmesi, çift tıklama. Kart verisi/PAN loga veya teste girmesin.
```

## P-09 İnceleme kapısı (her faz sonu, kritik PR'lar)
```
(1) /ponytail-review (kuruluysa) ve /code-review (kuruluysa) ile diff'i incele. (2) Kritik modüllerde auction-invariant-reviewer subagent'ını çağır.
Bulguları önem sırasıyla tablo yap: önem, dosya:satır, sorun, değişmez, düzeltme. Düzeltmeye başlamadan önce onay iste.
```

## P-10 Görev bitirme
```
Bitirme protokolünü uygula: (1) typecheck/lint/testleri test-runner ile çalıştır ve sonucu özetle, (2) docs/DEFINITION-OF-DONE.md maddelerini tek tek geç ve eksikleri belirt, (3) kanıt varsa ROADMAP'te ilgili maddeyi [x] yap, (4) LOG.md'ye giriş ekle (/usage özeti dahil), (5) atlanan şeyleri ve kalan riskleri yaz. Kanıtı olmayan maddeyi işaretleme.
```

## P-11 Oturum devri
```
Bu oturumu devret: yapılanlar, karar ve gerekçeleri, açık kalanlar, çalıştırılacak ilk komut ve dikkat edilecek tuzaklar. docs/LOG.md'ye yaz (en fazla 20 satır). Sonra özet gösterilirse /clear yapacağım.
```

## P-12 Haftalık maliyet ve süreç retrosu
```
bash scripts/progress.sh çalıştır. LOG.md'deki bu haftanın girişlerinden: harcama, görev başına medyan, en pahalı 3 görev ve nedeni (bağlam şişmesi? gereksiz keşif? yeniden deneme döngüsü?). CLAUDE.md'ye, skill'lere veya süreç kurallarına somut 3 değişiklik öner (yalnızca kanıta dayalı). Uygulamadan önce onay iste.
```

## P-13 Mimari sağlık (Faz sonlarında)
```
/improve-codebase-architecture (kuruluysa) ile modül sınırlarını tara: derin import, sızan soyutlama, çok sığ modül. En değerli 3 adayı öner; hiçbirini onaysız uygulama. Bulguları docs/LOG.md'ye ekle.
```
