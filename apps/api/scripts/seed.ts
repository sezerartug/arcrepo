import { createDb } from '../src/db/client.js';
import { migrateToLatest } from '../src/db/migrate.js';
import type { Unit } from '../src/db/schema.js';
import { hashPassword } from '../src/modules/identity/index.js';
import { loadEnvFileIfExists, parseEnv } from '../src/modules/platform/index.js';

// Demo data for local runs. Safe to run repeatedly: every row is looked up by a natural key first.
loadEnvFileIfExists(new URL('../../../.env', import.meta.url));
const db = createDb(parseEnv(process.env).databaseUrl);
await migrateToLatest(db);

const ADMIN = { email: 'admin@arc.local', password: 'Admin!2345' };
const DEMO_PASSWORD = 'Demo!2345';

async function ensureUser(email: string, fullName: string, password: string, isAdmin = false) {
  const existing = await db
    .selectFrom('users')
    .select('id')
    .where('email', '=', email)
    .executeTakeFirst();
  if (existing) return existing.id;
  const row = await db
    .insertInto('users')
    .values({
      email,
      password_hash: await hashPassword(password),
      full_name: fullName,
      is_platform_admin: isAdmin,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return row.id;
}

async function ensureCompany(c: {
  legalName: string;
  taxNo: string;
  taxOffice: string;
  address: string;
  owner: [string, string];
  member: [string, string];
}) {
  let company = await db
    .selectFrom('companies')
    .select('id')
    .where('tax_no', '=', c.taxNo)
    .executeTakeFirst();
  company ??= await db
    .insertInto('companies')
    .values({
      legal_name: c.legalName,
      tax_no: c.taxNo,
      tax_office: c.taxOffice,
      address: c.address,
      status: 'verified',
      status_reason: null,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  for (const [[email, name], role] of [
    [c.owner, 'owner'],
    [c.member, 'member'],
  ] as const) {
    const userId = await ensureUser(email, name, DEMO_PASSWORD);
    await db
      .insertInto('company_members')
      .values({ company_id: company.id, user_id: userId, role })
      .onConflict((oc) => oc.doNothing())
      .execute();
  }
  return company.id;
}

async function ensureCategory(
  slug: string,
  name: string,
  unit: Unit,
  basePerUnit: number,
  parentId: string | null,
  sort: number,
) {
  const existing = await db
    .selectFrom('categories')
    .select('id')
    .where('slug', '=', slug)
    .executeTakeFirst();
  if (existing) return existing.id;
  const row = await db
    .insertInto('categories')
    .values({ slug, name, unit, base_per_unit: basePerUnit, parent_id: parentId, sort_order: sort })
    .returning('id')
    .executeTakeFirstOrThrow();
  return row.id;
}

await ensureUser(ADMIN.email, 'Platform Yöneticisi', ADMIN.password, true);

const sellers = [
  await ensureCompany({
    legalName: 'Anadolu Çelik Sanayi ve Ticaret A.Ş.',
    taxNo: '1234567801',
    taxOffice: 'Gebze',
    address: 'Gebze OSB, 700. Sokak No:12, Gebze / Kocaeli',
    owner: ['satici1@arc.local', 'Mehmet Yılmaz'],
    member: ['uye.satici1@arc.local', 'Ayşe Demir'],
  }),
  await ensureCompany({
    legalName: 'Marmara Demir Çelik Ltd. Şti.',
    taxNo: '1234567802',
    taxOffice: 'Aliağa',
    address: 'Aliağa Demir Çelik Bölgesi, Parsel 8, Aliağa / İzmir',
    owner: ['satici2@arc.local', 'Hasan Kaya'],
    member: ['uye.satici2@arc.local', 'Zeynep Arslan'],
  }),
] as const;
await ensureCompany({
  legalName: 'Yapı Merkezi İnşaat A.Ş.',
  taxNo: '1234567803',
  taxOffice: 'Kadıköy',
  address: 'Barbaros Bulvarı No:45, Beşiktaş / İstanbul',
  owner: ['alici@arc.local', 'Elif Çelik'],
  member: ['uye.alici@arc.local', 'Burak Şahin'],
});

const steel = await ensureCategory('celik', 'Çelik', 'ton', 1000, null, 1);
const cat = {
  demir: await ensureCategory('insaat-demiri', 'İnşaat demiri', 'ton', 1000, steel, 1),
  profil: await ensureCategory('profil', 'Profil', 'ton', 1000, steel, 2),
  sac: await ensureCategory('sac', 'Sac', 'ton', 1000, steel, 3),
  boru: await ensureCategory('boru', 'Boru', 'ton', 1000, steel, 4),
};
await ensureCategory('cimento', 'Çimento', 'torba', 1, null, 2);
await ensureCategory('agrega', 'Agrega', 'm3', 1000, null, 3);
await ensureCategory('tugla-blok', 'Tuğla/Blok', 'adet', 1, null, 4);
await ensureCategory('yalitim', 'Yalıtım', 'm3', 1000, null, 5);

// [seller, category, title, description, attrs, TL per ton, tons available, min order tons, location]
const listings = [
  [
    0,
    cat.demir,
    'B500C Ø12 nervürlü inşaat demiri',
    'TS 708 uygun, 12 m çubuk, fabrika sertifikalı.',
    { grade: 'B500C', diameter: 12, length: '12 m' },
    24500,
    120,
    5,
    'Gebze, Kocaeli',
  ],
  [
    0,
    cat.demir,
    'B500C Ø16 nervürlü inşaat demiri',
    'TS 708 uygun, 12 m çubuk, bağlı demet.',
    { grade: 'B500C', diameter: 16, length: '12 m' },
    24300,
    200,
    5,
    'Gebze, Kocaeli',
  ],
  [
    0,
    cat.demir,
    'B500C Ø20 nervürlü inşaat demiri',
    'Yüksek mukavemetli, 12 m çubuk.',
    { grade: 'B500C', diameter: 20, length: '12 m' },
    24200,
    150,
    10,
    'Gebze, Kocaeli',
  ],
  [
    1,
    cat.demir,
    'B500C Ø12 inşaat demiri (Aliağa çıkışlı)',
    'Hurda bazlı üretim, TS 708 uygun.',
    { grade: 'B500C', diameter: 12, length: '12 m' },
    24100,
    300,
    10,
    'Aliağa, İzmir',
  ],
  [
    1,
    cat.demir,
    'B500C Ø16 inşaat demiri (Aliağa çıkışlı)',
    'Hurda bazlı üretim, 12 m.',
    { grade: 'B500C', diameter: 16, length: '12 m' },
    23950,
    250,
    10,
    'Aliağa, İzmir',
  ],
  [
    0,
    cat.sac,
    'S235JR sıcak haddelenmiş sac 5 mm',
    '1500x6000 mm levha, EN 10025.',
    { grade: 'S235JR', thickness: '5 mm', size: '1500x6000' },
    27800,
    60,
    3,
    'Gebze, Kocaeli',
  ],
  [
    1,
    cat.sac,
    'S235JR sıcak haddelenmiş sac 8 mm',
    '2000x6000 mm levha, EN 10025.',
    { grade: 'S235JR', thickness: '8 mm', size: '2000x6000' },
    27600,
    80,
    3,
    'Aliağa, İzmir',
  ],
  [
    0,
    cat.sac,
    'S355JR sıcak haddelenmiş sac 10 mm',
    '2000x6000 mm levha, yapısal çelik.',
    { grade: 'S355JR', thickness: '10 mm', size: '2000x6000' },
    29900,
    45,
    3,
    'Gebze, Kocaeli',
  ],
  [
    1,
    cat.profil,
    'HEA 200 yapısal profil',
    'S235JR, 12 m boy, EN 10025.',
    { profile: 'HEA 200', grade: 'S235JR', length: '12 m' },
    31200,
    90,
    5,
    'Aliağa, İzmir',
  ],
  [
    0,
    cat.profil,
    'IPE 300 yapısal profil',
    'S235JR, 12 m boy.',
    { profile: 'IPE 300', grade: 'S235JR', length: '12 m' },
    30800,
    70,
    5,
    'Gebze, Kocaeli',
  ],
  [
    1,
    cat.profil,
    'IPE 200 yapısal profil',
    'S235JR, 6 m boy.',
    { profile: 'IPE 200', grade: 'S235JR', length: '6 m' },
    30500,
    55,
    3,
    'Aliağa, İzmir',
  ],
  [
    0,
    cat.boru,
    'Dikişli yapısal boru Ø114x4 mm',
    'S235JRH, 6 m boy.',
    { diameter: '114 mm', wall: '4 mm', grade: 'S235JRH' },
    33400,
    40,
    2,
    'Gebze, Kocaeli',
  ],
] as const;

let created = 0;
for (const [
  s,
  categoryId,
  title,
  description,
  attrs,
  priceTl,
  tons,
  minTons,
  location,
] of listings) {
  const companyId = sellers[s];
  const exists = await db
    .selectFrom('listings')
    .select('id')
    .where('company_id', '=', companyId)
    .where('title', '=', title)
    .executeTakeFirst();
  if (exists) continue;
  await db
    .insertInto('listings')
    .values({
      company_id: companyId,
      category_id: categoryId,
      title,
      description,
      attrs: JSON.stringify(attrs),
      sale_type: 'fixed',
      unit_price_minor: BigInt(priceTl) * 100n, // kurus per ton
      quantity_base: BigInt(tons) * 1000n, // kg
      min_order_base: BigInt(minTons) * 1000n,
      location,
      delivery_terms: 'Fabrika teslim, nakliye alıcıya aittir.',
      auction_draft: null,
      status: 'published',
      review_reason: null,
    })
    .execute();
  created += 1;
}

console.log(`seed done: ${String(created)} new listings (${String(listings.length)} defined).`);
console.log(
  `admin: ${ADMIN.email} / ${ADMIN.password} · demo users (password ${DEMO_PASSWORD}): satici1@arc.local, satici2@arc.local, alici@arc.local`,
);
await db.destroy();
