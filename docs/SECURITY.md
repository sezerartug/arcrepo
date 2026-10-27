# SECURITY.md — Tehdit modeli ve kontroller (v0.1)

Varlıklar: kullanıcı hesapları ve kişisel veriler, teklif/sipariş bütünlüğü, para (escrow/ledger/hakediş), satıcı KYC verisi, yönetici yetkileri, gizli anahtarlar, kaynak kod ve geliştirme hattı.
Güven sınırları: tarayıcı/mobil ↔ API · API ↔ DB/Redis/depolama · API ↔ PSP/KYC/kargo · yönetici paneli · CI/CD ve geliştirici makineleri (AI araçları dahil).

| # | Tehdit | Örnek | Kontrol | Doğrulama (görev) |
|---|---|---|---|---|
| T1 | Nesne düzeyi yetki (BOLA/IDOR) | Başkasının siparişini/ilanını okuma-değiştirme | Her uç noktada sahiplik politikası; varsayılan ret | BOLA matrisi (P1-08, P2-14) |
| T2 | Kimlik hırsızlığı | Parola doldurma, oturum çalma | argon2id, rate limit, HttpOnly/Secure/SameSite, MFA (satıcı/yönetici) | P1-07, P5-08 |
| T3 | Teklif yarışı / çift kazanan | Eşzamanlı teklif, çift kapanış | Satır kilidi, DB kısıtları, idempotency | P1-16, P4-14/15 |
| T4 | Teklif spam/DoS | Bot teklif seli | Çok katmanlı rate limit, teklif yetkinliği, WAF/bot koruması | P1-12, P4-12 |
| T5 | Şişirme (shill) teklifi | Satıcının ilişkili hesapla fiyat yükseltmesi | Kendi ilanı engeli, kümeleme sinyalleri, inceleme | P4-12, P5-05 |
| T6 | Webhook sahteciliği/tekrarı | Sahte "ödendi" çağrısı | İmza doğrulama, tekilleştirme, durum makinesi, PSP'ye geri doğrulama | P3-04, P3-10 |
| T7 | Para tutarsızlığı | Çift tahsilat, yuvarlama | bigint minor unit, çift taraflı ledger, mutabakat | P1-14, P3-11 |
| T8 | Dosya yükleme istismarı | Polyglot dosya, SVG-XSS, devasa görsel | Magic-byte doğrulama, boyut/piksel sınırı, SVG yok, türev üretimi, özel orijinal | P2-04 |
| T9 | XSS/CSRF/SSRF/enjeksiyon | Kullanıcı içeriği, URL getirme | Çıktı kodlama, CSP, CSRF jetonu/SameSite, parametreli sorgu, sunucu tarafı URL getirme yok | P1-05, P5-12 |
| T10 | Kişisel veri sızıntısı | Loglara PII, hata mesajları | Log maskeleme, minimum veri, saklama süreleri, erişim logu | P1-13, P5-09 |
| T11 | Yönetici/insider kötüye kullanımı | Teklif silme, iade manipülasyonu | RBAC, MFA, neden zorunlu, değiştirilemez audit | P1-09, P4-13, P5-06 |
| T12 | Hesap ele geçirme → ödeme yönlendirme | Satıcı IBAN değişikliği | Ek doğrulama + bekleme süresi + bildirim | P5-08 |
| T13 | Tedarik zinciri | Zararlı npm paketi/eklenti | Sürüm sabitleme, lockfile, denetim, eklenti incelemesi | P0-03, P1-05 |
| T14 | AI geliştirme riski | Prompt injection, aşırı yetkili ajan, sır sızıntısı | `.claude/settings.json` deny kuralları, prod kimlik bilgisi vermeme, auth/ödeme/artırma diff'lerinde zorunlu insan incelemesi | P0-02/03, DoD |

Genel: OWASP API Security Top 10 ve ASVS kontrol listesi olarak kullanılır; her faz kapısında ilgili maddeler gözden geçirilir. Bulgular `docs/LOG.md`'de izlenir.
