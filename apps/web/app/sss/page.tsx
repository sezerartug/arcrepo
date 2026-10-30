import Link from 'next/link';
import { PageTitle } from '@/components/common';

export const metadata = { title: 'Sık Sorulan Sorular · ARC Global' };

const FAQ: [string, string][] = [
  [
    "Kimler ARC Global'e üye olabilir?",
    'Yalnızca şirketler. Kayıt sırasında ticaret unvanı ve vergi numarası alınır; yönetici onayından sonra alım, satım ve mezat işlemleri açılır.',
  ],
  [
    'Satın alma nasıl ilerler?',
    'İlandan miktarı seçip sipariş oluşturursunuz. Sipariş sayfasındaki hesaba referans numarasıyla havale yaparsınız; ödeme emanette tutulur. Satıcı sevk eder, siz teslimi onaylarsınız, ödeme satıcıya aktarılır.',
  ],
  [
    'Emanet (escrow) ne demek?',
    'Ödemeniz satıcıya hemen geçmez; teslim onaylanana kadar emanette bekler. Böylece mal gelmeden para çıkmaz.',
  ],
  [
    'Mezata nasıl katılırım?',
    'Mezat sayfasında teminat talimatını alır, havale yaparsınız. Teminat onaylanınca teklif verebilirsiniz. Ayrıntılar için Mezat Kuralları sayfasına bakın.',
  ],
  [
    'Teminat ne kadar, geri alınır mı?',
    "Başlangıç fiyatı ile miktarın çarpımının %5'idir. Kaybeden katılımcılara iade edilir; kazananın teminatı ödenecek tutardan düşülür. Kazanan ödeme yapmazsa teminat platforma gelir kaydedilir.",
  ],
  [
    'Teslimi onaylamazsam ne olur?',
    'Mal sevk edildikten 7 gün sonra teslim kendiliğinden onaylanır. Sorun varsa bu sürede gerekçeli itiraz açabilirsiniz; itiraz sürerken otomatik onay ve satıcı ödemesi durur.',
  ],
  [
    'Komisyon var mı?',
    "Satıcıdan, KDV hariç satış tutarının %2'si alınır. Alıcıdan ek bir hizmet bedeli alınmaz.",
  ],
  [
    'Teklifim diğer şirketlerce görülür mü?',
    'Teklif tutarı herkese görünür, ancak teklif verenler "Teklif veren #n" olarak anonim gösterilir; şirket adınız paylaşılmaz.',
  ],
  [
    'İkinci el ve hurda ürünler de satılıyor mu?',
    'Evet. Makine, ekipman, iş makinesi, hurda ve geri dönüşüm kategorilerinde ikinci el ve hurda ilanlar yer alır; ilan durumu ilanda belirtilir.',
  ],
  [
    'Sorunum için kime ulaşırım?',
    'İletişim sayfasındaki e-posta ve telefon üzerinden bize yazabilirsiniz.',
  ],
];

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle sub="Platform, ödeme ve mezat hakkında kısa cevaplar">
        Sık Sorulan Sorular
      </PageTitle>
      <div className="space-y-2">
        {FAQ.map(([q, a]) => (
          <details key={q} className="group rounded-xl border bg-card px-4 py-3 shadow-sm">
            <summary className="cursor-pointer list-none font-medium text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {q}
            </summary>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{a}</p>
          </details>
        ))}
      </div>
      <p className="mt-6 text-sm">
        Aradığınızı bulamadınız mı?{' '}
        <Link className="underline" href="/iletisim">
          Bize ulaşın
        </Link>
        .
      </p>
    </div>
  );
}
