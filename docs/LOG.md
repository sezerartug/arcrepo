# LOG.md — Proje günlüğü (en yeni giriş en altta)

Her görev bitişinde bir giriş eklenir (CLAUDE.md "Bitirme protokolü"). Amaç: karar izi, kanıt, maliyet ve devir. Kısa tut; kod değil sonuç yaz.

## Giriş şablonu
```
### YYYY-MM-DD — <görev ID'leri> — <tek satır başlık>
- Yapılan:
- Karar / neden (ADR varsa no):
- Doğrulama: <komut → sonuç özeti>
- Dokunulan alanlar:
- Maliyet: <`/usage` özeti: model, token, tahmini $> · Bağlam: <`/context` %>
- Risk / açık konu:
- Sonraki adım:
```

## Haftalık özet şablonu (P-13)
```
### Hafta N — Faz X
- Tamamlanan görev: a/b · Faz ilerlemesi: %
- Harcama: toplam, görev başına medyan, en pahalı 3 görev ve nedeni
- Kalite: kaçan hata, geri alınan değişiklik, incelemede yakalanan Kritik/Yüksek
- Değişecekler (CLAUDE.md / skill / süreç):
```

## A/B deney kaydı (P0-08)
| Görev | Mod | Model | Token (in/out) | Maliyet | Diff satırı | Test eklendi mi | Doğrulama/yetki kaybı var mı | Not |
|---|---|---|---|---|---|---|---|---|
| | ponytail kapalı | | | | | | | |
| | ponytail açık | | | | | | | |

## Girişler

### 2026-10-24 — Kit oluşturuldu
- Yapılan: CLAUDE.md, PRD, ARCHITECTURE, AUCTION-RULES, SECURITY, ROADMAP, DoD, PROMPTS, TOOLING, subagent'lar ve `scripts/progress.sh` hazırlandı (taslak v0.1).
- Karar: Ana backlog `docs/ROADMAP.md`; BMAD/Matt Pocock çıktıları buna bağlanır, ikinci backlog açılmaz.
- Doğrulama: `bash scripts/progress.sh` → 116 görev, 0 tamam.
- Risk: PRD açık soruları (OQ-01…09) ve AUCTION-RULES OPEN-AU maddeleri kapanmadan Faz 1'in ötesine geçilmez.
- Sonraki adım: P0-01.

### 2026-10-27 — P0-01 (kısmi), P0-02 (kısmi), P0-09 (hazırlık), P1-03 (öne çekildi) — Depo + model + MCP + DB tanımı
- Yapılan: Kit `docs/` yapısına taşındı, `.claude/` ve `scripts/` eklendi; `.gitignore`, `.gitattributes` (LF); `git init -b main`, ilk commit `1cddfeb`. `.mcp.json` (context7 4.3.0, playwright-mcp 0.0.83 + Edge). `compose.yaml` (PostgreSQL 18, Redis 8 noeviction; yalnızca 127.0.0.1).
- Karar / neden: Model `opusplan` (plan → Opus, uygulama → Sonnet, test-runner → Haiku); maliyet düşürme. MCP sürümleri ≥2 haftalık yayına sabitlendi (tedarik zinciri). DB MCP kurulmadı, `psql` docker üzerinden kullanılacak (TOOLING §5). P1-03, P0-G1 kapısından önce öne çekildi: iş kararlarına bağımlı değil, ürün sahibi istedi. S3/mail/OTel kendi görevlerinde eklenecek.
- Doğrulama: `bash scripts/progress.sh` → 0/116, sıradaki P0-01. `compose.yaml` ve `.mcp.json` henüz çalıştırılmadı (Docker kurulu değil; MCP onayı sonraki oturumda).
- Dokunulan alanlar: depo kökü, `.claude/settings.json`, `docs/PROMPTS.md`, `docs/LOG.md`.
- Maliyet: ölçülmedi (bu oturum Opus; `/usage` kullanıcıda). · Bağlam: ölçülmedi.
- Risk / açık konu: Uzak depo + dal koruması yok (`gh` kurulu değil). Docker Desktop + WSL2 yok; makinede 7,9 GB RAM → WSL belleği sınırlanmalı. Node 24.12 kurulu (ADR-012 yedek seçeneği); Node 26 Active LTS 28 Ekim'de. Tek geliştirici + Claude ile ROADMAP'in 3–4 kişilik 36 haftalık tahmini geçerli değil.
- Sonraki adım: Docker Desktop kurulumu → `docker compose up -d` doğrulama; GitHub deposu + dal koruması; taban `/context` ölçümü; P0-10 kapsam kararları.

