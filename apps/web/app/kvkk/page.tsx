import { DocPage, type DocSection } from '@/components/doc-page';
import { COMPANY } from '@/lib/company';

export const metadata = { title: 'KVKK Aydınlatma Metni · ARC Global' };

const SECTIONS: DocSection[] = [
  {
    heading: 'Veri sorumlusu',
    body: [
      `6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") uyarınca kişisel verileriniz, veri sorumlusu sıfatıyla ${COMPANY.name} ("ARC Global") tarafından işlenmektedir.`,
      `Adres: ${COMPANY.address} · E-posta: ${COMPANY.email} · KEP: ${COMPANY.kep}`,
    ],
  },
  {
    heading: 'İşlenen kişisel veriler',
    list: [
      'Kimlik ve iletişim: ad soyad, e-posta adresi, telefon numarası (isteğe bağlı).',
      'Şirket bilgileri: ticaret unvanı, vergi numarası, vergi dairesi, adres ve şirket içindeki rolünüz.',
      'İşlem güvenliği: IP adresi, oturum ve giriş kayıtları.',
      'İşlem bilgileri: ilan, teklif, sipariş, teminat ve ödeme referansı kayıtları.',
      'Denetim kayıtları: kritik işlemlerin (teklif, ödeme, iade, yönetici müdahalesi) kim tarafından ve ne zaman yapıldığı.',
    ],
  },
  {
    heading: 'İşleme amaçları',
    list: [
      'Üyelik ve şirket doğrulama süreçlerinin yürütülmesi.',
      'İlan, mezat, sipariş, teminat ve ödeme süreçlerinin yürütülmesi.',
      'İşlem güvenliğinin sağlanması, dolandırıcılık ve kötüye kullanımın önlenmesi.',
      'Hukuki yükümlülüklerin yerine getirilmesi, uyuşmazlıklarda hakkın tesisi ve korunması.',
      'Bildirimlerin (teklif geçildi, mezat sonucu, sipariş durumu) iletilmesi.',
    ],
  },
  {
    heading: 'Hukuki sebepler',
    body: [
      'Verileriniz KVKK m.5/2 kapsamında; bir sözleşmenin kurulması veya ifasıyla doğrudan ilgili olması (c), hukuki yükümlülüğün yerine getirilmesi (ç), bir hakkın tesisi, kullanılması veya korunması (e) ve meşru menfaat (f) sebeplerine dayanılarak işlenir.',
    ],
  },
  {
    heading: 'Verilerin aktarılması',
    body: [
      'Kişisel verileriniz; işlemin karşı tarafı olan şirkete (sipariş ve teslimat için gerekli ölçüde), ödeme ve bankacılık hizmeti sağlayıcılarına, altyapı ve barındırma hizmeti sağlayıcılarına ve yetkili kamu kurumlarına, ilgili mevzuatın izin verdiği ölçüde aktarılabilir.',
      'Mezatlarda teklif verenler birbirine anonim ("Teklif veren #n") gösterilir; şirket adınız diğer katılımcılarla paylaşılmaz.',
    ],
  },
  {
    heading: 'Toplama yöntemi',
    body: [
      'Verileriniz; üyelik ve şirket kayıt formları, ilan ve sipariş ekranları ile platformun kullanımı sırasında otomatik yollarla elektronik ortamda toplanır.',
    ],
  },
  {
    heading: 'Saklama süresi',
    body: [
      'Verileriniz, işleme amacının gerektirdiği süre ve ilgili mevzuatta öngörülen saklama süreleri boyunca saklanır; süre sonunda silinir, yok edilir veya anonim hale getirilir.',
    ],
  },
  {
    heading: 'İlgili kişi hakları (KVKK m.11)',
    list: [
      'Kişisel verilerinizin işlenip işlenmediğini öğrenme ve işlenmişse bilgi talep etme.',
      'İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme.',
      'Yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme.',
      'Eksik veya yanlış işlenmişse düzeltilmesini isteme.',
      'KVKK m.7 çerçevesinde silinmesini veya yok edilmesini isteme.',
      'Düzeltme, silme ve yok etme işlemlerinin aktarılan üçüncü kişilere bildirilmesini isteme.',
      'İşlenen verilerin otomatik sistemlerle analiz edilmesi sonucu aleyhinize bir sonuç çıkmasına itiraz etme.',
      'Kanuna aykırı işleme nedeniyle zarara uğramanız hâlinde zararın giderilmesini talep etme.',
    ],
  },
  {
    heading: 'Başvuru',
    body: [
      `Haklarınıza ilişkin taleplerinizi, kimliğinizi doğrulayan bilgilerle birlikte ${COMPANY.email} adresine veya ${COMPANY.kep} KEP adresine iletebilirsiniz. Başvurular en geç otuz gün içinde sonuçlandırılır.`,
    ],
  },
];

export default function KvkkPage() {
  return (
    <DocPage
      title="KVKK Aydınlatma Metni"
      sub="Kişisel verilerinizin işlenmesine ilişkin bilgilendirme"
      updated="30 Ekim 2026"
      sections={SECTIONS}
    />
  );
}
