# STATE.md — Tek bakışta proje durumu (her oturumda ÖNCE bunu oku; projeyi baştan okuma)

Güncelleme kuralı: bir dilim/görev bitince yalnızca bu dosyadaki tablo + "Sıradaki" satırı güncellenir. Ayrıntı: `docs/MVP-PLAN.md` (kararlar + API sözleşmesi), `docs/ROADMAP.md` (checkbox), `docs/LOG.md` (günlük).

## Dilim durumu (MVP-PLAN §Dilimler)
| Dilim | Durum | Not |
|---|---|---|
| S0 Ortam + DB temeli | ✅ | Kysely + embedded PG, audit, FOR UPDATE testi |
| S1 Kimlik/şirket/admin | ✅ | e-posta doğrulama/parola sıfırlama/rate limit YOK |
| S2 Katalog/ilan/arama | ✅ | ilan düzenleme arayüzü yok |
| S3 Ledger + mezat | ✅ | 200 paralel teklif testi geçti; dayanıklılık/k6 yok |
| S4 Sipariş + sahte havale | ✅ | oto teslim onayı yok |
| S5 Web ekranları + tohum veri | ✅ | tarayıcıda elle tıklama doğrulanmadı |

## Sıradaki
MVP tamam (yerel demo). Sıradaki: tarayıcıda elle gezinti + hata düzeltme; sonra ROADMAP 'MVP sonrası' sırası (mesajlaşma, e-posta/telefon doğrulama, rate limit, ilan düzenleme UI, görsel yükleme denemesi). Çalıştır: `pnpm demo` (web :3000, api :3001). Hesaplar: admin@arc.local/Admin!2345; satici1@, satici2@, alici@arc.local / Demo!2345.

## Dosya haritası (nerede ne var)
- `apps/api/src/db/` — `client.ts` (Kysely), `clock.ts` (`dbNow`), `migrate.ts` (liste), `migrations/NNNN_*.ts`, `schema.ts` (tablo tipleri)
- `apps/api/src/modules/<modül>/{index.ts (public), application, infrastructure, http}` — modüller arası yalnızca `index.ts`
- `apps/api/scripts/` — `dev-db.ts` (yerel PostgreSQL), `local-postgres.ts`
- `apps/api/src/test/` — test DB yardımcıları (`createTestDb`)
- `apps/web/app/` — Next.js sayfaları · `apps/web/components/ui/` — shadcn
- Çalıştır: `pnpm db:start` (api paketinde: `pnpm --filter @arc/api db:start`) → `pnpm dev`

## Tuzaklar (tekrar keşfetme)
- Windows'ta her PowerShell çağrısı PATH'i sıfırlar: `git`/`pnpm` için önce PATH'i yükle (`$env:USERPROFILE\bin` pnpm shim'i). `CI=true` olmadan pnpm TTY ister.
- Dosya aktarımında (flash/OneDrive) dosyalar NUL'a dönebilir; `git status` ile kontrol et, `git checkout HEAD -- <dosya>`.
- `.env*` okunmaz/yazılmaz (settings engeli); yeni env değişkeni → `.env.example`'ı kullanıcı elle günceller veya `cp`.
- Tüm komutlar kökten; DB integration testleri `pnpm --filter @arc/api test:int` (ilk çalışma yavaş).
