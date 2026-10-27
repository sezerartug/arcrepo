# PRD.md — Ürün Gereksinimleri (v0.1, taslak)

Durum: taslak. `P0-10` (Grill oturumu) sonunda açık sorular kapanır ve sürüm 1.0 olur. Gereksinim ID'leri (`FR-…`, `NFR-…`) test, görev ve PR'larda referans verilir.

## 1. Amaç
Alıcıların ve satıcıların ilan verip bulabildiği, uygun ilanların canlı açık artırmayla (mezat) satılabildiği, ödemenin escrow ile korunduğu ve satıcıların tek panelden yönetildiği güvenilir bir pazaryeri.
Başarı ölçütü, özellik sayısı değil **temel ticari akışların hatasız ve denetlenebilir çalışması**dır: doğru kazanan, doğru bitiş zamanı, tutarlı ödeme/sipariş.

## 2. Varsayımlar ve açık sorular (P0-10'da kapatılacak)
| ID | Konu | Mevcut varsayım | Karar sahibi |
|---|---|---|---|
| OQ-01 | Ülke/pazar | Türkiye, TRY, Türkçe | Ürün + Hukuk |
| OQ-02 | Satıcı/alıcı tipi | Bireysel + ticari satıcılar; alıcılar bireysel (C2C + B2C karışık) | Ürün |
| OQ-03 | Ödeme/escrow modeli | Lisanslı PSP üzerinden alt üye işyeri; fonları şirket tutmaz | Hukuk + Finans |
| OQ-04 | İlk kategoriler | Seçilecek 2–3 kategori (ör. koleksiyon, elektronik); araç/emlak v1 dışı | Ürün |
| OQ-05 | Artırma türü | Yalnızca klasik artan fiyatlı; otomatik teklif v2 | Ürün |
| OQ-06 | Teklif güvencesi | Ön provizyon veya depozito (ADR-014) | Ürün + Finans |
| OQ-07 | Komisyon modeli | Satıcıdan yüzde + sabit; kademeli v2 | Finans |
| OQ-08 | Hedef ölçek (NFR için) | İlk yıl: 50k kayıtlı kullanıcı, aynı artırmada 500 eşzamanlı izleyici, 50 aktif teklif veren | Ürün |
| OQ-09 | Kargo | Satıcı sorumlu; 1 taşıyıcı entegrasyonu | Operasyon |

**MVP kararları (2026-10-27, ürün sahibi):** OQ-04 → Koleksiyon + Elektronik. OQ-03 → MVP'de sahte ödeme sağlayıcısı (`PaymentPort`); gerçek PSP ve escrow modeli hukukla birlikte lansman öncesi. Diğer OQ'lar MVP için tablodaki varsayımla ilerler; ilgili dilime gelince teyit edilir. Ekip: ürün sahibi + Claude Code. Sıra: `docs/ROADMAP.md` "MVP yolu".

## 3. Roller
Ziyaretçi · Alıcı · Satıcı · Moderatör · Destek · Yönetici · Sistem (zamanlayıcı/worker).

## 4. Kapsam
**v1 içinde:** hesap ve doğrulama, ilan, kategori/nitelik, görsel, arama, favori/bildirim, mesajlaşma, satıcı onboarding/KYC ve paneli, klasik artırma + canlı yayın, escrow'lu ödeme, sipariş/teslimat/itiraz/iade, hakediş, moderasyon ve admin, audit.
**v1 dışında:** canlı video mezat, otomatik teklif (proxy), kapalı zarf, Hollanda usulü, mobil native uygulama, çoklu para birimi/dil, sadakat sistemi, yapay zekâ fiyat tahmini, reklam/öne çıkarma ürünleri, mağaza vitrini.

## 5. Ana yolculuklar
1. **Satıcı:** kayıt → doğrulama/KYC → ilan oluştur (sabit fiyat veya artırma) → moderasyon → yayın → teklif/sipariş → kargo → hakediş.
2. **Alıcı (sabit fiyat):** ara → ilan → satın al → öde (escrow) → teslim al → onayla / itiraz et.
3. **Alıcı (artırma):** ilan → teklif yetkinliği (güvence) → canlı teklif → kazan → ödeme penceresi → öde → teslim.
4. **Moderatör/Destek:** şikayet kuyruğu → karar → audit; sipariş/artırma zaman çizelgesiyle uyuşmazlık çözümü.

## 6. Fonksiyonel gereksinimler
Öncelik: **M**ust (v1), **S**hould, **C**ould.

### Kimlik ve hesap
- FR-ID-01 (M) E-posta + parola ile kayıt/giriş; e-posta doğrulama; parola sıfırlama.
- FR-ID-02 (M) Telefon doğrulama (teklif/satış için zorunlu).
- FR-ID-03 (M) Roller ve nesne düzeyi yetkilendirme (kullanıcı yalnızca kendi ilan/sipariş/tekliflerine erişir).
- FR-ID-04 (S) Satıcı ve yönetici için MFA.

### İlan ve katalog
- FR-LS-01 (M) Kategori ağacı ve kategoriye özel nitelikler.
- FR-LS-02 (M) İlan oluştur/düzenle/duraklat/kaldır; durum makinesi; yayından önce moderasyon.
- FR-LS-03 (M) Çoklu görsel yükleme; EXIF/konum temizleme; boyut/tür doğrulama.
- FR-LS-04 (M) Favoriler; ilan başına şikayet.
- FR-LS-05 (S) Toplu ilan yükleme (CSV).

