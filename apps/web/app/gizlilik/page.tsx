import { DocPage, type DocSection } from '@/components/doc-page';
import { COMPANY } from '@/lib/company';

export const metadata = { title: 'Gizlilik ve Çerez Politikası · ARC Global' };

const SECTIONS: DocSection[] = [
  {
    heading: 'Kapsam',
    body: [
      `Bu politika, ${COMPANY.name} tarafından işletilen ARC Global platformunun gizlilik uygulamalarını ve çerez kullanımını açıklar. Kişisel verilerin işlenmesine ilişkin ayrıntılar KVKK Aydınlatma Metni'nde yer alır.`,
    ],
  },
  {
    heading: 'Platform yalnızca şirketlere hizmet verir',
    body: [
      'ARC Global, şirketler arası ticaret platformudur. Hesaplar ticari kullanım içindir; bireysel tüketicilere satış yapılmaz.',
    ],
  },
  {
    heading: 'Kullandığımız çerezler ve benzeri teknolojiler',
    list: [
      'Oturum çerezi (zorunlu): Giriş yaptığınızda oturumunuzu güvenli biçimde sürdürmek için kullanılır. Yalnızca sunucu tarafından okunabilen (HttpOnly) bir çerezdir; oturumunuz sona erdiğinde geçerliliğini yitirir.',
      'Tema tercihi (işlevsel): Açık, koyu veya sistem temasını hatırlamak için tarayıcınızın yerel depolamasında saklanır; sunucuya gönderilmez.',
    ],
  },
  {
    heading: 'Kullanmadığımız teknolojiler',
    body: [
      'Platformda reklam, profilleme veya üçüncü taraf analitik çerezi kullanılmamaktadır. Bu nedenle çerez onay bandı gösterilmez. İleride zorunlu olmayan bir çerez eklenirse önceden açık rızanız alınacak ve bu politika güncellenecektir.',
    ],
  },
  {
    heading: 'Çerezleri yönetme',
    body: [
      'Tarayıcı ayarlarınızdan çerezleri silebilir veya engelleyebilirsiniz. Oturum çerezini engellerseniz giriş yapamazsınız; tema tercihini silerseniz varsayılan tema kullanılır.',
    ],
  },
  {
    heading: 'Veri güvenliği',
    list: [
      'Parolalar tek yönlü olarak özetlenerek saklanır; düz metin olarak tutulmaz.',
      'Kritik işlemler (teklif, ödeme, iade, yönetici müdahalesi) denetim kaydına yazılır.',
      'Kart bilgisi platformumuzda saklanmaz.',
      'Hesabınıza yetkisiz erişimden şüphelenirseniz parolanızı değiştirmeli ve bize bildirmelisiniz.',
    ],
  },
  {
    heading: 'İletişim',
    body: [`Gizlilikle ilgili sorularınız için: ${COMPANY.email}`],
  },
];

export default function PrivacyPage() {
  return (
    <DocPage
      title="Gizlilik ve Çerez Politikası"
      sub="Verilerinizi nasıl koruduğumuz ve hangi çerezleri kullandığımız"
      updated="30 Ekim 2026"
      sections={SECTIONS}
    />
  );
}
