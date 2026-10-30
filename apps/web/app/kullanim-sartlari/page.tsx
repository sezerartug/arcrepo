import { DocPage, type DocSection } from '@/components/doc-page';
import { COMPANY } from '@/lib/company';

export const metadata = { title: 'Kullanım Şartları · ARC Global' };

const SECTIONS: DocSection[] = [
  {
    heading: 'Taraflar ve kapsam',
    body: [
      `Bu şartlar, ${COMPANY.name} ("ARC Global") tarafından işletilen platformu kullanan şirketler ("Üye") için geçerlidir. Platformu kullanarak bu şartları kabul etmiş sayılırsınız.`,
      'ARC Global, alıcı ve satıcı şirketleri bir araya getiren bir ilan, mezat ve emanetli ödeme platformudur; satılan malın tarafı değildir.',
    ],
  },
  {
    heading: 'Üyelik',
    list: [
      'Üyelik yalnızca tüzel kişi şirketlere açıktır; bireysel tüketiciler üye olamaz.',
      'Şirket kaydı, vergi numarası ve bilgi kontrolünün ardından yönetici onayıyla etkinleşir. Onaylanmayan şirket ilan veremez, satın alamaz ve mezata katılamaz.',
      'Üye, verdiği bilgilerin doğru ve güncel olmasından ve hesabının güvenliğinden sorumludur.',
    ],
  },
  {
    heading: 'İlanlar',
    list: [
      'Satıcı, ilandaki ürün, miktar, fiyat, kalite ve teslim koşullarının doğruluğundan sorumludur.',
      'İlanlar yayınlanmadan önce yönetici incelemesinden geçer; ARC Global uygun görmediği ilanı reddedebilir veya kaldırabilir.',
      'Yayındaki bir mezat ilanı düzenlenemez.',
    ],
  },
  {
    heading: 'Sipariş, ödeme ve teslimat',
    list: [
      'Sabit fiyatlı satın almada ve mezat kazanımında sipariş oluşur; alıcı, sipariş sayfasında gösterilen hesaba referans numarasıyla havale yapar.',
      'Ödeme, teslim onayına kadar emanette tutulur; satıcıya hakediş, teslim onaylandıktan sonra aktarılır.',
      'Satıcı malı kargoya verdiğinde durumu günceller. Alıcı teslimi onaylar; onay verilmezse sevk tarihinden itibaren 7 gün sonra teslim kendiliğinden onaylanır.',
      'Alıcı, mal sevk edilmişken sorun varsa en az on karakterlik gerekçeyle itiraz açabilir; itiraz süresince otomatik onay ve satıcı hakedişi durur.',
    ],
  },
  {
    heading: 'Komisyon',
    body: [
      'Başarılı satışlarda satıcıdan, KDV hariç satış tutarı üzerinden %2 komisyon alınır. İade veya kısmi iade durumunda komisyon kalan tutar üzerinden hesaplanır.',
    ],
  },
  {
    heading: 'Mezat',
    body: [
      'Mezata katılım ve sonuçlanma kuralları Mezat Kuralları sayfasında düzenlenmiştir ve bu şartların ayrılmaz parçasıdır.',
    ],
  },
  {
    heading: 'Yasaklanan davranışlar',
    list: [
      'Yanıltıcı ilan vermek, sahte teklif vermek veya teklifleri yapay olarak şişirmek.',
      'Başka bir üyenin hesabını kullanmak ya da platformu aşırı yükleyecek otomatik istekler göndermek.',
      'Platform dışında işlem yaparak komisyondan veya emanet güvencesinden kaçınmaya çalışmak.',
      'Yasalara, kamu düzenine veya üçüncü kişi haklarına aykırı ürün ve hizmet sunmak.',
    ],
  },
  {
    heading: 'Askıya alma ve kapatma',
    body: [
      'Bu şartların ihlali veya güvenlik şüphesi hâlinde ARC Global, şirket veya kullanıcı hesabını gerekçesini kayda geçirerek askıya alabilir ya da kapatabilir.',
    ],
  },
  {
    heading: 'Sorumluluğun sınırı',
    body: [
      "ARC Global, satıcı ile alıcı arasındaki satış sözleşmesinin tarafı değildir; ürünün niteliğinden ve satıcının edimlerinden bizzat sorumlu tutulamaz. Platformun kesintisiz veya hatasız çalışacağı garanti edilmez. Sorumluluk, kanunen sınırlandırılamayan haller saklı kalmak üzere, ilgili işlemde ARC Global'e ödenen komisyonla sınırlıdır.",
    ],
  },
  {
    heading: 'Değişiklikler, uygulanacak hukuk ve yetki',
    body: [
      'ARC Global bu şartları değiştirebilir; güncel metin bu sayfada yayımlanır. Şartlar Türk hukukuna tabidir; uyuşmazlıklarda İstanbul mahkemeleri ve icra daireleri yetkilidir.',
    ],
  },
  {
    heading: 'İletişim',
    body: [`Sorularınız için: ${COMPANY.email} · ${COMPANY.phone}`],
  },
];

export default function TermsPage() {
  return (
    <DocPage
      title="Kullanım Şartları"
      sub="Platformu kullanan şirketler için geçerli şartlar"
      updated="30 Ekim 2026"
      sections={SECTIONS}
    />
  );
}
