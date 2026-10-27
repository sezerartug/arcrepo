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
