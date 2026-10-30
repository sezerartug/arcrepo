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

### 2026-10-27 — P1-03 engelli, P1-04 (kısmi) — Env doğrulama + sır taraması
- Yapılan: P1-02 `main`'e birleştirildi; dal `feat/P1-04-config-secrets`. P1-03 atlandı: Docker ve WSL bu makinede yok, `compose.yaml` çalıştırılarak doğrulanamaz (S3/mail/OTel servisleri önceki karar gereği kendi görevlerinde). P1-04: `apps/api/src/modules/platform` modülü açıldı (public `index.ts`); `infrastructure/env.ts` → `parseEnv` (`NODE_ENV`, `PORT`; varsayılan development/3001; tüm hatalar tek seferde, yalnızca değişken adıyla, değer asla mesajda yok) ve `loadEnvFileIfExists` (Node `process.loadEnvFile`; dosya yoksa sessiz). `main.ts` production dışında kökteki `.env`'i yükler, sonra doğrular, `env.port` ile dinler. Sır taraması: secretlint 13.0.7 + recommend preset, `pnpm secrets:scan` (`--maskSecrets`, `.gitignore`'a uyar → yerel `.env` taranmaz).
- Karar / neden: Şema için kütüphane eklenmedi (iki değişken; DTO doğrulama kütüphanesi henüz seçilmedi, karar öne çekilmedi). Yalnızca kullanılan değişkenler eklendi; `DATABASE_URL` vb. P1-06'da. Nest `--env-file` dosya yoksa hata verdiği için yükleme `main.ts`'te. gitleaks yerine secretlint: npm ile sabitlenebilir, ayrı binary yok. Pre-commit kancası yok (P1-02 kararıyla tutarlı); CI'da zorunlu tutma P1-05.
- Doğrulama (red → green): env testi önce modül yokluğundan düştü, sonra api 12/12 geçti (varsayılanlar, geçersiz PORT ×6, geçersiz NODE_ENV, çoklu hata + değer sızmama, eksik env dosyası). `pnpm lint`, `format:check` temiz; `typecheck` 3/3; `test:unit` config 11 + web 1 + api 12; api build başarılı. Çalışan süreç: `PORT=abc node dist/main.js` → `EnvError: … PORT must be …`, çıkış 1; `PORT=3099` → HTTP 404 (route yok, dinliyor). `pnpm secrets:scan` depoda temiz; scratchpad'de sahte sırlarla negatif kontrol: GitHub token + PostgreSQL bağlantı dizesi yakalandı (maskeli, çıkış 1). AWS belge örnek anahtarı yakalanmadı (kural örnek anahtarı atlıyor olabilir; gerçek anahtarla denenmedi).
- Maliyet: ölçülmedi (`/usage` kullanıcıda). · Bağlam: ölçülmedi.
- Risk / açık konu: **`.env.example` yazılamadı**: `.claude/settings.json` içindeki `Read(./.env.*)` engeli bu dosyayı da kapsıyor; içerik hazır, ürün sahibinin eklemesi bekleniyor → P1-04 `[ ]` kaldı. `NODE_ENV` verilmezse development sayılır (dağıtımda açıkça `production` verilmeli, P6). secretlint git geçmişini taramıyor, yalnızca çalışma ağacını. Docker kurulumu (WSL2 + yeniden başlatma, 7,9 GB RAM) P1-03, P1-06 ve P1-19 için engel.
- Sonraki adım: `.env.example` eklenince P1-04 `[x]`; Docker kurulursa P1-03; değilse P1-19 (Testcontainers da Docker ister) → P1-06 engelli, dolayısıyla M1'de Docker'sız kalan iş sınırlı.

### 2026-10-28 — P1-17 — Web iskeleti (Tailwind + shadcn/ui + yerleşim + erişilebilirlik)
- Yapılan: P1-04 kodu `main`'e birleştirildi (ROADMAP'te `[ ]`, yalnızca `.env.example` eksik); dal `feat/P1-17-web-skeleton`. `apps/web`: Tailwind CSS 4.3.3 (`@tailwindcss/postcss`, `postcss.config.mjs`, `app/globals.css`); boş `next.config.ts` (shadcn CLI Next'i bununla algılıyor); `@/*` alias (`tsconfig.json`, Vitest'te `resolve.tsconfigPaths`). shadcn 4.22.1 `init -d` → `base-nova` stili (Base UI), `components.json`, `lib/utils.ts`, `components/ui/button.tsx`, tema değişkenleri. Kök yerleşim: `lang="tr"`, "İçeriğe geç" atlama bağlantısı, header (ana sayfa bağlantısı) / `main#main-content` / footer; Geist fontu `latin` + `latin-ext`. Sayfa kendi `<main>`'ini bıraktı (landmark yerleşimde).
- Karar / neden: shadcn bileşenleri `packages/ui` yerine `apps/web/components/ui` altında — ARCHITECTURE'dan bilinçli sapma: tek tüketici var; ikinci tüketici çıkınca paket ayrılır. shadcn varsayılanı kabul edildi (Base UI, Radix değil). shadcn'in yeni `cn` paketi (0.5.0; clsx + tailwind-merge yerine) kabul edildi: yayıncı shadcn, depo `shadcn-ui/cn`, bağımlılığı yok. `shadcn` paketi yalnızca `shadcn/tailwind.css` için gerekli → devDependencies. Erişilebilirlik kontrolü axe-core 4.14.0 + jsdom 30.1.3 ile birim testinde (jsx-a11y ESLint 10'u desteklemediği için); `next/font` testte taklit ediliyor, `<title>` `metadata`'dan basılıyor (Next'in yaptığı gibi).
- Doğrulama (red → green): layout testi 3 vaka ile düştü (atlama bağlantısı, landmark'lar, axe ihlali), sonra `document-title` ihlali görüldü ve giderildi → web 6/6 (eski sayfa testi + 4 layout + 1 Button). `pnpm lint`, `format:check`, `typecheck` 3/3, `secrets:scan` temiz; `test:unit` config 11 + web 6 + api 12 (art arda iki toplu çalıştırma). `next build` başarılı (/ statik). `next start` ile gerçek HTML: `<html lang="tr">`, `<title>ARC Global</title>`, atlama bağlantısı, `main#main-content`, footer; CSS'te `.sr-only`, `.bg-background`, `--font-sans`; font CSS'inde latin-ext aralığı (U+100–2BA) var. Gerçek tarayıcıda klavye ile atlama bağlantısı ve renk kontrastı denenmedi (jsdom CSS hesaplamaz; axe kontrast kuralını bu ortamda değerlendiremez).
- Maliyet: ölçülmedi (`/usage` kullanıcıda). · Bağlam: ölçülmedi.
- Risk / açık konu: jsdom ilk yüklemesi bu makinede ~2 dk (Defender soğuk tarama; ikinci yükleme 3 sn) → Vitest "Timeout waiting for worker to respond" hatasıyla bir toplu çalıştırma düştü, ardından iki çalıştırma geçti; aralıklı (flaky) risk, CI'da (P1-05) izlenmeli. Kontrast ve klavye testleri P1-19 Playwright + axe ile. `next build` Google Fonts'u derleme anında indiriyor (ağ gerekli; çalışma zamanında Google'a istek yok). shadcn tema değişkenleri varsayılan nötr; marka renkleri ürün sahibi kararı.
- Sonraki adım: Docker kurulumu (P1-03 → P1-19 → P1-06 → P1-07…); `.env.example` eklenince P1-04 `[x]`.

### 2026-10-28 — P1-04 tamamlandı — `.env.example`
- Yapılan: Kökte `.env.example` (API: `NODE_ENV`, `PORT`; compose: `POSTGRES_USER/PASSWORD/DB/PORT`, `REDIS_PORT`; yalnızca yerel geliştirme değerleri). Ürün sahibinin isteğiyle scratchpad'deki hazır içerik `cp` ile kopyalandı; `.claude/settings.json` içindeki `Read(./.env.*)` engeli değiştirilmedi (Write aracı bu dosyayı da engelliyor).
- Doğrulama: kopya kaynakla bayt düzeyinde aynı (`cmp`); `.gitignore` dosyayı izlemeye izin veriyor (`!.env.example`); `pnpm secrets:scan` ve `format:check` temiz. Ayrıca `C:\Users\LENOVO\.wslconfig` oluşturuldu (WSL2: 3 GB bellek, 2 çekirdek, 2 GB swap) — depo dışı, Docker kurulumu için.
- Risk / açık konu: `.env.example` ileride Claude tarafından okunamaz/düzenlenemez; yeni değişken eklendiğinde aynı yol (scratchpad + `cp`) veya elle düzenleme gerekir. Docker kurulumu ürün sahibinde.
- Sonraki adım: Docker kurulunca P1-03.

### 2026-10-28 — DEVİR NOTU (başka bilgisayara geçiş) — P1-06 + P1-09 yarım, dal `feat/P1-06-db-foundation`
- Durum: `main` yeşil (P1-01/02/04/17 bitti). Bu dalda WIP commit var; **6 birim testi bilerek kırmızı** (`env.test.ts`, `DATABASE_URL` testleri yazıldı, kod yazılmadı). Lint/format WIP'te çalıştırılmadı.
- Bu dalda yapılan: Docker'sız yerel PostgreSQL 18 (`embedded-postgres` paketinin binary'leri + `initdb`/`pg_ctl`, `apps/api/scripts/local-postgres.ts`); `pnpm db:start` / `pnpm db:stop` (veri `.data/pg`, compose ile aynı POSTGRES_* değerleri); `pnpm test:int` (kalıcı test kümesi `.data/pg-test`, çalıştırma başına boş port, şablon DB bir kez migrate edilir, her test dosyası `createTestDb()` ile klonlar; test kümesi `fsync=off`). Kysely 0.28.18 + pg 8.23.1 (ADR-005 Prisma yerine: kod üretimi/CLI yok, kritik yol raw SQL); int8 → `bigint`. `src/db/`: `client.ts`, `schema.ts`, `clock.ts` (`dbNow` = `clock_timestamp()`), `migrate.ts` (statik migration listesi), `migrations/0001_init.ts` (unaccent, pg_trgm, `audit_log` append-only tetikleyicilerle). `modules/platform/application/audit.ts` → `recordAudit`. Entegrasyon testleri **9/9 geçti** (migration no-op, eklentiler, UTC; 20 eşzamanlı `FOR UPDATE` yazıcı → kayıp güncelleme yok, DB saati kilit sırasıyla artıyor; audit insert, update/delete/truncate reddi, actor_type CHECK) — `fsync=off` eklenmeden önceki çalıştırmada.
- Bulgular: initdb ICU `tr-TR` + `--locale=C` (Windows'un "Türkiye" locale adı initdb'yi kırıyor); embedded-postgres sınıfı Windows'ta pipe/hazır-mesaj nedeniyle takıldı → doğrudan `pg_ctl start -w` kullanılıyor. Eski makinede disk HDD + Defender: initdb ~3 dk, kapanış fsync 147 sn.
- **Kaldığı yer (sırayla):** (1) `env.ts`: `databaseUrl` — production'da zorunlu, değilse varsayılan `postgres://arc:arc_dev@127.0.0.1:5432/arc`; yalnızca `postgres:`/`postgresql:` şeması; hata mesajı değeri içermez (testler hazır). (2) `main.ts`: `createDb(env.databaseUrl)` + `migrateToLatest` açılışta. (3) `pnpm format && pnpm lint && pnpm typecheck && pnpm test:unit && pnpm test:int` yeşil. (4) `.env.example`'a `DATABASE_URL` (dosya Claude'a okuma/yazma engelli; scratchpad + `cp` ile, ürün sahibi onayı var). (5) CLAUDE.md Komutlar: `db:start`, `db:stop`, `test:int`. (6) ROADMAP: P1-06 + P1-09 `[x]`; P1-19 kısmi (fabrikalar/fast-check/Playwright yok); P1-03 Docker alternatifi not. (7) Commit + `main`'e birleştir. Sonra P1-10 (idempotency) → P1-07/P1-08 (şirket kaydı, giriş, roller).
- Yeni bilgisayarda ilk çalıştırma: `pnpm install` → `pnpm test:int` (ilk seferde initdb).

### 2026-10-28 — MVP S0–S5 — Yerel çalışan demo (kimlik, ilan, mezat, ledger, sipariş/escrow, web)
- Yapılan: Bundle'dan gelen DB işi doğrulandı (flash aktarımında 5 dosya NUL olmuştu → HEAD'ten geri yüklendi); S1 kimlik/şirket/admin, S2 katalog/arama, S3 ledger+mezat+teminat, S4 sipariş/sahte havale/escrow/hakediş, S5 web arayüzü. PRD OQ-08 ölçeği 500 kullanıcıya indirildi. `docs/MVP-PLAN.md`, `docs/STATE.md` eklendi.
- Karar: OPEN-AU varsayılanları MVP-PLAN'da (teminat %5, 60 sn uzatma, komisyon %2, 48 sa ödeme penceresi) — ürün sahibi onayı bekliyor. ORM Prisma yerine Kysely. Kod yazımı Sonnet alt ajanlarıyla, doğrulama kök komutlarla.
- Doğrulama: typecheck, lint, format:check yeşil; test:unit api 47 + web 11 + config 11; test:int 58 (200 paralel teklif: çift kazanan 0, ledger toplamı 0, tam sipariş akışı). API üzerinden uçtan uca demo akışı geçti.
- Risk: tarayıcıda elle test yapılmadı; dayanıklılık/k6/kaos testleri yok; giriş rate limit yok; e-posta/telefon doğrulama yok; `secrets:scan` yerel DB URL'lerini işaretliyor (dev değerleri).
- Sonraki adım: firma sunumu öncesi tarayıcı gezintisi; temiz demo için `pnpm db:stop`, `.data\pg` sil, `pnpm demo`.
### 2026-10-29 — P4-15 + arayüz — Dayanıklılık testleri, modern arayüz, eksik özellikler
- Yapılan: Giriş/kayıt hız sınırı (5 hata/15 dk), parola sıfırlama (MailPort konsol+dosya), ilan düzenleme ekranı, otomatik teslim onayı (7 gün), P4-15 dayanıklılık testleri (5), arayüz modernleştirme (kurumsal lacivert, SVG görseller, kategori `categoryId` filtresi). `db/client.ts`: havuz istemcisine hata dinleyicisi (işlem ortasında kopmada süreç çöküyordu).
- Karar: ürün sahibi — giriş sınırı 5/15 dk, oto onay 7 gün, mezat varsayılanları aynen; e-posta/telefon doğrulama ve mesajlaşma ertelendi. Yeni kural: belirsizse tahmin etme, sor.
- Doğrulama: typecheck, lint, format:check yeşil; test:unit 73 (api 51, web 11, config 11); test:int 68 (9 dosya).
- Risk: görsel sonuç tarayıcıda gözle doğrulanmadı; saat sapması testi yok (saat yalnızca DB'den); k6 yük testi yok.
- Sonraki adım: kullanıcı kararlarıyla e-posta/telefon doğrulama ve mesajlaşma; demo gezintisi.

### 2026-10-29 — X-08 + X-09 — Sipariş itirazı / iade, admin sipariş listesi
- Yapılan: migration 0006 (`order_disputes`, `orders.refund_minor`, durumlar `disputed`/`refunded`, geçiş tablosu shipped→disputed→completed|refunded); `DisputesService` (aç / çöz / admin listesi), `GET /admin/orders`; web: alıcı itiraz diyaloğu, itiraz kartı, admin "Siparişler" ve "İtirazlar" sekmeleri (TL→kuruş, tam iade kısayolu, not zorunlu).
- Karar (ürün sahibi): itiraz yalnız alıcı + yalnız `shipped`; açıkken oto onay/teslim onayı/hakediş durur; yönetici kısmi/tam iade veya reddet. Kısmi iadede komisyon kalan tutar üzerinden. Tam iadede mezat teminatı alıcıya döner, mezat SETTLED.
- Doğrulama: typecheck, lint, format:check yeşil; test:unit (api 10 dosya + yeni splitDispute testleri); test:int 12 dosya / 89 test, 2 kez yeşil (disputes.int.test.ts 10 test: yetki, durum, oto onay atlama, kısmi/tam/mezat iade, reddet, çift ve eşzamanlı resolve, geçersiz tutar, I7/I8). Canlı API'de itiraz→kısmi iade akışı denendi (9.150.000 → iade 2.287.500, komisyon 137.250, satıcı 6.725.250); admin ve alıcı/satıcı sayfaları 200.
- Risk: arayüz tarayıcıda elle tıklanmadı (dev HTML gövdesi akışlı); itiraz için ek kanıt/dosya, satıcı yanıtı ve destek talebi yok; itiraz süresi sınırı yok (shipped süresince açık); iade gerçek bankaya gitmez (bank_clearing kaydı).
- Sonraki adım: P3-07 kalan kısmı (destek talebi) ve tarayıcıda elle gezinti.
### 2026-10-29 — X-10 + X-11 — Kullanıcı askıya alma, uygulama içi bildirimler
- Yapılan: migration 0007; `UserAdminService` + admin uç noktaları; `notifications` modülü (`notifyCompany` tek INSERT...SELECT, olayla aynı transaction); teklif/kapanış/sipariş geçişlerine bildirim çağrısı; web: zil, `/bildirimler`, kullanıcı askı diyalogları.
- Karar: bildirim üye başına satır (okunma `read_at` sütunu; ayrı okunma tablosu yok); teklif geçildi bildirimi yalnız önceki liderin şirketine.
- Doğrulama: typecheck, lint, format:check yeşil; test:unit yeşil; test:int 14 dosya / 103 test, 2 kez yeşil (yeni: user-suspend 5, notifications 9). 200 paralel teklif testi süresi değişmedi (~2,6–2,9 sn). Canlı API: askıya alma (eski çerez 401, login 403, kaldırma), sipariş akışında bildirimler; admin ve alıcı sayfaları 200.
- Risk: zil/diyaloglar tarayıcıda elle tıklanmadı; bildirim metinlerinde ilan adı yalnız mezat sonucunda var; eski bildirimler için temizlik/saklama süresi yok; canlı denemede demo veride bir sipariş (kargolandı) kaldı.
- Sonraki adım: e-posta bildirimi (P2-09 kalanı), tarayıcıda elle gezinti.

## 2026-10-29 — X-13 çok sektörlü kategori ağacı + ikinci el
- Migration 0008 (7 üst kategori slug upsert, birim 'iş', listings.condition), özyinelemeli categoryId süzgeci, condition süzgeci/doğrulama, web seçici/süzgeç/rozet/ana sayfa kutuları, 14 örnek ilan (seed dev DB'ye çalıştırıldı). Test: typecheck, lint, format, unit, int (112, 2 kez) yeşil; / /ilanlar /satici/yeni /admin/ilan-ekle 200. Risk: sabit nitelik şeması yok; hurda kategorisi için mevcut ilan yoktu (condition geri doldurma gerekmedi). Sonraki: tarayıcıda elle gezinti.

### 2026-10-29 — X-01…X-19 — Yönetim paneli, itiraz/iade, bildirimler, mali rapor, çok sektörlü katalog, arayüz
- Yapılan: Admin dizin/detay/mezat izleme/ilan düzenleme/yönetici adına ilan (X-01…X-07); itiraz+kısmi/tam iade (X-08/09); kullanıcı askıya alma + uygulama içi bildirimler (X-10/11); mali rapor + CSV (X-12); 7 üst kategori + ikinci el durumu (X-13); hero slider 7 sektör, koyu/açık mod (X-14/15); ana sayfa arama/güven merkezi/sekmeler/rozetler, satıcı özet kartları (X-16/17); /hesap (X-18); mezatta minimum sipariş kaldırıldı (X-19). Dayanıklılık testleri (P4-15). DB sıfırlandı, tohum veri yenilendi.
- Karar (ürün sahibi): itiraz yalnızca alıcıdan ve shipped iken; sonuçlar kısmi/tam iade veya reddet; mezat tam iadesinde teminat alıcıya; kullanıcı askıya alma anında çıkış+giriş engeli; bildirimler mezat+sipariş; Fable/Opus 5 kullanılmaz, Sonnet/Haiku; belirsizse sor.
- Doğrulama: typecheck, lint, format:check yeşil; test:unit 100 (api 56, web 33, config 11); test:int 120 (gerçek PostgreSQL). Tarayıcı görsel doğrulaması yapılmadı.
- Risk: para koduna bağımsız inceleme yapılmadı (P4-19); bellek içi hız sınırları API yeniden başlayınca sıfırlanır; secrets:scan yerel dev DB URL'lerini bulgu sayıyor; ROADMAP'te 21 madde bu ölçekte gereksiz/ertelenmiş olarak notlandı.
- Sonraki adım: ürün sahibi seçimi (STATE.md "Sıradaki").
### 2026-10-30 — X-20 — Vercel demo sürümü
- Yapılan: Demo kipi (`NEXT_PUBLIC_DEMO_MODE=1`): `serverGet` ve `/api/*` (rewrite → `app/demo-api`) gerçek API yerine `lib/demo/mock-api.ts` üzerinden `snapshot.json` sunar. Anlık görüntü `node apps/web/scripts/capture-demo.mjs` ile (`pnpm demo` çalışırken) 4 rol için alınır; elle açılmış `Matkap` deneme ilanı çıkarıldı. Rol çubuğu (`arc-demo-role` çerezi), `/ilanlar` süzgeçleri yerelde, yazma isteği 403 `DEMO_MODE`.
- Karar: tohum mezatlar saatler önce bittiği için demoda canlı + sentetik teklifli gösterilir (süre her istekte ileri kayar); bu yalnız demo katmanındadır, gerçek akış değişmedi. Vercel: Root Directory `apps/web`, `vercel.json` build komutuna bayrağı ekler.
- Doğrulama: typecheck, lint, test:unit yeşil; API kapalıyken `next build` + `next start` ile 25 sayfa/rol 200; yazma 403, login/rol çerezi çalışıyor. Tarayıcıda görsel doğrulama yapılmadı.
- Risk: veri statik (tohum veri değişirse capture yeniden çalıştırılmalı); canlı mezat süresi sunum sırasında sabit kalır; demo adresi herkese açık olursa örnek şirket adları görünür.
- Sonraki adım: Vercel'e yükleme (ürün sahibi), tarayıcıda gezinti.
