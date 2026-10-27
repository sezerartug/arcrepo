# Mezat + İlan Pazaryeri — Claude Code Proje Kiti (v0.1)

Claude Code ile profesyonel, fazlara bölünmüş geliştirme için başlangıç kiti: bağlam dosyaları, backlog/ilerleme takibi, açık artırma motoru kuralları, komut istemleri ve araç seti analizi.

## İçindekiler
```
CLAUDE.md                      Claude Code'un her oturumda okuduğu kısa kurallar (<150 satır)
.claude/settings.json          İzin/yasak kuralları (gizli dosyalar, yıkıcı komutlar)
.claude/agents/                test-runner (Haiku), auction-invariant-reviewer (Opus)
docs/PRD.md                    Ürün gereksinimleri, açık sorular
docs/ARCHITECTURE.md           Yığın, modüller, ADR listesi, dış planla karşılaştırma
docs/AUCTION-RULES.md          Açık artırma motoru: durumlar, değişmezler (I1–I10), SQL kalıpları, testler
docs/SECURITY.md               Tehdit modeli ve kontroller
docs/ROADMAP.md                116 görev, 7 faz, checkbox'lı tek backlog
docs/LOG.md                    Karar, kanıt, maliyet günlüğü (şablonlu)
docs/DEFINITION-OF-DONE.md     Görev ve faz kapısı ölçütleri
docs/PROMPTS.md                Kopyala-yapıştır istemler (P-00 … P-13)
docs/TOOLING.md                BMAD / Ponytail / Matt Pocock / resmi eklentiler analizi, kurulum, MCP, token planı
scripts/progress.sh            Faz bazında ilerleme özeti
```

## Hızlı başlangıç
- [ ] 1. Boş bir git deposu aç; bu kitin içeriğini köke kopyala; ilk commit.
- [ ] 2. Gereksinimler: Git, Node 26 (veya 24), pnpm, Docker, güncel Claude Code (BMAD için ayrıca Python 3.10+ ve `uv`).
- [ ] 3. `docs/TOOLING.md` §4 sırasıyla eklentileri kur (önce şirket güvenlik onayı).
- [ ] 4. Depo kökünde Claude Code'u başlat → `docs/PROMPTS.md` **P-01**.
- [ ] 5. **P-02** ile Grill oturumu: PRD açık sorularını (OQ) ve AUCTION-RULES `OPEN-AU` maddelerini kapat.
- [ ] 6. `docs/ROADMAP.md` Faz 0'dan başla. Her görevde döngü: **P-00 → P-05 → P-10**, sonra `/clear`.
- [ ] 7. Her hafta: `bash scripts/progress.sh` + **P-12**.

## İlerleme nasıl görülür
1. **Durum:** `docs/ROADMAP.md` checkbox'ları (yalnızca doğrulanınca `[x]`).
2. **Kanıt ve maliyet:** `docs/LOG.md` girişleri.
3. **Özet:** `bash scripts/progress.sh` → faz bazında yüzde + sıradaki açık görev.

## Önceliklerin görevlere eşlemesi
| Öncelik | ROADMAP görevleri |
|---|---|
| Eşzamanlı tekliflerin doğru sırası, çift kazanan yok | P1-06, P1-16, P4-01…P4-03, P4-14, P4-17 |
| Bitiş zamanının sunucuda kesin yönetimi | P4-03, P4-04, P4-06, P4-11, P4-15, P4-18 |
| Ödeme–sipariş–teklif tutarlılığı | P1-10, P1-11, P1-14, P3-03…P3-05, P3-10, P3-11, P4-02, P4-09, P4-10 |
| Yetki, kötüye kullanım, audit, otomatik test | P1-07…P1-09, P1-12, P1-19, P2-14, P4-12, P4-13, P5-04…P5-08, P5-12, P6-05 |
| Arama, görsel, kuyruk, önbellek, gözlemlenebilirlik | P1-11, P1-13, P2-04…P2-07, P2-15, P2-17, P4-07, P4-18, P6-06 |

## Notlar
- Bu kit **taslaktır (v0.1)**. PRD'deki varsayımlar (Türkiye, TRY, PSP üzerinden escrow, ölçek hedefleri) Faz 0'da doğrulanır.
- Süre tahminleri (~36 hafta) 3–4 mühendis + Claude Code varsayımıyla planlama tahminidir; hukuk/PSP/KYC gibi dış bağımlılıklar kaydırabilir.
- Hukuki konular (escrow lisansı, mesafeli satış, KVKK) için hukuk danışmanı görüşü gerekir; bu kit hukuki tavsiye değildir.
