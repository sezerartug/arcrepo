import { sql, type Kysely } from 'kysely';

// [slug, name, unit, base_per_unit, children?]. Existing slugs (celik, cimento, ...) keep their ids, so
// existing listings are untouched; only the old root categories are moved under "Insaat Malzemeleri".
type Node = readonly [string, string, string, number, (readonly Node[])?];

const leaves = (unit: string, base: number, items: readonly (readonly [string, string])[]) =>
  items.map(([slug, name]): Node => [slug, name, unit, base]);

const TREE: readonly Node[] = [
  [
    'insaat-malzemeleri',
    'İnşaat Malzemeleri',
    'ton',
    1000,
    [
      [
        'celik',
        'Çelik',
        'ton',
        1000,
        leaves('ton', 1000, [
          ['insaat-demiri', 'İnşaat demiri'],
          ['profil', 'Profil'],
          ['sac', 'Sac'],
          ['boru', 'Boru'],
        ]),
      ],
      ['cimento', 'Çimento', 'torba', 1],
      ['agrega', 'Agrega', 'm3', 1000],
      ['tugla-blok', 'Tuğla/Blok', 'adet', 1],
      ['yalitim', 'Yalıtım', 'm3', 1000],
    ],
  ],
  [
    'makine-ekipman',
    'Makine ve Ekipman',
    'adet',
    1,
    leaves('adet', 1, [
      ['cnc-makineleri', 'CNC Makineleri'],
      ['vinc-kaldirma', 'Vinç ve Kaldırma'],
      ['kaynak-makineleri', 'Kaynak Makineleri'],
      ['pres-abkant', 'Pres ve Abkant'],
      ['torna-freze', 'Torna ve Freze'],
      ['kompresor', 'Kompresör'],
      ['jenerator', 'Jeneratör'],
      ['diger-makineler', 'Diğer Makineler'],
    ]),
  ],
  [
    'is-makineleri',
    'İş Makineleri',
    'adet',
    1,
    leaves('adet', 1, [
      ['ekskavator', 'Ekskavatör'],
      ['yukleyici', 'Yükleyici'],
      ['dozer', 'Dozer'],
      ['greyder', 'Greyder'],
      ['forklift', 'Forklift'],
      ['silindir', 'Silindir'],
      ['damperli-kamyon', 'Damperli Kamyon'],
      ['diger-is-makineleri', 'Diğer İş Makineleri'],
    ]),
  ],
  [
    'hurda-geri-donusum',
    'Hurda ve Geri Dönüşüm',
    'ton',
    1000,
    leaves('ton', 1000, [
      ['demir-celik-hurdasi', 'Demir/Çelik Hurdası'],
      ['aluminyum-hurda', 'Alüminyum'],
      ['bakir-hurda', 'Bakır'],
      ['pirinc-bronz-hurda', 'Pirinç ve Bronz'],
      ['paslanmaz-hurda', 'Paslanmaz'],
      ['plastik-hurda', 'Plastik'],
      ['kagit-karton-hurda', 'Kâğıt ve Karton'],
      ['diger-hurda', 'Diğer Hurda'],
    ]),
  ],
  [
    'el-aletleri-hirdavat',
    'El Aletleri ve Hırdavat',
    'adet',
    1,
    leaves('adet', 1, [
      ['elektrik-motorlari', 'Elektrik Motorları'],
      ['pompalar', 'Pompalar'],
      ['reduktorler', 'Redüktörler'],
      ['rulmanlar', 'Rulmanlar'],
      ['elektrikli-el-aletleri', 'Elektrikli El Aletleri'],
      ['akulu-el-aletleri', 'Akülü El Aletleri'],
      ['baglanti-elemanlari', 'Bağlantı Elemanları'],
      ['diger-hirdavat', 'Diğer Hırdavat'],
    ]),
  ],
  [
    'fabrika-depo-ekipmanlari',
    'Fabrika ve Depo Ekipmanları',
    'adet',
    1,
    leaves('adet', 1, [
      ['raf-depolama', 'Raf ve Depolama Sistemleri'],
      ['konveyor-tasima', 'Konveyör ve Taşıma'],
      ['paletleme', 'Paletleme'],
      ['endustriyel-sogutma', 'Endüstriyel Soğutma'],
      ['endustriyel-zemin-kaplama', 'Endüstriyel Zemin ve Kaplama'],
      ['diger-fabrika-depo', 'Diğer'],
    ]),
  ],
  [
    'proje-is-ihaleleri',
    'Proje ve İş İhaleleri',
    'iş',
    1,
    leaves('iş', 1, [
      ['celik-imalat', 'Çelik İmalat'],
      ['montaj', 'Montaj'],
      ['proje-muhendislik', 'Proje ve Mühendislik'],
      ['taseronluk', 'Taşeronluk'],
      ['diger-hizmetler', 'Diğer Hizmetler'],
    ]),
  ],
];

async function upsert(
  db: Kysely<unknown>,
  [slug, name, unit, base, children]: Node,
  parentId: string | null,
  sort: number,
): Promise<void> {
  // Keyed by slug: an existing row keeps its id and unit, and is only re-parented / renamed.
  const { rows } = await sql<{ id: string }>`
    insert into categories (slug, name, unit, base_per_unit, parent_id, sort_order)
    values (${slug}, ${name}, ${unit}, ${base}, ${parentId}, ${sort})
    on conflict (slug) do update set name = excluded.name, parent_id = excluded.parent_id,
      sort_order = excluded.sort_order
    returning id
  `.execute(db);
  const id = rows[0]?.id;
  if (!id) throw new Error(`category upsert failed: ${slug}`);
  for (const [i, child] of (children ?? []).entries()) await upsert(db, child, id, i + 1);
}

export async function up(db: Kysely<unknown>): Promise<void> {
  // Service categories are sold per job ("iş").
  await sql`alter table categories drop constraint categories_unit_check`.execute(db);
  await sql`
    alter table categories add constraint categories_unit_check
    check (unit in ('ton', 'torba', 'm3', 'adet', 'palet', 'iş'))
  `.execute(db);

  // New / second-hand / scrap. Existing listings default to 'yeni'.
  await sql`
    alter table listings add column condition text not null default 'yeni'
    check (condition in ('yeni', 'ikinci_el', 'hurda'))
  `.execute(db);
  await sql`create index listings_condition_idx on listings (condition)`.execute(db);

  for (const [i, root] of TREE.entries()) await upsert(db, root, null, i + 1);
}