### Arama
- FR-SR-01 (M) Türkçe metin arama, kategori/fiyat/konum filtreleri, sıralama.
- FR-SR-02 (S) Kayıtlı arama ve bildirim.
- FR-SR-03 (S) Facet/sayım. Gerekirse harici arama motoru (ADR-009 ölçütleri).

### Açık artırma (ayrıntı: AUCTION-RULES.md)
- FR-AU-01 (M) Satıcı başlangıç fiyatı, minimum artış, başlangıç/bitiş zamanı, isteğe bağlı rezerv fiyat ve "hemen al" belirler.
- FR-AU-02 (M) Teklif yalnızca sunucuda doğrulanır; geçerli teklifler anlık yayınlanır; geçmiş denetlenebilir.
- FR-AU-03 (M) Bitiş zamanı sunucu/DB saatiyle kesinleşir; son anda gelen teklif süreyi uzatır (anti-sniping).
- FR-AU-04 (M) Aynı anda gelen tekliflerde tek, deterministik sıralama; tek kazanan.
- FR-AU-05 (M) Aynı istek yeniden gönderilirse çift teklif oluşmaz (idempotency).
- FR-AU-06 (M) Satıcı kendi ilanına teklif veremez; hız ve davranış sınırları uygulanır.
- FR-AU-07 (M) Kazanan için ödeme penceresi; ödenmezse tanımlı politika işler.
- FR-AU-08 (S) Teklif güvencesi (ön provizyon/depozito).

### Sipariş, ödeme, escrow
- FR-OR-01 (M) Sipariş durum makinesi (ödeme bekliyor → ödendi/escrow → kargoda → teslim edildi → tamamlandı; iptal/iade/itiraz).
- FR-OR-02 (M) Kart verisi sistemimize girmez; barındırılan ödeme alanları + 3DS.
- FR-OR-03 (M) Ödeme, PSP webhook'u ile kesinleşir; tekrar eden/sırasız olaylar güvenli işlenir.
- FR-OR-04 (M) Çift taraflı ledger: komisyon, escrow tutma/serbest bırakma, iade.
- FR-OR-05 (M) Teslim onayı veya otomatik onay süresi sonunda satıcıya hakediş.
- FR-OR-06 (M) İtiraz/iade akışı; günlük mutabakat.

### İletişim
- FR-MS-01 (M) Alıcı-satıcı mesajlaşma; iletişim bilgisi maskeleme; engelleme/şikayet.
- FR-MS-02 (M) E-posta ve uygulama içi bildirimler; kullanıcı tercihleri (S).

### Satıcı yönetimi
- FR-SL-01 (M) Onboarding + KYC + doğrulama durumu.
- FR-SL-02 (M) İlan, sipariş, hakediş paneli.
- FR-SL-03 (S) Performans puanı, uyarı/askıya alma akışları.

### Yönetim ve güvenlik
- FR-AD-01 (M) Moderasyon kuyruğu, kullanıcı/ilan/artırma/sipariş yönetimi, rol bazlı.
- FR-AD-02 (M) Tüm yönetici müdahaleleri neden + aktör + zaman ile audit'lenir.
- FR-SC-01 (M) Rate limit, bot/kötüye kullanım önlemleri, girdi doğrulama.
- FR-SC-02 (M) KVKK: aydınlatma, rıza, silme/anonimleştirme, saklama süreleri.

## 7. Fonksiyonel olmayan gereksinimler
- NFR-01 **Doğruluk:** her artırmada tek sonuç, tek kazanan, tek sipariş; ledger toplamı 0 (AUCTION-RULES I1–I10).
- NFR-02 **Zaman:** kapanış gecikmesi (`closed_at − ends_at`) p99 < 2 sn; teklif kabul/ret yanıtı p95 < 1 sn (başlangıç hedefi, P4-16'da doğrulanır).
- NFR-03 **Performans:** normal API p95 < 500 ms; canlı olay yayılımı p95 < 1 sn.
- NFR-04 **Erişilebilirlik:** WCAG 2.2 AA.
- NFR-05 **Güvenlik:** OWASP ASVS/API Top 10 kontrolleri; sır yönetimi; PCI kapsamı minimum (barındırılan alanlar).
- NFR-06 **Gözlemlenebilirlik:** her kritik akışta iz, metrik, log ve alarm.
- NFR-07 **Dayanıklılık:** RPO/RTO hedefleri P6-04'te ölçülür; geri dönüş planı.
- NFR-08 **Veri koruma:** kişisel veri envanteri, saklama süreleri, log maskeleme.

## 8. Başarı metrikleri
Doğruluk (ihlal sayısı = 0), kapanış gecikmesi, teklif ret oranı ve nedenleri, ödeme başarı oranı, mutabakat sapması = 0, ilan→satış dönüşümü, moderasyon SLA'sı, sorun başına çözüm süresi.

## 9. Başlıca riskler
Escrow/lisans modeli · soğuk başlangıç (arz/talep) · sahte teklif ve ödeme yapmayan kazanan · kapsam kayması (her yeni artırma türü test yüzeyini katlar) · AI üretimli kodun kritik modüllerde incelenmeden birleşmesi.

## 10. Kabul
Faz kapıları (`docs/ROADMAP.md` `*-G1` maddeleri) ve `docs/DEFINITION-OF-DONE.md`.
