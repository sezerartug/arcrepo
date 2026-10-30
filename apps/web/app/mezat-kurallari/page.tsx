import { DocPage, type DocSection } from '@/components/doc-page';

export const metadata = { title: 'Mezat Kuralları · ARC Global' };

const SECTIONS: DocSection[] = [
  {
    heading: 'Kimler katılabilir',
    list: [
      'Yalnızca doğrulanmış (yönetici onaylı) şirketler mezata katılabilir.',
      'Satıcı, kendi ilanındaki mezata teklif veremez.',
    ],
  },
  {
    heading: 'Teminat',
    list: [
      "Teklif vermek için mezat başına bir kez teminat yatırılır. Tutar, başlangıç fiyatı ile miktarın çarpımının %5'idir (yukarı yuvarlanır).",
      'Teminat, havale ve yönetici onayıyla geçerli olur; onaylanana kadar teklif verilemez.',
      'Kaybeden katılımcıların teminatı iade edilir. Kazananın teminatı ödenecek tutardan düşülür.',
      'Kazanan süresi içinde ödeme yapmazsa teminatı satıcıya değil platforma gelir olarak kaydedilir.',
    ],
  },
  {
    heading: 'Teklif verme',
    list: [
      'Her teklif, güncel fiyata mezata özgü asgari artışın eklenmesiyle bulunan tutardan düşük olamaz.',
      'Fiyatlar birim fiyat üzerindendir; mezat, ilandaki lotun tamamı için yapılır.',
      'Teklifler birbirine anonim görünür ("Teklif veren #n"). Şirket adınız diğer katılımcılara gösterilmez.',
      'Verilen teklif geri çekilemez. Sunucu saati esastır; kendi cihazınızın saati hiçbir karar için kullanılmaz.',
      'Güncel en yüksek teklif sizinse kendi teklifinizi yeniden artıramazsınız.',
    ],
  },
  {
    heading: 'Bitiş ve süre uzatma',
    list: [
      'Bitişe son 60 saniye içinde kabul edilen teklif, bitişi o andan itibaren 60 saniye öteler.',
      'Uzatma en fazla 10 kez yapılabilir ve bitiş, ilk planlanan bitişten en fazla 15 dakika sonrasını geçemez.',
    ],
  },
  {
    heading: 'Rezerv fiyat',
    body: [
      'Satıcı gizli bir rezerv (asgari kabul) fiyatı belirleyebilir; yalnızca satıcı ve yönetici görür. En yüksek teklif rezervi karşılamazsa mezat satışsız sonlanır ve tüm teminatlar iade edilir.',
    ],
  },
  {
    heading: 'Kazanan ve ödeme',
    list: [
      'Mezat kapanınca en yüksek teklifi veren şirket kazanır ve kendiliğinden bir sipariş oluşur.',
      'Kazanan, siparişteki ödemeyi 48 saat içinde yapmalıdır; ödeme emanette tutulur ve teslim onayında satıcıya aktarılır.',
      'Satıcıdan %2 komisyon alınır (KDV hariç tutar üzerinden).',
    ],
  },
  {
    heading: 'Yönetici iptali',
    body: [
      'Yönetici, gerekçesini kayda geçirerek bir mezatı iptal edebilir; bu durumda tüm teminatlar iade edilir. Yönetici müdahaleleri denetim kaydına yazılır.',
    ],
  },
  {
    heading: 'Kötüye kullanım',
    body: [
      'Sahte teklif, teklif şişirme veya sistemi aşırı yükleyen otomatik istekler yasaktır. İhlal hâlinde teklif geçersiz sayılabilir, hesap askıya alınabilir. Aşırı sık teklif denemeleri hız sınırına takılır.',
    ],
  },
];

export default function AuctionRulesPage() {
  return (
    <DocPage
      title="Mezat Kuralları"
      sub="Canlı mezata katılım, teminat ve sonuçlanma kuralları"
      updated="30 Ekim 2026"
      sections={SECTIONS}
    />
  );
}