### 2026-10-27 — P0-10 (kısmi) — MVP yolu ve kapsam kararları
- Yapılan: ROADMAP'e "MVP yolu" (M1 Temel → M2 İlan → M3 Mezat → M4 Sipariş+ödeme → M5 Paneller) eklendi; PRD'ye MVP kararları yazıldı.
- Karar / neden: Ürün sahibi kararı — hukuk/PSP/KYC lansman öncesine; MVP sahte ödeme sağlayıcısıyla; kategoriler Koleksiyon + Elektronik; BMAD/Ponytail/Matt Pocock kurulmuyor (taban token maliyeti), yerleşik skill'ler kullanılıyor. Gerçek para/kullanıcı hukuk + PSP tamamlanmadan yok.
- Doğrulama: belge değişikliği; `bash scripts/progress.sh` → 0/116.
- Risk / açık konu: OPEN-AU-01…11 M3 başında karara bağlanacak; OQ-06…09 ilgili dilimde teyit.
- Sonraki adım: Docker kurulumu → M1 / P1-01 monorepo iskeleti.

### 2026-10-27 — P0-10 (kısmi) — Alan değişikliği: B2B inşaat malzemesi pazaryeri
- Yapılan: PRD amaç, roller, kapsam, OQ-02…06/09/10 ve FR'ler (FR-ID-05, FR-LS-01/06, FR-AU-08/09, FR-OR-02/07) güncellendi; MVP yolu tablosu buna göre düzenlendi. Önceki "Koleksiyon + Elektronik" kararı geçersiz.
- Karar / neden: Ürün sahibi — mezat inşaat sektörü odaklı (öncelik çelik). Çok satıcılı pazaryeri; alıcı ve satıcı yalnızca şirket; ileri (artan) mezat; TRY, KDV hariç, kategori birimi başına fiyat (çelik TL/ton); tüm inşaat malzemeleri; ödeme havale/EFT + teminat (kartla ödeme yok).
- Doğrulama: belge değişikliği.
- Risk / açık konu: Birim fiyat × miktar yuvarlama kuralı ve lot modeli AUCTION-RULES'a eklenmeli (M3 başı). Havale eşleştirme + escrow hesabının yasal sahibi hukuk konusu. Kimlik modeli artık şirket + üye → P1-07/P1-08 kapsamı büyüdü.
- Sonraki adım: P1-01.

