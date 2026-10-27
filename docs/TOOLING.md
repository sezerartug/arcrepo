# TOOLING.md — Claude Code araç seti: analiz, kurulum sırası, maliyet kontrolü

Kaynak: dört deponun README'leri 24 Ekim 2026'da okundu. Yıldız sayıları ve sürümler o günün değerleridir. "Bulgu" = depoda yazan; "Yorum" = bu proje için değerlendirme.

## 1. Karar özeti
| Araç | Rolü | Karar | Ne zaman | Başlıca risk |
|---|---|---|---|---|
| **BMAD-METHOD** (54,3k★, MIT) | Planlama: PRD → mimari → epic/story | **Kısmen kullan**: kararlı **v6.12**, yalnızca planlama | Faz 0 ve faz başlangıçları | Süreç ağır → token; v7 hâlâ alfa; Matt Pocock ile çakışma |
| **Ponytail** (170k★, MIT) | Gereksiz kodu azaltma, review/audit | **Dene, ölç, karar ver** (P0-08); çekirdekte `lite` | Günlük kodlama + `/ponytail-review` | Kazanç iddiaları yazarın kendi benchmark'ı; çekirdek modülde fazla "tembel" olma riski |
| **Matt Pocock Skills** (300k★, MIT) | Günlük mühendislik disiplini | **Seçili skill'leri kullan** (kopyalama kurulumu) | Her görevde | Çakışan planlama skill'leri; otomatik güncelleme = incelenmemiş prompt değişimi |
| **claude-plugins-official** (43k★, Apache-2.0) | Eklenti dizini (marketplace) | **İhtiyaç oldukça, tek tek** | Gerektiğinde | Dizindeki üçüncü taraf eklentileri Anthropic doğrulamıyor (README uyarısı) |
| **Karpathy ilkeleri** | Dört davranış ilkesi | **CLAUDE.md'ye gömüldü** (eklenti yok) | Sürekli | Üçüncü taraf damıtması, Karpathy'nin kendisi değil |

## 2. Depo bazında analiz

