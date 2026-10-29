'use client';

import { leafOptions, topOf, type Category } from '@/lib/types';
import { Field, inputCls } from './common';

/** Two-level category choice (main > sub); `value` is always a leaf category id. */
export function CategoryPicker({
  tree,
  value,
  onChange,
}: {
  tree: Category[];
  value: string;
  onChange: (id: string) => void;
}) {
  const top = topOf(tree, value) ?? tree[0];
  const subs = top ? leafOptions(top) : [];
  return (
    <>
      <Field label="Ana kategori" htmlFor="topCategory">
        <select
          id="topCategory"
          className={inputCls}
          value={top?.id ?? ''}
          onChange={(e) => {
            const next = tree.find((c) => c.id === e.target.value);
            const first = next ? leafOptions(next)[0] : undefined;
            if (first) onChange(first.id);
          }}
        >
          {tree.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Alt kategori" htmlFor="category">
        <select
          id="category"
          className={inputCls}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
          }}
        >
          {subs.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label} ({c.unit})
            </option>
          ))}
        </select>
      </Field>
    </>
  );
}

export function ConditionSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Field label="Durum" htmlFor="condition">
      <select
        id="condition"
        className={inputCls}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
        }}
      >
        <option value="yeni">Yeni</option>
        <option value="ikinci_el">İkinci el</option>
        <option value="hurda">Hurda</option>
      </select>
    </Field>
  );
}

/** Attribute line hints per main category (free-form attrs; there is no fixed schema). */
export function attrsPlaceholder(tree: Category[], categoryId: string): string {
  switch (topOf(tree, categoryId)?.slug) {
    case 'makine-ekipman':
    case 'is-makineleri':
      return 'Marka: …\nModel: …\nÜretim yılı: …\nÇalışma saati: …\nGüç: …';
    case 'hurda-geri-donusum':
      return 'Malzeme sınıfı: …\nSaflık/ayıklama: …';
    case 'proje-is-ihaleleri':
      return 'Kapsam: …\nSüre: …\nBölge: …';
    case 'el-aletleri-hirdavat':
    case 'fabrika-depo-ekipmanlari':
      return 'Marka: …\nModel: …\nGüç/Kapasite: …';
    default:
      return 'Çap: 12 mm\nKalite: B500C';
  }
}