### 2026-10-27 — P1-01 — Monorepo iskeleti
- Yapılan: pnpm workspaces (`apps/*`, `packages/*`). `packages/config` (strict `tsconfig.base.json`), `packages/contracts` (boş public `index.ts`), `apps/api` (NestJS 12, ESM, boş `AppModule` + `main.ts`, Nest CLI ile dev/build, Vitest + unplugin-swc), `apps/web` (Next.js 16.4.3 App Router, tek sayfa). Kök komutları: dev, build, typecheck, test:unit; CLAUDE.md "Komutlar" dolduruldu. `.node-version` = 24, `engines` ≥24. `next-env.d.ts` gitignore'a (typegen üretiyor).
- Karar / neden: TypeScript 6.0.3 (TS 7 Go tabanlı; Nest CLI `~6.0.2` istiyor, Next/Nest JS API'si riskli). Sürümler tam sabit (`savePrefix: ''`), ortaklar pnpm `catalog`. Ürün sahibi kararı: `minimumReleaseAge` 14 → **3 gün**, çünkü 14 günlük kural güvenlik yamalarını engelliyordu (next ≤16.4.0: 2 critical RCE + 1 high; body-parser <2.4.0, multer <2.5.0: high DoS). `@nestjs/platform-express` multer 2.4.0'ı sabitlediği için `overrides` (body-parser 2.4.0, multer 2.5.0) eklendi; Nest yamalı sürüm yayınlayınca kaldırılacak. `packages/ui` P1-17'ye bırakıldı. Plandan sapma: `tsconfig.base.json` kökte değil yalnızca `packages/config` içinde (tekrar olmasın diye). Paket kapsamı `@arc/*`. API testlerinde `testTimeout` 30 sn: Nest HTTP adaptörünü test içinde tembel yüklüyor, Windows'ta soğuk yükleme 5 sn'yi aşıyor (10–20 sn ölçüldü).
- Doğrulama (red → green): önce iki test modül yokluğundan düştü; sonra `pnpm typecheck` 3/3 Done, `pnpm test:unit` web 1/1 + api 1/1 geçti, `pnpm build` api + web başarılı, `node dist/main.js` başladı (HTTP 404, route yok), `pnpm dev` web 200 + `<h1>ARC Global</h1>`, api 404. `pnpm audit --prod` → açık yok.
- Maliyet: ölçülmedi (`/usage` kullanıcıda). · Bağlam: ölçülmedi.
- Risk / açık konu: `pnpm audit` (dev) → fast-uri 3.1.8 (2 moderate, 2 low), yalnızca Nest CLI → @angular-devkit/core üzerinden, çalışma zamanına girmez; bir sonraki bağımlılık güncellemesinde. `@swc/core` postinstall betiği pnpm varsayılanıyla engelli (native binary opsiyonel paketle geliyor, testler çalışıyor). `pnpm install` bu makinede 6–10 dk sürüyor. Lint ve modül sınır kuralı yok (P1-02). Node 26 geçişi CI'da doğrulanınca (ADR-012).
- Sonraki adım: P1-02.

### 2026-10-27 — P1-02 — Lint, format, modül sınır kuralı
- Yapılan: P1-01 `main`'e fast-forward birleştirildi; dal `feat/P1-02-lint-boundaries`. Kökte ESLint 10.13.0 flat config (`eslint.config.mjs`): `@eslint/js` recommended + typescript-eslint 8.72.0 `strictTypeChecked` (projectService), `apps/web/**` için `@next/eslint-plugin-next` core-web-vitals + `eslint-plugin-react-hooks`, `eslint-config-prettier`. Prettier 3.9.10 (`singleQuote`, `printWidth` 100; `*.md` ve lockfile hariç). Yerel kural `arc/no-cross-module-import` (`packages/config/eslint/`, `@arc/config/eslint-plugin` olarak dışa açık): başka bir modüle yalnızca `modules/<ad>/index` üzerinden, başka bir pakete yalnızca paket adıyla (göreli yol değil) import edilebilir. Kök komutları `lint`, `format`, `format:check`; CLAUDE.md güncellendi. TS strict zaten P1-01'de vardı, değişmedi.
- Karar / neden: Ürün sahibi kararları: ESLint + Prettier (Biome değil); CI zorunluluğu P1-05'e (pre-commit kancası yok); ESLint 9 EOL olduğu için ESLint 10. `eslint-config-next` kullanılmadı, çünkü içindeki react/import/jsx-a11y eklentileri ESLint 10'u desteklemiyor; yalnızca Next + hooks eklentileri alındı. Sınır kuralı üçüncü taraf eklenti yerine yerel (~50 satır, ek bağımlılık yok). `no-extraneous-class` için `allowWithDecorator` (Nest `@Module` boş sınıf). Yön kuralları (ör. ledger'ı yalnızca payments/orders çağırır) modüller oluşunca eklenecek. `compose.yaml` Prettier ile yeniden biçimlendirildi (yalnızca tırnak/dizi düzeni).
- Doğrulama (red → green): kural testi önce modül yokluğundan düştü, sonra 11/11 geçti (`RuleTester`: derin import, `export … from`, dinamik `import()`, modül dışından derin import, paketler arası göreli import). `pnpm lint` temiz, `pnpm format:check` temiz, `pnpm typecheck` 3/3, `pnpm test:unit` config 11 + web 1 + api 1 geçti. `eslint --print-config` ile kapsam doğrulandı: web 22 `@next` + 16 `react-hooks` kuralı, api'de 0; sınır kuralı ve `no-floating-promises` her ikisinde `error`. Gerçek bir modül dizininde uçtan uca deneme yapılmadı (henüz modül yok; geçici dosya oluşturma izni verilmedi).
- Maliyet: ölçülmedi (`/usage` kullanıcıda). · Bağlam: ölçülmedi.
- Risk / açık konu: React/JSX erişilebilirlik ve import kuralları yok; eklentiler ESLint 10'u destekleyince `eslint-config-next`'e dönülebilir. `packages/config/eslint/*.js` tipe duyarlı lint/typecheck dışında (yalnızca `// @ts-check` + JSDoc, editörde). CI olmadığı için kural şu an yalnızca elle `pnpm lint` ile uygulanıyor.
- Sonraki adım: P1-03 (compose: S3-uyumlu depo, e-posta yakalayıcı, OTel collector; Docker kurulumu gerekli).
