# PRD.md — Ürün Gereksinimleri (v0.1, taslak)

Durum: taslak. `P0-10` (Grill oturumu) sonunda açık sorular kapanır ve sürüm 1.0 olur. Gereksinim ID'leri (`FR-…`, `NFR-…`) test, görev ve PR'larda referans verilir.

## 1. Amaç
İnşaat sektörü için **şirketler arası (B2B) inşaat malzemesi pazaryeri** (öncelik: çelik — inşaat demiri, profil, sac, boru). Satıcı şirketler stoklarını ilan eder; ilanlar sabit fiyatla veya canlı açık artırmayla (mezat) satılır; ödeme escrow ile korunur; satıcılar ve platform tek panelden yönetilir.
Başarı ölçütü, özellik sayısı değil **temel ticari akışların hatasız ve denetlenebilir çalışması**dır: doğru kazanan, doğru bitiş zamanı, tutarlı ödeme/sipariş.

## 2. Varsayımlar ve açık sorular (P0-10'da kapatılacak)
| ID | Konu | Mevcut varsayım | Karar sahibi |
|---|---|---|---|
| OQ-01 | Ülke/pazar | Türkiye, TRY, Türkçe | Ürün + Hukuk |
| OQ-02 | Satıcı/alıcı tipi | **Karar:** yalnızca şirketler (B2B), çok satıcılı pazaryeri. Şirket hesabı + birden çok üye kullanıcı; fatura şirkete | Ürün |
| OQ-03 | Ödeme/escrow modeli | **Karar (akış):** havale/EFT ile escrow hesabına ödeme, teslimden sonra satıcıya aktarım. Hesabı kim tutar (PSP/banka/lisans) hukukla lansman öncesi; MVP'de sahte sağlayıcı | Hukuk + Finans |
| OQ-04 | İlk kategoriler | **Karar:** tüm inşaat malzemeleri (kategori ağacı); öncelik ve tohum veri çelik. Her kategori kendi satış birimini tanımlar (ton, m³, adet, palet, torba) | Ürün |
| OQ-05 | Artırma türü | **Karar:** yalnızca ileri (artan fiyatlı); ters mezat (satın alma ihalesi) ve otomatik teklif v2 | Ürün |
| OQ-06 | Teklif güvencesi | **Karar:** teminat (depozito, havale ile); tutar/oran kuralı M3'te (ADR-014) | Ürün + Finans |
| OQ-07 | Komisyon modeli | Satıcıdan yüzde + sabit; kademeli v2 | Finans |
| OQ-08 | Hedef ölçek (NFR için) | **Karar (2026-10-28):** ilk yıl 500 kayıtlı şirket kullanıcısı, aynı artırmada ~50 eşzamanlı izleyici, ~10 aktif teklif veren; tek sunucu/tek API örneği yeterli. Büyürse (Redis, ayrı worker, arama motoru) ROADMAP "MVP sonrası" sırasıyla eklenir | Ürün |
| OQ-09 | Teslimat | Teslim şekli ilan başına: depoda/fabrikada teslim (alıcı nakliyesi) veya satıcı nakliyesi (şantiyeye teslim, ücret ilanda). Nakliye entegrasyonu v2 | Operasyon |
| OQ-10 | Fiyat ve miktar | **Karar:** TRY, KDV hariç, **birim fiyat** üzerinden (çelikte TL/ton). Miktar en küçük birimde tamsayı (ton → kg). Toplam = birim fiyat × miktar; yuvarlama kuralı tek yerde, M3 başında AUCTION-RULES'a eklenir. KDV oranı kategori bazlı | Ürün + Finans |

**MVP kararları (2026-10-27, ürün sahibi):** B2B inşaat malzemesi pazaryeri (OQ-02/04/05/06/10 yukarıda). MVP'de sahte ödeme sağlayıcısı (`PaymentPort`) havale + teminat akışını taklit eder; gerçek hesap/PSP ve hukuk lansman öncesi. Şirket doğrulaması MVP'de vergi no format kontrolü + yönetici onayı (otomatik sorgu sonra). Ekip: ürün sahibi + Claude Code. Sıra: `docs/ROADMAP.md` "MVP yolu".

## 3. Roller
Ziyaretçi · Şirket (alıcı ve/veya satıcı yetkili) → şirket içi roller: Şirket yöneticisi, Satın almacı (teklif/sipariş), Satış sorumlusu (ilan) · Platform: Moderatör · Destek · Yönetici · Sistem (zamanlayıcı/worker). Yetki kontrolü hem şirket üyeliği hem şirket içi rol üzerinden yapılır.

## 4. Kapsam
**v1 içinde:** hesap ve doğrulama, ilan, kategori/nitelik, görsel, arama, favori/bildirim, mesajlaşma, satıcı onboarding/KYC ve paneli, klasik artırma + canlı yayın, escrow'lu ödeme, sipariş/teslimat/itiraz/iade, hakediş, moderasyon ve admin, audit.
**v1 dışında:** bireysel (tüketici) alıcı, kart ile ödeme, ters mezat (satın alma ihalesi), vadeli/açık hesap satış, nakliye entegrasyonu, canlı video mezat, otomatik teklif (proxy), kapalı zarf, Hollanda usulü, mobil native uygulama, çoklu para birimi/dil, sadakat sistemi, yapay zekâ fiyat tahmini, reklam/öne çıkarma ürünleri, mağaza vitrini.

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
- FR-ID-05 (M) Şirket hesabı: unvan, vergi no/dairesi, adres; şirkete üye davet etme, şirket içi rol atama; şirket doğrulanmadan teklif/satış yok.

### İlan ve katalog
- FR-LS-01 (M) Kategori ağacı ve kategoriye özel nitelikler (ör. çelik: ürün tipi, standart/kalite sınıfı B500C/S235JR/S355, çap/kalınlık/boy) ve kategoriye özel satış birimi.
- FR-LS-06 (M) İlanda miktar, minimum alım miktarı, depo konumu, teslim şekli ve kalite belgesi (fabrika test sertifikası) yükleme.
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
- FR-AU-08 (M) Teklif güvencesi: teklif vermeden önce teminat yatırılır; kaybeden teminatı iade edilir, kazananınki ödemeye sayılır, ödemeyen kazananın teminatı politika gereği işlenir (OPEN-AU-07).
- FR-AU-09 (M) Mezat bir lot üzerinedir (sabit miktar); teklif birim fiyat üzerinden verilir, toplam tutar ayrıca gösterilir.

### Sipariş, ödeme, escrow
- FR-OR-01 (M) Sipariş durum makinesi (ödeme bekliyor → ödendi/escrow → kargoda → teslim edildi → tamamlandı; iptal/iade/itiraz).
- FR-OR-02 (M) Ödeme havale/EFT ile; her siparişe tekil ödeme referansı, gelen ödemenin referansla eşleştirilmesi, eksik/fazla ödeme durumları. Kart verisi sistemimize hiç girmez.
- FR-OR-07 (S) E-fatura/e-arşiv entegrasyonu (lansman öncesi).
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