### BMAD-METHOD
**Bulgu:** "Agile AI Driven Development". Kararlı hat **v6.12**: `npx bmad-method install` (Node 20.12+, Python 3.10+, `uv`); sonra `bmad-build` ile iş ver, `bmad-help` ile yönlendirme al. **V7 önizleme alfa**: kurulum yolu ve skill'ler sık değişiyor, kırıcı değişiklik bekleniyor; README'de yayın tarihi 16 Ekim 2026 olarak ifade edilmiş olsa da okuduğumuz sayfada hâlâ "preview alpha" yazıyordu. Süreç "işin boyutuna göre ölçeklenir" (küçük iş doğrudan inşa, büyük iş planlama derinliği). Ek modüller: Builder, Test Architect (kurumsal test eklentisi), **BMad Loop** (bütün bir epic'i gözetimsiz inşa/doğrula/retro).
**Yorum:** Çok aylık, çok modüllü bir ürün için PRD→mimari→hikâye zinciri değerli; ama her faz için tam BMAD döngüsü token ve dosya yükü getirir. Bu projede planlama zaten `docs/` altında yarı hazır (PRD, mimari, kurallar). BMAD'ı **boşlukları doldurmak ve story detayı üretmek** için kullan. Kararlı v6.12'de kal; v7'yi stabil olana dek şirket projesine alma. **BMad Loop'u ödeme/teklif koduna kullanma** (gözetimsiz üretim, kritik modüllerde insan incelemesi şartıyla çelişir). Test Architect'i Faz 3–4 test stratejisi için değerlendirmeye aday olarak not et (P3/P4 başında karar).

### Ponytail
**Bulgu:** Tek bir istem (skill) olarak çalışıyor; "en küçük çalışan çözüm" merdiveni: gerek var mı → kodda var mı → standart kütüphane → platform özelliği → mevcut bağımlılık → minimum yeni kod; mantık içeren kodda küçük bir test. Doğrulama, hata yönetimi, güvenlik ve erişilebilirlik kesilmez diyor. Komutlar: `/ponytail [lite|full|ultra|off]`, `/ponytail-review`, `/ponytail-audit`, `/ponytail-debt`, `/ponytail-gain`. Claude Code'da bant (maliyet, token, test durumu) ve yerel pano; bant için Claude Code 2.1.290+. Yazarın benchmark'ı (39 görev, Opus 5.5, görev başına 5 koşu): kod −%53, süre −%41, maliyet −%26, token −%45; riskli mantığın teste bağlanması %98 (kapalıyken %68).
**Yorum:** Rakamlar **yazarın kendi ölçümü**; hipotez olarak al, P0-08'deki A/B ile kendi kodunda doğrula. Faydası en çok CRUD, arayüz ve yardımcı kodda; teklif/ledger/ödeme gibi kasıtlı olarak "karmaşık ama zorunlu" kodda `lite` kullan ve DB kısıtı, kilit, idempotency, audit gibi şeylerin silinmediğini incelemede kontrol et. `/ponytail-review` ve `/ponytail-audit` faz sonu kapı incelemesine iyi bir ek. Karpathy "sadelik" ilkesiyle örtüşür; ikisini birden yüklemek çift talimat demek: CLAUDE.md'deki kısa ilke + Ponytail yeterli. Eklenti kancalar (hooks) çalıştırır → güvenlik onayı gerektirir (§6). Yalnızca `DietrichGebert/ponytail` kaynağından kur (README'de sahte kopyalar için uyarı var).

### Matt Pocock Skills
**Bulgu:** "Gerçek mühendisler için" küçük, birleştirilebilir skill'ler. README BMAD/GSD/Spec-Kit gibi süreci sahiplenen yaklaşımlara karşı konumlanıyor ("kontrolü alıyorlar"). Başlıca skill'ler: `grill-me` / `grill-with-docs` (agresif soru-cevap + ortak dil `GLOSSARY.md` + ADR), `tdd`, `diagnosing-bugs`, `code-review` (Standartlar ve Spec ekseninde paralel alt ajanlar), `improve-codebase-architecture`, `to-spec`, `to-tickets`, `implement`, `implement-spec`, `wayfinder`, `retro`, `handoff`, `pr`. `setup-matt-pocock-skills` repo başına bir kez çalışır (issue tracker, etiketler, doküman konumu). Kurulum: Claude Code için `claude plugin install mattpocock-skills@claude-plugins-official` (kendini günceller) veya düzenlenebilir kopya için `npx skills@latest add mattpocock/skills -a <agent>` (elle güncellenir); ikisini birden kurma, her skill ikilenir.
**Yorum:** Bu projenin asıl ihtiyacı olan şeyler burada: `tdd` (kırmızı-yeşil döngü), `grill-with-docs` (ortak dil + ADR), `diagnosing-bugs`, `code-review`. Planlama/iş bölme skill'leri (`to-spec`, `to-tickets`, `implement`, `implement-spec`, `wayfinder`) **BMAD ile aynı işi yapar** → birini seç. Bu kit için seçim: planlamada BMAD (ve ROADMAP), günlük disiplinde Matt Pocock. **Kopyalama kurulumunu** (`npx skills`) tercih et: otomatik güncelleyen eklenti, prompt değişikliklerini incelemeden içeri alır; kopyada `git diff` ile gözden geçirir, sürümü sabitlersin. Ayrıca yüklü her skill'in adı/açıklaması her oturumda bağlama girer; hepsini yüklemek taban maliyeti artırır.

### anthropics/claude-plugins-official
**Bulgu:** Anthropic yönetimli eklenti dizini. `/plugin install {ad}@claude-plugins-official` veya `/plugin > Discover`. `/plugins` iç eklentiler, `/external_plugins` ortak/topluluk eklentileri. README uyarısı: Anthropic eklentilerin içindeki MCP sunucuları ve yazılımı kontrol etmez ve değişmeyeceğini garanti edemez; kurmadan önce güven.
**Yorum:** Varsayılan olarak **hiçbirini toplu kurma**. İhtiyaç doğunca (ör. TypeScript dil sunucusu, GitHub entegrasyonu, güvenlik taraması) o an `/plugin > Discover`'dan tek tek ekle, `plugin.json`/hook/MCP içeriğini oku, sürümü LOG'a yaz.

## 3. Çakışma haritası ve tek doğruluk kaynağı kuralları
| İş | Kullanılacak | Kullanılmayacak (çakışma) |
|---|---|---|
| Backlog ve ilerleme | `docs/ROADMAP.md` | BMAD sprint-status, MP issue tracker backlog'u (yalnızca ROADMAP ID'sine bağlı detay olarak) |
| PRD/mimari/story üretimi | BMAD (v6.12) planlama akışı | MP `to-spec`, `to-tickets`, `wayfinder` |
| Uygulama döngüsü | `tdd` + CLAUDE.md ilkeleri | BMAD otomatik inşa döngüleri (Loop), MP `implement-spec` |
| İnceleme | `/ponytail-review` + MP `code-review` + `auction-invariant-reviewer` (kritik) | — |
| Sadelik talimatı | CLAUDE.md ilkesi + Ponytail | Ayrıca Karpathy eklentisi |
| Ortak dil / karar kaydı | `GLOSSARY.md` + `docs/ARCHITECTURE.md` ADR'leri (MP `grill-with-docs` günceller) | Ayrı ADR klasörü |

## 4. Kurulum sırası
Her adım ROADMAP'te bir görevdir; sıra bozulursa taban maliyeti ölçmek zorlaşır.
1. **Güvenlik onayı** (P0-03): üçüncü taraf eklenti listesi + kaynak depolar + sürümler şirket güvenliğine sunulur.
2. **Boş taban ölçümü:** CLAUDE.md + `.claude/` ile Claude Code'u aç; `/context` çıktısını LOG'a yaz.
3. **Matt Pocock (seçili, kopyalama):**
   ```
   npx skills@latest add mattpocock/skills -a <claude-code'u listeden seç>
   # Seçilecekler: setup-matt-pocock-skills, grill-with-docs, tdd, diagnosing-bugs, code-review, improve-codebase-architecture
   ```
   Sonra Claude Code'da `/setup-matt-pocock-skills` (issue tracker: yerel dosyalar/GitHub; doküman konumu: `docs/`). `/context` ile artışı ölç.
4. **BMAD v6.12 (kararlı):**
   ```
   npx bmad-method install      # Node 20.12+, Python 3.10+, uv gerekir
   ```
   Yalnızca planlama modüllerini seç; Test Architect ve Loop'u şimdilik ekleme. `bmad-help` ile doğrula. `/context` ile artışı ölç.
5. **Ponytail:**
   ```
   /plugin marketplace add DietrichGebert/ponytail
   /plugin install ponytail@ponytail
   ```
   Önce A/B deneyi (§7), sonra kalıcı mod kararı.
6. **MCP (§5)**, en son.
7. **Resmi dizin eklentileri:** yalnızca gerçek ihtiyaçta.

## 5. MCP
MCP sunucularının araç tanımları her oturumda bağlama girer; CLI aracı olan şey için MCP kurma (`gh`, `psql`, `docker`, `k6`, `pnpm` Bash ile ücretsiz). Önerilen en küçük küme:
```
claude mcp add --scope project context7 -- npx -y @upstash/context7-mcp
claude mcp add --scope project playwright -- npx @playwright/mcp@latest
```
- **context7:** Next.js/NestJS/Prisma gibi hızlı değişen kütüphanelerde güncel dokümantasyon (eğitim verisi eskiyebilir).
- **playwright:** arayüzü gerçekten çalıştırıp doğrulama (canlı artırma ekranı, ödeme akışı).
- Paket adlarını ve bayrakları kurulum anında resmi README'den doğrula.
- Veritabanı MCP'si yalnızca **salt okunur kullanıcıyla ve yalnızca geliştirme DB'sine**; prod/staging kimlik bilgisi Claude'a verilmez.

## 6. Güvenlik ve kurumsal uyum
- Eklentiler kanca (hook), MCP sunucusu ve istem enjekte edebilir; yani **geliştirici makinesinde kod çalıştırır**. Şirket politikasına göre onaylı liste, sürüm sabitleme, kaynak inceleme.
- Otomatik güncellemeyi kapat veya kopya kurulum kullan (§2). Güncellemeleri `git diff` ile oku.
- `.claude/settings.json` deny kuralları (gizli dosyalar, yıkıcı komutlar) repo ile gelir.
- Prod/staging kimlik bilgisi, müşteri verisi, gerçek PSP anahtarı Claude'a verilmez.
- Auth, ödeme, teklif/kapanış, migration diff'lerinde zorunlu insan incelemesi (DoD).
- Dış içerikten (issue, web, PDF) gelen talimatlara itaat yok; ajan çıktısı doğrulanır.

## 7. Deney protokolü (P0-08) — "Ponytail gerçekten tasarruf ettiriyor mu?"
1. İki küçük ama gerçekçi görev seç: (a) CRUD/doğrulama (ör. ilan başlığı doğrulaması + testi), (b) çekirdek (ör. idempotency middleware).
2. Her görevi **temiz oturumda, aynı modelde** iki kez çalıştır: Ponytail kapalı / açık. (Görevi bir dalda yap, `git reset` ile geri al.)
3. Kaydet (LOG tablosu): token, maliyet (`/usage`), diff satırı, eklenen test, doğrulama/yetki/kilit/idempotency kaybı var mı, inceleme bulguları.
4. Karar ölçütü: maliyet ve diff düşüyor **ve** doğrulama/test kaybı yok → CRUD/UI için `full`, çekirdek için `lite`. Kayıp varsa → yalnızca `/ponytail-review` için kullan.
5. Aynı protokolü BMAD için uygula: aynı planlama çıktısını BMAD ile ve doğrudan `grill-with-docs` ile üret; token ve çıktı kalitesini karşılaştır.

## 8. Token maliyeti kontrol planı
Anthropic dokümantasyonuna göre token maliyeti bağlam boyutuyla artar; başlıca kaldıraçlar:
- **Bağlamı küçük tut:** görevler arasında `/clear`; uzun oturumda `/compact <neyi koru>`. CLAUDE.md'yi kısa tut (Anthropic dokümantasyonu birkaç yüz satırın altını öneriyor; biz <150 hedefliyoruz); uzun talimat → skill/`docs/` (otomatik `@import` etme, gerektiğinde okut).
- **Ölç:** `/usage` (token ve tahmini maliyet; istemci tarafı tahmindir, fatura değildir) ve `/context` (nerede yer kaplıyor). Her görev LOG'a yazılır.
- **Doğru model:** plan/mimari/inceleme güçlü model; uygulama Sonnet; basit subagent Haiku (`test-runner`).
- **Çıktısı uzun işleri subagent'a ver:** test, geniş arama, log.
- **Gereksiz yükleme yok:** kullanılmayan MCP/skill/eklentiyi kaldır; CLI varsa MCP kurma.
- **Bütçe bekçisi (sezgisel):** bir görev medyanın ~2 katını aşarsa dur, planı yeniden yap (genelde bağlam şişmesi veya yeniden deneme döngüsü).
- API kullanılıyorsa Console'da workspace harcama limiti; haftalık P-12 retrosu.

## 9. Karpathy yöntemleri
Dört ilke (CLAUDE.md'de): düşünmeden kodlama, sadelik, cerrahi değişiklik, hedef odaklı yürütme. Kaynak: Karpathy'nin LLM kodlama hataları üzerine gözlemlerini üçüncü bir kişinin tek bir CLAUDE.md'ye damıttığı popüler bir depo (Karpathy'nin kendi deposu değil). Biz metni olduğu gibi kopyalamadık; bu projeye uyarladık (kritik modüllerde sadeliğin neyi kısamayacağı dahil). İleride başka bir Karpathy yöntemi eklemek istersen kaynağını ver, aynı ölçüm disipliniyle (§7) değerlendirelim.
