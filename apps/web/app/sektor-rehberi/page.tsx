import Link from 'next/link';
import { ctaCls } from '@/components/common';
import { DocPage, type DocSection } from '@/components/doc-page';

export const metadata = { title: 'Çelik ve İnşaat Sektör Rehberi · ARC Global' };

const SECTIONS: DocSection[] = [
  {
    heading: 'İnşaat demiri (nervürlü)',
    body: [
      "Betonarme yapıların ana donatısıdır. Türkiye'de en yaygın sınıf B500C'dir; çap (Ø8–Ø32 mm), boy ve sınıf ilanda belirtilir. Satış birimi genellikle tondur.",
    ],
  },
  {
    heading: 'Sac ve levha',
    body: [
      'Yapısal işlerde sıcak haddelenmiş S235JR ve S355JR kaliteleri sık kullanılır (EN 10025). Kalınlık milimetre cinsindendir; levha ebadı ve kalite ilanda yer alır.',
    ],
  },
  {
    heading: 'Profil ve boru',
    body: [
      'Çelik konstrüksiyonda IPE, HEA/HEB ve UPN profiller ile kutu profiller kullanılır. Borular dikişli veya dikişsiz üretilir; çap ve et kalınlığı fiyatı doğrudan etkiler.',
    ],
  },
  {
    heading: 'Kalite belgeleri',
    body: [
      'Ürüne göre üretici muayene sertifikası (EN 10204 tip 3.1), TSE veya CE belgesi istenebilir. Alımdan önce satıcıdan ilgili belgeyi talep etmenizi ve ilan açıklamasında belirtilmesini öneririz.',
    ],
  },
  {
    heading: 'Fiyatlandırma',
    list: [
      'Fiyatlar çoğunlukla ton (veya adet / metre) başına ve KDV hariç verilir.',
      'Boyut, kalite, miktar, ödeme şekli ve teslim yeri fiyatı değiştirir.',
      'ARC Global ilanlarında birim fiyat ile birim bilgisi birlikte gösterilir; sipariş tutarı sunucuda hesaplanır.',
    ],
  },
  {
    heading: 'Sabit fiyat mı, mezat mı?',
    list: [
      'Sabit fiyat: Fiyat belliyse ve hızlı alım istiyorsanız. Miktarı seçer, siparişi oluşturursunuz.',
      'Mezat: Büyük lotlarda piyasa fiyatını rekabetle bulmak için. Teminat yatırılır, teklifler anonim verilir.',
    ],
  },
  {
    heading: 'Teslimat ve kontrol',
    list: [
      'Teslimde miktarı (kantar fişi) ve kaliteyi sevk belgeleriyle karşılaştırın.',
      'Sorun varsa teslimi onaylamadan, sipariş sayfasından gerekçeli itiraz açın; itiraz süresince ödeme satıcıya geçmez.',
    ],
  },
];

export default function SectorGuidePage() {
  return (
    <DocPage
      title="Çelik ve İnşaat Sektör Rehberi"
      sub="Çelik ve yapı malzemesi alırken bilinmesi gerekenlerin kısa özeti"
      sections={SECTIONS}
    >
      <p className="mt-8 text-xs text-muted-foreground">
        Bu rehber genel bilgilendirme amaçlıdır; ürün ve proje seçimlerinde ilgili standartlara ve
        mühendislik şartnamelerine başvurun.
      </p>
      <Link href="/ilanlar" className={`${ctaCls} mt-4`}>
        İlanlara göz at
      </Link>
    </DocPage>
  );
}
