# DEFINITION-OF-DONE.md

## Her görev için
- [ ] Kabul ölçütleri yazılıydı ve karşılandı (görev başında planda belirtilmişti)
- [ ] `typecheck`, `lint`, ilgili birim/entegrasyon testleri yeşil; çıktı özeti rapora eklendi
- [ ] Yeni davranış için test var; hata düzeltmesinde önce hatayı yeniden üreten test var
- [ ] Girdi doğrulama, yetki (nesne düzeyi) ve hata durumları ele alındı; sır/kişisel veri loga girmiyor
- [ ] Kritik eylem ise audit log yazılıyor; dış etkili yazma ise idempotent
- [ ] Şema değişikliği varsa migration ileri uyumlu ve geri alma notu PR'da
- [ ] Gözlemlenebilirlik: gerekli log/metrik/iz eklendi, hata yollarında korelasyon id var
- [ ] Belge güncellendi (ilgili `docs/*`, ADR, GLOSSARY)
- [ ] Diff insan tarafından incelendi (aşağıdaki "zorunlu insan incelemesi" alanlarında şart)
- [ ] `docs/ROADMAP.md` işaretlendi ve `docs/LOG.md` girişi yazıldı (maliyet dahil)

## Zorunlu insan incelemesi (AI üretimi olsa da)
Kimlik/oturum · yetkilendirme politikaları · teklif/kapanış · ödeme/webhook/ledger · migration · gizli bilgi/yapılandırma · dış bağımlılık ekleme.

## Kritik modüller (auctions, ledger, payments, orders) için ek şartlar
- [ ] İlgili değişmez(ler) (AUCTION-RULES I1–I10) açıkça adlandırıldı ve test edildi
- [ ] Property veya eşzamanlılık testi eklendi/güncellendi
- [ ] Gerçek PostgreSQL (Testcontainers) ile entegrasyon testi geçti — mock DB yeterli değil
- [ ] DB kısıtı ile korunabilecek kural uygulama koduna bırakılmadı
- [ ] Faz kapısında `auction-invariant-reviewer` bulguları kapandı

## Faz kapısı
`docs/ROADMAP.md` içindeki `*-G1` maddesi; ilgili değişmezler ve panolar canlı; LOG'a faz özeti yazılmış; bir sonraki faz için `/clear` ile temiz başlangıç.
