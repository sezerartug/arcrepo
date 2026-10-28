# STATE.md — Tek bakışta proje durumu (her oturumda ÖNCE bunu oku; projeyi baştan okuma)

Güncelleme kuralı: bir dilim/görev bitince yalnızca bu dosyadaki tablo + "Sıradaki" satırı güncellenir. Ayrıntı: `docs/MVP-PLAN.md` (kararlar + API sözleşmesi), `docs/ROADMAP.md` (checkbox), `docs/LOG.md` (günlük).

## Dilim durumu (MVP-PLAN §Dilimler)
| Dilim | Durum | Not |
|---|---|---|
| S0 Ortam + DB temeli | ⏳ | git/pnpm kuruldu; DB temeli (migrate, audit, FOR UPDATE testi) önceki PC'den geldi |
| S1 Kimlik/şirket/admin | ⬜ | |
| S2 Katalog/ilan/arama | ⬜ | |
| S3 Ledger + mezat | ⬜ | |
| S4 Sipariş + sahte havale | ⬜ | |
| S5 Web ekranları + tohum veri | ⬜ | |

## Sıradaki
S0'ı doğrula → S1.

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
