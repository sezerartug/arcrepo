#!/usr/bin/env bash
# Kullanım: scripts/progress.sh [docs/ROADMAP.md]
# Faz bazında checkbox ilerlemesini ve sıradaki açık görevi gösterir.
set -euo pipefail
f="${1:-docs/ROADMAP.md}"
[ -f "$f" ] || { echo "Bulunamadı: $f" >&2; exit 1; }
awk '
/^## Faz [0-9]+/ { phase=$0; sub(/^## /,"",phase); order[++n]=phase; next }
/^- \[[ xX]\] P[0-9]+-[A-Z0-9]+/ && phase!="" {
  total[phase]++; T++
  if ($0 ~ /^- \[[xX]\]/) { done[phase]++; D++ }
}
END {
  for (i=1;i<=n;i++) {
    p=order[i]; t=total[p]+0; d=done[p]+0; pct=(t? int(100*d/t):0)
    bar=""; for (k=0;k<20;k++) bar = bar (k < pct/5 ? "#" : ".")
    printf "%s\n  [%s] %3d%%  (%d/%d)\n", p, bar, pct, d, t
  }
  printf "\nToplam: %d/%d (%d%%)\n", D, T, (T? int(100*D/T):0)
}' "$f"
echo
echo "Sıradaki açık görev:"
grep -m1 -E '^- \[ \] P[0-9]+-[A-Z0-9]+' "$f" || echo "Tüm görevler tamam."
