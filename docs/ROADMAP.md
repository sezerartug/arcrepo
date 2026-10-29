# ROADMAP.md — Tek doğruluk kaynağı (backlog + ilerleme)

Kural: Bir görev yalnızca **doğrulandığında** `[x]` olur (test/çıktı kanıtı `docs/LOG.md`'de). Görev ID'leri (`P4-03`) PRD, LOG, commit ve PR başlıklarında kullanılır.
İlerleme özeti: `scripts/progress.sh` · Süre tahminleri 3–4 mühendis + Claude Code varsayımıyla planlama tahminidir; dış bağımlılıklar (hukuk, PSP, KYC) takvimi kaydırabilir.
Toplam hedef: ~36 hafta (7–9 ay) → kapalı beta Faz 3 sonunda, pilot Faz 6'da.

Durum gösterimi: `[ ]` açık · `[x]` bitti. Gate (kapı) maddeleri `G` ile başlar; kapı geçilmeden sonraki faza başlanmaz.

---

## MVP yolu (2026-10-27 kararı — çalışma sırası bu)
Ekip: ürün sahibi + Claude Code. Hukuk/PSP/KYC lansman öncesine ertelendi; MVP sahte ödeme sağlayıcısıyla (`PaymentPort`) uçtan uca çalışır. **Gerçek para ve gerçek kullanıcı, P0-11 + P0-12 + P3-12 tamamlanmadan yok.**
Faz kapıları lansman için geçerlidir; MVP süresince sıra aşağıdaki dilimlerdir. Checkbox'lar aşağıdaki faz bölümlerinde kalır (tek kaynak); burada yalnızca sıra vardır.
Değişmez kurallar (para, zaman, yetki, audit, idempotency, test) MVP'de de kısılmaz.

| Dilim | Bitti ölçütü | Görevler (sırayla) |
|---|---|---|
| M1 Temel | Şirket kaydı + üye davet + giriş + roller çalışıyor; boş web iskeleti; testler yeşil | P1-01, P1-02, P1-03, P1-04, P1-19, P1-06, P1-07 (+ şirket hesabı ve üyeler, FR-ID-05), P1-08 (şirket üyeliği + şirket içi rol), P1-09, P1-10, P1-17 |
| M2 İlan | Doğrulanmış satıcı şirket ilan verir → moderasyon → alıcı arar, bulur, görüntüler | P2-12 (MVP: vergi no format kontrolü + yönetici onayı), P2-01 (inşaat malzemesi ağacı, çelik nitelikleri, satış birimi), P2-02, P2-03, P2-04 (önce yerel depolama; görsel + kalite belgesi), P2-06, P2-08, P2-09 (yalnızca favori), P2-11, P2-14 |
| M3 Mezat | Lot üzerinde birim fiyatla canlı teklif, teminat kontrolü, tek kazanan, doğru bitiş; eşzamanlılık testleri yeşil | (önce OPEN-AU kararları + birim fiyat/yuvarlama kuralı) P1-16, P1-11, P1-15, P4-01, P4-02, P4-03, P4-04, P4-05, P4-06, P4-07, P4-08 (teminat, sahte havale), P4-11, P4-12, P4-13, P4-14 |
| M4 Sipariş + ödeme | Sabit fiyat ve mezat kazananı → sipariş → sahte havale (referans eşleştirme) → escrow → teslim → satıcıya hakediş | P1-14, P3-01, P3-03, P3-04, P3-05, P3-06 (yalnızca manuel teslim onayı), P4-09, P4-10, P3-08 (sahte aktarım), P3-09, P3-10 |
| M5 Paneller | Satıcı paneli + şirket paneli + admin dashboard; çelik tohum verisiyle demo | P2-13, P5-03, P5-06, P5-07, P6-08 (yalnızca tohum veri) |

**Yalın kapsam (2026-10-28, ürün sahibi: "çok kapsamlı olmayan, işimizi gören, çalışan sistem"):** dilimler ve değişmez kurallar aynı; altyapı en sade hâliyle kurulur, gerektiğinde büyütülür.
- Veritabanı: geliştirme ve testte `embedded-postgres` (gerçek PostgreSQL 18, Docker gerekmez); `compose.yaml` Docker kurulunca alternatif. Testcontainers yerine test başına geçici embedded PG (P1-19).
- Redis/BullMQ/outbox relay (P1-11, P1-12'nin Redis kısmı) ertelenir: kapanış süpürücüsü API süreci içinde zamanlayıcı + DB; canlı güncelleme tek örnekte SSE/yoklama + `seq` + snapshot (P1-15 sadeleşir). Doğruluk zaten DB'de.
- E-posta: geliştirmede konsola/dosyaya yazan `MailPort`; gerçek sağlayıcı sonra. Görsel: yerel disk (P2-04 zaten öyle).
- Ertelenen: gözlemlenebilirlik yığını (P1-13 → yalnızca yapısal log + health), S3, CI/staging, KYC/MFA, mesajlaşma/bildirim.

MVP sonrası sıra: mesajlaşma/bildirim (P2-10, P2-09) → telefon/KYC/MFA (P2-12, P5-08) → gözlemlenebilirlik + CI + staging (P1-05, P1-13, P1-18) → gerçek PSP sandbox (P0-12, P3-02) → güven/KVKK (Faz 5) → hukuk (P0-11, P3-12) → sertleştirme ve lansman (Faz 6).

---

## Faz 0 — Keşif, kurulum, kararlar (Hafta 1–2)
- [ ] P0-01 Git deposu oluşturuldu, kit eklendi, ilk commit; ana dal koruması ve zorunlu PR/inceleme açık
- [ ] P0-02 Claude Code güncel sürüm; varsayılan model Sonnet; `/usage` ve `/context` çalışıyor; (API kullanılıyorsa) workspace harcama limiti tanımlı
- [ ] P0-03 Üçüncü taraf eklentiler (BMAD, Ponytail, Matt Pocock, resmi dizin) için şirket güvenlik onayı alındı; sürümler sabitlendi — ERTELENDİ (2026-10-27): P0-05…P0-08 eklentileri kurulmuyor; yerleşik `/code-review`, `/simplify`, `/security-review` kullanılıyor
- [ ] P0-04 CLAUDE.md kuru çalıştırma: küçük bir görevde dört çalışma ilkesi + bitirme protokolü uygulandı
- [ ] P0-05 BMAD v6.12 (kararlı) kuruldu; yalnızca planlama akışı etkin; `bmad-help` doğrulandı
- [ ] P0-06 Matt Pocock skill'leri (seçili): `setup-matt-pocock-skills`, `grill-with-docs`, `tdd`, `diagnosing-bugs`, `code-review`, `improve-codebase-architecture` kuruldu ve `setup` çalıştırıldı
- [ ] P0-07 Ponytail kuruldu; mod kuralı (çekirdek: lite, CRUD/UI: full) doğrulandı
- [ ] P0-08 A/B deneyi (TOOLING §7): Ponytail açık/kapalı iki görev; maliyet, diff boyutu, test/doğrulama kaybı LOG'a yazıldı; karar verildi
- [ ] P0-09 MCP: context7 + playwright kuruldu; `/context` ile taban bağlam maliyeti ölçüldü ve LOG'a yazıldı
- [ ] P0-10 Grill oturumu: PRD'deki açık sorular kapandı (ülke, PSP, escrow modeli, kategoriler, kullanıcı tipleri, teklif güvencesi)
- [ ] P0-11 Hukuk/uyum ön görüşü alındı (ödeme/escrow lisansı, mesafeli satış, e-ticaret kayıtları, KVKK) — ERTELENDİ: lansman öncesi
- [ ] P0-12 PSP seçildi; sandbox hesabı açıldı; marketplace/alt üye işyeri + ön provizyon desteği doğrulandı — ERTELENDİ: MVP sahte sağlayıcıyla
- [ ] P0-13 ARCHITECTURE.md ADR-001…014 durumları Kabul/Red olarak güncellendi
- [ ] P0-14 AUCTION-RULES.md açık kararları (OPEN-AU-xx) ürün sahibince kapatıldı ve onaylandı
- [ ] P0-15 GLOSSARY.md (ortak alan dili) oluşturuldu
- [ ] P0-16 SECURITY.md tehdit modeli ilk sürüm gözden geçirildi
- [ ] P0-G1 KAPI: PRD kapsamı kilitli, ADR'ler kapalı, PSP+hukuk yönü belli, eklenti kararları verilmiş, taban token maliyeti ölçülmüş

## Faz 1 — Platform temeli (Hafta 3–6)
- [x] P1-01 Monorepo iskeleti (pnpm workspaces; `apps/web`, `apps/api`, `packages/*`); CLAUDE.md "Komutlar" bölümü dolduruldu
- [x] P1-02 TypeScript strict + lint/format + modül sınır kuralı (derin import yasağı) CI'da zorunlu — CI'da zorunlu kılma P1-05'e bırakıldı (2026-10-27)
- [ ] P1-03 docker compose geliştirme ortamı (PostgreSQL, Redis, S3-uyumlu depo, e-posta yakalayıcı, OTel collector)
- [x] P1-04 Yapılandırma ve sır yönetimi: şema doğrulamalı env, `.env.example`, sır taraması
- [ ] P1-05 CI hattı: typecheck, lint, unit, entegrasyon (gerçek PostgreSQL), build, bağımlılık denetimi, sır taraması
- [x] P1-06 (Kysely + embedded PG; Prisma yerine, 2026-10-28) şema iskeleti + migration hattı + `FOR UPDATE` raw SQL kalıbı ve testi
- [ ] P1-07 Kimlik: kayıt, giriş, oturum (HttpOnly çerez), argon2id, e-posta doğrulama, parola sıfırlama — KISMİ (2026-10-29): e-posta doğrulama yok; kayıt/giriş/oturum/argon2id/parola sıfırlama + hız sınırı var
- [ ] P1-08 Yetkilendirme: roller + nesne düzeyi sahiplik politikası + BOLA test matrisi altyapısı — KISMİ (2026-10-29): şirket üyeliği + owner/member + nesne yetkisi var; merkezi BOLA matrisi tam değil
- [x] P1-09 Audit log altyapısı (append-only; aktör, eylem, neden, korelasyon id)
- [x] P1-10 Idempotency-Key altyapısı (istek özeti doğrulama, saklı yanıtı tekrar verme, reddedilen isteği de kaydetme)
- [ ] P1-11 Outbox tablosu + relay + BullMQ worker iskeleti (yeniden deneme, dead-letter)
- [ ] P1-12 Rate limiting katmanları (IP, kullanıcı, uç nokta) Redis üzerinde
- [ ] P1-13 Gözlemlenebilirlik: OpenTelemetry (iz/metrik/log), yapısal log + kişisel veri maskeleme, Sentry, health/ready uçları
- [x] P1-14 Ledger iskeleti: hesaplar, journal, entries; "toplam = 0" değişmezi + property testi
- [ ] P1-15 Gerçek zamanlı iskelet: WebSocket gateway + kimlik doğrulama + Redis fan-out + sıra numaralı olay zarfı
- [x] P1-16 Açık artırma eşzamanlılık spike'ı: ≥200 paralel teklif, tek kazanan, `clock_timestamp()` ile bitiş; rapor `docs/spikes/auction-concurrency.md`
- [x] P1-17 Web iskeleti: Next.js App Router + Tailwind + shadcn/ui + temel yerleşim + erişilebilirlik kontrolü
- [ ] P1-18 Staging'e otomatik dağıtım + geri alma prosedürü
- [ ] P1-19 Test altyapısı: Testcontainers, fabrikalar, property test (fast-check), Playwright smoke
- [ ] P1-20 GLOSSARY.md ve ADR'ler güncel
- [ ] P1-G1 KAPI: CI yeşil; spike raporu kabul edildi (çift kazanan = 0); BOLA harness çalışıyor; taban maliyet/bağlam raporu LOG'da

## Faz 2 — İlan pazaryeri + satıcı temeli (Hafta 7–12)
- [x] P2-01 Kategori ağacı + kategoriye özel nitelik şeması (MVP: serbest attrs; ağaç X-13 ile 7 sektöre genişledi, sabit nitelik şeması hâlâ yok)
- [x] P2-02 İlan veri modeli ve durum makinesi (taslak → incelemede → yayında → duraklatıldı → satıldı/süresi doldu/kaldırıldı)
- [x] P2-03 İlan oluştur/düzenle/yayınla API + doğrulama + sahiplik yetkisi
- [x] P2-04 Görsel yükleme: presigned yükleme, sunucuda içerik türü/boyut doğrulama, asenkron türev üretimi, EXIF/konum temizleme
- [ ] P2-05 CDN + özel/herkese açık nesne politikaları + yaşam döngüsü kuralları
- [x] P2-06 Arama v1: Türkçe tam metin (PostgreSQL), kategori/fiyat/konum filtreleri, sıralama; `SearchPort` arayüzü
- [ ] P2-07 Arama kalite seti: 30+ gerçek sorguyla ilgililik testi; OpenSearch'e geçiş ölçütleri yazıldı
- [ ] P2-08 İlan listeleme/detay sayfaları (SSR, SEO, site haritası, yapılandırılmış veri) — KISMİ (2026-10-29): sayfalar var; site haritası/yapılandırılmış veri/SEO yok
- [ ] P2-09 Favoriler ve bildirimler (e-posta + uygulama içi, kuyruk üzerinden) — KISMİ (2026-10-29): favori + uygulama içi bildirim (X-11); bildirimlerin e-posta kısmı ve kuyruk YOK
- [ ] P2-10 Mesajlaşma (iletişim bilgisi maskeleme, spam sınırı, engelleme/şikayet)
- [ ] P2-11 Şikayet akışı + moderasyon kuyruğu + admin paneli v0 (audit'li) — KISMİ (2026-10-29): admin moderasyon + audit var; şikayet akışı yok
- [ ] P2-12 Satıcı onboarding + KYC akışı + satıcı profili/doğrulama durumu — KISMİ (2026-10-29): MVP kapsamı vergi no format kontrolü + admin onayı var; KYC/belge doğrulama yok
- [ ] P2-13 Satıcı paneli: ilanlarım, durum değişiklikleri, görseller — KISMİ (2026-10-29): ilan listesi/durum/düzenleme/hakediş var; satıcı analitiği yok
- [ ] P2-14 Tüm uç noktalar için BOLA/yetki test matrisi tamam
- [ ] P2-15 Panolar: arama gecikmesi, görsel işleme kuyruğu, kuyruk derinliği, hata oranı
- [ ] P2-16 Yük testi: arama ve ilan detay p95 hedefi doğrulandı
- [ ] P2-17 Önbellek: kategori ağacı/ilan detayı için cache-aside + olayla geçersiz kılma; artırma durumu asla tek kaynak olarak önbellekte tutulmaz
- [ ] P2-G1 KAPI: ilan yayınla→bul→görüntüle uçtan uca; yetki matrisi %100; moderasyon çalışıyor; arama/görsel/kuyruk panoları canlı

## Faz 3 — Ödeme, defter, sipariş, escrow (Hafta 13–18)
- [x] P3-01 Sipariş durum makinesi ve veri modeli
- [ ] P3-02 PSP entegrasyonu (barındırılan ödeme alanları/3DS; kart verisi sistemimize girmez)
- [ ] P3-03 Provizyon/tahsilat akışı + idempotent ödeme niyeti
- [ ] P3-04 Webhook alıcısı: imza doğrulama, tekilleştirme, sırasız/gecikmeli olay toleransı
- [x] P3-05 Ledger: komisyon, escrow tutma, serbest bırakma, iade girişleri + değişmez testleri
- [x] P3-06 Teslimat/kargo durumu (manuel + 1 entegrasyon), teslim onayı, otomatik onay süresi
- [ ] P3-07 İtiraz, iade ve destek talebi akışları — KISMİ: itiraz + iade yapıldı (X-08); destek talebi (ticket) akışı yok
- [ ] P3-08 Satıcı hakediş/ödeme (alt üye işyeri) + günlük mutabakat işi — KISMİ (2026-10-29): sahte hakediş transferi + audit var; günlük mutabakat/alt üye işyeri yok
- [ ] P3-09 Sabit fiyatlı satın alma uçtan uca (Playwright) — KISMİ (2026-10-29): API düzeyinde uçtan uca doğrulandı; Playwright testi yok
- [ ] P3-10 Ödeme kaos testleri: webhook tekrarı/kaybı/gecikmesi, süreç çökmesi, çift tıklama — KISMİ (2026-10-29): çift tıklama/çift onay/kapanış çökmesi testleri var; webhook yok (sahte sağlayıcı)
- [ ] P3-11 Mutabakat sapma alarmı (PSP ↔ ledger ↔ sipariş)
- [ ] P3-12 Belgeler: fatura/makbuz, mesafeli satış bilgilendirmeleri (hukuk onaylı)
- [ ] P3-13 Dahili kapalı beta (gerçek, düşük tutarlı işlemler)
- [ ] P3-G1 KAPI: ledger toplamı her zaman 0; çift tahsilat/çift sipariş testleri yeşil; mutabakat sapması 0; hukuk onayı var

## Faz 4 — Açık artırma motoru (Hafta 19–26)
- [x] P4-01 Domain: durum geçiş tablosu + saf kural fonksiyonları (artış, rezerv, uzatma, kazanan) + property testleri
- [x] P4-02 Şema ve DB kısıtları: `(auction_id, seq)` unique, tek `auction_results`, artırma başına tek sipariş, CHECK'ler
- [x] P4-03 PlaceBid: tek transaction, `FOR UPDATE`, kilit sonrası `clock_timestamp()`, idempotency
- [x] P4-04 Bitiş uzatma (anti-sniping) + maksimum uzatma sınırı
- [ ] P4-05 Rezerv fiyat, "hemen al", iptal kuralları — KISMİ (2026-10-29): rezerv + admin iptali var; hemen al yok (v2)
- [ ] P4-06 Kapanış: BullMQ gecikmeli iş + süpürücü (`SKIP LOCKED`) + idempotent closer + kayıp zamanlayıcı toleransı — KISMİ (2026-10-29): API içi süpürücü + idempotent closer + tembel kapanış var; BullMQ yok (yalın kapsam)
- [ ] P4-07 Outbox → WebSocket yayını; sıra numarası, snapshot/resync, yeniden bağlanma
- [x] P4-08 Teklif güvencesi (ön provizyon/depozito) ve teklif yetkinliği kontrolleri
- [x] P4-09 Kazanan ödeme penceresi + başarısız ödeme politikası (OPEN-AU kararına göre)
- [x] P4-10 Kazanan → sipariş entegrasyonu (tek sipariş garantisi; ledger/escrow ile tutarlı)
- [ ] P4-11 Canlı artırma arayüzü (sunucu ofsetli geri sayım, bekleyen/ret durumları, erişilebilirlik) — KISMİ (2026-10-29): arayüz var (yoklama, sunucu saati ofseti); tarayıcıda gözle doğrulanmadı
- [ ] P4-12 Kötüye kullanım: teklif hız sınırları, kendi ilanına teklif engeli, şişirme sinyalleri v1 — KISMİ (2026-10-29): teklif hız sınırı + kendi ilanına teklif engeli var; şişirme sinyalleri yok
- [x] P4-13 Audit: tüm yönetici müdahaleleri ve teklif iptali nedenleri
- [x] P4-14 Eşzamanlılık testleri: N paralel teklif, aynı tutar yarışı, kapanış-teklif yarışı
- [x] P4-15 Dayanıklılık testleri: süreç ortada ölür, DB bağlantısı kopar, worker çift çalışır, saat sapması
- [ ] P4-16 k6 yük testi (son 10 saniye yoğunluğu) + p95 hedefi
- [ ] P4-17 Değişmez denetçisi işi (I1–I10) üretimde periyodik koşar ve alarm üretir
- [ ] P4-18 Gözlemlenebilirlik: teklif gecikmesi, kilit bekleme, kapanış gecikmesi, ret nedenleri panosu + alarmlar
- [ ] P4-19 `auction-invariant-reviewer` ile bağımsız inceleme; bulgular kapandı
- [ ] P4-20 Dahili "artırma günü" (gerçek kullanıcılarla) + sonuç raporu
- [ ] P4-G1 KAPI: değişmez ihlali = 0 (tüm testlerde ve artırma gününde); kapanış gecikmesi hedefte; bağımsız inceleme Kritik/Yüksek bulgusu yok

## Faz 5 — Güven, satıcı yönetimi, admin (Hafta 27–31)
- [ ] P5-01 Satıcı performans puanı ve metrikleri
- [ ] P5-02 Toplu ilan yükleme (CSV) + doğrulama raporu
- [ ] P5-03 Satıcı analitiği ve hakediş raporları
- [ ] P5-04 Ceza/uyarı/askıya alma akışları (itirazlı, audit'li)
- [ ] P5-05 Sahtecilik ve kötüye kullanım kuralları (hesap yaşı, cihaz/IP kümeleme, şişirme teklif sinyalleri v2)
- [ ] P5-06 Tam admin paneli: kullanıcı/ilan/artırma/sipariş/iade; rol bazlı; tüm eylemler audit'li
- [ ] P5-07 Destek araçları: sipariş/artırma zaman çizelgesi (olay günlüğünden)
- [ ] P5-08 Yönetici ve satıcı için MFA; ödeme hesabı değişikliğinde ek doğrulama + bekleme süresi
- [ ] P5-09 KVKK: aydınlatma, rıza kayıtları, silme/anonimleştirme akışı, saklama süreleri
- [ ] P5-10 Erişilebilirlik (WCAG 2.2 AA) denetimi ve düzeltmeler
- [ ] P5-11 Bildirim tercihleri ve şablon yönetimi
- [ ] P5-12 İç güvenlik gözden geçirmesi + düzeltmeler
- [ ] P5-G1 KAPI: operasyon ekibi mühendis yardımı olmadan günlük işi yürütebiliyor; KVKK akışları çalışıyor

## Faz 6 — Sertleştirme ve lansman (Hafta 32–36)
- [ ] P6-01 Yük testi: PRD NFR hedef eşzamanlılığı ile k6 senaryoları
- [ ] P6-02 Soak testi (24–48 saat)
- [ ] P6-03 Kaos/hata enjeksiyonu: DB failover, Redis kaybı, worker çökmesi, ağ gecikmesi
- [ ] P6-04 Yedekten geri dönme tatbikatı (RPO/RTO ölçüldü)
- [ ] P6-05 Bağımsız sızma testi + bulguların kapatılması
- [ ] P6-06 SLO'lar, alarmlar, nöbet düzeni ve runbook'lar
- [ ] P6-07 Üretim ortamı, IaC, sır yönetimi, ağ sınırları
- [ ] P6-08 Seed verisi (kategoriler, şablonlar) ve yasal metinler
- [ ] P6-09 Pilot (sınırlı kullanıcı) + geri bildirim
- [ ] P6-10 Kademeli açılış (feature flag) + yakın izleme
- [ ] P6-11 Lansman sonrası retro + v2 backlog (otomatik teklif, mobil vb.)
- [ ] P6-G1 KAPI: SLO'lar karşılanıyor; runbook'lar tatbik edildi; sızma testi Kritik/Yüksek bulgusu yok; geri dönüş planı denendi

## MVP sonrası eklenen işler (2026-10-29, ürün sahibi isteği)
- [x] X-01 Admin: şirket/kullanıcı dizini + şirket detayı (üye, ilan, mezat, sipariş, denetim) + durum/ilan kaldırma/mezat iptal işlemleri + Türkçe etiketler (int test; tarayıcıda elle denenmedi)
- [x] X-02 Yönetici doğrulanmış şirket adına ilan/mezat açar (doğrudan yayın, audit) (int test)
- [x] X-03 İlan görseli ekle/sil (sahip + yönetici), görsel yoksa yer tutucu (int test; tarayıcıda elle denenmedi)
- [x] X-04 Mezat kartı/listesi ilan görselini kullanır (`GET /auctions` `imageUrl`; yoksa yer tutucu) (int test; tarayıcıda elle denenmedi)
- [x] X-05 Yönetici ilan alanlarını düzenleyebilir — karar: evet (X-07)
- [x] X-06 Yönetici mezat izleme: `GET /admin/auctions` + `/admin/auctions/:id` (gerçek teklif veren şirket/kullanıcı, reddedilen denemeler, teminat, olaylar, sonuç/sipariş; `admin.auction.view` audit), web `/admin?tab=mezatlar` + `/admin/mezatlar/[id]` (3 sn yoklama, mezat iptali) (int test; tarayıcıda elle denenmedi)
- [x] X-07 Yönetici ilan alanı düzenleme: `PATCH /admin/listings/:id` (zorunlu neden, `admin.listing.update` audit, durum korunur; yayındaki mezat ilanı `AUCTION_LISTING_LOCKED`) + düzenleme ekranında neden kutusu (int test; tarayıcıda elle denenmedi)
- [x] X-08 İtiraz/iade: alıcı `shipped` iken itiraz açar (`POST /orders/:id/dispute`, ★) → sipariş `disputed`, oto onay + teslim onayı + hakediş durur; yönetici `POST /admin/disputes/:id/resolve` ile kısmi/tam iade (`refundMinor`; komisyon kalan tutar üzerinden) veya reddet; tek ledger journal (`order.dispute_resolution`), mezat siparişinde tam iadede teminat `refunded` + mezat SETTLED; migration 0006 (`order_disputes`, `orders.refund_minor`, `disputed`/`refunded`); web: sipariş sayfasında "İtiraz aç" diyaloğu + durum/sonuç, `/admin` "İtirazlar" sekmesi (İade et / İtirazı reddet) (int test 10 + birim; tarayıcıda elle tıklanmadı)
- [x] X-09 Yönetici sipariş listesi: `GET /admin/orders?status=&q=&page=` (alıcı/satıcı şirket, tutar, iade, durum) + `/admin?tab=siparisler` (int test; tarayıcıda elle tıklanmadı)
- [x] X-10 Kullanıcı askıya alma: yönetici tek kullanıcıyı nedenle askıya alır/kaldırır (`POST /admin/users/:id/suspend|unsuspend {reason}`; oturumlar silinir, giriş 403 `USER_SUSPENDED`, eski çerez 401, kendini askıya alma reddedilir, şirket etkilenmez; audit `admin.user.suspend|unsuspend`) + `POST /admin/users/:id/send-reset` (mevcut MailPort; bağlantı yöneticiye gösterilmez); migration 0007 (`users.suspended_at/suspend_reason`); web: Kullanıcılar sekmesi + şirket detay üyeleri (diyalog, neden zorunlu) (int test; canlı API'de denendi; tarayıcıda elle tıklanmadı)
- [x] X-11 Uygulama içi bildirimler: `notifications` tablosu (üye başına satır, `read_at` sütunu; migration 0007); olaylar: teklif geçildi (yalnız önceki lider), mezat sonucu (kazanan/kaybedenler/satıcı), sipariş durumu (ödeme onayı→satıcı, kargo→alıcı, teslim→satıcı, itiraz→satıcı, itiraz çözümü→iki taraf, ödeme süresi aşımı→alıcı); API `GET /notifications?unread=1&page=`, `/notifications/unread-count`, `POST /notifications/:id/read`, `/notifications/read-all` (yalnız kendi kayıtları); web: zil + rozet (20 sn yoklama), açılır liste, `/bildirimler` (int test; canlı API'de denendi; e-posta bildirimi YOK)
- [x] X-12 Yönetici mali raporu (salt okunur): `GET /admin/finance/summary?range=today|7d|30d|all` veya `from/to` (UTC, DB saati) → komisyon, ihlal teminatı geliri, emanet, bekleyen hakediş (şirket başına), tutulan teminat, ciro, iade/itiraz, bank_clearing + her rakam için `kaynak` + `consistency` (ledger toplamı=0, escrow=açık siparişler); `GET /admin/finance/orders.csv` ve `payouts.csv` (UTF-8 BOM, `;` ayraç, ondalık virgül, formül önekleme; audit `admin.finance.export`); web `/admin?tab=mali-rapor`. Migration/indeks eklenmedi (500 kullanıcı ölçeğinde mevcut `ledger_entries_account_idx` yeterli) (int test 6 + birim 3)
- [x] X-13 Çok sektörlü kategori ağacı + ikinci el durumu: migration 0008 (7 üst kategori, slug'lı idempotent ağaç; mevcut Çelik/Çimento/... kimlikleri korunarak 'İnşaat Malzemeleri' altına taşındı; birim 'iş' eklendi; `listings.condition` yeni|ikinci_el|hurda, varsayılan yeni); `GET /listings?categoryId=` üst kategoride tüm alt soyları (özyinelemeli) kapsar, `?condition=` süzgeci (yanlış değer 422); ilan oluşturma/düzenleme (satıcı + yönetici) `condition` alır; web: iki seviyeli kategori seçici + Durum, /ilanlar hiyerarşik kategori + Durum süzgeci, 7 ikonlu ana sayfa kutuları + İkinci El kısayolu (üst menü dahil), kart/detay rozeti; seed: 14 örnek sektör ilanı. Kapsam dışı: gayrimenkul/kiralık depo ilanı; kategoriye özel sabit nitelik şeması yok (attrs serbest, form yalnız örnek ipucu gösterir) (int test 3 yeni)

- [x] X-14 Ana sayfa hero slider: 7 sektör slaydı (İnşaat aynen + 6 yeni SVG sahne, `components/hero-slider.tsx` + `illustrations/hero-scenes.tsx`); 6 sn otomatik geçiş, fare/odak/gizli sekme/reduced-motion duraklatma, noktalar, oklar, ←/→, dokunmatik kaydırma, duraklat düğmesi, ARIA carousel; kategori bağlantısı ada göre (bulunamazsa /ilanlar) (birim test; tarayıcıda görsel doğrulama yapılmadı)
- [x] X-15 Koyu/açık mod: üst menüde Açık/Koyu/Sistem anahtarı (localStorage `arc-theme`, <head> satır içi script ile FOUC yok), `data-theme="dark"` + Tailwind `dark` varyantı, tam koyu palet, `chrome` (hep koyu lacivert: üst menü/alt bilgi/hero) ve `brand-text` token'ları (axe testi açık+koyu; kontrast oranı tarayıcıda elle doğrulanmadı)
- [x] X-16 Ana sayfa: hero altında arama kutusu (GET /ilanlar?q=) + hızlı etiketler (kategori kimliği ada göre çözülür, yoksa ?q=), 5 kartlı Güven merkezi (eski 3 rozet şeridinin yerine), Öne çıkan ilanlar sekmeleri (/?sekme=sabit|mezat|ikinci-el, sunucu tarafı, aria-current), canlı göstergesi (reduced-motion'da animasyonsuz) + Kalan süre etiketi, Doğrulanmış şirket ve %5 teminatlı rozetleri (birim test; tarayıcıda görsel doğrulama yapılmadı)
- [x] X-17 Satıcı paneli özet kartları (açık ilan, canlı mezat, bekleyen sipariş, bekleyen hakediş; mevcut uç noktalardan, hata/boşta —; `computeSellerSummary`) (birim test; tarayıcıda görsel doğrulama yapılmadı)

- [x] X-18 Hesap sayfası (/hesap): parola değiştirme (`POST /me/password`, mevcut parola argon2id ile doğrulanır, 5 yanlışta 15 dk kilit, başarıda diğer oturumlar silinir, audit `user.password.change`), profil (`PATCH /me` ad + isteğe bağlı telefon; migration 0009 `users.phone`; `GET /me` phone+createdAt), aktif oturumlar (`GET /me/sessions`, `DELETE /me/sessions/:id`, `POST /me/sessions/revoke-others`; token dönmez, başkasının oturumu 404; son kullanım/user-agent verisi tutulmadığı için gösterilmez), yönetici kısayolları (`GET /admin/pending-counts`) (int test 8 yeni + web birim test; tarayıcıda gelişmiş görsel doğrulama yapılmadı)
